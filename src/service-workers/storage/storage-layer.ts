import { serviceWorkerLogger } from '../../utils/logger.js'
import type { Tab } from '../../types/shared.js'

export type StorageKey = 'tabHistory' | 'harpoonHistory' | 'harpoonWindows' | 'tabsScreenshotMap' | 'windowStates' | 'systemHealth' | 'excludedSites'

export interface WindowState {
  id: number
  focused: boolean
  lastActivity: number
  activeTabId: number | null
}

export interface SystemHealth {
  version: number
  lastCleanup: number
  errorCount: number
  lastHealthCheck: number
}

export class SimpleStorage {
  /**
   * Read data from storage
   */
  async read<T>(key: StorageKey): Promise<T | null> {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get([key], (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
          return
        }
        
        const value = result[key]
        if (value === undefined) {
          resolve(null)
        } else if (this.validateData(key, value)) {
          resolve(value as T)
        } else {
          serviceWorkerLogger.warn(`Invalid data for key ${key}, returning null`)
          resolve(null)
        }
      })
    })
  }

  /**
   * Write data to storage
   */
  async write<T>(key: StorageKey, value: T): Promise<void> {
    if (!this.validateData(key, value)) {
      throw new Error(`Invalid data for key ${key}`)
    }

    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ [key]: value }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
          return
        }
        resolve()
      })
    })
  }

  /**
   * Delete data from storage
   */
  async delete(key: StorageKey): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove([key], () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
          return
        }
        resolve()
      })
    })
  }

  /**
   * Get storage usage information
   */
  async getStorageInfo(): Promise<{ bytesInUse: number, quota: number }> {
    return new Promise((resolve, reject) => {
      chrome.storage.local.getBytesInUse(null, (bytesInUse) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
          return
        }
        
        // Chrome extension storage quota is typically 10MB
        const quota = 10 * 1024 * 1024
        resolve({ bytesInUse, quota })
      })
    })
  }

  /**
   * Clear all storage (for testing/recovery)
   */
  async clearAll(): Promise<void> {
    return new Promise((resolve, reject) => {
      chrome.storage.local.clear(() => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
          return
        }
        serviceWorkerLogger.info('All storage cleared')
        resolve()
      })
    })
  }

  /**
   * Validate data before storage
   */
  private validateData(key: StorageKey, value: unknown): boolean {
    switch (key) {
      case 'tabHistory':
      case 'harpoonHistory':
        return Array.isArray(value) && value.every(this.validateTab)
      
      case 'harpoonWindows':
        return typeof value === 'object' && value !== null && 
               Object.values(value as Record<string, unknown>).every(windowTabs => 
                 Array.isArray(windowTabs) && windowTabs.every(this.validateTab)
               )
      
      case 'tabsScreenshotMap':
        return typeof value === 'object' && value !== null
      
      case 'windowStates':
        return typeof value === 'object' && value !== null
      
      case 'systemHealth':
        return this.validateSystemHealth(value)
      
      case 'excludedSites':
        return Array.isArray(value) && value.every(site => typeof site === 'string')
      
      default:
        return false
    }
  }

  private validateTab(tab: unknown): boolean {
    if (typeof tab !== 'object' || tab === null) return false
    
    const t = tab as Record<string, unknown>
    return (
      typeof t.id === 'number' &&
      typeof t.url === 'string' &&
      typeof t.title === 'string' &&
      typeof t.windowId === 'number'
    )
  }

  private validateSystemHealth(health: unknown): boolean {
    if (typeof health !== 'object' || health === null) return false
    
    const h = health as Record<string, unknown>
    return (
      typeof h.version === 'number' &&
      typeof h.lastCleanup === 'number' &&
      typeof h.errorCount === 'number' &&
      typeof h.lastHealthCheck === 'number'
    )
  }
}

// Export singleton instance
export const storage = new SimpleStorage()