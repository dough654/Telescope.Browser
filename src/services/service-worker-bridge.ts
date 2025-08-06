import type { Tab } from '../types/shared.js'
import type { InputMode, ModalMode } from '../types/shared.js'

async function sendMessageToSW(message: string, payload?: unknown): Promise<unknown> {
  return new Promise((resolve, reject) => {
    try {
      chrome.runtime.sendMessage(
        { message, ...(payload as Record<string, unknown>) },
        (response) => {
          if (chrome.runtime.lastError) {
            // Handle context invalidation specifically
            const error = chrome.runtime.lastError.message
            if (error?.includes('Extension context invalidated')) {
              console.warn(
                '[SERVICE_WORKER_BRIDGE] Extension context invalidated, service worker may have restarted'
              )
            }
            reject(new Error(error || 'Unknown runtime error'))
            return
          }
          if (response?.error) {
            reject(new Error(response.error))
            return
          }
          resolve(response)
        }
      )
    } catch (error) {
      reject(error)
    }
  })
}

export function switchToTab(tabId: number): Promise<{ message: string }> {
  return sendMessageToSW('switchToTab', { tabId }) as Promise<{ message: string }>
}

export function sendOpenModalFromIFrame(mode: ModalMode): Promise<void> {
  return sendMessageToSW('showModal', { mode }) as Promise<void>
}

export function addTabToHarpoon(): Promise<{ message: string; harpoonIndex?: number }> {
  return sendMessageToSW('addTabToHarpoon') as Promise<{ message: string; harpoonIndex?: number }>
}

export function removeTabFromHarpoon(): Promise<void> {
  return sendMessageToSW('removeTabFromHarpoon') as Promise<void>
}

export function removeTabFromHarpoonById(tabId: number): Promise<void> {
  return sendMessageToSW('removeTabFromHarpoonById', { tabId }) as Promise<void>
}

export function closeTab(tabId: number): Promise<void> {
  return sendMessageToSW('closeTab', { tabId }) as Promise<void>
}

export function getHarpoonTabs(): Promise<Tab[]> {
  return sendMessageToSW('getHarpoonTabs') as Promise<Tab[]>
}

export function getTabScreenshotUrl(): Promise<string> {
  return sendMessageToSW('getTabScreenshotUrl') as Promise<string>
}

export function getScreenshotForUrl(url: string): Promise<string | null> {
  return sendMessageToSW('getScreenshotForUrl', { url }) as Promise<string | null>
}

export function getCurrentWindowId(): Promise<number> {
  return sendMessageToSW('getCurrentWindowId') as Promise<number>
}

export function requestInitialSync(): Promise<{ allTabs: Tab[]; harpoonTabs: Tab[] }> {
  return sendMessageToSW('requestInitialSync') as Promise<{ allTabs: Tab[]; harpoonTabs: Tab[] }>
}

export function switchToLastBuffer(): Promise<void> {
  return sendMessageToSW('switchToLastBuffer') as Promise<void>
}
