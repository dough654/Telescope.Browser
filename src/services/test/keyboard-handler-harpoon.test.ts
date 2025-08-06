import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest'
import { get } from 'svelte/store'

// Mock all external dependencies
vi.mock('../../utils/html-utils.js', () => ({
  targetIsText: vi.fn(() => false),
  isRunningInIFrame: vi.fn(() => false)
}))

vi.mock('../../services/service-worker-bridge.js', () => ({
  addTabToHarpoon: vi.fn(() => Promise.resolve({ message: 'addedTabToHarpoon' })),
  removeTabFromHarpoon: vi.fn(() => Promise.resolve()),
  removeTabFromHarpoonById: vi.fn(() => Promise.resolve()),
  getHarpoonTabs: vi.fn(() => Promise.resolve([])),
  sendOpenModalFromIFrame: vi.fn(() => Promise.resolve()),
  switchToTab: vi.fn(() => Promise.resolve()),
  closeTab: vi.fn(() => Promise.resolve())
}))

vi.mock('../../stores/harpoon-indicator.js', () => ({
  showHarpoonIndicatorLoading: vi.fn(),
  updateHarpoonIndicator: vi.fn(),
  hideHarpoonIndicator: vi.fn()
}))

vi.mock('../../stores/harpoon-flash.js', () => ({
  triggerBorderFlash: vi.fn()
}))

vi.mock('../../stores/keyboard.js', () => ({
  keyBuffer: {
    subscribe: vi.fn((callback) => {
      callback([])
      return { unsubscribe: vi.fn() }
    }),
    set: vi.fn(),
    update: vi.fn()
  },
  addKeyToBuffer: vi.fn(),
  clearKeyBuffer: vi.fn(),
  checkModalTrigger: vi.fn(() => null),
  checkEscapeSequence: vi.fn(() => false),
  checkHarpoonAdd: vi.fn(() => false),
  checkHarpoonRemove: vi.fn(() => false),
  checkHarpoonSwitch: vi.fn(() => null),
  checkDeleteSequence: vi.fn(() => false),
  checkSubmenuInvalidation: vi.fn(() => false),
  getHarpoonSubmenuHints: vi.fn(() => []),
  harpoonSubmenuActive: {
    subscribe: vi.fn((callback) => {
      callback(false)
      return { unsubscribe: vi.fn() }
    })
  },
  activateHarpoonSubmenu: vi.fn(),
  clearHarpoonSubmenu: vi.fn(),
  checkLastTab: vi.fn(() => false)
}))

vi.mock('../../stores/modal.js', () => ({
  isModalOpen: {
    subscribe: vi.fn((callback) => {
      callback(false) // Default to closed
      return { unsubscribe: vi.fn() }
    })
  },
  inputMode: {
    subscribe: vi.fn((callback) => {
      callback('normal')
      return { unsubscribe: vi.fn() }
    })
  },
  selectedTabIndex: {
    subscribe: vi.fn((callback) => {
      callback(0)
      return { unsubscribe: vi.fn() }
    })
  },
  modalMode: {
    subscribe: vi.fn((callback) => {
      callback('tab')
      return { unsubscribe: vi.fn() }
    })
  },
  openModal: vi.fn(),
  closeModal: vi.fn(),
  switchToNormalMode: vi.fn(),
  switchToInsertMode: vi.fn(),
  switchToVisualMode: vi.fn(),
  setSelectedTab: vi.fn()
}))

vi.mock('../../stores/search.js', () => ({
  filteredTabsFromSearch: {
    subscribe: vi.fn((callback) => {
      callback([])
      return { unsubscribe: vi.fn() }
    })
  }
}))

vi.mock('../../stores/tabs.js', () => ({
  updateHarpoonTabs: vi.fn(),
  removeTabOptimistically: vi.fn()
}))

vi.mock('../../stores/which-key.js', () => ({
  scheduleWhichKey: vi.fn(),
  hideWhichKey: vi.fn(),
  isWhichKeyVisible: {
    subscribe: vi.fn((callback) => {
      callback(false)
      return { unsubscribe: vi.fn() }
    })
  },
  showWhichKey: vi.fn()
}))

vi.mock('../../stores/loading.js', () => ({
  showTabSwitchLoading: vi.fn(),
  hideLoading: vi.fn()
}))

vi.mock('../../stores/visual-selection.js', () => ({
  startVisualSelection: vi.fn(),
  clearVisualSelection: vi.fn(),
  updateVisualCursor: vi.fn(),
  visualSelectionIndices: {
    subscribe: vi.fn((callback) => {
      callback([])
      return { unsubscribe: vi.fn() }
    })
  }
}))

// Mock logger
vi.mock('../../utils/logger.js', () => ({
  keyboardLogger: { debug: vi.fn(), error: vi.fn() },
  harpoonLogger: { debug: vi.fn(), error: vi.fn(), warn: vi.fn() }
}))

// Import the module after mocks are set up
import { setupKeyboardHandler } from '../keyboard-handler.js'
import * as serviceWorkerBridge from '../../services/service-worker-bridge.js'
import * as harpoonIndicator from '../../stores/harpoon-indicator.js'
import * as harpoonFlash from '../../stores/harpoon-flash.js'
import * as keyboard from '../../stores/keyboard.js'

describe('Keyboard Handler - Harpoon Operations', () => {
  let mockAddTabToHarpoon: MockedFunction<any>
  let mockShowHarpoonIndicatorLoading: MockedFunction<any>
  let mockUpdateHarpoonIndicator: MockedFunction<any>
  let mockHideHarpoonIndicator: MockedFunction<any>
  let mockTriggerBorderFlash: MockedFunction<any>
  let mockCheckHarpoonAdd: MockedFunction<any>
  let mockClearKeyBuffer: MockedFunction<any>

  beforeEach(() => {
    vi.clearAllMocks()

    // Get references to mocked functions
    mockAddTabToHarpoon = vi.mocked(serviceWorkerBridge.addTabToHarpoon)
    mockShowHarpoonIndicatorLoading = vi.mocked(harpoonIndicator.showHarpoonIndicatorLoading)
    mockUpdateHarpoonIndicator = vi.mocked(harpoonIndicator.updateHarpoonIndicator)
    mockHideHarpoonIndicator = vi.mocked(harpoonIndicator.hideHarpoonIndicator)
    mockTriggerBorderFlash = vi.mocked(harpoonFlash.triggerBorderFlash)
    mockCheckHarpoonAdd = vi.mocked(keyboard.checkHarpoonAdd)
    mockClearKeyBuffer = vi.mocked(keyboard.clearKeyBuffer)

    // Reset DOM
    document.body.innerHTML = ''

    // Setup keyboard handler
    setupKeyboardHandler()
  })

  describe('Harpoon Add Operation', () => {
    it('should show loading indicator and update with index on success', async () => {
      // Mock the service response with harpoon index
      const mockResponse = { message: 'addedTabToHarpoon', harpoonIndex: 2 }
      mockAddTabToHarpoon.mockResolvedValue(mockResponse)

      // Mock harpoon add detection
      mockCheckHarpoonAdd.mockReturnValue(true)

      // Create and dispatch keyboard event
      const event = new KeyboardEvent('keydown', { key: 'a' })
      document.dispatchEvent(event)

      // Should show loading immediately
      expect(mockShowHarpoonIndicatorLoading).toHaveBeenCalled()
      expect(mockTriggerBorderFlash).toHaveBeenCalled()
      expect(mockClearKeyBuffer).toHaveBeenCalled()

      // Wait for promise to resolve
      await vi.waitFor(() => {
        expect(mockAddTabToHarpoon).toHaveBeenCalled()
      })

      // Should update indicator with the index from response
      await vi.waitFor(() => {
        expect(mockUpdateHarpoonIndicator).toHaveBeenCalledWith(2)
      })

      // Should not hide indicator on success
      expect(mockHideHarpoonIndicator).not.toHaveBeenCalled()
    })

    it('should handle response without harpoon index', async () => {
      // Mock response without harpoonIndex
      const mockResponse = { message: 'addedTabToHarpoon' }
      mockAddTabToHarpoon.mockResolvedValue(mockResponse)

      mockCheckHarpoonAdd.mockReturnValue(true)

      const event = new KeyboardEvent('keydown', { key: 'a' })
      document.dispatchEvent(event)

      // Should show loading
      expect(mockShowHarpoonIndicatorLoading).toHaveBeenCalled()

      // Wait for promise to resolve
      await vi.waitFor(() => {
        expect(mockAddTabToHarpoon).toHaveBeenCalled()
      })

      // Should not update indicator (no valid index)
      expect(mockUpdateHarpoonIndicator).not.toHaveBeenCalled()
      expect(mockHideHarpoonIndicator).not.toHaveBeenCalled()
    })

    it('should handle response with invalid harpoon index', async () => {
      // Mock response with invalid index
      const mockResponse = { message: 'addedTabToHarpoon', harpoonIndex: -1 }
      mockAddTabToHarpoon.mockResolvedValue(mockResponse)

      mockCheckHarpoonAdd.mockReturnValue(true)

      const event = new KeyboardEvent('keydown', { key: 'a' })
      document.dispatchEvent(event)

      await vi.waitFor(() => {
        expect(mockAddTabToHarpoon).toHaveBeenCalled()
      })

      // Should not update indicator with invalid index
      expect(mockUpdateHarpoonIndicator).not.toHaveBeenCalled()
    })

    it('should hide indicator on error', async () => {
      // Mock error response
      mockAddTabToHarpoon.mockRejectedValue(new Error('Failed to add'))

      mockCheckHarpoonAdd.mockReturnValue(true)

      const event = new KeyboardEvent('keydown', { key: 'a' })
      document.dispatchEvent(event)

      // Should show loading
      expect(mockShowHarpoonIndicatorLoading).toHaveBeenCalled()

      // Wait for promise to reject
      await vi.waitFor(() => {
        expect(mockAddTabToHarpoon).toHaveBeenCalled()
      })

      // Should hide indicator on error
      await vi.waitFor(() => {
        expect(mockHideHarpoonIndicator).toHaveBeenCalled()
      })
    })

    it('should handle zero as valid harpoon index', async () => {
      // Mock response with index 0 (first position)
      const mockResponse = { message: 'addedTabToHarpoon', harpoonIndex: 0 }
      mockAddTabToHarpoon.mockResolvedValue(mockResponse)

      mockCheckHarpoonAdd.mockReturnValue(true)

      const event = new KeyboardEvent('keydown', { key: 'a' })
      document.dispatchEvent(event)

      await vi.waitFor(() => {
        expect(mockAddTabToHarpoon).toHaveBeenCalled()
      })

      // Should update indicator with index 0
      await vi.waitFor(() => {
        expect(mockUpdateHarpoonIndicator).toHaveBeenCalledWith(0)
      })
    })
  })

  describe('Edge Cases', () => {
    it('should handle null response gracefully', async () => {
      mockAddTabToHarpoon.mockResolvedValue(null)

      mockCheckHarpoonAdd.mockReturnValue(true)

      const event = new KeyboardEvent('keydown', { key: 'a' })
      document.dispatchEvent(event)

      await vi.waitFor(() => {
        expect(mockAddTabToHarpoon).toHaveBeenCalled()
      })

      // Should not crash or update indicator
      expect(mockUpdateHarpoonIndicator).not.toHaveBeenCalled()
      expect(mockHideHarpoonIndicator).not.toHaveBeenCalled()
    })

    it('should handle response with non-numeric harpoonIndex', async () => {
      const mockResponse = { message: 'addedTabToHarpoon', harpoonIndex: 'invalid' }
      mockAddTabToHarpoon.mockResolvedValue(mockResponse)

      mockCheckHarpoonAdd.mockReturnValue(true)

      const event = new KeyboardEvent('keydown', { key: 'a' })
      document.dispatchEvent(event)

      await vi.waitFor(() => {
        expect(mockAddTabToHarpoon).toHaveBeenCalled()
      })

      // Should not update indicator with invalid type
      expect(mockUpdateHarpoonIndicator).not.toHaveBeenCalled()
    })
  })
})

