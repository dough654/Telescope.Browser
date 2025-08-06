import { writable } from 'svelte/store'

export type HarpoonIndicatorState = {
  isVisible: boolean
  isLoading: boolean
  index: number | null
}

// Store for immediate harpoon indicator feedback
export const harpoonIndicatorState = writable<HarpoonIndicatorState>({
  isVisible: false,
  isLoading: false,
  index: null
})

// Show indicator immediately with spinner
let loadingTimeout: ReturnType<typeof setTimeout> | null = null

export function showHarpoonIndicatorLoading() {
  // Clear any existing timeout
  if (loadingTimeout) {
    clearTimeout(loadingTimeout)
  }
  
  harpoonIndicatorState.set({
    isVisible: true,
    isLoading: true,
    index: null
  })
  
  // Set a timeout to hide the loading state after 3 seconds if no update
  loadingTimeout = setTimeout(() => {
    harpoonIndicatorState.update(state => {
      if (state.isLoading) {
        return {
          isVisible: false,
          isLoading: false,
          index: null
        }
      }
      return state
    })
  }, 3000)
}

// Update indicator with actual index from service worker
export function updateHarpoonIndicator(index: number) {
  // Clear loading timeout if it exists
  if (loadingTimeout) {
    clearTimeout(loadingTimeout)
    loadingTimeout = null
  }
  
  harpoonIndicatorState.set({
    isVisible: true,
    isLoading: false,
    index
  })
}

// Hide indicator (but not if it's currently loading)
export function hideHarpoonIndicator() {
  harpoonIndicatorState.update(state => {
    // Don't hide if we're in a loading state - wait for the operation to complete
    if (state.isLoading) {
      return state
    }
    return {
      isVisible: false,
      isLoading: false,
      index: null
    }
  })
}