import { serviceWorkerLogger } from '../../utils/logger.js'
import { stateManager } from '../state/state-manager.js'
import { storage } from '../storage/storage-layer.js'

export interface ScreenshotOptions {
  quality?: number
  format?: 'jpeg' | 'png'
  maxAge?: number
  retries?: number
}

export interface ScreenshotInfo {
  url: string
  timestamp: number
  size: number
  quality: number
  format: string
}

export interface ScreenshotCleanupResult {
  removedCount: number
  bytesFreed: number
  errors: string[]
}

/**
 * Efficient screenshot capture and management
 */
export class ScreenshotManager {
  private screenshotCache = new Map<string, ScreenshotInfo>()
  private captureQueue = new Set<number>()
  private cleanupInterval: NodeJS.Timeout | null = null
  private maxCacheSize = 50 // Limit for in-memory cache
  private defaultMaxAge = 12 * 60 * 60 * 1000 // Reduced from 24h to 12h
  private defaultQuality = 50 // Further reduced for smaller file sizes
  private maxScreenshotSizeBytes = 50 * 1024 // 50KB max per screenshot
  private thumbnailWidth = 1024 // Resize to max 1024px width
  private thumbnailHeight = 768 // Resize to max 768px height
  private isCapturing = false
  private modalStates = new Map<number, boolean>() // Track modal states per tab

  constructor() {
    this.setupCleanupInterval()
  }

  /**
   * Initialize screenshot manager
   */
  async initialize(): Promise<void> {
    try {
      await this.loadScreenshotCache()
      await this.validateStoredScreenshots()
      
      serviceWorkerLogger.info('Screenshot manager initialized')
    } catch (error) {
      serviceWorkerLogger.error('Failed to initialize screenshot manager:', error)
      throw error
    }
  }

  /**
   * Capture screenshot for a specific tab
   */
  async captureTabScreenshot(tabId: number, options: ScreenshotOptions = {}): Promise<string | null> {
    // Prevent duplicate captures
    if (this.captureQueue.has(tabId)) {
      serviceWorkerLogger.debug(`Screenshot capture already in progress for tab ${tabId}`)
      return null
    }

    // Get the tab first
    const tab = await this.getTabById(tabId)
    if (!tab || !tab.url) {
      serviceWorkerLogger.debug(`Tab ${tabId} not found or has no URL`)
      return null
    }

    // Check if tab is active and visible (required for Chrome's captureVisibleTab API)
    const activeTab = await this.getActiveTab()
    if (!activeTab || activeTab.id !== tabId) {
      serviceWorkerLogger.debug(`Tab ${tabId} is not currently active, cannot capture screenshot`)
      return null
    }

    // Check if tab is in current window (required for Chrome's captureVisibleTab API)
    const currentWindow = await this.getCurrentWindow()
    if (!currentWindow || tab.windowId !== currentWindow.id) {
      serviceWorkerLogger.debug(`Tab ${tabId} is not in current window, cannot capture screenshot`)
      return null
    }

    // Check if modal is open on this tab - if so, skip screenshot to avoid capturing the modal
    // First check our local state, then fall back to messaging the content script
    let modalOpen = this.getModalState(tabId)
    if (!modalOpen) {
      // Double-check with content script
      modalOpen = await this.isModalOpenOnTab(tabId)
    }
    
    if (modalOpen) {
      serviceWorkerLogger.debug(`Modal is open on tab ${tabId}, skipping screenshot capture`)
      return null
    }

    this.captureQueue.add(tabId)

    try {
      const screenshotUrl = await this.captureScreenshot(options)
      
      if (screenshotUrl && tab.url) {
        // Resize screenshot to thumbnail for storage efficiency
        const thumbnailUrl = await this.resizeScreenshot(screenshotUrl)
        const finalScreenshotUrl = thumbnailUrl || screenshotUrl
        
        // Check storage quota before storing
        const canStore = await this.checkStorageQuota()
        if (!canStore) {
          serviceWorkerLogger.warn('Storage quota nearly exceeded, performing cleanup before storing screenshot')
          await this.cleanupScreenshots()
        }

        await this.storeScreenshot(tab.url, finalScreenshotUrl, options)
        
        // Update cache with the final (resized) screenshot
        this.screenshotCache.set(tab.url, {
          url: finalScreenshotUrl,
          timestamp: Date.now(),
          size: finalScreenshotUrl.length,
          quality: options.quality || this.defaultQuality,
          format: options.format || 'jpeg'
        })

        // Enforce cache size limit
        this.enforceCacheLimit()

        serviceWorkerLogger.debug(`Screenshot captured for tab ${tabId}`)
        return finalScreenshotUrl
      }

      return null
    } catch (error) {
      serviceWorkerLogger.error(`Failed to capture screenshot for tab ${tabId}:`, error)
      return null
    } finally {
      this.captureQueue.delete(tabId)
    }
  }

  /**
   * Get screenshot for a specific tab
   */
  async getScreenshotForTab(tabId: number): Promise<string | null> {
    try {
      const tab = await this.getTab(tabId)
      if (!tab || !tab.url) {
        return null
      }

      return await this.getScreenshotForUrl(tab.url)
    } catch (error) {
      serviceWorkerLogger.error(`Failed to get screenshot for tab ${tabId}:`, error)
      return null
    }
  }

  /**
   * Get screenshot for a specific URL
   */
  async getScreenshotForUrl(url: string): Promise<string | null> {
    try {
      // Check cache first
      const cached = this.screenshotCache.get(url)
      if (cached) {
        // Check if not expired
        const maxAge = this.defaultMaxAge
        if (Date.now() - cached.timestamp < maxAge) {
          return cached.url
        } else {
          // Remove expired from cache
          this.screenshotCache.delete(url)
        }
      }

      // Load from storage
      const screenshotMap = await this.loadScreenshotMap()
      const screenshotUrl = screenshotMap[url]
      
      if (screenshotUrl) {
        // Update cache
        this.screenshotCache.set(url, {
          url: screenshotUrl,
          timestamp: Date.now(),
          size: screenshotUrl.length,
          quality: this.defaultQuality,
          format: 'jpeg'
        })

        // Enforce cache size limit
        this.enforceCacheLimit()
      }

      return screenshotUrl || null
    } catch (error) {
      serviceWorkerLogger.error(`Failed to get screenshot for URL ${url}:`, error)
      return null
    }
  }

  /**
   * Set screenshot quality (0-100)
   */
  setQuality(quality: number): void {
    if (quality >= 0 && quality <= 100) {
      this.defaultQuality = quality
      serviceWorkerLogger.debug(`Screenshot quality set to ${quality}`)
    } else {
      serviceWorkerLogger.warn(`Invalid quality value: ${quality}. Must be between 0 and 100`)
    }
  }

  /**
   * Set maximum age for screenshots
   */
  setMaxAge(maxAge: number): void {
    if (maxAge > 0) {
      this.defaultMaxAge = maxAge
      serviceWorkerLogger.debug(`Screenshot max age set to ${maxAge}ms`)
    } else {
      serviceWorkerLogger.warn(`Invalid max age value: ${maxAge}. Must be greater than 0`)
    }
  }

  /**
   * Clean up old screenshots
   */
  async cleanupScreenshots(): Promise<ScreenshotCleanupResult> {
    const result: ScreenshotCleanupResult = {
      removedCount: 0,
      bytesFreed: 0,
      errors: []
    }

    try {
      const screenshotMap = await this.loadScreenshotMap()
      const tabHistory = stateManager.getTabHistory()
      const harpoonTabs = stateManager.getHarpoonTabs()
      
      // Get all URLs that are still in use
      const activeUrls = new Set([
        ...tabHistory.map(tab => tab.url),
        ...harpoonTabs.map(tab => tab.url)
      ])

      // Find screenshots to remove
      const screenshotsToRemove: string[] = []
      let bytesFreed = 0

      for (const [url, screenshotUrl] of Object.entries(screenshotMap)) {
        let shouldRemove = false
        
        // Remove if URL is no longer in use
        if (!activeUrls.has(url)) {
          shouldRemove = true
        }
        
        // Remove if expired
        const cached = this.screenshotCache.get(url)
        if (cached && Date.now() - cached.timestamp > this.defaultMaxAge) {
          shouldRemove = true
        }

        if (shouldRemove) {
          screenshotsToRemove.push(url)
          bytesFreed += screenshotUrl.length
        }
      }

      // Remove screenshots
      if (screenshotsToRemove.length > 0) {
        const updatedMap = { ...screenshotMap }
        
        for (const url of screenshotsToRemove) {
          delete updatedMap[url]
          this.screenshotCache.delete(url)
        }

        await storage.write('tabsScreenshotMap', updatedMap)

        result.removedCount = screenshotsToRemove.length
        result.bytesFreed = bytesFreed
        
        serviceWorkerLogger.info(`Cleaned up ${screenshotsToRemove.length} screenshots, freed ${bytesFreed} bytes`)
      }

      return result
    } catch (error) {
      serviceWorkerLogger.error('Failed to cleanup screenshots:', error)
      result.errors.push(error instanceof Error ? error.message : 'Unknown error')
      return result
    }
  }

  /**
   * Get screenshot cache info
   */
  getCacheInfo(): { size: number; urls: string[] } {
    return {
      size: this.screenshotCache.size,
      urls: Array.from(this.screenshotCache.keys())
    }
  }

  /**
   * Clear all screenshots
   */
  async clearAllScreenshots(): Promise<void> {
    try {
      await storage.write('tabsScreenshotMap', {})

      this.screenshotCache.clear()
      serviceWorkerLogger.info('All screenshots cleared')
    } catch (error) {
      serviceWorkerLogger.error('Failed to clear screenshots:', error)
      throw error
    }
  }

  /**
   * Clear screenshot cache (keeps storage, just clears memory cache)
   */
  clearScreenshotCache(): void {
    this.screenshotCache.clear()
    serviceWorkerLogger.info('Screenshot cache cleared')
  }

  /**
   * Set modal state for a specific tab
   */
  setModalState(tabId: number, isOpen: boolean): void {
    this.modalStates.set(tabId, isOpen)
    serviceWorkerLogger.debug(`Modal state for tab ${tabId} set to: ${isOpen ? 'OPEN' : 'closed'}`)
  }

  /**
   * Get modal state for a specific tab
   */
  getModalState(tabId: number): boolean {
    return this.modalStates.get(tabId) || false
  }

  /**
   * Get screenshot statistics
   */
  async getScreenshotStats(): Promise<{
    totalScreenshots: number
    totalSize: number
    oldestTimestamp: number
    newestTimestamp: number
    cacheHitRatio: number
  }> {
    try {
      const screenshotMap = await this.loadScreenshotMap()
      const urls = Object.keys(screenshotMap)
      
      let totalSize = 0
      let oldestTimestamp = Date.now()
      let newestTimestamp = 0
      let cacheHits = 0

      for (const url of urls) {
        const screenshotUrl = screenshotMap[url]
        totalSize += screenshotUrl.length

        const cached = this.screenshotCache.get(url)
        if (cached) {
          cacheHits++
          oldestTimestamp = Math.min(oldestTimestamp, cached.timestamp)
          newestTimestamp = Math.max(newestTimestamp, cached.timestamp)
        }
      }

      const cacheHitRatio = urls.length > 0 ? cacheHits / urls.length : 0

      return {
        totalScreenshots: urls.length,
        totalSize,
        oldestTimestamp,
        newestTimestamp,
        cacheHitRatio
      }
    } catch (error) {
      serviceWorkerLogger.error('Failed to get screenshot stats:', error)
      return {
        totalScreenshots: 0,
        totalSize: 0,
        oldestTimestamp: 0,
        newestTimestamp: 0,
        cacheHitRatio: 0
      }
    }
  }

  // Private methods

  private async captureScreenshot(options: ScreenshotOptions = {}): Promise<string | null> {
    // Final check - ensure modal is not open on the currently active tab right before capture
    const activeTab = await this.getActiveTab()
    if (activeTab && activeTab.id) {
      const modalOpen = await this.isModalOpenOnTab(activeTab.id)
      if (modalOpen) {
        serviceWorkerLogger.debug(`Modal is open on active tab ${activeTab.id}, aborting screenshot capture`)
        return null
      }
    }

    return new Promise((resolve) => {
      const format = options.format || 'jpeg'
      const quality = options.quality || this.defaultQuality

      chrome.tabs.captureVisibleTab(
        { format, quality },
        (screenshotUrl) => {
          if (chrome.runtime.lastError) {
            serviceWorkerLogger.error('Screenshot capture failed:', chrome.runtime.lastError.message)
            resolve(null)
          } else {
            resolve(screenshotUrl)
          }
        }
      )
    })
  }

  private async storeScreenshot(url: string, screenshotUrl: string, options: ScreenshotOptions): Promise<void> {
    const screenshotMap = await storage.read<Record<string, string>>('tabsScreenshotMap') || {}
    screenshotMap[url] = screenshotUrl
    await storage.write('tabsScreenshotMap', screenshotMap)
  }

  private async loadScreenshotMap(): Promise<Record<string, string>> {
    return await storage.read<Record<string, string>>('tabsScreenshotMap') || {}
  }

  private async loadScreenshotCache(): Promise<void> {
    try {
      const screenshotMap = await this.loadScreenshotMap()
      
      // Load recent screenshots into cache
      const urls = Object.keys(screenshotMap)
      const sortedUrls = urls.sort() // Simple sorting, could be improved

      for (const url of sortedUrls.slice(0, this.maxCacheSize)) {
        this.screenshotCache.set(url, {
          url: screenshotMap[url],
          timestamp: Date.now(),
          size: screenshotMap[url].length,
          quality: this.defaultQuality,
          format: 'jpeg'
        })
      }

      serviceWorkerLogger.debug(`Loaded ${this.screenshotCache.size} screenshots into cache`)
    } catch (error) {
      serviceWorkerLogger.error('Failed to load screenshot cache:', error)
    }
  }

  private async validateStoredScreenshots(): Promise<void> {
    try {
      const screenshotMap = await this.loadScreenshotMap()
      const urls = Object.keys(screenshotMap)
      let invalidCount = 0

      for (const url of urls) {
        const screenshotUrl = screenshotMap[url]
        
        // Basic validation - check if it's a data URL
        if (!screenshotUrl.startsWith('data:image/')) {
          invalidCount++
          delete screenshotMap[url]
          this.screenshotCache.delete(url)
        }
      }

      if (invalidCount > 0) {
        await storage.write('tabsScreenshotMap', screenshotMap)
        
        serviceWorkerLogger.info(`Removed ${invalidCount} invalid screenshots`)
      }
    } catch (error) {
      serviceWorkerLogger.error('Failed to validate stored screenshots:', error)
    }
  }

  private setupCleanupInterval(): void {
    // Clean up screenshots every 10 minutes
    this.cleanupInterval = setInterval(async () => {
      await this.cleanupScreenshots()
    }, 10 * 60 * 1000)
  }

  private async getActiveTab(): Promise<chrome.tabs.Tab | null> {
    return new Promise((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        resolve(tabs[0] || null)
      })
    })
  }

  private async getCurrentWindow(): Promise<chrome.windows.Window | null> {
    return new Promise((resolve) => {
      chrome.windows.getCurrent((window) => {
        if (chrome.runtime.lastError) {
          resolve(null)
        } else {
          resolve(window)
        }
      })
    })
  }

  private async getTabById(tabId: number): Promise<chrome.tabs.Tab | null> {
    return new Promise((resolve) => {
      chrome.tabs.get(tabId, (tab) => {
        if (chrome.runtime.lastError) {
          resolve(null)
        } else {
          resolve(tab)
        }
      })
    })
  }

  private async getTab(tabId: number): Promise<chrome.tabs.Tab | null> {
    return this.getTabById(tabId)
  }

  /**
   * Resize screenshot to thumbnail size for storage efficiency
   */
  private async resizeScreenshot(dataUrl: string): Promise<string | null> {
    try {
      // Convert data URL to blob
      const response = await fetch(dataUrl)
      const blob = await response.blob()
      
      // Create ImageBitmap from blob
      const imageBitmap = await createImageBitmap(blob)
      
      // Calculate new dimensions while maintaining aspect ratio
      const { width: originalWidth, height: originalHeight } = imageBitmap
      let newWidth = this.thumbnailWidth
      let newHeight = this.thumbnailHeight
      
      const aspectRatio = originalWidth / originalHeight
      
      if (originalWidth > originalHeight) {
        // Landscape
        newHeight = Math.round(newWidth / aspectRatio)
      } else {
        // Portrait
        newWidth = Math.round(newHeight * aspectRatio)
      }
      
      // Don't upscale images
      if (newWidth >= originalWidth && newHeight >= originalHeight) {
        serviceWorkerLogger.debug('Image is already smaller than thumbnail size, keeping original')
        return dataUrl
      }
      
      // Use OffscreenCanvas for resizing in service worker
      const canvas = new OffscreenCanvas(newWidth, newHeight)
      const ctx = canvas.getContext('2d')
      
      if (!ctx) {
        serviceWorkerLogger.warn('Could not get canvas context for resizing')
        return null
      }
      
      // Draw resized image
      ctx.drawImage(imageBitmap, 0, 0, newWidth, newHeight)
      
      // Convert back to blob with compression
      const resizedBlob = await canvas.convertToBlob({
        type: 'image/jpeg',
        quality: this.defaultQuality / 100
      })
      
      // Convert blob back to data URL
      const reader = new FileReader()
      return new Promise((resolve) => {
        reader.onload = () => {
          const resizedDataUrl = reader.result as string
          serviceWorkerLogger.debug(`Resized screenshot from ${dataUrl.length} to ${resizedDataUrl.length} bytes`)
          resolve(resizedDataUrl)
        }
        reader.onerror = () => {
          serviceWorkerLogger.error('Failed to convert resized blob to data URL')
          resolve(null)
        }
        reader.readAsDataURL(resizedBlob)
      })
      
    } catch (error) {
      serviceWorkerLogger.error('Failed to resize screenshot:', error)
      return null
    }
  }

  /**
   * Check if modal is open on a specific tab
   */
  private async isModalOpenOnTab(tabId: number): Promise<boolean> {
    return new Promise((resolve) => {
      chrome.tabs.sendMessage(
        tabId,
        { message: 'isModalOpen' },
        (response) => {
          if (chrome.runtime.lastError) {
            // If we can't communicate with the content script, assume modal is not open
            serviceWorkerLogger.debug(`Cannot check modal status for tab ${tabId}: ${chrome.runtime.lastError.message}`)
            resolve(false)
          } else {
            const isOpen = response?.isOpen || false
            serviceWorkerLogger.debug(`Modal status for tab ${tabId}: ${isOpen ? 'OPEN' : 'closed'}`)
            resolve(isOpen)
          }
        }
      )
    })
  }

  /**
   * Check if storage quota allows for new screenshots
   */
  private async checkStorageQuota(): Promise<boolean> {
    try {
      const storageInfo = await storage.getStorageInfo()
      const usagePercent = (storageInfo.bytesInUse / storageInfo.quota) * 100
      
      // Log storage usage periodically
      if (Math.random() < 0.1) { // 10% chance to log
        serviceWorkerLogger.debug(`Storage usage: ${usagePercent.toFixed(1)}% (${Math.round(storageInfo.bytesInUse / 1024 / 1024)}MB / ${Math.round(storageInfo.quota / 1024 / 1024)}MB)`)
      }
      
      // Return false if we're above 85% usage
      return usagePercent < 85
    } catch (error) {
      serviceWorkerLogger.error('Failed to check storage quota:', error)
      return true // Allow storage if we can't check
    }
  }

  /**
   * Enforce cache size limit by removing oldest entries
   */
  private enforceCacheLimit(): void {
    if (this.screenshotCache.size <= this.maxCacheSize) {
      return
    }

    // Convert to array and sort by timestamp (oldest first)
    const entries = Array.from(this.screenshotCache.entries())
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp)

    // Remove oldest entries until we're at the limit
    const entriesToRemove = entries.length - this.maxCacheSize
    for (let i = 0; i < entriesToRemove; i++) {
      const [url] = entries[i]
      this.screenshotCache.delete(url)
    }

    serviceWorkerLogger.debug(`Enforced cache limit: removed ${entriesToRemove} old entries, cache size now ${this.screenshotCache.size}`)
  }

  /**
   * Cleanup on destruction
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
  }
}

// Export singleton instance
export const screenshotManager = new ScreenshotManager()