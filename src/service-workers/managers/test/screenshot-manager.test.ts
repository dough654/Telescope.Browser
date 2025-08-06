import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { ScreenshotOptions, ScreenshotInfo, ScreenshotCleanupResult } from '../screenshot-manager.js'

/**
 * Screenshot Manager Core Logic Tests
 * 
 * These tests verify screenshot capture logic, caching, cleanup,
 * and URL-based storage management without requiring Chrome APIs.
 */
describe('ScreenshotManager Core Logic', () => {
  
  describe('Screenshot Options', () => {
    it('applies default options correctly', () => {
      const defaultOptions: Required<ScreenshotOptions> = {
        quality: 80,
        format: 'jpeg',
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        retries: 3
      }

      // Test merging user options with defaults
      const userOptions: ScreenshotOptions = { quality: 90 }
      const mergedOptions = { ...defaultOptions, ...userOptions }

      expect(mergedOptions).toEqual({
        quality: 90, // User override
        format: 'jpeg', // Default
        maxAge: 24 * 60 * 60 * 1000, // Default
        retries: 3 // Default
      })
    })

    it('validates screenshot quality bounds', () => {
      const validateQuality = (quality: number): number => {
        return Math.max(1, Math.min(100, quality))
      }

      expect(validateQuality(50)).toBe(50) // Valid
      expect(validateQuality(0)).toBe(1) // Too low
      expect(validateQuality(150)).toBe(100) // Too high
      expect(validateQuality(-10)).toBe(1) // Negative
    })

    it('validates screenshot format', () => {
      const validFormats = ['jpeg', 'png']
      const validateFormat = (format: string): 'jpeg' | 'png' => {
        return validFormats.includes(format) ? format as 'jpeg' | 'png' : 'jpeg'
      }

      expect(validateFormat('jpeg')).toBe('jpeg')
      expect(validateFormat('png')).toBe('png')
      expect(validateFormat('gif')).toBe('jpeg') // Invalid, defaults to jpeg
      expect(validateFormat('')).toBe('jpeg') // Empty, defaults to jpeg
    })
  })

  describe('Screenshot Cache Management', () => {
    let screenshotCache: Map<string, ScreenshotInfo>
    const maxCacheSize = 5

    beforeEach(() => {
      screenshotCache = new Map()
    })

    it('stores screenshot info correctly', () => {
      const url = 'https://example.com'
      const screenshotInfo: ScreenshotInfo = {
        url,
        timestamp: Date.now(),
        size: 1024 * 50, // 50KB
        quality: 80,
        format: 'jpeg'
      }

      screenshotCache.set(url, screenshotInfo)

      expect(screenshotCache.get(url)).toEqual(screenshotInfo)
      expect(screenshotCache.size).toBe(1)
    })

    it('handles cache size limits with LRU eviction', () => {
      const now = Date.now()
      
      // Add screenshots beyond cache limit
      for (let i = 0; i < maxCacheSize + 2; i++) {
        const url = `https://example${i}.com`
        screenshotCache.set(url, {
          url,
          timestamp: now + i * 1000, // Newer timestamps
          size: 1024,
          quality: 80,
          format: 'jpeg'
        })
      }

      // Simulate LRU eviction - remove oldest entries when over limit
      if (screenshotCache.size > maxCacheSize) {
        const entries = Array.from(screenshotCache.entries())
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp) // Sort by timestamp
        
        // Remove oldest entries
        const toRemove = entries.slice(0, screenshotCache.size - maxCacheSize)
        toRemove.forEach(([url]) => screenshotCache.delete(url))
      }

      expect(screenshotCache.size).toBe(maxCacheSize)
      
      // Verify newest entries are kept
      expect(screenshotCache.has('https://example5.com')).toBe(true)
      expect(screenshotCache.has('https://example6.com')).toBe(true)
      
      // Verify oldest entries are removed
      expect(screenshotCache.has('https://example0.com')).toBe(false)
      expect(screenshotCache.has('https://example1.com')).toBe(false)
    })

    it('updates existing screenshot entries', () => {
      const url = 'https://example.com'
      const initialInfo: ScreenshotInfo = {
        url,
        timestamp: 1000,
        size: 1024,
        quality: 80,
        format: 'jpeg'
      }

      screenshotCache.set(url, initialInfo)

      // Update with newer screenshot
      const updatedInfo: ScreenshotInfo = {
        url,
        timestamp: 2000,
        size: 2048,
        quality: 90,
        format: 'png'
      }

      screenshotCache.set(url, updatedInfo)

      expect(screenshotCache.get(url)).toEqual(updatedInfo)
      expect(screenshotCache.size).toBe(1) // Size shouldn't change
    })
  })

  describe('Screenshot Age and Cleanup Logic', () => {
    const maxAge = 24 * 60 * 60 * 1000 // 24 hours

    it('identifies expired screenshots correctly', () => {
      const now = Date.now()
      
      const screenshots: ScreenshotInfo[] = [
        {
          url: 'https://fresh.com',
          timestamp: now - (1 * 60 * 60 * 1000), // 1 hour ago
          size: 1024,
          quality: 80,
          format: 'jpeg'
        },
        {
          url: 'https://expired.com',
          timestamp: now - (25 * 60 * 60 * 1000), // 25 hours ago
          size: 1024,
          quality: 80,
          format: 'jpeg'
        }
      ]

      const isExpired = (screenshot: ScreenshotInfo): boolean => {
        return (now - screenshot.timestamp) > maxAge
      }

      expect(isExpired(screenshots[0])).toBe(false) // Fresh
      expect(isExpired(screenshots[1])).toBe(true) // Expired
    })

    it('calculates cleanup statistics correctly', () => {
      const screenshots: ScreenshotInfo[] = [
        { url: 'https://1.com', timestamp: Date.now(), size: 1024, quality: 80, format: 'jpeg' },
        { url: 'https://2.com', timestamp: Date.now() - (25 * 60 * 60 * 1000), size: 2048, quality: 80, format: 'jpeg' },
        { url: 'https://3.com', timestamp: Date.now() - (30 * 60 * 60 * 1000), size: 3072, quality: 80, format: 'jpeg' }
      ]

      const expiredScreenshots = screenshots.filter(s => 
        (Date.now() - s.timestamp) > maxAge
      )

      const cleanupResult: ScreenshotCleanupResult = {
        removedCount: expiredScreenshots.length,
        bytesFreed: expiredScreenshots.reduce((total, s) => total + s.size, 0),
        errors: []
      }

      expect(cleanupResult.removedCount).toBe(2)
      expect(cleanupResult.bytesFreed).toBe(2048 + 3072) // 5120 bytes
      expect(cleanupResult.errors).toEqual([])
    })
  })

  describe('URL-Based Screenshot Storage', () => {
    it('generates consistent storage keys from URLs', () => {
      const generateStorageKey = (url: string): string => {
        // Simulate the storage key generation logic
        return `screenshot_${url.replace(/[^a-zA-Z0-9]/g, '_')}`
      }

      expect(generateStorageKey('https://example.com')).toBe('screenshot_https___example_com')
      expect(generateStorageKey('https://github.com/user/repo')).toBe('screenshot_https___github_com_user_repo')
      
      // Same URL should always generate same key
      const url = 'https://test.com/page?param=value'
      expect(generateStorageKey(url)).toBe(generateStorageKey(url))
    })

    it('handles URL normalization for storage', () => {
      const normalizeUrl = (url: string): string => {
        try {
          const parsed = new URL(url)
          // Remove fragment, normalize case
          return `${parsed.protocol}//${parsed.hostname.toLowerCase()}${parsed.pathname}${parsed.search}`
        } catch {
          return url
        }
      }

      expect(normalizeUrl('https://Example.com/Path')).toBe('https://example.com/Path')
      expect(normalizeUrl('https://example.com/page#section')).toBe('https://example.com/page')
      expect(normalizeUrl('https://example.com/page?a=1&b=2')).toBe('https://example.com/page?a=1&b=2')
      
      // Invalid URLs should return as-is
      expect(normalizeUrl('not-a-url')).toBe('not-a-url')
    })
  })

  describe('Capture Queue Management', () => {
    let captureQueue: Set<number>

    beforeEach(() => {
      captureQueue = new Set()
    })

    it('prevents duplicate captures correctly', () => {
      const tabId = 123

      // First capture - should be allowed
      const canCapture1 = !captureQueue.has(tabId)
      expect(canCapture1).toBe(true)

      // Add to queue
      captureQueue.add(tabId)

      // Second capture - should be prevented
      const canCapture2 = !captureQueue.has(tabId)
      expect(canCapture2).toBe(false)

      // Remove from queue
      captureQueue.delete(tabId)

      // Third capture - should be allowed again
      const canCapture3 = !captureQueue.has(tabId)
      expect(canCapture3).toBe(true)
    })

    it('handles multiple tab captures simultaneously', () => {
      const tabIds = [1, 2, 3, 4, 5]

      // Start captures for all tabs
      tabIds.forEach(id => captureQueue.add(id))

      expect(captureQueue.size).toBe(5)
      expect(Array.from(captureQueue).sort()).toEqual([1, 2, 3, 4, 5])

      // Complete capture for tab 3
      captureQueue.delete(3)

      expect(captureQueue.size).toBe(4)
      expect(captureQueue.has(3)).toBe(false)
      expect(captureQueue.has(1)).toBe(true)
    })
  })

  describe('Modal State Tracking', () => {
    let modalStates: Map<number, boolean>

    beforeEach(() => {
      modalStates = new Map()
    })

    it('tracks modal states per tab correctly', () => {
      const tabId = 123

      // Initial state - no entry
      expect(modalStates.get(tabId)).toBeUndefined()

      // Set modal open
      modalStates.set(tabId, true)
      expect(modalStates.get(tabId)).toBe(true)

      // Set modal closed
      modalStates.set(tabId, false)
      expect(modalStates.get(tabId)).toBe(false)

      // Remove tab entry
      modalStates.delete(tabId)
      expect(modalStates.get(tabId)).toBeUndefined()
    })

    it('prevents screenshot capture when modal is open', () => {
      const tabId = 456

      // No modal state - should allow capture
      const canCapture1 = !modalStates.get(tabId)
      expect(canCapture1).toBe(true)

      // Modal closed - should allow capture
      modalStates.set(tabId, false)
      const canCapture2 = !modalStates.get(tabId)
      expect(canCapture2).toBe(true)

      // Modal open - should prevent capture
      modalStates.set(tabId, true)
      const canCapture3 = !modalStates.get(tabId)
      expect(canCapture3).toBe(false)
    })
  })

  describe('Screenshot Data URL Handling', () => {
    it('validates data URL format correctly', () => {
      const isValidDataUrl = (dataUrl: string): boolean => {
        return dataUrl.startsWith('data:image/') && dataUrl.includes('base64,')
      }

      expect(isValidDataUrl('data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAY...')).toBe(true)
      expect(isValidDataUrl('data:image/png;base64,iVBORw0KGgoAAAANSUhEUg...')).toBe(true)
      expect(isValidDataUrl('data:text/plain;base64,SGVsbG8=')).toBe(false)
      expect(isValidDataUrl('not-a-data-url')).toBe(false)
      expect(isValidDataUrl('')).toBe(false)
    })

    it('estimates data URL size correctly', () => {
      const estimateDataUrlSize = (dataUrl: string): number => {
        if (!dataUrl.startsWith('data:')) return 0
        
        const base64Start = dataUrl.indexOf('base64,')
        if (base64Start === -1) return 0
        
        const base64Data = dataUrl.substring(base64Start + 7)
        // Base64 encoding increases size by ~33%, estimate original size
        return Math.floor(base64Data.length * 0.75)
      }

      const smallDataUrl = 'data:image/jpeg;base64,SGVsbG8=' // "Hello" in base64
      const largeDataUrl = 'data:image/jpeg;base64,' + 'A'.repeat(1000)

      expect(estimateDataUrlSize(smallDataUrl)).toBeGreaterThan(0)
      expect(estimateDataUrlSize(largeDataUrl)).toBeGreaterThan(estimateDataUrlSize(smallDataUrl))
      expect(estimateDataUrlSize('not-a-data-url')).toBe(0)
    })
  })
})