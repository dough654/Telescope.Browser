import { harpoonLogger } from '../../utils/logger.js'
import type { Tab } from '../../types/shared.js'
import { stateManager } from '../state/state-manager.js'
import { messageBroker } from '../messaging/message-broker.js'
import { tabManager } from './tab-manager.js'
import { windowManager } from './window-manager.js'
import { screenshotManager } from './screenshot-manager.js'

export interface HarpoonStats {
  totalTabs: number
  windowDistribution: Record<number, number>
  oldestTab: Tab | null
  newestTab: Tab | null
  averageAge: number
}

export interface HarpoonValidationResult {
  validTabs: Tab[]
  invalidTabs: Tab[]
  removedCount: number
}

/**
 * Specialized harpoon functionality manager
 */
export class HarpoonManager {
  private maxHarpoonTabs = 20 // Maximum number of harpoon tabs
  private initializationPromise: Promise<void> | null = null

  constructor() {
    this.setupStateListeners()
  }

  /**
   * Initialize harpoon manager
   */
  async initialize(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise
    }

    this.initializationPromise = this.doInitialize()
    return this.initializationPromise
  }

  /**
   * Add tab to harpoon
   */
  async addTabToHarpoon(tabId: number): Promise<void> {
    harpoonLogger.debug(`Adding tab ${tabId} to harpoon`)
    try {
      // Get the tab from Chrome
      const chromeTab = await this.getChromeTab(tabId)
      if (!chromeTab) {
        throw new Error(`Tab ${tabId} not found`)
      }

      // Create telescope tab
      const telescopeTab = await this.createTelescopeTab(chromeTab)

      // Check if tab is already in harpoon for this window
      const windowId = telescopeTab.windowId
      const currentHarpoonTabs = stateManager.getHarpoonTabsForWindow(windowId)
      const existingIndex = currentHarpoonTabs.findIndex((tab) => tab.id === tabId)
      harpoonLogger.debug(
        `Current harpoon tabs for window ${windowId}:`,
        currentHarpoonTabs.map((t) => t.id)
      )

      if (existingIndex !== -1) {
        // Update existing tab
        await stateManager.updateHarpoonTabs({
          type: 'update',
          windowId,
          tab: telescopeTab
        })
        harpoonLogger.debug(`Updated existing harpoon tab ${tabId} in window ${windowId}`)
      } else {
        // Add new tab
        await stateManager.updateHarpoonTabs({
          type: 'add',
          windowId,
          tab: telescopeTab
        })
        harpoonLogger.debug(`Added tab ${tabId} to harpoon in window ${windowId}`)
      }

      harpoonLogger.debug(`Harpoon tabs after addition:`, stateManager.getHarpoonTabs())
      // Enforce max harpoon tabs limit for this window
      await this.enforceMaxHarpoonTabs(windowId)

      // Notify content scripts (async, don't block response)
      this.notifyHarpoonChange().catch((error) => {
        harpoonLogger.error('Failed to notify harpoon change:', error)
      })
    } catch (error) {
      harpoonLogger.error(`Failed to add tab ${tabId} to harpoon:`, error)
      throw error
    }
  }

  /**
   * Remove tab from harpoon
   */
  async removeTabFromHarpoon(tabId: number): Promise<void> {
    try {
      // Find the tab across all windows to get its window ID
      const allHarpoonTabs = stateManager.getHarpoonTabs()
      const existingTab = allHarpoonTabs.find((tab) => tab.id === tabId)

      if (!existingTab) {
        harpoonLogger.debug(`Tab ${tabId} not found in harpoon`)
        return
      }

      await stateManager.updateHarpoonTabs({
        type: 'remove',
        windowId: existingTab.windowId,
        tabId
      })

      harpoonLogger.debug(`Removed tab ${tabId} from harpoon in window ${existingTab.windowId}`)

      // Notify content scripts (async, don't block response)
      this.notifyHarpoonChange().catch((error) => {
        harpoonLogger.error('Failed to notify harpoon change:', error)
      })
    } catch (error) {
      harpoonLogger.error(`Failed to remove tab ${tabId} from harpoon:`, error)
      throw error
    }
  }

  /**
   * Get all harpoon tabs
   */
  getHarpoonTabs(): Tab[] {
    return stateManager.getHarpoonTabs()
  }

  /**
   * Get harpoon tabs for specific window
   */
  getHarpoonTabsForWindow(windowId: number): Tab[] {
    return stateManager.getHarpoonTabsForWindow(windowId)
  }

  /**
   * Get harpoon index for a tab
   */
  getHarpoonIndex(tabId: number): number | null {
    const harpoonTabs = stateManager.getHarpoonTabs()
    const index = harpoonTabs.findIndex((tab) => tab.id === tabId)
    return index >= 0 ? index : null
  }

  /**
   * Get tab at specific harpoon index
   */
  getHarpoonTabAtIndex(index: number): Tab | null {
    const harpoonTabs = stateManager.getHarpoonTabs()
    return harpoonTabs[index] || null
  }

  /**
   * Switch to harpoon tab by index
   */
  async switchToHarpoonIndex(index: number): Promise<void> {
    try {
      const harpoonTabs = stateManager.getHarpoonTabs()
      const tab = harpoonTabs[index]

      if (!tab) {
        throw new Error(`No harpoon tab at index ${index}`)
      }

      await tabManager.switchToTab(tab.id)
      harpoonLogger.debug(`Switched to harpoon tab at index ${index}`)
    } catch (error) {
      harpoonLogger.error(`Failed to switch to harpoon index ${index}:`, error)
      throw error
    }
  }

  /**
   * Check if tab is in harpoon
   */
  isTabInHarpoon(tabId: number): boolean {
    const harpoonTabs = stateManager.getHarpoonTabs()
    return harpoonTabs.some((tab) => tab.id === tabId)
  }

  /**
   * Toggle tab in harpoon
   */
  async toggleTabInHarpoon(tabId: number): Promise<boolean> {
    try {
      const isInHarpoon = this.isTabInHarpoon(tabId)

      if (isInHarpoon) {
        await this.removeTabFromHarpoon(tabId)
        return false
      } else {
        await this.addTabToHarpoon(tabId)
        return true
      }
    } catch (error) {
      harpoonLogger.error(`Failed to toggle tab ${tabId} in harpoon:`, error)
      throw error
    }
  }

  /**
   * Clear harpoon tabs for a specific window
   */
  async clearHarpoonTabs(windowId: number): Promise<void> {
    try {
      await stateManager.updateHarpoonTabs({
        type: 'clear',
        windowId
      })

      harpoonLogger.info(`Cleared harpoon tabs for window ${windowId}`)

      // Notify content scripts (async, don't block response)
      this.notifyHarpoonChange().catch((error) => {
        harpoonLogger.error('Failed to notify harpoon change:', error)
      })
    } catch (error) {
      harpoonLogger.error('Failed to clear harpoon tabs:', error)
      throw error
    }
  }

  /**
   * Clear all harpoon tabs from all windows
   */
  async clearAllHarpoonTabs(): Promise<void> {
    try {
      const allHarpoonTabs = stateManager.getHarpoonTabs()
      const windowIds = [...new Set(allHarpoonTabs.map((tab) => tab.windowId))]

      for (const windowId of windowIds) {
        await this.clearHarpoonTabs(windowId)
      }

      harpoonLogger.info('Cleared all harpoon tabs from all windows')
    } catch (error) {
      harpoonLogger.error('Failed to clear all harpoon tabs:', error)
      throw error
    }
  }

  /**
   * Validate and clean up harpoon tabs
   */
  async validateAndCleanupHarpoonTabs(): Promise<HarpoonValidationResult> {
    try {
      const harpoonTabs = stateManager.getHarpoonTabs()
      const validTabs: Tab[] = []
      const invalidTabs: Tab[] = []

      // Validate each tab
      for (const tab of harpoonTabs) {
        const validation = await tabManager.validateTab(tab)
        if (validation.valid) {
          validTabs.push(tab)
        } else {
          invalidTabs.push(tab)
          harpoonLogger.debug(`Invalid harpoon tab ${tab.id}:`, validation.errors)
        }
      }

      // Remove invalid tabs per window
      if (invalidTabs.length > 0) {
        // Group valid tabs by window
        const validTabsByWindow: Record<number, Tab[]> = {}
        for (const tab of validTabs) {
          if (!validTabsByWindow[tab.windowId]) {
            validTabsByWindow[tab.windowId] = []
          }
          validTabsByWindow[tab.windowId].push(tab)
        }

        // Group all tabs by window to know which windows to update
        const tabsByWindow: Record<number, Tab[]> = {}
        for (const tab of harpoonTabs) {
          if (!tabsByWindow[tab.windowId]) {
            tabsByWindow[tab.windowId] = []
          }
          tabsByWindow[tab.windowId].push(tab)
        }

        // Update each window's harpoon tabs
        for (const windowId of Object.keys(tabsByWindow).map(Number)) {
          const validWindowTabs = validTabsByWindow[windowId] || []
          await stateManager.updateHarpoonTabs({
            type: 'reorder',
            windowId,
            tabs: validWindowTabs
          })
        }

        harpoonLogger.info(`Removed ${invalidTabs.length} invalid harpoon tabs`)

        // Notify content scripts (async, don't block response)
        this.notifyHarpoonChange().catch((error) => {
          harpoonLogger.error('Failed to notify harpoon change:', error)
        })
      }

      return {
        validTabs,
        invalidTabs,
        removedCount: invalidTabs.length
      }
    } catch (error) {
      harpoonLogger.error('Failed to validate harpoon tabs:', error)
      throw error
    }
  }

  /**
   * Reorder harpoon tabs for a specific window
   */
  async reorderHarpoonTabs(windowId: number, tabs: Tab[]): Promise<void> {
    try {
      // Validate all tabs are in harpoon for this window
      const currentHarpoonTabs = stateManager.getHarpoonTabsForWindow(windowId)
      const currentIds = new Set(currentHarpoonTabs.map((tab) => tab.id))

      for (const tab of tabs) {
        if (!currentIds.has(tab.id)) {
          throw new Error(`Tab ${tab.id} is not in harpoon for window ${windowId}`)
        }
        if (tab.windowId !== windowId) {
          throw new Error(`Tab ${tab.id} does not belong to window ${windowId}`)
        }
      }

      await stateManager.updateHarpoonTabs({
        type: 'reorder',
        windowId,
        tabs
      })

      harpoonLogger.debug(`Reordered harpoon tabs for window ${windowId}`)

      // Notify content scripts (async, don't block response)
      this.notifyHarpoonChange().catch((error) => {
        harpoonLogger.error('Failed to notify harpoon change:', error)
      })
    } catch (error) {
      harpoonLogger.error('Failed to reorder harpoon tabs:', error)
      throw error
    }
  }

  /**
   * Get harpoon statistics
   */
  getHarpoonStats(): HarpoonStats {
    const harpoonTabs = stateManager.getHarpoonTabs()

    // Calculate window distribution
    const windowDistribution: Record<number, number> = {}
    for (const tab of harpoonTabs) {
      windowDistribution[tab.windowId] = (windowDistribution[tab.windowId] || 0) + 1
    }

    // Find oldest and newest tabs (assuming tab IDs are chronological)
    let oldestTab: Tab | null = null
    let newestTab: Tab | null = null
    let totalAge = 0

    for (const tab of harpoonTabs) {
      if (!oldestTab || tab.id < oldestTab.id) {
        oldestTab = tab
      }
      if (!newestTab || tab.id > newestTab.id) {
        newestTab = tab
      }
      totalAge += tab.id
    }

    const averageAge = harpoonTabs.length > 0 ? totalAge / harpoonTabs.length : 0

    return {
      totalTabs: harpoonTabs.length,
      windowDistribution,
      oldestTab,
      newestTab,
      averageAge
    }
  }

  /**
   * Export harpoon tabs
   */
  exportHarpoonTabs(): {
    tabs: Tab[]
    exportedAt: number
    version: number
  } {
    return {
      tabs: stateManager.getHarpoonTabs(),
      exportedAt: Date.now(),
      version: 1
    }
  }

  /**
   * Import harpoon tabs
   */
  async importHarpoonTabs(data: {
    tabs: Tab[]
    exportedAt: number
    version: number
  }): Promise<void> {
    try {
      // Validate import data
      if (!Array.isArray(data.tabs)) {
        throw new Error('Invalid import data: tabs must be an array')
      }

      // Validate each tab
      for (const tab of data.tabs) {
        if (!tab.id || !tab.url || !tab.title || !tab.windowId) {
          throw new Error(`Invalid tab data: ${JSON.stringify(tab)}`)
        }
      }

      // Clear existing harpoon tabs
      await this.clearAllHarpoonTabs()

      // Add imported tabs
      for (const tab of data.tabs) {
        try {
          await this.addTabToHarpoon(tab.id)
        } catch (error) {
          harpoonLogger.warn(`Failed to import tab ${tab.id}:`, error)
        }
      }

      harpoonLogger.info(`Imported ${data.tabs.length} harpoon tabs`)
    } catch (error) {
      harpoonLogger.error('Failed to import harpoon tabs:', error)
      throw error
    }
  }

  /**
   * Set maximum number of harpoon tabs
   */
  setMaxHarpoonTabs(max: number): void {
    if (max > 0) {
      this.maxHarpoonTabs = max
      harpoonLogger.debug(`Max harpoon tabs set to ${max}`)

      // Enforce the new limit for all windows
      this.enforceMaxHarpoonTabsForAllWindows()
    } else {
      harpoonLogger.warn(`Invalid max harpoon tabs: ${max}. Must be greater than 0`)
    }
  }

  /**
   * Get maximum number of harpoon tabs
   */
  getMaxHarpoonTabs(): number {
    return this.maxHarpoonTabs
  }

  // Private methods

  private async doInitialize(): Promise<void> {
    try {
      // Initialize state manager first
      await stateManager.initialize()

      // Validate existing harpoon tabs
      await this.validateAndCleanupHarpoonTabs()

      harpoonLogger.info('Harpoon manager initialized')
    } catch (error) {
      harpoonLogger.error('Failed to initialize harpoon manager:', error)
      throw error
    }
  }

  private setupStateListeners(): void {
    // Listen for harpoon tab changes
    stateManager.subscribeToHarpoonTabs((newTabs, previousTabs) => {
      this.handleHarpoonTabsChange(newTabs, previousTabs)
    })
  }

  private async handleHarpoonTabsChange(newTabs: Tab[], previousTabs: Tab[]): Promise<void> {
    try {
      // Log the change
      const added = newTabs.filter((tab) => !previousTabs.find((prev) => prev.id === tab.id))
      const removed = previousTabs.filter(
        (tab) => !newTabs.find((current) => current.id === tab.id)
      )

      if (added.length > 0) {
        harpoonLogger.debug(
          `Added ${added.length} harpoon tabs:`,
          added.map((t) => t.id)
        )
      }

      if (removed.length > 0) {
        harpoonLogger.debug(
          `Removed ${removed.length} harpoon tabs:`,
          removed.map((t) => t.id)
        )
      }

      // Update system health
      await stateManager.updateSystemHealth({
        lastHealthCheck: Date.now()
      })
    } catch (error) {
      harpoonLogger.error('Failed to handle harpoon tabs change:', error)
    }
  }

  private async enforceMaxHarpoonTabs(windowId: number): Promise<void> {
    try {
      harpoonLogger.debug(`Enforcing max harpoon tabs for window ${windowId}`)
      const harpoonTabs = stateManager.getHarpoonTabsForWindow(windowId)
      harpoonLogger.debug(
        `Current harpoon tabs for window ${windowId}:`,
        harpoonTabs.map((t) => t.id)
      )

      if (harpoonTabs.length > this.maxHarpoonTabs) {
        harpoonLogger.info(`Enforcing max harpoon tabs limit for window ${windowId}`)
        // Remove oldest tabs (assuming newer tab IDs are larger)
        const sortedTabs = harpoonTabs.sort((a, b) => b.id - a.id)
        const tabsToKeep = sortedTabs.slice(0, this.maxHarpoonTabs)

        await stateManager.updateHarpoonTabs({
          type: 'reorder',
          windowId,
          tabs: tabsToKeep
        })

        const removedCount = harpoonTabs.length - this.maxHarpoonTabs
        harpoonLogger.info(
          `Removed ${removedCount} oldest harpoon tabs to enforce limit in window ${windowId}`
        )
      }
    } catch (error) {
      harpoonLogger.error('Failed to enforce max harpoon tabs:', error)
    }
  }

  private async enforceMaxHarpoonTabsForAllWindows(): Promise<void> {
    try {
      const allHarpoonTabs = stateManager.getHarpoonTabs()
      const windowIds = [...new Set(allHarpoonTabs.map((tab) => tab.windowId))]

      for (const windowId of windowIds) {
        await this.enforceMaxHarpoonTabs(windowId)
      }
    } catch (error) {
      harpoonLogger.error('Failed to enforce max harpoon tabs for all windows:', error)
    }
  }

  private async notifyHarpoonChange(): Promise<void> {
    try {
      const notifyTime = Date.now()
      harpoonLogger.debug('notifyHarpoonChange called at:', notifyTime)

      // Since we now have per-window isolation, we need to send window-specific data
      // The service worker message handlers already handle this correctly by using
      // getTabHistoryForWindow() and getHarpoonTabsForWindow() based on sender.tab.windowId

      // Just broadcast a simple notification - the content scripts will request fresh data
      await messageBroker.broadcastToAllTabs('harpoonChanged', {})

      const broadcastTime = Date.now()
      harpoonLogger.debug(
        'harpoonChanged broadcast completed in:',
        broadcastTime - notifyTime,
        'ms'
      )
    } catch (error) {
      harpoonLogger.error('Failed to notify harpoon change:', error)
    }
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

  private async createTelescopeTab(tab: chrome.tabs.Tab): Promise<Tab> {
    if (!tab.id || !tab.url || !tab.title || !tab.windowId) {
      throw new Error('Invalid Chrome tab data')
    }

    // Look up screenshot URL from screenshot manager
    let screenshotUrl = ''
    try {
      const screenshot = await screenshotManager.getScreenshotForUrl(tab.url)
      screenshotUrl = screenshot || ''
    } catch (error) {
      // Screenshot lookup failed, use empty string
      screenshotUrl = ''
    }

    return {
      id: tab.id,
      url: tab.url,
      highlightedUrl: tab.url,
      title: tab.title,
      highlightedTitle: tab.title,
      faviconUrl: this.generateFaviconUrl(tab.url),
      screenshotUrl,
      windowId: tab.windowId
    }
  }

  private generateFaviconUrl(url: string): string {
    // Using Google favicon service
    const faviconUrl = new URL('https://www.google.com/s2/favicons')
    faviconUrl.searchParams.set('sz', '64')
    faviconUrl.searchParams.set('domain_url', url)
    return faviconUrl.toString()
  }
}

// Export singleton instance
export const harpoonManager = new HarpoonManager()

