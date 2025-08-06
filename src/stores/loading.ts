import { writable } from 'svelte/store'

export type LoadingState = {
  isLoading: boolean
  message?: string
}

// Core loading state
export const loadingState = writable<LoadingState>({
  isLoading: false,
  message: undefined
})

let loadingTimeout: ReturnType<typeof setTimeout> | null = null

// Actions
export function showLoading(message?: string) {
  loadingState.set({
    isLoading: true,
    message
  })
}

export function hideLoading() {
  // Clear any pending timeout
  if (loadingTimeout !== null) {
    clearTimeout(loadingTimeout)
    loadingTimeout = null
  }

  loadingState.set({
    isLoading: false,
    message: undefined
  })
}

// Show loading with delay to prevent flashing on quick operations
export function showLoadingWithDelay(message?: string, delay: number = 100) {
  // Clear any existing timeout
  if (loadingTimeout !== null) {
    clearTimeout(loadingTimeout)
  }

  loadingTimeout = setTimeout(() => {
    loadingState.set({
      isLoading: true,
      message
    })
    loadingTimeout = null
  }, delay)
}

// Convenience functions for specific loading operations
export function showTabSwitchLoading() {
  showLoadingWithDelay('Switching tab...', 100)
}

