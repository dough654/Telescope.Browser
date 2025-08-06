import { writable, derived } from 'svelte/store'

// Core keyboard state
export const keyBuffer = writable<string[]>([])

// Submenu state for hierarchical commands
export const harpoonSubmenuActive = writable<boolean>(false)
export const harpoonSubmenuTimeout = writable<number | null>(null)


// Derived stores
export const lastTwoKeys = derived(keyBuffer, ($buffer) => {
  return $buffer.slice(-2)
})

export const lastThreeKeys = derived(keyBuffer, ($buffer) => {
  return $buffer.slice(-3)
})

// Actions
export function addKeyToBuffer(key: string) {
  keyBuffer.update(buffer => {
    const newBuffer = [...buffer, key]
    // Keep buffer manageable size
    if (newBuffer.length > 10) {
      return newBuffer.slice(-10)
    }
    return newBuffer
  })
}

export function clearKeyBuffer() {
  keyBuffer.set([])
  clearHarpoonSubmenu()
}

// Submenu management
export function activateHarpoonSubmenu() {
  harpoonSubmenuActive.set(true)
  
  // Clear any existing timeout
  harpoonSubmenuTimeout.update(currentTimeout => {
    if (currentTimeout) {
      clearTimeout(currentTimeout)
    }
    return null
  })
  
  // Set timeout to show hints after 1 second (for when which-key is not already visible)
  const timeoutId = setTimeout(() => {
    // Directly import and show the hints
    import('../stores/which-key.js').then(({ scheduleWhichKey }) => {
      const hints = getHarpoonSubmenuHints()
      scheduleWhichKey(hints, 0) // Show immediately since we already waited 1 second
    })
  }, 1000) as unknown as number
  
  harpoonSubmenuTimeout.set(timeoutId)
}

export function clearHarpoonSubmenu() {
  harpoonSubmenuActive.set(false)
  harpoonSubmenuTimeout.update(currentTimeout => {
    if (currentTimeout) {
      clearTimeout(currentTimeout)
    }
    return null
  })
}


// Key combination checkers
export function checkModalTrigger(keys: string[]): 'tab' | 'harpoon' | null {
  const combo = keys.join('').toLowerCase()
  
  // Handle tab modal trigger
  if (combo === '  ') {
    return 'tab'
  }
  
  // Handle harpoon modal open command (space h o)
  if (keys.length === 3 && combo === ' ho') {
    clearHarpoonSubmenu()
    return 'harpoon'
  }
  
  // Note: space h submenu activation is now handled directly in keyboard-handler.ts
  
  return null
}

export function checkEscapeSequence(keys: string[]): boolean {
  return keys.length === 2 && keys.every(key => key === 'Escape')
}

export function checkHarpoonAdd(keys: string[]): boolean {
  const combo = keys.join('').toLowerCase()
  
  // Check for new hierarchical command (space h a)
  if (keys.length === 3 && combo === ' ha') {
    clearHarpoonSubmenu()
    return true
  }
  
  return false
}

export function checkHarpoonRemove(keys: string[]): boolean {
  const combo = keys.join('').toLowerCase()
  
  // Check for new hierarchical command (space h r)
  if (keys.length === 3 && combo === ' hr') {
    clearHarpoonSubmenu()
    return true
  }
  
  return false
}

export function checkLastTab(keys: string[]): boolean {
  const combo = keys.join('').toLowerCase()
  
  // Check for last tab command (space l)
  if (keys.length === 2 && combo === ' l') {
    return true
  }
  
  return false
}


export function checkHarpoonSwitch(keys: string[]): number | null {
  const numbers = ['1', '2', '3', '4', '5', '6', '7', '8', '9']
  if (keys.length === 2 && keys[0] === ' ' && numbers.includes(keys[1])) {
    return parseInt(keys[1]) - 1
  }
  return null
}

export function checkDeleteSequence(keys: string[]): boolean {
  return keys.join('').toLowerCase() === 'dd'
}

// Check if we should clear submenu due to invalid key after "space h"
export function checkSubmenuInvalidation(keys: string[]): boolean {
  const combo = keys.join('').toLowerCase()
  
  // If we have "space h" followed by an invalid key, clear harpoon submenu
  if (keys.length === 3 && combo.startsWith(' h')) {
    const lastKey = combo[2]
    const validHarpoonKeys = ['o', 'a', 'r']
    
    if (!validHarpoonKeys.includes(lastKey)) {
      clearHarpoonSubmenu()
      return true
    }
  }
  
  return false
}

// Get available harpoon submenu options for hint display
export function getHarpoonSubmenuHints(): Array<{key: string, description: string}> {
  return [
    { key: 'o', description: 'open [H]arpoon list' },
    { key: 'a', description: 'add to [H]arpoon' },
    { key: 'r', description: 'remove from [H]arpoon' }
  ]
}