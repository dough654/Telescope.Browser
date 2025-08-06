import { describe, it, expect, beforeEach, vi } from 'vitest'
import { get } from 'svelte/store'
import {
  harpoonIndicatorState,
  showHarpoonIndicatorLoading,
  updateHarpoonIndicator,
  hideHarpoonIndicator
} from '../harpoon-indicator.js'

describe('Harpoon Indicator Store', () => {
  beforeEach(() => {
    // Reset state before each test
    harpoonIndicatorState.set({
      isVisible: false,
      isLoading: false,
      index: null
    })
    
    // Clear any existing timeouts
    vi.clearAllTimers()
  })

  it('should initialize with correct default state', () => {
    const state = get(harpoonIndicatorState)
    expect(state).toEqual({
      isVisible: false,
      isLoading: false,
      index: null
    })
  })

  describe('showHarpoonIndicatorLoading', () => {
    it('should show loading state immediately', () => {
      showHarpoonIndicatorLoading()
      
      const state = get(harpoonIndicatorState)
      expect(state).toEqual({
        isVisible: true,
        isLoading: true,
        index: null
      })
    })

    it('should timeout after 3 seconds if no update', async () => {
      vi.useFakeTimers()
      
      showHarpoonIndicatorLoading()
      
      // Should be loading initially
      let state = get(harpoonIndicatorState)
      expect(state.isLoading).toBe(true)
      expect(state.isVisible).toBe(true)
      
      // Fast-forward 3 seconds
      vi.advanceTimersByTime(3000)
      
      // Should now be hidden
      state = get(harpoonIndicatorState)
      expect(state).toEqual({
        isVisible: false,
        isLoading: false,
        index: null
      })
      
      vi.useRealTimers()
    })

    it('should clear existing timeout when called multiple times', () => {
      vi.useFakeTimers()
      
      showHarpoonIndicatorLoading()
      
      // Fast-forward 2 seconds
      vi.advanceTimersByTime(2000)
      
      // Call again - should reset the timeout
      showHarpoonIndicatorLoading()
      
      // Fast-forward another 2 seconds (total 4, but only 2 since last call)
      vi.advanceTimersByTime(2000)
      
      // Should still be loading (timeout not reached)
      const state = get(harpoonIndicatorState)
      expect(state.isLoading).toBe(true)
      expect(state.isVisible).toBe(true)
      
      vi.useRealTimers()
    })
  })

  describe('updateHarpoonIndicator', () => {
    it('should update indicator with index and clear loading state', () => {
      // Start with loading state
      showHarpoonIndicatorLoading()
      
      updateHarpoonIndicator(2)
      
      const state = get(harpoonIndicatorState)
      expect(state).toEqual({
        isVisible: true,
        isLoading: false,
        index: 2
      })
    })

    it('should clear timeout when updating', () => {
      vi.useFakeTimers()
      
      showHarpoonIndicatorLoading()
      updateHarpoonIndicator(1)
      
      // Fast-forward past timeout period
      vi.advanceTimersByTime(4000)
      
      // Should still be visible with index (timeout was cleared)
      const state = get(harpoonIndicatorState)
      expect(state).toEqual({
        isVisible: true,
        isLoading: false,
        index: 1
      })
      
      vi.useRealTimers()
    })
  })

  describe('hideHarpoonIndicator', () => {
    it('should hide indicator when not loading', () => {
      // Set visible with index
      updateHarpoonIndicator(3)
      
      hideHarpoonIndicator()
      
      const state = get(harpoonIndicatorState)
      expect(state).toEqual({
        isVisible: false,
        isLoading: false,
        index: null
      })
    })

    it('should NOT hide indicator when in loading state', () => {
      showHarpoonIndicatorLoading()
      
      hideHarpoonIndicator()
      
      // Should still be visible and loading
      const state = get(harpoonIndicatorState)
      expect(state).toEqual({
        isVisible: true,
        isLoading: true,
        index: null
      })
    })

    it('should hide indicator after loading state times out', () => {
      vi.useFakeTimers()
      
      showHarpoonIndicatorLoading()
      hideHarpoonIndicator() // Should be ignored while loading
      
      // Fast-forward past timeout
      vi.advanceTimersByTime(3000)
      
      const state = get(harpoonIndicatorState)
      expect(state).toEqual({
        isVisible: false,
        isLoading: false,
        index: null
      })
      
      vi.useRealTimers()
    })
  })

  describe('loading state protection', () => {
    it('should protect loading state from being hidden prematurely', () => {
      // Start loading
      showHarpoonIndicatorLoading()
      
      // Try to hide (should be ignored)
      hideHarpoonIndicator()
      
      // Should still be loading
      let state = get(harpoonIndicatorState)
      expect(state.isLoading).toBe(true)
      expect(state.isVisible).toBe(true)
      
      // Update with success
      updateHarpoonIndicator(1)
      
      // Now should have index and not be loading
      state = get(harpoonIndicatorState)
      expect(state).toEqual({
        isVisible: true,
        isLoading: false,
        index: 1
      })
      
      // Now hide should work
      hideHarpoonIndicator()
      
      state = get(harpoonIndicatorState)
      expect(state.isVisible).toBe(false)
    })
  })
})