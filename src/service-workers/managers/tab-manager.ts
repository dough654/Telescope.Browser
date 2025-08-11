import { serviceWorkerLogger } from '../../utils/logger.js'
import type { Tab } from '../../types/shared.js'
import { stateManager } from '../state/state-manager.js'
import { messageBroker } from '../messaging/message-broker.js'
import { screenshotManager } from './screenshot-manager.js'
import { bufferManager } from './buffer-manager.js'


export interface TabValidationResult {
  valid: boolean
  errors: string[]
}


/**
 * Centralized tab lifecycle management
 */
export class TabManager {
  private initializationPromise: Promise<void> | null = null
  private tabLoadStatus = new Map<number, { url: string; complete: boolean; timestamp: number }>()
  private currentActiveTabId: number | null = null
  private tabLoadCleanupInterval: NodeJS.Timeout | null = null

  constructor() {
    this.setupEventListeners()
    this.setupCleanupInterval()
  }

  /**
   * Initialize tab manager
   */
  async initialize(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise
    }

    this.initializationPromise = this.doInitialize()
    return this.initializationPromise
  }

  /**
   * Handle tab creation
   */
  async onTabCreated(tab: chrome.tabs.Tab): Promise<void> {
    if (!this.isValidChromeTab(tab)) {
      // Tab rejected (likely no URL yet) - will be handled in onTabUpdated when URL is set
      return
    }

    try {
      serviceWorkerLogger.debug('Tab created:', tab.id)
      
      // Create telescope tab from Chrome tab
      const telescopeTab = await this.createTelescopeTab(tab)
      if (!telescopeTab) {
        return
      }

      // Add to tab history
      await stateManager.updateTabHistory({
        type: 'add',
        tab: telescopeTab
      })

      // Notify content scripts with window-specific filtering
      await this.broadcastTabUpdatesPerWindow()

    } catch (error) {
      serviceWorkerLogger.error('Failed to handle tab creation:', error)
    }
  }

  /**
   * Handle tab updates
   */
  async onTabUpdated(tabId: number, changeInfo: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab): Promise<void> {
    try {
      // Track URL changes for loading status
      if (changeInfo.url) {
        this.tabLoadStatus.set(tabId, { url: changeInfo.url, complete: false, timestamp: Date.now() })
        
        // Check if this tab is already in our history
        const existingTab = stateManager.getTabHistory().find(t => t.id === tabId)
        if (!existingTab && this.isValidChromeTab(tab)) {
          // This is a new tab that now has a URL - treat it like a new tab creation
          const telescopeTab = await this.createTelescopeTab(tab)
          if (telescopeTab) {
            await stateManager.updateTabHistory({
              type: 'add',
              tab: telescopeTab
            })
            
            await this.broadcastTabUpdatesPerWindow()
          }
        }
      }

      // Handle completion of navigation
      if (changeInfo.status === 'complete') {
        const loadStatus = this.tabLoadStatus.get(tabId)
        if (loadStatus && !loadStatus.complete) {
          loadStatus.complete = true
          loadStatus.timestamp = Date.now()
          await this.handleTabLoadComplete(tab)
        }
      }

      // Handle other tab property changes
      if (changeInfo.title || changeInfo.favIconUrl) {
        await this.handleTabPropertyChange(tab)
      }

    } catch (error) {
      serviceWorkerLogger.error('Failed to handle tab update:', error)
    }
  }

  /**
   * Handle tab activation
   */
  async onTabActivated(activeInfo: chrome.tabs.TabActiveInfo): Promise<void> {
    try {
      const previousActiveTabId = this.currentActiveTabId
      this.currentActiveTabId = activeInfo.tabId

      // Get the activated tab
      const tab = await this.getChromeTab(activeInfo.tabId)
      if (!tab) {
        return
      }

      // Update window state
      await stateManager.updateWindowState({
        type: 'update',
        windowId: activeInfo.windowId,
        state: {
          activeTabId: activeInfo.tabId,
          lastActivity: Date.now()
        }
      })

      // Update buffer manager with previous active tab for "last buffer" functionality
      bufferManager.updatePreviousActiveTab(activeInfo.windowId, previousActiveTabId)

      // Capture screenshot for the activated tab (with delay for page rendering)
      setTimeout(async () => {
        // Re-verify the tab is still active before capturing
        const currentActiveTab = await this.getActiveTab()
        if (currentActiveTab?.id === activeInfo.tabId) {
          // Additional delay to let content script settle if modal was just opened/closed
          setTimeout(async () => {
            screenshotManager.captureTabScreenshot(activeInfo.tabId).then(screenshotUrl => {
              if (screenshotUrl) {
                serviceWorkerLogger.debug(`Screenshot captured for activated tab ${activeInfo.tabId}`)
                // Update tab history with new screenshot
                this.refreshTabWithScreenshot(activeInfo.tabId).catch(error => {
                  serviceWorkerLogger.error(`Failed to refresh tab ${activeInfo.tabId} with screenshot:`, error)
                })
              }
            }).catch(error => {
              serviceWorkerLogger.error(`Failed to capture screenshot for activated tab ${activeInfo.tabId}:`, error)
            })
          }, 200) // Additional 200ms delay for content script state to settle
        } else {
          serviceWorkerLogger.debug(`Tab ${activeInfo.tabId} is no longer active, skipping delayed screenshot`)
        }
      }, 500) // 500ms delay for page rendering

      // Update tab history order (move activated tab to front)
      await this.updateTabHistoryOrder(tab, previousActiveTabId)

      // Notify content scripts with window-specific filtering
      await this.broadcastTabUpdatesPerWindow()

    } catch (error) {
      serviceWorkerLogger.error('Failed to handle tab activation:', error)
    }
  }

  /**
   * Handle tab removal
   */
  async onTabRemoved(tabId: number, removeInfo: chrome.tabs.TabRemoveInfo): Promise<void> {
    try {
      serviceWorkerLogger.debug('Tab removed:', tabId)

      // Clean up tracking
      this.tabLoadStatus.delete(tabId)
      if (this.currentActiveTabId === tabId) {
        this.currentActiveTabId = null
      }

      // Find if the tab is in harpoon and get its window ID for proper cleanup
      const allHarpoonTabs = stateManager.getHarpoonTabs()
      const harpoonTab = allHarpoonTabs.find(tab => tab.id === tabId)

      // Remove from tab history
      await stateManager.updateTabHistory({
        type: 'remove',
        tabId
      })

      // Remove from harpoon if it exists there (using per-window harpoon system)
      if (harpoonTab) {
        await stateManager.updateHarpoonTabs({
          type: 'remove',
          windowId: harpoonTab.windowId,
          tabId
        })
      }

      // Notify content scripts in the affected window only
      await messageBroker.broadcastToWindow(removeInfo.windowId, 'tabsUpdated', {
        allTabs: stateManager.getTabHistoryForWindow(removeInfo.windowId)
        // Removed harpoonTabs to avoid overriding window-scoped harpoon data
        // Harpoon updates are handled by the harpoon system via harpoonChanged messages
      })

    } catch (error) {
      serviceWorkerLogger.error('Failed to handle tab removal:', error)
    }
  }

  /**
   * Handle window creation
   */
  async onWindowCreated(window: chrome.windows.Window): Promise<void> {
    try {
      serviceWorkerLogger.debug('Window created:', window.id)

      // Create window state
      await stateManager.updateWindowState({
        type: 'create',
        windowId: window.id!,
        state: {
          focused: window.focused || false,
          lastActivity: Date.now(),
          activeTabId: null
        }
      })

    } catch (error) {
      serviceWorkerLogger.error('Failed to handle window creation:', error)
    }
  }

  /**
   * Handle window removal
   */
  async onWindowRemoved(windowId: number): Promise<void> {
    try {
      serviceWorkerLogger.debug('Window removed:', windowId)

      // Remove window state
      await stateManager.updateWindowState({
        type: 'remove',
        windowId
      })

      // Clean up tabs from this window
      await this.cleanupWindowTabs(windowId)

    } catch (error) {
      serviceWorkerLogger.error('Failed to handle window removal:', error)
    }
  }

  /**
   * Handle window focus changes
   */
  async onWindowFocusChanged(windowId: number): Promise<void> {
    if (windowId === chrome.windows.WINDOW_ID_NONE) {
      return
    }

    try {
      // Update window focus state
      await stateManager.updateWindowState({
        type: 'focus',
        windowId
      })

    } catch (error) {
      serviceWorkerLogger.error('Failed to handle window focus change:', error)
    }
  }

  /**
   * Broadcast tab updates to all windows with window-specific filtering
   */
  private async broadcastTabUpdatesPerWindow(): Promise<void> {
    try {
      // Get all windows
      const windows = await this.getAllWindows()
      
      // Send window-specific updates to each window
      const broadcastPromises = windows.map(async (window) => {
        if (window.id) {
          const windowTabs = stateManager.getTabHistoryForWindow(window.id)
          await messageBroker.broadcastToWindow(window.id, 'tabsUpdated', {
            allTabs: windowTabs
          })
        }
      })
      
      await Promise.all(broadcastPromises)
    } catch (error) {
      serviceWorkerLogger.error('Failed to broadcast tab updates per window:', error)
      // Fallback to old behavior if window-specific fails
      await messageBroker.broadcastToAllTabs('tabsUpdated', {
        allTabs: stateManager.getTabHistory()
      })
    }
  }

  /**
   * Validate and clean up invalid tabs
   */
  async cleanupInvalidTabs(): Promise<void> {
    try {
      const allTabs = stateManager.getTabHistory()
      const harpoonTabs = stateManager.getHarpoonTabs()
      
      // Validate all tabs
      const validationResults = await Promise.allSettled(
        [...allTabs, ...harpoonTabs].map(tab => this.validateTab(tab))
      )

      const invalidTabIds = new Set<number>()
      validationResults.forEach((result, index) => {
        if (result.status === 'rejected' || !result.value.valid) {
          const tab = index < allTabs.length ? allTabs[index] : harpoonTabs[index - allTabs.length]
          invalidTabIds.add(tab.id)
        }
      })

      if (invalidTabIds.size > 0) {
        serviceWorkerLogger.info(`Cleaning up ${invalidTabIds.size} invalid tabs`)

        // Remove invalid tabs
        for (const tabId of invalidTabIds) {
          // Find if the tab is in harpoon and get its window ID
          const harpoonTab = harpoonTabs.find(tab => tab.id === tabId)

          // Remove from tab history
          await stateManager.updateTabHistory({
            type: 'remove',
            tabId
          })

          // Remove from harpoon if it exists there (using per-window harpoon system)
          if (harpoonTab) {
            await stateManager.updateHarpoonTabs({
              type: 'remove',
              windowId: harpoonTab.windowId,
              tabId
            })
          }
        }

        // Notify content scripts with window-specific filtering
        await this.broadcastTabUpdatesPerWindow()
        // Also broadcast harpoon changes globally since cleanup affects all windows
        await messageBroker.broadcastToAllTabs('harpoonChanged', {})
      }

    } catch (error) {
      serviceWorkerLogger.error('Failed to cleanup invalid tabs:', error)
    }
  }

  /**
   * Validate a tab
   */
  async validateTab(tab: Tab): Promise<TabValidationResult> {
    const errors: string[] = []

    // Check required properties
    if (!tab.id) errors.push('Missing tab ID')
    if (!tab.url) errors.push('Missing tab URL')
    if (!tab.title) errors.push('Missing tab title')
    if (!tab.windowId) errors.push('Missing window ID')

    // Check if tab still exists in Chrome
    if (tab.id) {
      try {
        await this.getChromeTab(tab.id)
      } catch (error) {
        errors.push('Tab no longer exists in Chrome')
      }
    }

    // Check if window still exists
    if (tab.windowId) {
      try {
        await this.getChromeWindow(tab.windowId)
      } catch (error) {
        errors.push('Window no longer exists')
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Get tabs for specific window
   */
  async getTabsForWindow(windowId: number): Promise<Tab[]> {
    return stateManager.getTabHistoryForWindow(windowId)
  }

  /**
   * Switch to a specific tab
   */
  async switchToTab(tabId: number): Promise<void> {
    try {
      // Validate tab exists
      const tab = await this.getChromeTab(tabId)
      if (!tab) {
        throw new Error(`Tab ${tabId} not found`)
      }

      // Focus the window first
      await this.focusWindow(tab.windowId!)

      // Activate the tab
      await this.activateTab(tabId)

      serviceWorkerLogger.debug('Successfully switched to tab:', tabId)
    } catch (error) {
      serviceWorkerLogger.error('Failed to switch to tab:', error)
      throw error
    }
  }

  /**
   * Refresh a tab with its latest screenshot
   */
  async refreshTabWithScreenshot(tabId: number): Promise<void> {
    try {
      const tab = await this.getChromeTab(tabId)
      if (!tab) {
        return
      }

      const telescopeTab = await this.createTelescopeTab(tab)
      if (!telescopeTab) {
        return
      }

      // Update tab in history and harpoon if it exists there
      await stateManager.updateTabHistory({
        type: 'update',
        tab: telescopeTab
      })

      // Check if tab is in harpoon and update it there too
      const harpoonTabs = stateManager.getHarpoonTabs()
      const isInHarpoon = harpoonTabs.some(harpoonTab => harpoonTab.id === tabId)
      
      if (isInHarpoon) {
        await stateManager.updateHarpoonTabs({
          type: 'update',
          windowId: telescopeTab.windowId,
          tab: telescopeTab
        })
      }

      // Notify content scripts with window-specific filtering
      await this.broadcastTabUpdatesPerWindow()

      if (isInHarpoon) {
        await messageBroker.broadcastToAllTabs('harpoonChanged', {})
      }

    } catch (error) {
      serviceWorkerLogger.error('Failed to refresh tab with screenshot:', error)
    }
  }

  // Private methods

  private async doInitialize(): Promise<void> {
    try {
      // Initialize state manager first
      await stateManager.initialize()

      // Populate initial tab history
      await this.populateInitialTabHistory()

      serviceWorkerLogger.info('Tab manager initialized')
    } catch (error) {
      serviceWorkerLogger.error('Failed to initialize tab manager:', error)
      throw error
    }
  }

  private setupEventListeners(): void {
    chrome.tabs.onCreated.addListener(this.onTabCreated.bind(this))
    chrome.tabs.onUpdated.addListener(this.onTabUpdated.bind(this))
    chrome.tabs.onActivated.addListener(this.onTabActivated.bind(this))
    chrome.tabs.onRemoved.addListener(this.onTabRemoved.bind(this))
    chrome.windows.onCreated.addListener(this.onWindowCreated.bind(this))
    chrome.windows.onRemoved.addListener(this.onWindowRemoved.bind(this))
    chrome.windows.onFocusChanged.addListener(this.onWindowFocusChanged.bind(this))
  }

  private async populateInitialTabHistory(): Promise<void> {
    try {
      const windows = await this.getAllWindows()
      const allTabs: Tab[] = []

      for (const window of windows) {
        const tabs = await this.getTabsInWindow(window.id!)
        for (const tab of tabs) {
          const telescopeTab = await this.createTelescopeTab(tab)
          if (telescopeTab) {
            allTabs.push(telescopeTab)
          }
        }

        // Update window state
        await stateManager.updateWindowState({
          type: 'create',
          windowId: window.id!,
          state: {
            focused: window.focused || false,
            lastActivity: Date.now(),
            activeTabId: null
          }
        })
      }

      // Update tab history
      await stateManager.updateTabHistory({
        type: 'reorder',
        tabs: allTabs
      })

      serviceWorkerLogger.info(`Populated initial tab history with ${allTabs.length} tabs`)
    } catch (error) {
      serviceWorkerLogger.error('Failed to populate initial tab history:', error)
    }
  }

  private async handleTabLoadComplete(tab: chrome.tabs.Tab): Promise<void> {
    if (!this.isValidChromeTab(tab)) {
      return
    }

    // Check if this tab is currently active to capture screenshot
    const activeTab = await this.getActiveTab()
    const isCurrentlyActive = activeTab?.id === tab.id

    if (isCurrentlyActive) {
      // Capture screenshot for the completed tab (with delay for page rendering)
      setTimeout(async () => {
        // Re-verify the tab is still active before capturing
        const currentActiveTab = await this.getActiveTab()
        if (currentActiveTab?.id === tab.id) {
          screenshotManager.captureTabScreenshot(tab.id!).then(screenshotUrl => {
            if (screenshotUrl) {
              serviceWorkerLogger.debug(`Screenshot captured for completed tab ${tab.id}`)
              // Update tab history with new screenshot
              this.refreshTabWithScreenshot(tab.id!).catch(error => {
                serviceWorkerLogger.error(`Failed to refresh tab ${tab.id} with screenshot:`, error)
              })
            }
          }).catch(error => {
            serviceWorkerLogger.error(`Failed to capture screenshot for completed tab ${tab.id}:`, error)
          })
        } else {
          serviceWorkerLogger.debug(`Tab ${tab.id} is no longer active, skipping delayed screenshot`)
        }
      }, 500) // 500ms delay for page rendering
    }

    const telescopeTab = await this.createTelescopeTab(tab)
    if (!telescopeTab) {
      return
    }

    // Update tab in history
    await stateManager.updateTabHistory({
      type: 'update',
      tab: telescopeTab
    })

    // Notify content scripts with window-specific filtering
    await this.broadcastTabUpdatesPerWindow()
    // Also broadcast harpoon changes globally since harpoons are cross-window
    await messageBroker.broadcastToAllTabs('harpoonChanged', {})
  }

  private async handleTabPropertyChange(tab: chrome.tabs.Tab): Promise<void> {
    if (!this.isValidChromeTab(tab)) {
      return
    }

    const telescopeTab = await this.createTelescopeTab(tab)
    if (!telescopeTab) {
      return
    }

    // Update tab in history
    await stateManager.updateTabHistory({
      type: 'update',
      tab: telescopeTab
    })
  }

  private async updateTabHistoryOrder(activeTab: chrome.tabs.Tab, previousActiveTabId: number | null): Promise<void> {
    const telescopeTab = await this.createTelescopeTab(activeTab)
    if (!telescopeTab) {
      return
    }

    const currentHistory = stateManager.getTabHistory()
    const filteredHistory = currentHistory.filter(tab => tab.id !== telescopeTab.id)

    // If we have a previous active tab, move it to the front of filtered history
    if (previousActiveTabId) {
      const previousTabIndex = filteredHistory.findIndex(tab => tab.id === previousActiveTabId)
      if (previousTabIndex !== -1) {
        const previousTab = filteredHistory[previousTabIndex]
        filteredHistory.splice(previousTabIndex, 1)
        filteredHistory.unshift(previousTab)
      }
    }

    // Current tab goes at the very front
    const newHistory = [telescopeTab, ...filteredHistory]

    await stateManager.updateTabHistory({
      type: 'reorder',
      tabs: newHistory
    })
  }

  private async cleanupWindowTabs(windowId: number): Promise<void> {
    const tabHistory = stateManager.getTabHistory()
    const harpoonTabs = stateManager.getHarpoonTabs()

    const historyTabsToRemove = tabHistory
      .filter(tab => tab.windowId === windowId)
      .map(tab => tab.id)

    const harpoonTabsToRemove = harpoonTabs
      .filter(tab => tab.windowId === windowId)
      .map(tab => tab.id)

    // Remove from tab history
    for (const tabId of historyTabsToRemove) {
      await stateManager.updateTabHistory({
        type: 'remove',
        tabId
      })
    }

    // Remove from harpoon using per-window system
    for (const tabId of harpoonTabsToRemove) {
      await stateManager.updateHarpoonTabs({
        type: 'remove',
        windowId,
        tabId
      })
    }
  }

  private async createTelescopeTab(tab: chrome.tabs.Tab): Promise<Tab | null> {
    if (!this.isValidChromeTab(tab)) {
      return null
    }

    // Look up screenshot URL from screenshot manager
    let screenshotUrl = ''
    try {
      const screenshot = await screenshotManager.getScreenshotForUrl(tab.url!)
      screenshotUrl = screenshot || ''
    } catch (error) {
      // Screenshot lookup failed, use empty string
      screenshotUrl = ''
    }

    return {
      id: tab.id!,
      url: tab.url!,
      highlightedUrl: tab.url!,
      title: tab.title!,
      highlightedTitle: tab.title!,
      faviconUrl: tab.favIconUrl || this.generateFaviconUrl(tab.url!),
      screenshotUrl,
      windowId: tab.windowId!
    }
  }

  private generateFaviconUrl(url: string): string {
    // Using Google favicon service as fallback
    // This is used when Chrome doesn't provide a favIconUrl (e.g., for new tabs)
    const faviconUrl = new URL('https://www.google.com/s2/favicons')
    faviconUrl.searchParams.set('sz', '64')
    faviconUrl.searchParams.set('domain_url', url)
    return faviconUrl.toString()
  }

  private isValidChromeTab(tab: chrome.tabs.Tab): boolean {
    return !!(tab.id && tab.url && tab.title && tab.windowId)
  }

  private async getChromeTab(tabId: number): Promise<chrome.tabs.Tab | null> {
    return new Promise((resolve) => {
      chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError) {
          resolve(null)
        } else {
          resolve(tab)
        }
      })
    })
  }

  private async getChromeWindow(windowId: number): Promise<chrome.windows.Window | null> {
    return new Promise((resolve) => {
      chrome.windows.get(windowId, (window) => {
        if (chrome.runtime.lastError) {
          resolve(null)
        } else {
          resolve(window)
        }
      })
    })
  }

  private async getAllWindows(): Promise<chrome.windows.Window[]> {
    return new Promise((resolve) => {
      chrome.windows.getAll((windows) => {
        resolve(windows)
      })
    })
  }

  private async getTabsInWindow(windowId: number): Promise<chrome.tabs.Tab[]> {
    return new Promise((resolve) => {
      chrome.tabs.query({ windowId }, (tabs) => {
        resolve(tabs)
      })
    })
  }

  private async focusWindow(windowId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.windows.update(windowId, { focused: true }, (window) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
        } else {
          resolve()
        }
      })
    })
  }

  private async activateTab(tabId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.tabs.update(tabId, { active: true }, (tab) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
        } else {
          resolve()
        }
      })
    })
  }

  private async getActiveTab(): Promise<chrome.tabs.Tab | null> {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        resolve(tabs[0] || null)
      })
    })
  }

  /**
   * Setup cleanup interval for tab load status
   */
  private setupCleanupInterval(): void {
    // Clean up tab load status every 15 minutes
    this.tabLoadCleanupInterval = setInterval(() => {
      this.cleanupTabLoadStatus()
    }, 15 * 60 * 1000)
  }

  /**
   * Clean up old tab load status entries
   */
  private cleanupTabLoadStatus(): void {
    const cutoffTime = Date.now() - (30 * 60 * 1000) // 30 minutes old
    let removedCount = 0

    for (const [tabId, status] of this.tabLoadStatus.entries()) {
      if (status.timestamp < cutoffTime) {
        this.tabLoadStatus.delete(tabId)
        removedCount++
      }
    }

    if (removedCount > 0) {
      serviceWorkerLogger.debug(`Cleaned up ${removedCount} old tab load status entries`)
    }
  }

  /**
   * Cleanup on destruction
   */
  destroy(): void {
    if (this.tabLoadCleanupInterval) {
      clearInterval(this.tabLoadCleanupInterval)
      this.tabLoadCleanupInterval = null
    }
  }
}

// Export singleton instance
export const tabManager = new TabManager()