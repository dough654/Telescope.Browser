import { describe, it, expect } from 'vitest'
import {
  checkModalTrigger,
  checkHarpoonSwitch,
  checkHarpoonAdd,
  checkHarpoonRemove,
  checkDeleteSequence,
  checkSubmenuInvalidation,
  getHarpoonSubmenuHints
} from '../keyboard.js'

describe('Keyboard Combination Checkers', () => {
  describe('checkModalTrigger', () => {
    it('should detect double space for tab modal', () => {
      expect(checkModalTrigger([' ', ' '])).toBe('tab')
    })

    it('should detect space-h as submenu activation (returns null)', () => {
      expect(checkModalTrigger([' ', 'h'])).toBe(null) // Now activates submenu instead
    })

    it('should detect space-h-o for harpoon modal', () => {
      expect(checkModalTrigger([' ', 'h', 'o'])).toBe('harpoon')
    })

    it('should reject other combinations', () => {
      expect(checkModalTrigger([' ', 'f'])).toBe(null)
      expect(checkModalTrigger(['f', 'h'])).toBe(null)
      expect(checkModalTrigger(['a', 'b'])).toBe(null)
      expect(checkModalTrigger([' ', 'h', 'x'])).toBe(null) // Invalid submenu command
    })

    it('should handle single key inputs', () => {
      expect(checkModalTrigger([' '])).toBe(null)
      expect(checkModalTrigger(['f'])).toBe(null)
    })

    it('should handle empty input', () => {
      expect(checkModalTrigger([])).toBe(null)
    })

    it('should handle other 3-key combinations', () => {
      expect(checkModalTrigger([' ', 'f', 'h'])).toBe(null)
      expect(checkModalTrigger(['a', ' ', 'f'])).toBe(null)
    })

    it('should be case insensitive', () => {
      expect(checkModalTrigger([' ', 'H'])).toBe(null) // Submenu activation
      expect(checkModalTrigger([' ', 'H', 'O'])).toBe('harpoon') // Harpoon modal
      expect(checkModalTrigger(['  '])).toBe('tab') // Two spaces as one string
    })
  })

  describe('checkHarpoonAdd', () => {
    it('should detect space-h-a combination', () => {
      expect(checkHarpoonAdd([' ', 'h', 'a'])).toBe(true)
    })

    it('should be case insensitive', () => {
      expect(checkHarpoonAdd([' ', 'H', 'A'])).toBe(true)
      expect(checkHarpoonAdd([' ', 'h', 'A'])).toBe(true)
    })

    it('should reject old 2-key combinations', () => {
      expect(checkHarpoonAdd([' ', 'a'])).toBe(false) // Old format no longer works
    })

    it('should reject other combinations', () => {
      expect(checkHarpoonAdd([' ', 'h', 'h'])).toBe(false)
      expect(checkHarpoonAdd([' ', 'h', 'f'])).toBe(false)
      expect(checkHarpoonAdd(['a', 'b', 'c'])).toBe(false)
      expect(checkHarpoonAdd([' ', 'f', 'a'])).toBe(false)
    })

    it('should handle edge cases', () => {
      expect(checkHarpoonAdd([' '])).toBe(false)
      expect(checkHarpoonAdd(['a'])).toBe(false)
      expect(checkHarpoonAdd([])).toBe(false)
      expect(checkHarpoonAdd([' ', 'h'])).toBe(false) // Incomplete sequence
      expect(checkHarpoonAdd([' ', 'h', 'a', 'f'])).toBe(false) // Too long
    })
  })

  describe('checkHarpoonRemove', () => {
    it('should detect space-h-r combination', () => {
      expect(checkHarpoonRemove([' ', 'h', 'r'])).toBe(true)
    })

    it('should be case insensitive', () => {
      expect(checkHarpoonRemove([' ', 'H', 'R'])).toBe(true)
      expect(checkHarpoonRemove([' ', 'h', 'R'])).toBe(true)
    })

    it('should reject old 2-key combinations', () => {
      expect(checkHarpoonRemove([' ', 'r'])).toBe(false) // Old format no longer works
    })

    it('should reject other combinations', () => {
      expect(checkHarpoonRemove([' ', 'h', 'f'])).toBe(false)
      expect(checkHarpoonRemove([' ', 'h', 'd'])).toBe(false)
      expect(checkHarpoonRemove(['h', 'r', 'x'])).toBe(false)
      expect(checkHarpoonRemove([' ', 'f', 'r'])).toBe(false)
    })

    it('should handle edge cases', () => {
      expect(checkHarpoonRemove([' '])).toBe(false)
      expect(checkHarpoonRemove(['r'])).toBe(false)
      expect(checkHarpoonRemove([])).toBe(false)
      expect(checkHarpoonRemove([' ', 'h'])).toBe(false) // Incomplete sequence
      expect(checkHarpoonRemove([' ', 'h', 'r', 'f'])).toBe(false) // Too long
    })
  })

  describe('checkHarpoonSwitch', () => {
    it('should detect valid space-number combinations', () => {
      expect(checkHarpoonSwitch([' ', '1'])).toBe(0) // 0-indexed
      expect(checkHarpoonSwitch([' ', '2'])).toBe(1)
      expect(checkHarpoonSwitch([' ', '5'])).toBe(4)
      expect(checkHarpoonSwitch([' ', '9'])).toBe(8)
    })

    it('should reject non-space first key', () => {
      expect(checkHarpoonSwitch(['1', ' '])).toBe(null)
      expect(checkHarpoonSwitch(['a', '1'])).toBe(null)
    })

    it('should reject 0 as invalid', () => {
      expect(checkHarpoonSwitch([' ', '0'])).toBe(null)
    })

    it('should reject non-numeric combinations', () => {
      expect(checkHarpoonSwitch([' ', 'f'])).toBe(null)
      expect(checkHarpoonSwitch([' ', 'h'])).toBe(null)
      expect(checkHarpoonSwitch(['a', ' '])).toBe(null)
    })

    it('should handle edge cases', () => {
      expect(checkHarpoonSwitch([' '])).toBe(null)
      expect(checkHarpoonSwitch(['1'])).toBe(null)
      expect(checkHarpoonSwitch([])).toBe(null)
      expect(checkHarpoonSwitch([' ', '1', 'f'])).toBe(null)
    })

    it('should handle invalid length inputs', () => {
      expect(checkHarpoonSwitch([' ', '10'])).toBe(null) // Two-character second element
      expect(checkHarpoonSwitch([' ', ''])).toBe(null) // Empty second element
    })
  })

  describe('checkDeleteSequence', () => {
    it('should detect dd combination', () => {
      expect(checkDeleteSequence(['d', 'd'])).toBe(true)
    })

    it('should be case insensitive', () => {
      expect(checkDeleteSequence(['D', 'D'])).toBe(true)
      expect(checkDeleteSequence(['d', 'D'])).toBe(true)
      expect(checkDeleteSequence(['D', 'd'])).toBe(true)
    })

    it('should reject other combinations', () => {
      expect(checkDeleteSequence(['d', 'a'])).toBe(false)
      expect(checkDeleteSequence(['a', 'd'])).toBe(false)
      expect(checkDeleteSequence(['x', 'x'])).toBe(false)
    })

    it('should handle edge cases', () => {
      expect(checkDeleteSequence(['d'])).toBe(false)
      expect(checkDeleteSequence([])).toBe(false)
      expect(checkDeleteSequence(['d', 'd', 'd'])).toBe(false)
    })
  })

  describe('checkSubmenuInvalidation', () => {
    it('should detect invalid keys after space-h', () => {
      expect(checkSubmenuInvalidation([' ', 'h', 'x'])).toBe(true)
      expect(checkSubmenuInvalidation([' ', 'h', 'f'])).toBe(true)
      expect(checkSubmenuInvalidation([' ', 'h', '1'])).toBe(true)
    })

    it('should not invalidate valid harpoon submenu commands', () => {
      expect(checkSubmenuInvalidation([' ', 'h', 'o'])).toBe(false)
      expect(checkSubmenuInvalidation([' ', 'h', 'a'])).toBe(false)
      expect(checkSubmenuInvalidation([' ', 'h', 'r'])).toBe(false)
    })

    it('should be case insensitive', () => {
      expect(checkSubmenuInvalidation([' ', 'H', 'O'])).toBe(false)
      expect(checkSubmenuInvalidation([' ', 'H', 'X'])).toBe(true)
    })

    it('should handle edge cases', () => {
      expect(checkSubmenuInvalidation([' ', 'h'])).toBe(false) // Not 3 keys
      expect(checkSubmenuInvalidation([' ', 'f', 'x'])).toBe(false) // Not starting with space-h
      expect(checkSubmenuInvalidation([])).toBe(false)
      expect(checkSubmenuInvalidation([' '])).toBe(false)
    })
  })

  describe('getHarpoonSubmenuHints', () => {
    it('should return correct hint structure', () => {
      const hints = getHarpoonSubmenuHints()
      expect(hints).toHaveLength(3)
      
      expect(hints[0]).toEqual({ key: 'o', description: 'open [H]arpoon list' })
      expect(hints[1]).toEqual({ key: 'a', description: 'add to [H]arpoon' })
      expect(hints[2]).toEqual({ key: 'r', description: 'remove from [H]arpoon' })
    })

    it('should always return the same hints', () => {
      const hints1 = getHarpoonSubmenuHints()
      const hints2 = getHarpoonSubmenuHints()
      
      expect(hints1).toEqual(hints2)
    })
  })
})