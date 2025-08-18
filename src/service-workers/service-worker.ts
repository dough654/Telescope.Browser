import { serviceWorkerLogger } from '../utils/logger.js'
import { configureLogs } from '../utils/logging-config.js'
import type { Tab } from '../types/shared.js'

// Import all managers
import { stateManager } from './state/state-manager.js'
import { messageBroker } from './messaging/message-broker.js'
import { tabManager } from './managers/tab-manager.js'
import { windowManager } from './managers/window-manager.js'
import { screenshotManager } from './managers/screenshot-manager.js'
import { harpoonManager } from './managers/harpoon-manager.js'
import { bufferManager } from './managers/buffer-manager.js'
import { recoveryManager } from './managers/recovery-manager.js'
import { SettingsManager } from './managers/settings-manager.js'

/**
 * New service worker with modular architecture
 * Coordinates all managers and handles Chrome extension events
 */
class TelescopeServiceWorker {
  private initialized = false
  private initializationPromise: Promise<void> | null = null
  private settingsManager: SettingsManager

  constructor() {
    // Configure logging first
    configureLogs()
    
    // Initialize settings manager
    this.settingsManager = new SettingsManager()

    // Setup extension lifecycle handlers
    this.setupLifecycleHandlers()

    // Setup message handlers
    this.setupMessageHandlers()
  }

  /**
   * Initialize all managers
   */
  async initialize(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise
    }

    this.initializationPromise = this.doInitialize()
    return this.initializationPromise
  }

  /**
   * Get system health status
   */
  async getSystemHealth() {
    return await recoveryManager.checkHealth()
  }

  /**
   * Perform manual recovery
   */
  async performRecovery() {
    return await recoveryManager.recoverFromCorruption()
  }

  private async doInitialize(): Promise<void> {
    try {
      serviceWorkerLogger.info('Initializing Telescope service worker...')

      // Initialize managers in dependency order
      await stateManager.initialize()
      serviceWorkerLogger.debug('State manager initialized')

      await tabManager.initialize()
      serviceWorkerLogger.debug('Tab manager initialized')

      await windowManager.initialize()
      serviceWorkerLogger.debug('Window manager initialized')

      await screenshotManager.initialize()
      serviceWorkerLogger.debug('Screenshot manager initialized')

      await harpoonManager.initialize()
      serviceWorkerLogger.debug('Harpoon manager initialized')

      await bufferManager.initialize()
      serviceWorkerLogger.debug('Buffer manager initialized')

      await recoveryManager.initialize()
      serviceWorkerLogger.debug('Recovery manager initialized')

      // Setup cross-manager coordination
      this.setupManagerCoordination()

      this.initialized = true
      serviceWorkerLogger.info('Telescope service worker initialized successfully')
    } catch (error) {
      serviceWorkerLogger.error('Failed to initialize service worker:', error)

      // Attempt recovery
      try {
        await recoveryManager.recoverFromCorruption()
      } catch (recoveryError) {
        serviceWorkerLogger.error('Recovery failed:', recoveryError)
      }

      throw error
    }
  }

  private setupLifecycleHandlers(): void {
    // Handle extension startup
    chrome.runtime.onStartup.addListener(() => {
      serviceWorkerLogger.info('Extension startup detected')
      this.initialize()
    })

    // Handle extension installation
    chrome.runtime.onInstalled.addListener(async (details) => {
      serviceWorkerLogger.info('Extension installed/updated', details)
      await this.initialize()

      // Inject content scripts into existing tabs on first install
      console.log('Extension installed, Checking reason:', details.reason)
      if (details.reason === 'install') {
        console.log('Reason was install, injecting content scripts into existing tabs')
        await this.injectContentScriptIntoExistingTabs()
      }
    })

    // Handle service worker suspend/resume
    chrome.runtime.onSuspend.addListener(() => {
      serviceWorkerLogger.info('Service worker suspending')
      this.handleSuspend()
    })
  }

  private setupMessageHandlers(): void {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      this.handleMessage(request, sender, sendResponse)
      return true // Indicates we will respond asynchronously
    })
  }

  private async handleMessage(
    request: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ): Promise<void> {
    try {
      // Ensure we're initialized
      if (!this.initialized) {
        await this.initialize()
      }

      const response = await this.processMessage(request as Record<string, unknown>, sender)
      sendResponse(response)
    } catch (error) {
      serviceWorkerLogger.error('Message handling failed:', error)
      sendResponse({ error: error instanceof Error ? error.message : 'Unknown error' })
    }
  }

  private async processMessage(
    request: Record<string, unknown>,
    sender: chrome.runtime.MessageSender
  ): Promise<unknown> {
    const { message } = request

    switch (message) {
      case 'getHarpoonTabs':
        return this.handleGetHarpoonTabs(sender)

      case 'switchToTab':
        return this.handleSwitchToTab(request.tabId as number)

      case 'addTabToHarpoon':
        return this.handleAddTabToHarpoon(sender)

      case 'removeTabFromHarpoon':
        return this.handleRemoveTabFromHarpoon(sender)

      case 'removeTabFromHarpoonById':
        return this.handleRemoveTabFromHarpoonById(request.tabId as number)

      case 'closeTab':
        return this.handleCloseTab(request.tabId as number)

      case 'showModal':
        return this.handleShowModal(request.mode as string)

      case 'getTabScreenshotUrl':
        return this.handleGetTabScreenshotUrl(sender)
      
      // Settings-related messages
      case 'getExcludedSites':
      case 'addExcludedSite':
      case 'removeExcludedSite':
      case 'isUrlExcluded':
        return this.settingsManager.handleMessage(request, sender)

      case 'modalStateChanged':
        return this.handleModalStateChanged(request, sender)

      case 'getScreenshotForUrl':
        return this.handleGetScreenshotForUrl(request.url as string)

      case 'getCurrentWindowId':
        return this.handleGetCurrentWindowId(sender)

      case 'requestInitialSync':
        return this.handleRequestInitialSync(sender)

      case 'getSystemHealth':
        return this.handleGetSystemHealth()

      case 'performRecovery':
        return this.handlePerformRecovery()

      case 'switchToLastBuffer':
        return this.handleSwitchToLastBuffer(sender)

      default:
        serviceWorkerLogger.warn('Unknown message type:', message)
        return { error: 'Unknown message type' }
    }
  }

  private async handleGetHarpoonTabs(sender: chrome.runtime.MessageSender): Promise<Tab[]> {
    // Return harpoon tabs for the sender's window without expensive validation
    const windowId = sender.tab?.windowId
    return windowId ? stateManager.getHarpoonTabsForWindow(windowId) : stateManager.getHarpoonTabs()
  }

  private async handleSwitchToTab(tabId: number): Promise<{ message: string }> {
    try {
      // Notify the target tab that extension navigation is happening
      try {
        await new Promise<void>((resolve, reject) => {
          chrome.tabs.sendMessage(tabId, { message: 'extensionNavigating' }, (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message))
            } else {
              resolve()
            }
          })
        })
        serviceWorkerLogger.debug(`Notified tab ${tabId} of extension navigation`)
      } catch (error) {
        // Ignore errors if content script is not ready
        serviceWorkerLogger.debug(`Could not notify tab ${tabId} of extension navigation: ${error}`)
      }

      await tabManager.switchToTab(tabId)
      return { message: 'switchedToTab' }
    } catch (error) {
      serviceWorkerLogger.error('Failed to switch to tab:', error)
      throw error
    }
  }

  private async handleAddTabToHarpoon(
    sender: chrome.runtime.MessageSender
  ): Promise<{ message: string }> {
    if (!sender.tab?.id) {
      throw new Error('No tab found')
    }

    try {
      await harpoonManager.addTabToHarpoon(sender.tab.id)
      return { message: 'addedTabToHarpoon' }
    } catch (error) {
      serviceWorkerLogger.error('Failed to add tab to harpoon:', error)
      throw error
    }
  }

  private async handleRemoveTabFromHarpoon(
    sender: chrome.runtime.MessageSender
  ): Promise<{ message: string }> {
    if (!sender.tab?.id) {
      throw new Error('No tab found')
    }

    try {
      await harpoonManager.removeTabFromHarpoon(sender.tab.id)
      return { message: 'removedTabFromHarpoon' }
    } catch (error) {
      serviceWorkerLogger.error('Failed to remove tab from harpoon:', error)
      throw error
    }
  }

  private async handleRemoveTabFromHarpoonById(tabId: number): Promise<{ message: string }> {
    if (!tabId) {
      throw new Error('No tab ID provided')
    }

    try {
      await harpoonManager.removeTabFromHarpoon(tabId)
      return { message: 'removedTabFromHarpoon' }
    } catch (error) {
      serviceWorkerLogger.error('Failed to remove tab from harpoon by ID:', error)
      throw error
    }
  }

  private async handleCloseTab(tabId: number): Promise<{ message: string }> {
    if (!tabId) {
      throw new Error('No tab ID provided')
    }

    try {
      // Use Chrome's tabs API to close the tab
      await this.closeChromeTab(tabId)

      // The tab removal will be automatically handled by the onRemoved event listener
      // in the tab manager, which will clean up both tab history and harpoon tabs

      return { message: 'tabClosed' }
    } catch (error) {
      serviceWorkerLogger.error('Failed to close tab:', error)
      throw error
    }
  }

  private async handleShowModal(mode: string): Promise<{ message: string }> {
    try {
      const currentWindow = await windowManager.getCurrentWindow()
      if (!currentWindow?.id) {
        throw new Error('No current window found')
      }

      // Get active tab in current window
      const tabs = await this.getTabsInWindow(currentWindow.id)
      const activeTab = tabs.find((tab) => tab.active)

      if (activeTab?.id) {
        await messageBroker.sendMessage(activeTab.id, 'showModal', { mode })
        return { message: 'openModalSentToParent' }
      } else {
        throw new Error('No active tab found')
      }
    } catch (error) {
      serviceWorkerLogger.error('Failed to show modal:', error)
      throw error
    }
  }

  private async handleGetTabScreenshotUrl(
    sender: chrome.runtime.MessageSender
  ): Promise<string | null> {
    if (!sender.tab?.id) {
      return null
    }

    return await screenshotManager.getScreenshotForTab(sender.tab.id)
  }

  private async handleGetScreenshotForUrl(url: string): Promise<string | null> {
    if (!url) {
      return null
    }

    return await screenshotManager.getScreenshotForUrl(url)
  }

  private async handleGetCurrentWindowId(
    sender: chrome.runtime.MessageSender
  ): Promise<number | null> {
    return sender.tab?.windowId || null
  }

  private async handleRequestInitialSync(
    sender: chrome.runtime.MessageSender
  ): Promise<{ message: string; allTabs: Tab[]; harpoonTabs: Tab[]; windowId?: number }> {
    try {
      const startTime = Date.now()
      const windowId = sender.tab?.windowId
      serviceWorkerLogger.debug(
        'handleRequestInitialSync called for window:',
        windowId,
        'at:',
        startTime
      )

      const allTabs = windowId
        ? stateManager.getTabHistoryForWindow(windowId)
        : stateManager.getTabHistory()
      const harpoonTabs = windowId
        ? stateManager.getHarpoonTabsForWindow(windowId)
        : stateManager.getHarpoonTabs()

      const endTime = Date.now()
      serviceWorkerLogger.debug(
        'handleRequestInitialSync completed in:',
        endTime - startTime,
        'ms',
        {
          windowId,
          allTabsCount: allTabs.length,
          harpoonTabsCount: harpoonTabs.length
        }
      )

      return {
        message: 'initialSync',
        allTabs,
        harpoonTabs,
        windowId
      }
    } catch (error) {
      serviceWorkerLogger.error('Failed to handle initial sync:', error)
      throw error
    }
  }

  private async handleGetSystemHealth(): Promise<{
    status: string
    score: number
    recommendations: string[]
    timestamp: number
  }> {
    const health = await recoveryManager.checkHealth()
    return {
      status: health.status,
      score: health.overallScore,
      recommendations: health.recommendations,
      timestamp: health.timestamp
    }
  }

  private async handlePerformRecovery(): Promise<{ success: boolean; message: string }> {
    try {
      const success = await recoveryManager.recoverFromCorruption()
      return { success, message: success ? 'Recovery completed' : 'Recovery failed' }
    } catch (error) {
      serviceWorkerLogger.error('Recovery failed:', error)
      return { success: false, message: error instanceof Error ? error.message : 'Recovery failed' }
    }
  }

  private async handleSwitchToLastBuffer(
    sender: chrome.runtime.MessageSender
  ): Promise<{ message: string }> {
    const windowId = sender.tab?.windowId
    if (!windowId) {
      throw new Error('No window ID found')
    }

    try {
      await bufferManager.switchToLastBuffer(windowId)
      return { message: 'switchedToLastBuffer' }
    } catch (error) {
      serviceWorkerLogger.error('Failed to switch to last buffer:', error)
      throw error
    }
  }

  private setupManagerCoordination(): void {
    // Setup screenshot capture for tab events
    stateManager.subscribeToTabHistory((newTabs, previousTabs) => {
      this.handleTabHistoryChange(newTabs, previousTabs)
    })

    // Setup harpoon tab screenshot capture
    stateManager.subscribeToHarpoonTabs((newTabs, previousTabs) => {
      this.handleHarpoonTabsChange(newTabs, previousTabs)
    })

    // Setup window state synchronization
    stateManager.subscribeToWindowStates((newStates, previousStates) => {
      this.handleWindowStatesChange(newStates, previousStates)
    })
  }

  private async handleTabHistoryChange(newTabs: Tab[], previousTabs: Tab[]): Promise<void> {
    try {
      // Tab history changes are now handled by tab manager
      // Screenshot capture happens during tab activation and load completion
      serviceWorkerLogger.debug('Tab history changed')
    } catch (error) {
      serviceWorkerLogger.error('Failed to handle tab history change:', error)
    }
  }

  private async handleHarpoonTabsChange(newTabs: Tab[], previousTabs: Tab[]): Promise<void> {
    try {
      // Harpoon tab changes are now handled by harpoon manager
      // Screenshot capture happens during tab activation and load completion
      serviceWorkerLogger.debug('Harpoon tabs changed')
    } catch (error) {
      serviceWorkerLogger.error('Failed to handle harpoon tabs change:', error)
    }
  }

  private async handleWindowStatesChange(
    newStates: Record<number, unknown>,
    previousStates: Record<number, unknown>
  ): Promise<void> {
    try {
      // Handle window state changes if needed
      serviceWorkerLogger.debug('Window states changed')
    } catch (error) {
      serviceWorkerLogger.error('Failed to handle window states change:', error)
    }
  }

  private async handleModalStateChanged(
    request: Record<string, unknown>,
    sender: chrome.runtime.MessageSender
  ): Promise<{ success: boolean }> {
    try {
      const { isOpen } = request
      const tabId = sender.tab?.id

      if (tabId) {
        screenshotManager.setModalState(tabId, isOpen as boolean)
        serviceWorkerLogger.debug(
          `Modal state updated for tab ${tabId}: ${isOpen ? 'OPEN' : 'closed'}`
        )
      }

      return { success: true }
    } catch (error) {
      serviceWorkerLogger.error('Failed to handle modal state change:', error)
      return { success: false }
    }
  }

  private async handleSuspend(): Promise<void> {
    try {
      // Cleanup before suspension
      await screenshotManager.cleanupScreenshots()
      await tabManager.cleanupInvalidTabs()
      await windowManager.cleanupClosedWindows()
    } catch (error) {
      serviceWorkerLogger.error('Failed to handle suspension:', error)
    }
  }

  private async getTabsInWindow(windowId: number): Promise<chrome.tabs.Tab[]> {
    return new Promise((resolve) => {
      chrome.tabs.query({ windowId }, (tabs) => {
        resolve(tabs)
      })
    })
  }

  /**
   * Inject content script into existing tabs on installation
   */
  private async injectContentScriptIntoExistingTabs(): Promise<void> {
    try {
      // Get all tabs across all windows
      const tabs = await chrome.tabs.query({})

      // Filter tabs that can have content scripts injected
      const injectableTabs = tabs.filter(
        (tab) =>
          tab.url &&
          tab.id &&
          !tab.url.startsWith('chrome://') &&
          !tab.url.startsWith('chrome-extension://') &&
          !tab.url.startsWith('moz-extension://') &&
          !tab.url.startsWith('edge://') &&
          !tab.url.startsWith('about:') &&
          !tab.url.startsWith('file://') // Usually restricted
      )

      serviceWorkerLogger.info(
        `Injecting content script into ${injectableTabs.length} existing tabs`
      )

      // Inject content script into each tab
      for (const tab of injectableTabs) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id! },
            files: ['content-scripts/content.js']
          })
          serviceWorkerLogger.debug(`Injected content script into tab ${tab.id}: ${tab.title}`)
        } catch (error) {
          // Some tabs might not allow injection (e.g., chrome:// pages in disguise)
          // Log but don't throw - we want to continue with other tabs
          serviceWorkerLogger.debug(`Failed to inject into tab ${tab.id}: ${error}`)
        }
      }

      serviceWorkerLogger.info('Finished injecting content scripts into existing tabs')
    } catch (error) {
      serviceWorkerLogger.error('Failed to inject content scripts into existing tabs:', error)
      // Don't throw - extension should still work for new tabs
    }
  }

  private async closeChromeTab(tabId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.tabs.remove(tabId, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
        } else {
          resolve()
        }
      })
    })
  }
}

// Create and initialize the service worker
const telescopeServiceWorker = new TelescopeServiceWorker()

// Initialize on startup
telescopeServiceWorker.initialize().catch((error) => {
  serviceWorkerLogger.error('Failed to initialize service worker:', error)
})

// Export for testing
export { telescopeServiceWorker }
