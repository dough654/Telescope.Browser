import { serviceWorkerLogger } from '../../utils/logger.js'
import type { Tab } from '../../types/shared.js'
import { storage, type WindowState, type SystemHealth } from '../storage/storage-layer.js'

export type { WindowState, SystemHealth }

export type StateChangeListener<T> = (newState: T, previousState: T) => void
export type UnsubscribeFn = () => void

export interface TabHistoryOperation {
  type: 'add' | 'remove' | 'update' | 'reorder'
  tab?: Tab
  tabId?: number
  tabs?: Tab[]
}

export interface HarpoonOperation {
  type: 'add' | 'remove' | 'update' | 'clear' | 'reorder'
  windowId: number
  tab?: Tab
  tabId?: number
  tabs?: Tab[]
}

export interface WindowStateOperation {
  type: 'create' | 'update' | 'remove' | 'focus'
  windowId: number
  state?: Partial<WindowState>
}

/**
 * Reactive state manager with atomic operations
 * Provides single source of truth for all extension state
 */
export class StateManager {
  private tabHistoryState: Tab[] = []
  private harpoonTabsState: Tab[] = [] // Legacy - for migration
  private harpoonWindowsState: Record<number, Tab[]> = {} // New per-window harpoon storage
  private windowStatesState: Record<number, WindowState> = {}
  private systemHealthState: SystemHealth = {
    version: 1,
    lastCleanup: Date.now(),
    errorCount: 0,
    lastHealthCheck: Date.now()
  }

  private tabHistoryListeners = new Set<StateChangeListener<Tab[]>>()
  private harpoonTabsListeners = new Set<StateChangeListener<Tab[]>>()
  private windowStatesListeners = new Set<StateChangeListener<Record<number, WindowState>>>()
  private systemHealthListeners = new Set<StateChangeListener<SystemHealth>>()

  private isInitialized = false

  /**
   * Initialize state manager from storage
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return
    }

    try {
      // Load all state from storage
      const tabHistory = await storage.read<Tab[]>('tabHistory') || []
      const legacyHarpoonTabs = await storage.read<Tab[]>('harpoonHistory') || []
      const harpoonWindows = await storage.read<Record<number, Tab[]>>('harpoonWindows') || {}
      const windowStates = await storage.read<Record<number, WindowState>>('windowStates') || {}
      const systemHealth = await storage.read<SystemHealth>('systemHealth') || this.systemHealthState

      // Migrate legacy harpoon data if needed
      if (legacyHarpoonTabs.length > 0 && Object.keys(harpoonWindows).length === 0) {
        serviceWorkerLogger.info('Migrating legacy harpoon data to per-window storage')
        
        // Group legacy harpoon tabs by window
        const migratedHarpoonWindows: Record<number, Tab[]> = {}
        for (const tab of legacyHarpoonTabs) {
          if (!migratedHarpoonWindows[tab.windowId]) {
            migratedHarpoonWindows[tab.windowId] = []
          }
          migratedHarpoonWindows[tab.windowId].push(tab)
        }
        
        // Save migrated data and clear legacy
        await storage.write('harpoonWindows', migratedHarpoonWindows)
        await storage.write('harpoonHistory', []) // Clear legacy data
        
        this.harpoonWindowsState = migratedHarpoonWindows
        this.harpoonTabsState = [] // Clear legacy state
        
        serviceWorkerLogger.info('Migration completed', {
          migratedWindows: Object.keys(migratedHarpoonWindows).length,
          totalMigratedTabs: legacyHarpoonTabs.length
        })
      } else {
        this.harpoonWindowsState = harpoonWindows
        this.harpoonTabsState = legacyHarpoonTabs
      }

      // Update internal state
      this.tabHistoryState = tabHistory
      this.windowStatesState = windowStates
      this.systemHealthState = systemHealth

      serviceWorkerLogger.info('State manager initialized', {
        tabHistoryCount: tabHistory.length,
        harpoonWindowsCount: Object.keys(this.harpoonWindowsState).length,
        totalHarpoonTabs: Object.values(this.harpoonWindowsState).flat().length,
        windowStatesCount: Object.keys(windowStates).length
      })

      this.isInitialized = true
    } catch (error) {
      serviceWorkerLogger.error('Failed to initialize state manager:', error)
      throw error
    }
  }

  /**
   * Get current tab history
   */
  getTabHistory(): Tab[] {
    return [...this.tabHistoryState]
  }

  /**
   * Get tab history for specific window
   */
  getTabHistoryForWindow(windowId: number): Tab[] {
    return this.tabHistoryState.filter(tab => tab.windowId === windowId)
  }

  /**
   * Subscribe to tab history changes
   */
  subscribeToTabHistory(listener: StateChangeListener<Tab[]>): UnsubscribeFn {
    this.tabHistoryListeners.add(listener)
    return () => this.tabHistoryListeners.delete(listener)
  }

  /**
   * Update tab history with atomic operation
   */
  async updateTabHistory(operation: TabHistoryOperation): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    const previousState = [...this.tabHistoryState]

    try {
      // Apply operation to get new state
      const newState = this.applyTabHistoryOperation(previousState, operation)
      
      // Validate the new state
      this.validateTabHistory(newState)
      
      // Update internal state immediately (before storage write)
      // This ensures getTabHistory* methods return updated state immediately
      this.tabHistoryState = newState
      
      // Write to storage (async, but internal state already updated)
      await storage.write('tabHistory', newState)

      // Notify listeners
      this.notifyTabHistoryListeners(this.tabHistoryState, previousState)
      
      serviceWorkerLogger.debug('Tab history updated:', operation)
    } catch (error) {
      serviceWorkerLogger.error('Failed to update tab history:', error)
      throw error
    }
  }

  /**
   * Get current harpoon tabs (legacy - returns all tabs from all windows)
   */
  getHarpoonTabs(): Tab[] {
    return Object.values(this.harpoonWindowsState).flat()
  }

  /**
   * Get harpoon tabs for specific window
   */
  getHarpoonTabsForWindow(windowId: number): Tab[] {
    return [...(this.harpoonWindowsState[windowId] || [])]
  }

  /**
   * Subscribe to harpoon tabs changes
   */
  subscribeToHarpoonTabs(listener: StateChangeListener<Tab[]>): UnsubscribeFn {
    this.harpoonTabsListeners.add(listener)
    return () => this.harpoonTabsListeners.delete(listener)
  }

  /**
   * Update harpoon tabs with atomic operation
   */
  async updateHarpoonTabs(operation: HarpoonOperation): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    const { windowId } = operation
    const previousWindowState = [...(this.harpoonWindowsState[windowId] || [])]
    const previousGlobalState = this.getHarpoonTabs()

    try {
      // Apply operation to get new window state
      const newWindowState = this.applyHarpoonOperationToWindow(previousWindowState, operation)
      
      // Validate the new state
      this.validateHarpoonTabs(newWindowState)
      
      // Update the window state in our internal storage
      const newHarpoonWindows = { ...this.harpoonWindowsState }
      if (newWindowState.length === 0) {
        delete newHarpoonWindows[windowId]
      } else {
        newHarpoonWindows[windowId] = newWindowState
      }
      
      // Update internal state immediately (before storage write)
      // This ensures getHarpoonTabs* methods return updated state immediately
      this.harpoonWindowsState = newHarpoonWindows
      
      // Write to storage (async, but internal state already updated)
      await storage.write('harpoonWindows', newHarpoonWindows)

      // Notify listeners with global state for backward compatibility
      const newGlobalState = this.getHarpoonTabs()
      this.notifyHarpoonTabsListeners(newGlobalState, previousGlobalState)
      
      serviceWorkerLogger.debug('Harpoon tabs updated for window:', windowId, operation)
    } catch (error) {
      serviceWorkerLogger.error('Failed to update harpoon tabs:', error)
      throw error
    }
  }

  /**
   * Get current window states
   */
  getWindowStates(): Record<number, WindowState> {
    return { ...this.windowStatesState }
  }

  /**
   * Get specific window state
   */
  getWindowState(windowId: number): WindowState | null {
    return this.windowStatesState[windowId] || null
  }

  /**
   * Subscribe to window states changes
   */
  subscribeToWindowStates(listener: StateChangeListener<Record<number, WindowState>>): UnsubscribeFn {
    this.windowStatesListeners.add(listener)
    return () => this.windowStatesListeners.delete(listener)
  }

  /**
   * Update window state with atomic operation
   */
  async updateWindowState(operation: WindowStateOperation): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    const previousState = { ...this.windowStatesState }

    try {
      // Apply operation to get new state
      const newState = this.applyWindowStateOperation(previousState, operation)
      
      // Write to storage
      await storage.write('windowStates', newState)
      
      // Update internal state
      this.windowStatesState = newState

      // Notify listeners
      this.notifyWindowStatesListeners(this.windowStatesState, previousState)
      
      serviceWorkerLogger.debug('Window state updated:', operation)
    } catch (error) {
      serviceWorkerLogger.error('Failed to update window state:', error)
      throw error
    }
  }

  /**
   * Get current system health
   */
  getSystemHealth(): SystemHealth {
    return { ...this.systemHealthState }
  }

  /**
   * Subscribe to system health changes
   */
  subscribeToSystemHealth(listener: StateChangeListener<SystemHealth>): UnsubscribeFn {
    this.systemHealthListeners.add(listener)
    return () => this.systemHealthListeners.delete(listener)
  }

  /**
   * Update system health
   */
  async updateSystemHealth(updates: Partial<SystemHealth>): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    const previousState = { ...this.systemHealthState }

    try {
      // Apply updates
      const newState = { ...this.systemHealthState, ...updates }
      
      // Write to storage
      await storage.write('systemHealth', newState)
      
      // Update internal state
      this.systemHealthState = newState

      // Notify listeners
      this.notifySystemHealthListeners(this.systemHealthState, previousState)
      
      serviceWorkerLogger.debug('System health updated:', updates)
    } catch (error) {
      serviceWorkerLogger.error('Failed to update system health:', error)
      throw error
    }
  }

  // NOTE: executeAtomically was removed as it was never used.
  // If you need atomic multi-write operations in the future, you can:
  // 1. Restore the transaction system from git history, or
  // 2. Implement a simpler approach using Chrome storage's batch set operations

  // Private helper methods

  private applyTabHistoryOperation(state: Tab[], operation: TabHistoryOperation): Tab[] {
    switch (operation.type) {
      case 'add':
        if (!operation.tab) throw new Error('Tab required for add operation')
        return [operation.tab, ...state.filter(t => t.id !== operation.tab!.id)]

      case 'remove':
        if (!operation.tabId) throw new Error('Tab ID required for remove operation')
        return state.filter(t => t.id !== operation.tabId)

      case 'update':
        if (!operation.tab) throw new Error('Tab required for update operation')
        return state.map(t => t.id === operation.tab!.id ? operation.tab! : t)

      case 'reorder':
        if (!operation.tabs) throw new Error('Tabs required for reorder operation')
        return [...operation.tabs]

      default:
        throw new Error(`Unknown tab history operation: ${operation.type}`)
    }
  }

  private applyHarpoonOperation(state: Tab[], operation: HarpoonOperation): Tab[] {
    switch (operation.type) {
      case 'add':
        if (!operation.tab) throw new Error('Tab required for add operation')
        return [...state.filter(t => t.id !== operation.tab!.id), operation.tab]

      case 'remove':
        if (!operation.tabId) throw new Error('Tab ID required for remove operation')
        return state.filter(t => t.id !== operation.tabId)

      case 'update':
        if (!operation.tab) throw new Error('Tab required for update operation')
        return state.map(t => t.id === operation.tab!.id ? operation.tab! : t)

      case 'clear':
        return []

      case 'reorder':
        if (!operation.tabs) throw new Error('Tabs required for reorder operation')
        return [...operation.tabs]

      default:
        throw new Error(`Unknown harpoon operation: ${operation.type}`)
    }
  }

  private applyHarpoonOperationToWindow(windowState: Tab[], operation: HarpoonOperation): Tab[] {
    // Same logic as applyHarpoonOperation but operates on a single window's harpoon state
    switch (operation.type) {
      case 'add':
        if (!operation.tab) throw new Error('Tab required for add operation')
        // Ensure the tab belongs to this window
        if (operation.tab.windowId !== operation.windowId) {
          throw new Error(`Tab window ID ${operation.tab.windowId} does not match operation window ID ${operation.windowId}`)
        }
        return [...windowState.filter(t => t.id !== operation.tab!.id), operation.tab]

      case 'remove':
        if (!operation.tabId) throw new Error('Tab ID required for remove operation')
        return windowState.filter(t => t.id !== operation.tabId)

      case 'update':
        if (!operation.tab) throw new Error('Tab required for update operation')
        if (operation.tab.windowId !== operation.windowId) {
          throw new Error(`Tab window ID ${operation.tab.windowId} does not match operation window ID ${operation.windowId}`)
        }
        return windowState.map(t => t.id === operation.tab!.id ? operation.tab! : t)

      case 'clear':
        return []

      case 'reorder':
        if (!operation.tabs) throw new Error('Tabs required for reorder operation')
        // Ensure all tabs belong to this window
        for (const tab of operation.tabs) {
          if (tab.windowId !== operation.windowId) {
            throw new Error(`Tab window ID ${tab.windowId} does not match operation window ID ${operation.windowId}`)
          }
        }
        return [...operation.tabs]

      default:
        throw new Error(`Unknown harpoon operation: ${operation.type}`)
    }
  }

  private applyWindowStateOperation(state: Record<number, WindowState>, operation: WindowStateOperation): Record<number, WindowState> {
    const newState = { ...state }

    switch (operation.type) {
      case 'create':
        if (!operation.state) throw new Error('State required for create operation')
        newState[operation.windowId] = {
          id: operation.windowId,
          focused: false,
          lastActivity: Date.now(),
          activeTabId: null,
          ...operation.state
        }
        break

      case 'update':
        if (!operation.state) throw new Error('State required for update operation')
        if (newState[operation.windowId]) {
          newState[operation.windowId] = { ...newState[operation.windowId], ...operation.state }
        }
        break

      case 'remove':
        delete newState[operation.windowId]
        break

      case 'focus':
        // Unfocus all windows
        Object.values(newState).forEach(state => state.focused = false)
        // Focus the specified window
        if (newState[operation.windowId]) {
          newState[operation.windowId].focused = true
        }
        break

      default:
        throw new Error(`Unknown window state operation: ${operation.type}`)
    }

    return newState
  }

  private validateTabHistory(tabs: Tab[]): void {
    if (!Array.isArray(tabs)) {
      throw new Error('Tab history must be an array')
    }

    for (const tab of tabs) {
      if (!tab.id || !tab.url || !tab.title || !tab.windowId) {
        throw new Error('Invalid tab in history')
      }
    }
  }

  private validateHarpoonTabs(tabs: Tab[]): void {
    if (!Array.isArray(tabs)) {
      throw new Error('Harpoon tabs must be an array')
    }

    for (const tab of tabs) {
      if (!tab.id || !tab.url || !tab.title || !tab.windowId) {
        throw new Error('Invalid tab in harpoon')
      }
    }
  }

  private notifyTabHistoryListeners(newState: Tab[], previousState: Tab[]): void {
    for (const listener of this.tabHistoryListeners) {
      try {
        listener(newState, previousState)
      } catch (error) {
        serviceWorkerLogger.error('Tab history listener error:', error)
      }
    }
  }

  private notifyHarpoonTabsListeners(newState: Tab[], previousState: Tab[]): void {
    for (const listener of this.harpoonTabsListeners) {
      try {
        listener(newState, previousState)
      } catch (error) {
        serviceWorkerLogger.error('Harpoon tabs listener error:', error)
      }
    }
  }

  private notifyWindowStatesListeners(newState: Record<number, WindowState>, previousState: Record<number, WindowState>): void {
    for (const listener of this.windowStatesListeners) {
      try {
        listener(newState, previousState)
      } catch (error) {
        serviceWorkerLogger.error('Window states listener error:', error)
      }
    }
  }

  private notifySystemHealthListeners(newState: SystemHealth, previousState: SystemHealth): void {
    for (const listener of this.systemHealthListeners) {
      try {
        listener(newState, previousState)
      } catch (error) {
        serviceWorkerLogger.error('System health listener error:', error)
      }
    }
  }

}

// Export singleton instance
export const stateManager = new StateManager()