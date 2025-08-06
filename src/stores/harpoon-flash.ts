import { writable } from 'svelte/store'

// Store to trigger border flash animation
export const shouldFlashBorder = writable(false)

export function triggerBorderFlash() {
  shouldFlashBorder.set(true)
  // Reset after animation completes
  setTimeout(() => {
    shouldFlashBorder.set(false)
  }, 1000)
}