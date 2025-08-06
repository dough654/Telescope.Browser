import { describe, it, expect, beforeEach } from 'vitest'
import { get } from 'svelte/store'
import {
  visualSelectionRange,
  visualSelectionIndices,
  startVisualSelection,
  updateVisualCursor,
  clearVisualSelection,
  getVisualSelectionSize
} from '../visual-selection.js'

describe('Visual Selection Store', () => {
  beforeEach(() => {
    // Clear visual selection before each test
    clearVisualSelection()
  })

  describe('Basic State Management', () => {
    it('should initialize with null selection range', () => {
      const range = get(visualSelectionRange)
      expect(range).toBeNull()
    })

    it('should initialize with empty selection indices', () => {
      const indices = get(visualSelectionIndices)
      expect(indices).toEqual([])
    })

    it('should start visual selection with anchor and cursor at same position', () => {
      startVisualSelection(3)
      
      const range = get(visualSelectionRange)
      expect(range).toEqual({
        anchor: 3,
        cursor: 3
      })
    })

    it('should update cursor position while keeping anchor fixed', () => {
      startVisualSelection(2)
      updateVisualCursor(5)
      
      const range = get(visualSelectionRange)
      expect(range).toEqual({
        anchor: 2,
        cursor: 5
      })
    })

    it('should clear visual selection', () => {
      startVisualSelection(1)
      updateVisualCursor(4)
      
      clearVisualSelection()
      
      const range = get(visualSelectionRange)
      const indices = get(visualSelectionIndices)
      expect(range).toBeNull()
      expect(indices).toEqual([])
    })
  })

  describe('Selection Range Calculation', () => {
    it('should calculate forward selection indices correctly', () => {
      startVisualSelection(2)
      updateVisualCursor(5)
      
      const indices = get(visualSelectionIndices)
      expect(indices).toEqual([2, 3, 4, 5])
    })

    it('should calculate backward selection indices correctly', () => {
      startVisualSelection(5)
      updateVisualCursor(2)
      
      const indices = get(visualSelectionIndices)
      expect(indices).toEqual([2, 3, 4, 5])
    })

    it('should handle single item selection', () => {
      startVisualSelection(3)
      // Don't update cursor, should select only the anchor
      
      const indices = get(visualSelectionIndices)
      expect(indices).toEqual([3])
    })

    it('should handle selection at index 0', () => {
      startVisualSelection(0)
      updateVisualCursor(2)
      
      const indices = get(visualSelectionIndices)
      expect(indices).toEqual([0, 1, 2])
    })

    it('should handle adjacent selection', () => {
      startVisualSelection(3)
      updateVisualCursor(4)
      
      const indices = get(visualSelectionIndices)
      expect(indices).toEqual([3, 4])
    })
  })

  describe('Selection Size Helper', () => {
    it('should return 0 for no selection', () => {
      const size = getVisualSelectionSize()
      expect(size).toBe(0)
    })

    it('should return correct size for single item selection', () => {
      startVisualSelection(2)
      
      const size = getVisualSelectionSize()
      expect(size).toBe(1)
    })

    it('should return correct size for multi-item selection', () => {
      startVisualSelection(1)
      updateVisualCursor(5)
      
      const size = getVisualSelectionSize()
      expect(size).toBe(5) // indices [1, 2, 3, 4, 5]
    })
  })

  describe('Edge Cases', () => {
    it('should handle updating cursor to same position as anchor', () => {
      startVisualSelection(3)
      updateVisualCursor(3)
      
      const indices = get(visualSelectionIndices)
      expect(indices).toEqual([3])
    })

    it('should handle multiple cursor updates', () => {
      startVisualSelection(2)
      updateVisualCursor(5)
      updateVisualCursor(1)
      updateVisualCursor(4)
      
      const range = get(visualSelectionRange)
      const indices = get(visualSelectionIndices)
      
      expect(range).toEqual({ anchor: 2, cursor: 4 })
      expect(indices).toEqual([2, 3, 4])
    })

    it('should handle clearing non-existent selection gracefully', () => {
      // Clear when no selection exists
      clearVisualSelection()
      
      const range = get(visualSelectionRange)
      expect(range).toBeNull()
    })

    it('should handle updateVisualCursor when no selection exists', () => {
      updateVisualCursor(3)
      
      const range = get(visualSelectionRange)
      expect(range).toBeNull()
    })
  })

  describe('Reactive Updates', () => {
    it('should update indices reactively when cursor changes', () => {
      startVisualSelection(2)
      
      let currentIndices = get(visualSelectionIndices)
      expect(currentIndices).toEqual([2])
      
      updateVisualCursor(4)
      
      currentIndices = get(visualSelectionIndices)
      expect(currentIndices).toEqual([2, 3, 4])
    })

    it('should clear indices reactively when selection is cleared', () => {
      startVisualSelection(1)
      updateVisualCursor(3)
      
      let currentIndices = get(visualSelectionIndices)
      expect(currentIndices).toEqual([1, 2, 3])
      
      clearVisualSelection()
      
      currentIndices = get(visualSelectionIndices)
      expect(currentIndices).toEqual([])
    })
  })
})