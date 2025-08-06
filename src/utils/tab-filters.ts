import type { Tab } from '../types/shared.js'

/**
 * Filters out unwanted tabs for display in the tab list
 */
export function filterTabsForDisplay(tabs: Tab[], currentWindowId: number): Tab[] {
  return tabs.filter(tab => 
    !tab.url.includes('chrome://') && 
    tab.url !== window.location.href &&
    tab.windowId === currentWindowId
  )
}

/**
 * Filters tabs by window ID only (used for harpoon tabs)
 */
export function filterTabsByWindow(tabs: Tab[], currentWindowId: number): Tab[] {
  return tabs.filter(tab => tab.windowId === currentWindowId)
}

/**
 * Checks if a tab should be excluded from broadcasting messages
 * (chrome:// and about: pages cannot receive content script messages)
 */
export function canReceiveMessages(tab: chrome.tabs.Tab): tab is chrome.tabs.Tab & { id: number } {
  return !!(tab.id && !tab.url?.includes('chrome://') && !tab.url?.includes('about:'))
}