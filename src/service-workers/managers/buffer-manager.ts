import { serviceWorkerLogger } from '../../utils/logger.js'
import type { Tab } from '../../types/shared.js'
import { stateManager, type WindowState } from '../state/state-manager.js'
import { tabManager } from './tab-manager.js'

export interface BufferNavigationState {
  previousActiveTabId: number | null
  windowId: number
}

/**
 * Buffer navigation manager - provides simple last tab switching
 * 
 * Supports:
 * - Last buffer: Switch to previously active tab (space l)
 */
export class BufferManager {
  private initializationPromise: Promise<void> | null = null
  private navigationStates = new Map<number, BufferNavigationState>()

  constructor() {
    this.setupStateListeners()
  }

  /**
   * Initialize buffer manager
   */
  async initialize(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise
    }

    this.initializationPromise = this.doInitialize()
    return this.initializationPromise
  }

  /**
   * Switch to the last active buffer (previously active tab)
   * Equivalent to "space b l" in Doom Emacs
   */
  async switchToLastBuffer(windowId: number): Promise<void> {
    try {
      serviceWorkerLogger.debug(`Switching to last buffer for window ${windowId}`)
      
      const navigationState = this.getNavigationState(windowId)
      if (!navigationState.previousActiveTabId) {
        serviceWorkerLogger.debug('No previous active tab found')
        return
      }

      // Verify the previous tab still exists
      const tabHistory = stateManager.getTabHistoryForWindow(windowId)
      const previousTab = tabHistory.find(tab => tab.id === navigationState.previousActiveTabId)
      
      if (!previousTab) {
        serviceWorkerLogger.debug(`Previous tab ${navigationState.previousActiveTabId} no longer exists`)
        // Clear the invalid previous tab ID
        navigationState.previousActiveTabId = null
        return
      }

      await tabManager.switchToTab(navigationState.previousActiveTabId)
      serviceWorkerLogger.debug(`Switched to last buffer: tab ${navigationState.previousActiveTabId}`)
      
    } catch (error) {
      serviceWorkerLogger.error('Failed to switch to last buffer:', error)
      throw error
    }
  }


  /**
   * Update the previous active tab when a tab becomes active
   */
  updatePreviousActiveTab(windowId: number, previousTabId: number | null): void {
    if (previousTabId) {
      const navigationState = this.getNavigationState(windowId)
      navigationState.previousActiveTabId = previousTabId
      serviceWorkerLogger.debug(`Updated previous active tab for window ${windowId}: ${previousTabId}`)
    }
  }

  /**
   * Get buffer navigation statistics for debugging
   */
  getNavigationStats(windowId: number): {
    hasNavigationState: boolean
    previousActiveTabId: number | null
    totalTabsInHistory: number
  } {
    const navigationState = this.navigationStates.get(windowId)
    const tabHistory = stateManager.getTabHistoryForWindow(windowId)
    
    return {
      hasNavigationState: !!navigationState,
      previousActiveTabId: navigationState?.previousActiveTabId || null,
      totalTabsInHistory: tabHistory.length
    }
  }

  // Private methods

  private async doInitialize(): Promise<void> {
    try {
      // Initialize state manager first
      await stateManager.initialize()

      // Initialize navigation states for existing windows
      const windowStates = stateManager.getWindowStates()
      for (const windowId of Object.keys(windowStates).map(Number)) {
        this.getNavigationState(windowId) // This creates the state if it doesn't exist
      }

      serviceWorkerLogger.info('Buffer manager initialized')
    } catch (error) {
      serviceWorkerLogger.error('Failed to initialize buffer manager:', error)
      throw error
    }
  }

  private setupStateListeners(): void {
    // Listen for window state changes to manage navigation states
    stateManager.subscribeToWindowStates((newStates, previousStates) => {
      this.handleWindowStatesChange(newStates, previousStates)
    })
  }

  private handleWindowStatesChange(
    newStates: Record<number, WindowState>, 
    previousStates: Record<number, WindowState>
  ): void {
    // Clean up navigation states for removed windows
    const removedWindowIds = Object.keys(previousStates)
      .map(Number)
      .filter(windowId => !newStates[windowId])

    removedWindowIds.forEach(windowId => {
      this.navigationStates.delete(windowId)
      serviceWorkerLogger.debug(`Cleaned up navigation state for removed window ${windowId}`)
    })

    // Initialize navigation states for new windows
    const newWindowIds = Object.keys(newStates)
      .map(Number)
      .filter(windowId => !previousStates[windowId])

    newWindowIds.forEach(windowId => {
      this.getNavigationState(windowId) // This creates the state
      serviceWorkerLogger.debug(`Initialized navigation state for new window ${windowId}`)
    })
  }

  private getNavigationState(windowId: number): BufferNavigationState {
    let state = this.navigationStates.get(windowId)
    if (!state) {
      state = {
        previousActiveTabId: null,
        windowId
      }
      this.navigationStates.set(windowId, state)
    }
    return state
  }

  private async getCurrentActiveTabId(windowId: number): Promise<number | null> {
    const windowState = stateManager.getWindowState(windowId)
    return windowState?.activeTabId || null
  }
}

// Export singleton instance
export const bufferManager = new BufferManager()