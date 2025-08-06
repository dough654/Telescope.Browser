import { describe, it, expect, beforeEach } from 'vitest'
import {
  filterTabsForDisplay,
  filterTabsByWindow,
  canReceiveMessages
} from '../tab-filters.js'
import type { Tab } from '../../types/shared.js'

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

describe('Tab Filters', () => {
  describe('filterTabsForDisplay', () => {
    const currentWindowId = 1

    // Mock window.location.href for testing current tab filtering
    beforeEach(() => {
      Object.defineProperty(window, 'location', {
        value: { href: 'https://current.com' },
        writable: true
      })
    })

    it('should filter out chrome:// URLs', () => {
      const tabs = [
        createMockTab({ url: 'https://example.com', windowId: 1 }),
        createMockTab({ url: 'chrome://settings', windowId: 1 }),
        createMockTab({ url: 'chrome-extension://abc123/page.html', windowId: 1 }),
        createMockTab({ url: 'https://google.com', windowId: 1 })
      ]

      const result = filterTabsForDisplay(tabs, currentWindowId)
      
      expect(result).toHaveLength(3) // chrome-extension URLs are NOT filtered
      expect(result.every(tab => !tab.url.includes('chrome://'))).toBe(true)
    })

    it('should filter out current tab URL', () => {
      const tabs = [
        createMockTab({ url: 'https://example.com', windowId: 1 }),
        createMockTab({ url: 'https://current.com', windowId: 1 }),
        createMockTab({ url: 'https://google.com', windowId: 1 })
      ]

      const result = filterTabsForDisplay(tabs, currentWindowId)
      
      expect(result).toHaveLength(2)
      expect(result.every(tab => tab.url !== 'https://current.com')).toBe(true)
    })

    it('should keep tabs from current window only', () => {
      const tabs = [
        createMockTab({ url: 'https://example.com', windowId: 1 }),
        createMockTab({ url: 'https://google.com', windowId: 2 }),
        createMockTab({ url: 'https://github.com', windowId: 1 }),
        createMockTab({ url: 'https://stackoverflow.com', windowId: 3 })
      ]

      const result = filterTabsForDisplay(tabs, 1)
      
      expect(result).toHaveLength(2)
      expect(result.every(tab => tab.windowId === 1)).toBe(true)
    })

    it('should apply all filters together', () => {
      const tabs = [
        createMockTab({ url: 'https://example.com', windowId: 1 }), // Should keep
        createMockTab({ url: 'chrome://settings', windowId: 1 }), // Filter out: chrome URL
        createMockTab({ url: 'https://current.com', windowId: 1 }), // Filter out: current tab
        createMockTab({ url: 'https://google.com', windowId: 2 }), // Filter out: different window
        createMockTab({ url: 'https://github.com', windowId: 1 }) // Should keep
      ]

      const result = filterTabsForDisplay(tabs, 1)
      
      expect(result).toHaveLength(2)
      expect(result[0].url).toBe('https://example.com')
      expect(result[1].url).toBe('https://github.com')
    })

    it('should handle empty tabs array', () => {
      const result = filterTabsForDisplay([], currentWindowId)
      expect(result).toHaveLength(0)
    })

    it('should handle edge case URLs', () => {
      const tabs = [
        createMockTab({ url: 'about:blank', windowId: 1 }),
        createMockTab({ url: 'data:text/html,<h1>Test</h1>', windowId: 1 }),
        createMockTab({ url: 'javascript:alert("test")', windowId: 1 }),
        createMockTab({ url: 'https://example.com', windowId: 1 })
      ]

      const result = filterTabsForDisplay(tabs, 1)
      
      // Should keep all non-chrome URLs (including about:, data:, javascript:)
      expect(result).toHaveLength(4)
    })
  })

  describe('filterTabsByWindow', () => {
    it('should filter tabs by window ID', () => {
      const tabs = [
        createMockTab({ windowId: 1 }),
        createMockTab({ windowId: 2 }),
        createMockTab({ windowId: 1 }),
        createMockTab({ windowId: 3 })
      ]

      const result = filterTabsByWindow(tabs, 1)
      
      expect(result).toHaveLength(2)
      expect(result.every(tab => tab.windowId === 1)).toBe(true)
    })

    it('should return empty array when no tabs match window', () => {
      const tabs = [
        createMockTab({ windowId: 1 }),
        createMockTab({ windowId: 2 })
      ]

      const result = filterTabsByWindow(tabs, 99)
      expect(result).toHaveLength(0)
    })

    it('should handle empty tabs array', () => {
      const result = filterTabsByWindow([], 1)
      expect(result).toHaveLength(0)
    })
  })

  describe('canReceiveMessages', () => {
    it('should allow valid web URLs', () => {
      const validUrls = [
        'https://example.com',
        'http://example.com',
        'https://subdomain.example.com/path',
        'https://example.com:8080/page?param=value',
        'file:///path/to/file.html'
      ]

      validUrls.forEach(url => {
        const tab = { url, id: 1 } as chrome.tabs.Tab
        expect(canReceiveMessages(tab)).toBe(true)
      })
    })

    it('should reject chrome:// URLs', () => {
      const chromeUrls = [
        'chrome://settings',
        'chrome://extensions',
        'chrome://flags',
        'chrome://newtab'
      ]

      chromeUrls.forEach(url => {
        const tab = { url, id: 1 } as chrome.tabs.Tab
        expect(canReceiveMessages(tab)).toBe(false)
      })
    })

    it('should allow chrome-extension:// URLs', () => {
      const extensionUrls = [
        'chrome-extension://abc123/popup.html',
        'chrome-extension://def456/options.html'
      ]

      extensionUrls.forEach(url => {
        const tab = { url, id: 1 } as chrome.tabs.Tab
        expect(canReceiveMessages(tab)).toBe(true)
      })
    })

    it('should handle edge cases', () => {
      expect(canReceiveMessages({ url: undefined } as chrome.tabs.Tab)).toBe(false)
      expect(canReceiveMessages({ url: '' } as chrome.tabs.Tab)).toBe(false)
      expect(canReceiveMessages({} as chrome.tabs.Tab)).toBe(false)
    })

    it('should reject about: URLs', () => {
      const aboutUrls = [
        'about:blank',
        'about:config'
      ]

      aboutUrls.forEach(url => {
        const tab = { url, id: 1 } as chrome.tabs.Tab
        expect(canReceiveMessages(tab)).toBe(false)
      })
    })

    it('should allow moz-extension URLs', () => {
      const tab = { url: 'moz-extension://abc123/page.html', id: 1 } as chrome.tabs.Tab
      expect(canReceiveMessages(tab)).toBe(true)
    })

    it('should allow data: and javascript: URLs', () => {
      const specialUrls = [
        'data:text/html,<h1>Test</h1>',
        'javascript:alert("test")'
      ]

      specialUrls.forEach(url => {
        const tab = { url, id: 1 } as chrome.tabs.Tab
        expect(canReceiveMessages(tab)).toBe(true)
      })
    })
  })
})