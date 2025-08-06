import type { Tab } from '../types/shared.js'
import { getScreenshotForUrl } from './service-worker-bridge.js'

/**
 * Cache for screenshot URLs to avoid repeated requests
 */
const screenshotCache = new Map<string, string | null>()

/**
 * Populate screenshot URLs for tabs with throttling to avoid overwhelming service worker
 */
export async function populateTabScreenshots(tabs: Tab[]): Promise<Tab[]> {
  if (!tabs.length) {
    return tabs
  }

  try {
    // Process tabs in batches to avoid overwhelming the service worker
    const batchSize = 3
    const populatedTabs: Tab[] = []

    for (let i = 0; i < tabs.length; i += batchSize) {
      const batch = tabs.slice(i, i + batchSize)

      const batchResults = await Promise.all(
        batch.map(async (tab) => {
          try {
            // Check cache first
            let screenshotUrl = screenshotCache.get(tab.url)

            if (screenshotUrl === undefined) {
              // Not in cache, fetch from service worker
              screenshotUrl = await getScreenshotForUrl(tab.url)
              screenshotCache.set(tab.url, screenshotUrl)
            }

            return {
              ...tab,
              screenshotUrl: screenshotUrl || ''
            }
          } catch (error) {
            // Screenshot loading failed - continue with empty screenshot
            return {
              ...tab,
              screenshotUrl: ''
            }
          }
        })
      )

      populatedTabs.push(...batchResults)

      // Small delay between batches to avoid overwhelming service worker
      if (i + batchSize < tabs.length) {
        await new Promise((resolve) => setTimeout(resolve, 10))
      }
    }

    return populatedTabs
  } catch (error) {
    console.error('Failed to populate screenshots:', error)
    return tabs
  }
}

