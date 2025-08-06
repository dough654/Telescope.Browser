import { describe, it, expect, beforeEach, vi } from 'vitest'
import { get } from 'svelte/store'
import {
  allTabs,
  harpoonTabs,
  filteredTabs,
  tabsToDisplay,
  tabCount,
  updateAllTabs,
  updateHarpoonTabs,
  updateFilteredTabs,
  removeTabOptimistically,
  clearPendingDeletions
} from '../tabs.js'
import { modalMode } from '../modal.js'
import type { Tab } from '../../types/shared.js'

// Mock the service worker bridge functions
vi.mock('../../services/service-worker-bridge.js', () => ({
  getAllTabs: vi.fn(),
  getHarpoonTabs: vi.fn(),
  getCurrentWindowId: vi.fn(),
  requestInitialSync: vi.fn()
}))

// Mock loggers
vi.mock('../../utils/logger.js', () => ({
  tabsLogger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  }
}))

describe('Tabs Store', () => {
  // Sample test data
  const sampleTabs: Tab[] = [
    {
      id: 1,
      title: 'Test Tab 1',
      highlightedTitle: 'Test Tab 1',
      url: 'https://example.com/1',
      highlightedUrl: 'https://example.com/1',
      windowId: 1,
      faviconUrl: '',
      screenshotUrl: ''
    },
    {
      id: 2,
      title: 'Test Tab 2',
      highlightedTitle: 'Test Tab 2',
      url: 'https://example.com/2',
      highlightedUrl: 'https://example.com/2',
      windowId: 1,
      faviconUrl: '',
      screenshotUrl: ''
    },
    {
      id: 3,
      title: 'Test Tab 3',
      highlightedTitle: 'Test Tab 3',
      url: 'https://example.com/3',
      highlightedUrl: 'https://example.com/3',
      windowId: 1,
      faviconUrl: '',
      screenshotUrl: ''
    }
  ]

  const sampleHarpoonTabs: Tab[] = [
    {
      id: 2,
      title: 'Test Tab 2',
      highlightedTitle: 'Test Tab 2',
      url: 'https://example.com/2',
      highlightedUrl: 'https://example.com/2',
      windowId: 1,
      faviconUrl: '',
      screenshotUrl: ''
    }
  ]

  beforeEach(() => {
    // Reset all stores
    allTabs.set([])
    harpoonTabs.set([])
    filteredTabs.set([])
    modalMode.set('tab')

    // Clear any pending deletions that might affect tests
    clearPendingDeletions()

    // Reset window.location to avoid filtering issues
    Object.defineProperty(window, 'location', {
      value: { href: 'https://test-runner.com' },
      writable: true
    })
  })

  describe('Store Updates', () => {
    it('should update all tabs correctly', () => {
      updateAllTabs(sampleTabs)

      const tabs = get(allTabs)
      expect(tabs).toHaveLength(3)
      expect(tabs[0].id).toBe(1)
      expect(tabs[1].id).toBe(2)
      expect(tabs[2].id).toBe(3)
    })

    it('should filter out chrome:// URLs when updating all tabs', () => {
      const tabsWithChrome = [
        ...sampleTabs,
        {
          id: 4,
          title: 'Chrome Settings',
          highlightedTitle: 'Chrome Settings',
          url: 'chrome://settings/',
          highlightedUrl: 'chrome://settings/',
          windowId: 1,
          faviconUrl: '',
          screenshotUrl: ''
        }
      ]

      updateAllTabs(tabsWithChrome)

      const tabs = get(allTabs)
      expect(tabs).toHaveLength(3) // Should exclude chrome:// URL
      expect(tabs.find((tab) => tab.url.includes('chrome://'))).toBeUndefined()
    })

    it('should filter out current page URL when updating all tabs', () => {
      // Mock current page URL
      Object.defineProperty(window, 'location', {
        value: { href: 'https://example.com/2' },
        writable: true
      })

      updateAllTabs(sampleTabs)

      const tabs = get(allTabs)
      expect(tabs).toHaveLength(2) // Should exclude current page
      expect(tabs.find((tab) => tab.url === 'https://example.com/2')).toBeUndefined()
    })

    it('should update harpoon tabs correctly', () => {
      updateHarpoonTabs(sampleHarpoonTabs)

      const tabs = get(harpoonTabs)
      expect(tabs).toHaveLength(1)
      expect(tabs[0].id).toBe(2)
    })

    it('should update filtered tabs correctly', () => {
      const filteredSample = sampleTabs.slice(0, 2)
      updateFilteredTabs(filteredSample)

      const tabs = get(filteredTabs)
      expect(tabs).toHaveLength(2)
      expect(tabs[0].id).toBe(1)
      expect(tabs[1].id).toBe(2)
    })
  })

  describe('Optimistic Tab Removal', () => {
    beforeEach(() => {
      // Set up initial state
      updateAllTabs(sampleTabs)
      updateHarpoonTabs(sampleHarpoonTabs)
      updateFilteredTabs(sampleTabs)
    })

    it('should remove tab from all stores optimistically', () => {
      // Verify initial state
      expect(get(allTabs)).toHaveLength(3)
      expect(get(harpoonTabs)).toHaveLength(1)
      expect(get(filteredTabs)).toHaveLength(3)

      // Remove tab with id 2 (exists in both allTabs and harpoonTabs)
      removeTabOptimistically(2)

      // Verify removal from all stores
      const allTabsAfter = get(allTabs)
      const harpoonTabsAfter = get(harpoonTabs)
      const filteredTabsAfter = get(filteredTabs)

      expect(allTabsAfter).toHaveLength(2)
      expect(allTabsAfter.find((tab) => tab.id === 2)).toBeUndefined()

      expect(harpoonTabsAfter).toHaveLength(0)
      expect(harpoonTabsAfter.find((tab) => tab.id === 2)).toBeUndefined()

      expect(filteredTabsAfter).toHaveLength(2)
      expect(filteredTabsAfter.find((tab) => tab.id === 2)).toBeUndefined()
    })

    it('should handle removing non-existent tab gracefully', () => {
      // Verify initial state
      expect(get(allTabs)).toHaveLength(3)
      expect(get(harpoonTabs)).toHaveLength(1)
      expect(get(filteredTabs)).toHaveLength(3)

      // Try to remove tab that doesn't exist
      removeTabOptimistically(999)

      // State should remain unchanged
      expect(get(allTabs)).toHaveLength(3)
      expect(get(harpoonTabs)).toHaveLength(1)
      expect(get(filteredTabs)).toHaveLength(3)
    })

    it('should remove tab only from stores where it exists', () => {
      // Remove tab that exists in allTabs and filteredTabs but not harpoonTabs
      removeTabOptimistically(1)

      const allTabsAfter = get(allTabs)
      const harpoonTabsAfter = get(harpoonTabs)
      const filteredTabsAfter = get(filteredTabs)

      expect(allTabsAfter).toHaveLength(2)
      expect(allTabsAfter.find((tab) => tab.id === 1)).toBeUndefined()

      expect(harpoonTabsAfter).toHaveLength(1) // Unchanged since tab 1 wasn't in harpoon

      expect(filteredTabsAfter).toHaveLength(2)
      expect(filteredTabsAfter.find((tab) => tab.id === 1)).toBeUndefined()
    })

    it('should preserve order of remaining tabs after removal', () => {
      removeTabOptimistically(2) // Remove middle tab

      const allTabsAfter = get(allTabs)
      expect(allTabsAfter).toHaveLength(2)
      expect(allTabsAfter[0].id).toBe(1) // First tab unchanged
      expect(allTabsAfter[1].id).toBe(3) // Third tab moved to second position
    })
  })

  describe('Derived Stores', () => {
    beforeEach(() => {
      updateAllTabs(sampleTabs)
      updateHarpoonTabs(sampleHarpoonTabs)
      updateFilteredTabs(sampleTabs)
    })

    it('should display all tabs when modal mode is "tab"', () => {
      modalMode.set('tab')

      const displayed = get(tabsToDisplay)
      expect(displayed).toHaveLength(3)
      expect(displayed).toEqual(get(allTabs))
    })

    it('should display harpoon tabs when modal mode is "harpoon"', () => {
      modalMode.set('harpoon')

      const displayed = get(tabsToDisplay)
      expect(displayed).toHaveLength(1)
      expect(displayed).toEqual(get(harpoonTabs))
    })

    it('should calculate correct tab count', () => {
      // filteredTabs has 3, tabsToDisplay (allTabs) has 3
      const count = get(tabCount)
      expect(count).toBe('3/3')
    })

    it('should update tab count after optimistic removal', () => {
      // Remove one tab optimistically
      removeTabOptimistically(2)

      const count = get(tabCount)
      expect(count).toBe('2/2') // Both filtered and displayed should be 2
    })

    it('should update tab count correctly with different modal modes', () => {
      modalMode.set('harpoon')

      // filteredTabs has 3, tabsToDisplay (harpoonTabs) has 1
      const count = get(tabCount)
      expect(count).toBe('3/1')
    })
  })

  describe('Integration with Modal Mode', () => {
    beforeEach(() => {
      updateAllTabs(sampleTabs)
      updateHarpoonTabs(sampleHarpoonTabs)
      updateFilteredTabs(sampleTabs)
    })

    it('should reflect optimistic removal in tabsToDisplay when in tab mode', () => {
      modalMode.set('tab')

      removeTabOptimistically(2)

      const displayed = get(tabsToDisplay)
      expect(displayed).toHaveLength(2)
      expect(displayed.find((tab) => tab.id === 2)).toBeUndefined()
    })

    it('should reflect optimistic removal in tabsToDisplay when in harpoon mode', () => {
      modalMode.set('harpoon')

      removeTabOptimistically(2)

      const displayed = get(tabsToDisplay)
      expect(displayed).toHaveLength(0) // Harpoon tab was removed
    })

    it('should not affect tabsToDisplay in harpoon mode when removing non-harpoon tab', () => {
      modalMode.set('harpoon')

      removeTabOptimistically(1) // Tab 1 is not in harpoon

      const displayed = get(tabsToDisplay)
      expect(displayed).toHaveLength(1) // Harpoon tabs unchanged
      expect(displayed[0].id).toBe(2)
    })
  })
})

