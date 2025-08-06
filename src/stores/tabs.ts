import { writable, derived } from 'svelte/store'
import type { Tab } from '../types/shared.js'
import { requestInitialSync } from '../services/service-worker-bridge.js'
import { modalMode } from './modal.js'
import { filterTabsForDisplay, filterTabsByWindow } from '../utils/tab-filters.js'
import { tabsLogger } from '../utils/logger.js'

// Track tabs that are pending deletion to prevent race conditions
const pendingDeletions = writable<Set<number>>(new Set())

// Helper function to filter out pending deletions
function filterPendingDeletions(tabs: Tab[], pendingSet: Set<number>): Tab[] {
  return tabs.filter((tab) => !pendingSet.has(tab.id))
}

// Core tab state
export const allTabs = writable<Tab[]>([])
export const harpoonTabs = writable<Tab[]>([])
export const filteredTabs = writable<Tab[]>([])

// Derived stores
export const tabsToDisplay = derived(
  [allTabs, harpoonTabs, modalMode],
  ([$allTabs, $harpoonTabs, $modalMode]) => {
    return $modalMode === 'tab' ? $allTabs : $harpoonTabs
  }
)

export const tabCount = derived(
  [filteredTabs, tabsToDisplay],
  ([$filteredTabs, $tabsToDisplay]) => {
    return `${$filteredTabs.length}/${$tabsToDisplay.length}`
  }
)

// Actions
export async function loadTabs() {
  try {
    const syncData = await requestInitialSync()

    // Get current pending deletions
    let pendingSet = new Set<number>()
    pendingDeletions.subscribe((set) => {
      pendingSet = new Set(set)
    })()

    // Filter out unwanted tabs (chrome:// URLs, current tab, etc.)
    // Note: syncData.allTabs and syncData.harpoonTabs are already window-specific
    const filtered = syncData.allTabs.filter(
      (tab) => !tab.url.includes('chrome://') && tab.url !== window.location.href
    )

    // Filter out tabs that are pending deletion to prevent race conditions
    const filteredWithoutPending = filterPendingDeletions(filtered, pendingSet)
    const harpoonWithoutPending = filterPendingDeletions(syncData.harpoonTabs, pendingSet)

    allTabs.set(filteredWithoutPending)
    harpoonTabs.set(harpoonWithoutPending)
    filteredTabs.set(filteredWithoutPending)
  } catch (error) {
    tabsLogger.error('Failed to load tabs:', error)
  }
}

export function updateFilteredTabs(tabs: Tab[]) {
  // Get current pending deletions and filter them out
  let pendingSet = new Set<number>()
  pendingDeletions.subscribe((set) => {
    pendingSet = new Set(set)
  })()

  const filtered = filterPendingDeletions(tabs, pendingSet)
  filteredTabs.set(filtered)
}

export function updateAllTabs(tabs: Tab[]) {
  // Get current pending deletions
  let pendingSet = new Set<number>()
  pendingDeletions.subscribe((set) => {
    pendingSet = new Set(set)
  })()

  // Filter out unwanted tabs (chrome:// URLs, current tab, etc.)
  // Note: tabs are already window-specific from the service worker
  const filtered = tabs.filter(
    (tab) => !tab.url.includes('chrome://') && tab.url !== window.location.href
  )

  // Filter out tabs that are pending deletion
  const filteredWithoutPending = filterPendingDeletions(filtered, pendingSet)
  allTabs.set(filteredWithoutPending)
}

export function updateHarpoonTabs(tabs: Tab[]) {
  // Get current pending deletions and filter them out
  let pendingSet = new Set<number>()
  pendingDeletions.subscribe((set) => {
    pendingSet = new Set(set)
  })()

  const filtered = filterPendingDeletions(tabs, pendingSet)
  harpoonTabs.set(filtered)
}

export function removeTabOptimistically(tabId: number) {
  // Add to pending deletions to prevent race conditions with polling
  pendingDeletions.update((set) => {
    const newSet = new Set(set)
    newSet.add(tabId)
    return newSet
  })

  // Optimistically remove tab from all stores for immediate UI feedback
  allTabs.update((tabs) => tabs.filter((tab) => tab.id !== tabId))
  filteredTabs.update((tabs) => tabs.filter((tab) => tab.id !== tabId))
  harpoonTabs.update((tabs) => tabs.filter((tab) => tab.id !== tabId))

  // Clear the pending deletion after a timeout as a safety net
  // The proper cleanup should happen when we receive confirmation from the service worker
  setTimeout(() => {
    pendingDeletions.update((set) => {
      const newSet = new Set(set)
      newSet.delete(tabId)
      return newSet
    })
  }, 5000) // 5 second timeout
}

// Clear all pending deletions (useful for tests)
export function clearPendingDeletions() {
  pendingDeletions.set(new Set())
}

