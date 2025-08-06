import { writable, derived } from 'svelte/store'

export interface VisualSelectionRange {
  anchor: number  // The starting point of selection (where visual mode was entered)
  cursor: number  // The current cursor position
}

// Visual selection state
export const visualSelectionRange = writable<VisualSelectionRange | null>(null)

// Derived store that calculates the actual selection indices
export const visualSelectionIndices = derived(
  visualSelectionRange,
  ($range) => {
    if (!$range) return []
    
    const start = Math.min($range.anchor, $range.cursor)
    const end = Math.max($range.anchor, $range.cursor)
    
    // Create array of all indices in the selection range (inclusive)
    const indices: number[] = []
    for (let i = start; i <= end; i++) {
      indices.push(i)
    }
    return indices
  }
)

// Actions
export function startVisualSelection(anchorIndex: number) {
  visualSelectionRange.set({
    anchor: anchorIndex,
    cursor: anchorIndex
  })
}

export function updateVisualCursor(cursorIndex: number) {
  visualSelectionRange.update(range => {
    if (!range) return null
    return {
      ...range,
      cursor: cursorIndex
    }
  })
}

export function clearVisualSelection() {
  visualSelectionRange.set(null)
}

export function getVisualSelectionSize(): number {
  let size = 0
  visualSelectionIndices.subscribe(indices => {
    size = indices.length
  })()
  return size
}