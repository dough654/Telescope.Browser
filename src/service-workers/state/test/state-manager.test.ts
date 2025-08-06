import { describe, it, expect, beforeEach, vi } from 'vitest'
import { StateManager } from '../state-manager.js'
import type { Tab } from '../../../types/shared.js'

// Mock the storage layer
vi.mock('../../storage/storage-layer.js', () => ({
  storage: {
    read: vi.fn(),
    write: vi.fn()
  }
}))

// Mock logger
vi.mock('../../../utils/logger.js', () => ({
  serviceWorkerLogger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}))

import { storage } from '../../storage/storage-layer.js'

const createMockTab = (overrides: Partial<Tab> = {}): Tab => ({
  id: 1,
  title: 'Test Tab',
  url: 'https://example.com',
  highlightedTitle: 'Test Tab',
  highlightedUrl: 'https://example.com',
  faviconUrl: 'https://example.com/favicon.ico',
  screenshotUrl: 'https://example.com/screenshot.png',
  windowId: 1,
  ...overrides
})

describe('StateManager', () => {
  let stateManager: StateManager
  const mockStorage = storage as any

  beforeEach(() => {
    vi.clearAllMocks()
    stateManager = new StateManager()
    
    // Setup default storage responses
    mockStorage.read.mockResolvedValue(null)
    mockStorage.write.mockResolvedValue(undefined)
  })

  describe('initialization', () => {
    it('should initialize from empty storage', async () => {
      await stateManager.initialize()
      
      expect(stateManager.getTabHistory()).toEqual([])
      expect(mockStorage.read).toHaveBeenCalledWith('tabHistory')
      expect(mockStorage.read).toHaveBeenCalledWith('harpoonHistory')
      expect(mockStorage.read).toHaveBeenCalledWith('harpoonWindows')
    })

    it('should load existing tab history from storage', async () => {
      const existingTabs = [
        createMockTab({ id: 1, url: 'https://tab1.com' }),
        createMockTab({ id: 2, url: 'https://tab2.com' })
      ]
      
      mockStorage.read.mockImplementation((key: string) => {
        if (key === 'tabHistory') return Promise.resolve(existingTabs)
        return Promise.resolve(null)
      })

      await stateManager.initialize()
      
      expect(stateManager.getTabHistory()).toEqual(existingTabs)
    })

    it('should only initialize once', async () => {
      await stateManager.initialize()
      await stateManager.initialize() // Second call
      
      // Should only call storage.read once per key
      expect(mockStorage.read).toHaveBeenCalledTimes(5) // Not 10
    })

    it('should migrate legacy harpoon data to per-window storage', async () => {
      const legacyHarpoonTabs = [
        createMockTab({ id: 1, windowId: 1, url: 'https://tab1.com' }),
        createMockTab({ id: 2, windowId: 1, url: 'https://tab2.com' }),
        createMockTab({ id: 3, windowId: 2, url: 'https://tab3.com' })
      ]
      
      mockStorage.read.mockImplementation((key: string) => {
        if (key === 'harpoonHistory') return Promise.resolve(legacyHarpoonTabs)
        if (key === 'harpoonWindows') return Promise.resolve({})
        return Promise.resolve(null)
      })

      await stateManager.initialize()
      
      // Should write migrated data to new format
      expect(mockStorage.write).toHaveBeenCalledWith('harpoonWindows', {
        1: [legacyHarpoonTabs[0], legacyHarpoonTabs[1]],
        2: [legacyHarpoonTabs[2]]
      })
      
      // Should clear legacy data
      expect(mockStorage.write).toHaveBeenCalledWith('harpoonHistory', [])
    })
  })

  describe('tab history operations', () => {
    beforeEach(async () => {
      await stateManager.initialize()
    })

    it('should add tab to history', async () => {
      const tab = createMockTab({ id: 1, url: 'https://example.com' })
      
      await stateManager.updateTabHistory({
        type: 'add',
        tab
      })
      
      expect(stateManager.getTabHistory()).toEqual([tab])
      expect(mockStorage.write).toHaveBeenCalledWith('tabHistory', [tab])
    })

    it('should remove tab from history', async () => {
      const tab1 = createMockTab({ id: 1, url: 'https://tab1.com' })
      const tab2 = createMockTab({ id: 2, url: 'https://tab2.com' })
      
      // Add tabs first
      await stateManager.updateTabHistory({ type: 'add', tab: tab1 })
      await stateManager.updateTabHistory({ type: 'add', tab: tab2 })
      
      // Remove one tab
      await stateManager.updateTabHistory({
        type: 'remove',
        tabId: 1
      })
      
      const history = stateManager.getTabHistory()
      expect(history).toHaveLength(1)
      expect(history[0].id).toBe(2)
    })

    it('should get tab history for specific window', async () => {
      const tab1 = createMockTab({ id: 1, windowId: 1 })
      const tab2 = createMockTab({ id: 2, windowId: 2 })
      const tab3 = createMockTab({ id: 3, windowId: 1 })
      
      await stateManager.updateTabHistory({ type: 'add', tab: tab1 })
      await stateManager.updateTabHistory({ type: 'add', tab: tab2 })
      await stateManager.updateTabHistory({ type: 'add', tab: tab3 })
      
      const window1Tabs = stateManager.getTabHistoryForWindow(1)
      expect(window1Tabs).toEqual([tab3, tab1]) // Most recent first
    })
  })

  describe('state change listeners', () => {
    beforeEach(async () => {
      await stateManager.initialize()
    })

    it('should notify listeners of tab history changes', async () => {
      const listener = vi.fn()
      const unsubscribe = stateManager.subscribeToTabHistory(listener)
      
      const tab = createMockTab({ id: 1 })
      await stateManager.updateTabHistory({ type: 'add', tab })
      
      expect(listener).toHaveBeenCalledWith([tab], [])
      
      unsubscribe()
    })

    it('should stop notifying after unsubscribe', async () => {
      const listener = vi.fn()
      const unsubscribe = stateManager.subscribeToTabHistory(listener)
      
      unsubscribe()
      
      const tab = createMockTab({ id: 1 })
      await stateManager.updateTabHistory({ type: 'add', tab })
      
      expect(listener).not.toHaveBeenCalled()
    })
  })

  describe('error handling', () => {
    it('should handle storage read errors during initialization', async () => {
      mockStorage.read.mockRejectedValue(new Error('Storage error'))
      
      await expect(stateManager.initialize()).rejects.toThrow('Storage error')
    })

    it('should handle storage write errors during operations', async () => {
      await stateManager.initialize()
      mockStorage.write.mockRejectedValue(new Error('Write error'))
      
      const tab = createMockTab({ id: 1 })
      
      await expect(stateManager.updateTabHistory({
        type: 'add',
        tab
      })).rejects.toThrow('Write error')
    })
  })

  describe('harpoon operations', () => {
    beforeEach(async () => {
      await stateManager.initialize()
    })

    it('should handle harpoon operations for specific window', async () => {
      const tab = createMockTab({ id: 1, windowId: 1 })
      
      await stateManager.updateHarpoonTabs({
        type: 'add',
        windowId: 1,
        tab
      })
      
      const harpoonTabs = stateManager.getHarpoonTabsForWindow(1)
      expect(harpoonTabs).toEqual([tab])
    })

    it('should clear harpoon tabs for specific window', async () => {
      const tab1 = createMockTab({ id: 1, windowId: 1 })
      const tab2 = createMockTab({ id: 2, windowId: 2 })
      
      await stateManager.updateHarpoonTabs({ type: 'add', windowId: 1, tab: tab1 })
      await stateManager.updateHarpoonTabs({ type: 'add', windowId: 2, tab: tab2 })
      
      await stateManager.updateHarpoonTabs({
        type: 'clear',
        windowId: 1
      })
      
      expect(stateManager.getHarpoonTabsForWindow(1)).toEqual([])
      expect(stateManager.getHarpoonTabsForWindow(2)).toEqual([tab2])
    })
  })
})