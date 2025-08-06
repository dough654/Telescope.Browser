import { describe, it, expect, vi } from 'vitest'
import { truncateUrl } from '../html-utils.js'

describe('HTML Utilities', () => {
  describe('truncateUrl', () => {
    it('should not truncate URLs shorter than 150 characters', () => {
      const shortUrl = 'https://example.com'
      expect(truncateUrl(shortUrl)).toBe(shortUrl)
    })

    it('should truncate URLs longer than 150 characters', () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(200) // Total length > 150
      const result = truncateUrl(longUrl)
      
      expect(result).toHaveLength(153) // 150 + '...' (3 chars)
      expect(result.endsWith('...')).toBe(true)
      expect(result.startsWith('https://example.com')).toBe(true)
    })

    it('should handle empty URL', () => {
      expect(truncateUrl('')).toBe('')
    })

    it('should handle URL exactly at 150 characters', () => {
      const url = 'https://example.com/' + 'a'.repeat(130) // Exactly 150 chars
      expect(truncateUrl(url)).toBe(url) // Should not be truncated
      expect(truncateUrl(url)).toHaveLength(150)
    })

    it('should handle very long URLs with query parameters', () => {
      const longUrl = 'https://example.com/search?q=' + 'a'.repeat(200) + '&sort=date&filter=all'
      const result = truncateUrl(longUrl)
      
      expect(result).toHaveLength(153) // 150 + '...'
      expect(result.endsWith('...')).toBe(true)
      expect(result.includes('https://example.com')).toBe(true)
    })
  })

  // Note: targetIsText function is harder to test as it requires DOM Event objects
  // and complex element type checking. It would require significant mocking setup
  // and might be better covered by integration tests.
})