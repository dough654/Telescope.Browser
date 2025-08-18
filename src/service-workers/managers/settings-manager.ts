import { settingsService } from '../../services/settings.js'
import { serviceWorkerLogger } from '../../utils/logger.js'

export class SettingsManager {
  constructor() {
    serviceWorkerLogger.info('SettingsManager initialized')
  }

  /**
   * Get all excluded sites
   */
  async getExcludedSites(): Promise<string[]> {
    return settingsService.getExcludedSites()
  }

  /**
   * Add an excluded site pattern
   */
  async addExcludedSite(pattern: string): Promise<void> {
    await settingsService.addExcludedSite(pattern)
    serviceWorkerLogger.info(`Added excluded site: ${pattern}`)
    
    // Notify all tabs about the change
    await this.broadcastSettingsChange()
  }

  /**
   * Remove an excluded site pattern
   */
  async removeExcludedSite(pattern: string): Promise<void> {
    await settingsService.removeExcludedSite(pattern)
    serviceWorkerLogger.info(`Removed excluded site: ${pattern}`)
    
    // Notify all tabs about the change
    await this.broadcastSettingsChange()
  }

  /**
   * Check if a URL is excluded
   */
  async isUrlExcluded(url: string): Promise<boolean> {
    return settingsService.isUrlExcluded(url)
  }

  /**
   * Broadcast settings change to all tabs
   */
  private async broadcastSettingsChange(): Promise<void> {
    const tabs = await chrome.tabs.query({})
    
    for (const tab of tabs) {
      if (tab.id && tab.url) {
        try {
          await chrome.tabs.sendMessage(tab.id, {
            message: 'settingsChanged',
            type: 'excludedSites'
          })
        } catch (error) {
          // Tab might not have content script loaded
          // This is expected for excluded sites or special pages
        }
      }
    }
  }

  /**
   * Handle message from popup or content scripts
   */
  async handleMessage(message: any, sender: chrome.runtime.MessageSender): Promise<any> {
    switch (message.message) {
      case 'getExcludedSites':
        return { sites: await this.getExcludedSites() }
      
      case 'addExcludedSite':
        await this.addExcludedSite(message.pattern)
        return { success: true }
      
      case 'removeExcludedSite':
        await this.removeExcludedSite(message.pattern)
        return { success: true }
      
      case 'isUrlExcluded':
        return { isExcluded: await this.isUrlExcluded(message.url) }
      
      default:
        return null
    }
  }
}