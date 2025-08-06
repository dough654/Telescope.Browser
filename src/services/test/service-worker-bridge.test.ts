import { describe, it, expect, beforeEach, vi } from 'vitest'
import { 
  switchToTab,
  addTabToHarpoon,
  removeTabFromHarpoon,
  closeTab,
  getHarpoonTabs,
  getCurrentWindowId
} from '../service-worker-bridge.js'

// Mock Chrome runtime API
const mockSendMessage = vi.fn()

global.chrome = {
  runtime: {
    sendMessage: mockSendMessage,
    lastError: undefined as any
  }
} as any

describe('Service Worker Bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    chrome.runtime.lastError = undefined
  })

  describe('Error handling', () => {
    it('should handle Chrome runtime errors', async () => {
      chrome.runtime.lastError = { message: 'Service worker not responding' }
      mockSendMessage.mockImplementation((message, callback) => {
        callback(null)
      })

      await expect(switchToTab(123)).rejects.toThrow('Service worker not responding')
    })

    it('should handle extension context invalidation', async () => {
      chrome.runtime.lastError = { message: 'Extension context invalidated. Try refreshing the page.' }
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      mockSendMessage.mockImplementation((message, callback) => {
        callback(null)
      })

      await expect(switchToTab(123)).rejects.toThrow('Extension context invalidated')
      expect(consoleWarn).toHaveBeenCalledWith(
        '[SERVICE_WORKER_BRIDGE] Extension context invalidated, service worker may have restarted'
      )
      
      consoleWarn.mockRestore()
    })

    it('should handle service worker error responses', async () => {
      const errorResponse = { error: 'Tab not found' }
      mockSendMessage.mockImplementation((message, callback) => {
        callback(errorResponse)
      })

      await expect(switchToTab(123)).rejects.toThrow('Tab not found')
    })
  })

  describe('API functions', () => {
    beforeEach(() => {
      mockSendMessage.mockImplementation((message, callback) => {
        callback({ success: true })
      })
    })

    it('should call switchToTab with tabId', async () => {
      await switchToTab(123)
      expect(mockSendMessage).toHaveBeenCalledWith(
        { message: 'switchToTab', tabId: 123 },
        expect.any(Function)
      )
    })

    it('should call addTabToHarpoon correctly', async () => {
      await addTabToHarpoon()
      expect(mockSendMessage).toHaveBeenCalledWith(
        { message: 'addTabToHarpoon' },
        expect.any(Function)
      )
    })

    it('should call removeTabFromHarpoon correctly', async () => {
      await removeTabFromHarpoon()
      expect(mockSendMessage).toHaveBeenCalledWith(
        { message: 'removeTabFromHarpoon' },
        expect.any(Function)
      )
    })

    it('should call closeTab with tabId', async () => {
      await closeTab(456)
      expect(mockSendMessage).toHaveBeenCalledWith(
        { message: 'closeTab', tabId: 456 },
        expect.any(Function)
      )
    })

    it('should call getHarpoonTabs correctly', async () => {
      await getHarpoonTabs()
      expect(mockSendMessage).toHaveBeenCalledWith(
        { message: 'getHarpoonTabs' },
        expect.any(Function)
      )
    })

    it('should call getCurrentWindowId correctly', async () => {
      await getCurrentWindowId()
      expect(mockSendMessage).toHaveBeenCalledWith(
        { message: 'getCurrentWindowId' },
        expect.any(Function)
      )
    })
  })

  describe('Response handling', () => {
    it('should return response data correctly', async () => {
      const mockTabs = [{ id: 1, title: 'Test Tab', url: 'https://example.com' }]
      mockSendMessage.mockImplementation((message, callback) => {
        callback(mockTabs)
      })

      const result = await getHarpoonTabs()
      expect(result).toEqual(mockTabs)
    })

    it('should handle successful responses', async () => {
      const mockResponse = { message: 'success', tabId: 123 }
      mockSendMessage.mockImplementation((message, callback) => {
        callback(mockResponse)
      })

      const result = await switchToTab(123)
      expect(result).toEqual(mockResponse)
    })
  })
})