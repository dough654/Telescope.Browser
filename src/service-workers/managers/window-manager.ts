import { serviceWorkerLogger } from '../../utils/logger.js'
import type { Tab } from '../../types/shared.js'
import { stateManager, type WindowState } from '../state/state-manager.js'
import { messageBroker } from '../messaging/message-broker.js'

export interface WindowInfo {
  id: number
  focused: boolean
  state: string
  type: string
  tabCount: number
  lastActivity: number
}

export interface CrossWindowSyncResult {
  success: boolean
  windowsUpdated: number
  tabsUpdated: number
  errors: string[]
}

/**
 * Multi-window state management and coordination
 */
export class WindowManager {
  private focusedWindowId: number | null = null
  private windowStates = new Map<number, WindowState>()
  private initializationPromise: Promise<void> | null = null

  constructor() {
    this.setupEventListeners()
  }

  /**
   * Initialize window manager
   */
  async initialize(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise
    }

    this.initializationPromise = this.doInitialize()
    return this.initializationPromise
  }

  /**
   * Get current focused window
   */
  async getCurrentWindow(): Promise<chrome.windows.Window | null> {
    try {
      return await this.getChromeWindow(chrome.windows.WINDOW_ID_CURRENT)
    } catch (error) {
      serviceWorkerLogger.error('Failed to get current window:', error)
      return null
    }
  }

  /**
   * Get window by ID
   */
  async getWindowById(windowId: number): Promise<chrome.windows.Window | null> {
    try {
      return await this.getChromeWindow(windowId)
    } catch (error) {
      serviceWorkerLogger.error(`Failed to get window ${windowId}:`, error)
      return null
    }
  }

  /**
   * Get all windows
   */
  async getAllWindows(): Promise<chrome.windows.Window[]> {
    try {
      return await this.getAllChromeWindows()
    } catch (error) {
      serviceWorkerLogger.error('Failed to get all windows:', error)
      return []
    }
  }

  /**
   * Get tabs in specific window
   */
  async getTabsInWindow(windowId: number): Promise<Tab[]> {
    return stateManager.getTabHistoryForWindow(windowId)
  }

  /**
   * Get harpoon tabs in specific window
   */
  async getHarpoonTabsInWindow(windowId: number): Promise<Tab[]> {
    return stateManager.getHarpoonTabsForWindow(windowId)
  }

  /**
   * Focus a specific window
   */
  async focusWindow(windowId: number): Promise<void> {
    try {
      await this.focusChromeWindow(windowId)
      
      // Update window state
      await stateManager.updateWindowState({
        type: 'focus',
        windowId
      })

      this.focusedWindowId = windowId
      serviceWorkerLogger.debug(`Window ${windowId} focused`)
    } catch (error) {
      serviceWorkerLogger.error(`Failed to focus window ${windowId}:`, error)
      throw error
    }
  }

  /**
   * Get window state
   */
  getWindowState(windowId: number): WindowState | null {
    return stateManager.getWindowState(windowId)
  }

  /**
   * Get all window states
   */
  getAllWindowStates(): Record<number, WindowState> {
    return stateManager.getWindowStates()
  }

  /**
   * Update window state
   */
  async updateWindowState(windowId: number, updates: Partial<WindowState>): Promise<void> {
    try {
      await stateManager.updateWindowState({
        type: 'update',
        windowId,
        state: {
          ...updates,
          lastActivity: Date.now()
        }
      })

      serviceWorkerLogger.debug(`Window ${windowId} state updated`)
    } catch (error) {
      serviceWorkerLogger.error(`Failed to update window ${windowId} state:`, error)
      throw error
    }
  }

  /**
   * Broadcast message to specific window
   */
  async broadcastToWindow(windowId: number, type: string, payload: unknown): Promise<void> {
    try {
      await messageBroker.broadcastToWindow(windowId, type, payload)
      serviceWorkerLogger.debug(`Message broadcasted to window ${windowId}`)
    } catch (error) {
      serviceWorkerLogger.error(`Failed to broadcast to window ${windowId}:`, error)
      throw error
    }
  }

  /**
   * Broadcast message to all windows
   */
  async broadcastToAllWindows(type: string, payload: unknown): Promise<void> {
    try {
      const windows = await this.getAllWindows()
      
      for (const window of windows) {
        if (window.id) {
          await this.broadcastToWindow(window.id, type, payload)
        }
      }

      serviceWorkerLogger.debug(`Message broadcasted to ${windows.length} windows`)
    } catch (error) {
      serviceWorkerLogger.error('Failed to broadcast to all windows:', error)
      throw error
    }
  }

  /**
   * Sync state across all windows
   */
  async syncStateAcrossWindows(): Promise<CrossWindowSyncResult> {
    const result: CrossWindowSyncResult = {
      success: true,
      windowsUpdated: 0,
      tabsUpdated: 0,
      errors: []
    }

    try {
      // Get current state
      const tabHistory = stateManager.getTabHistory()
      const harpoonTabs = stateManager.getHarpoonTabs()
      const windowStates = stateManager.getWindowStates()

      // Get all windows
      const windows = await this.getAllWindows()
      
      // Update each window
      for (const window of windows) {
        if (!window.id) continue

        try {
          // Get window-specific tabs
          const windowTabs = tabHistory.filter(tab => tab.windowId === window.id)
          const windowHarpoonTabs = harpoonTabs.filter(tab => tab.windowId === window.id)

          // Broadcast updated state to this window
          await this.broadcastToWindow(window.id, 'tabsUpdated', {
            allTabs: windowTabs,
            harpoonTabs: windowHarpoonTabs,
            windowStates
          })

          result.windowsUpdated++
          result.tabsUpdated += windowTabs.length
        } catch (error) {
          result.errors.push(`Failed to sync window ${window.id}: ${error instanceof Error ? error.message : 'Unknown error'}`)
          result.success = false
        }
      }

      serviceWorkerLogger.debug('Cross-window sync completed:', result)
      return result
    } catch (error) {
      serviceWorkerLogger.error('Cross-window sync failed:', error)
      result.success = false
      result.errors.push(error instanceof Error ? error.message : 'Unknown error')
      return result
    }
  }

  /**
   * Get window information
   */
  async getWindowInfo(windowId: number): Promise<WindowInfo | null> {
    try {
      const window = await this.getChromeWindow(windowId)
      if (!window) {
        return null
      }

      const windowState = this.getWindowState(windowId)
      const tabs = await this.getTabsInWindow(windowId)

      return {
        id: window.id!,
        focused: window.focused || false,
        state: window.state || 'normal',
        type: window.type || 'normal',
        tabCount: tabs.length,
        lastActivity: windowState?.lastActivity || Date.now()
      }
    } catch (error) {
      serviceWorkerLogger.error(`Failed to get window info for ${windowId}:`, error)
      return null
    }
  }

  /**
   * Get all window information
   */
  async getAllWindowInfo(): Promise<WindowInfo[]> {
    try {
      const windows = await this.getAllWindows()
      const windowInfos: WindowInfo[] = []

      for (const window of windows) {
        if (window.id) {
          const info = await this.getWindowInfo(window.id)
          if (info) {
            windowInfos.push(info)
          }
        }
      }

      return windowInfos
    } catch (error) {
      serviceWorkerLogger.error('Failed to get all window info:', error)
      return []
    }
  }

  /**
   * Clean up closed windows
   */
  async cleanupClosedWindows(): Promise<void> {
    try {
      const currentWindows = await this.getAllWindows()
      const currentWindowIds = new Set(currentWindows.map(w => w.id).filter(id => id !== undefined))
      
      const storedWindowStates = stateManager.getWindowStates()
      const storedWindowIds = Object.keys(storedWindowStates).map(id => parseInt(id))

      // Find windows that are stored but no longer exist
      const windowsToRemove = storedWindowIds.filter(id => !currentWindowIds.has(id))

      for (const windowId of windowsToRemove) {
        await stateManager.updateWindowState({
          type: 'remove',
          windowId
        })
      }

      if (windowsToRemove.length > 0) {
        serviceWorkerLogger.info(`Cleaned up ${windowsToRemove.length} closed windows`)
      }
    } catch (error) {
      serviceWorkerLogger.error('Failed to cleanup closed windows:', error)
    }
  }

  /**
   * Handle window focus changes
   */
  async handleWindowFocus(windowId: number): Promise<void> {
    try {
      const previousFocusedWindowId = this.focusedWindowId
      this.focusedWindowId = windowId

      // Update window states
      await stateManager.updateWindowState({
        type: 'focus',
        windowId
      })

      // Notify about focus change
      await this.broadcastToWindow(windowId, 'windowFocused', {
        windowId,
        previousWindowId: previousFocusedWindowId
      })

      serviceWorkerLogger.debug(`Window focus changed to ${windowId}`)
    } catch (error) {
      serviceWorkerLogger.error('Failed to handle window focus:', error)
    }
  }

  /**
   * Get focused window ID
   */
  getFocusedWindowId(): number | null {
    return this.focusedWindowId
  }

  // Private methods

  private async doInitialize(): Promise<void> {
    try {
      // Initialize state manager first
      await stateManager.initialize()

      // Setup initial window states
      await this.setupInitialWindowStates()

      // Setup window state synchronization
      this.setupWindowStateSync()

      serviceWorkerLogger.info('Window manager initialized')
    } catch (error) {
      serviceWorkerLogger.error('Failed to initialize window manager:', error)
      throw error
    }
  }

  private setupEventListeners(): void {
    // Listen for window focus changes
    chrome.windows.onFocusChanged.addListener(async (windowId) => {
      if (windowId !== chrome.windows.WINDOW_ID_NONE) {
        await this.handleWindowFocus(windowId)
      }
    })

    // Listen for window creation
    chrome.windows.onCreated.addListener(async (window) => {
      if (window.id) {
        await this.handleWindowCreated(window)
      }
    })

    // Listen for window removal
    chrome.windows.onRemoved.addListener(async (windowId) => {
      await this.handleWindowRemoved(windowId)
    })
  }

  private async setupInitialWindowStates(): Promise<void> {
    try {
      const windows = await this.getAllWindows()
      
      for (const window of windows) {
        if (window.id) {
          await stateManager.updateWindowState({
            type: 'create',
            windowId: window.id,
            state: {
              focused: window.focused || false,
              lastActivity: Date.now(),
              activeTabId: null
            }
          })

          if (window.focused) {
            this.focusedWindowId = window.id
          }
        }
      }

      serviceWorkerLogger.debug(`Setup initial states for ${windows.length} windows`)
    } catch (error) {
      serviceWorkerLogger.error('Failed to setup initial window states:', error)
    }
  }

  private setupWindowStateSync(): void {
    // Subscribe to window state changes
    stateManager.subscribeToWindowStates((newStates, previousStates) => {
      // Handle window state changes
      this.handleWindowStateChange(newStates, previousStates)
    })
  }

  private async handleWindowStateChange(newStates: Record<number, WindowState>, previousStates: Record<number, WindowState>): Promise<void> {
    try {
      // Find windows that need updates
      const changedWindows = Object.keys(newStates)
        .map(id => parseInt(id))
        .filter(windowId => {
          const newState = newStates[windowId]
          const previousState = previousStates[windowId]
          return JSON.stringify(newState) !== JSON.stringify(previousState)
        })

      // Notify changed windows
      for (const windowId of changedWindows) {
        await this.broadcastToWindow(windowId, 'windowStateChanged', {
          windowId,
          state: newStates[windowId]
        })
      }
    } catch (error) {
      serviceWorkerLogger.error('Failed to handle window state change:', error)
    }
  }

  private async handleWindowCreated(window: chrome.windows.Window): Promise<void> {
    try {
      if (!window.id) return

      await stateManager.updateWindowState({
        type: 'create',
        windowId: window.id,
        state: {
          focused: window.focused || false,
          lastActivity: Date.now(),
          activeTabId: null
        }
      })

      serviceWorkerLogger.debug(`Window ${window.id} created`)
    } catch (error) {
      serviceWorkerLogger.error('Failed to handle window creation:', error)
    }
  }

  private async handleWindowRemoved(windowId: number): Promise<void> {
    try {
      await stateManager.updateWindowState({
        type: 'remove',
        windowId
      })

      // Update focused window if it was the removed one
      if (this.focusedWindowId === windowId) {
        this.focusedWindowId = null
      }

      serviceWorkerLogger.debug(`Window ${windowId} removed`)
    } catch (error) {
      serviceWorkerLogger.error('Failed to handle window removal:', error)
    }
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

  private async getAllChromeWindows(): Promise<chrome.windows.Window[]> {
    return new Promise((resolve) => {
      chrome.windows.getAll((windows) => {
        resolve(windows)
      })
    })
  }

  private async focusChromeWindow(windowId: number): Promise<void> {
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
}

// Export singleton instance
export const windowManager = new WindowManager()