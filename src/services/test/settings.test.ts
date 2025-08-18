import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SettingsService } from '../settings.js'

// Mock the storage layer
vi.mock('../../service-workers/storage/storage-layer.js', () => ({
  storage: {
    read: vi.fn(),
    write: vi.fn(),
  }
}))

describe('SettingsService', () => {
  let settingsService: SettingsService
  let mockStorage: any

  beforeEach(async () => {
    vi.clearAllMocks()
    // Get the mocked storage
    const { storage } = await vi.importMock('../../service-workers/storage/storage-layer.js') as { storage: any }
    mockStorage = storage
    settingsService = new SettingsService()
  })

  describe('pattern matching', () => {
    it('should match exact domain', async () => {
      mockStorage.read.mockResolvedValue(['example.com'])
      
      const result = await settingsService.isUrlExcluded('https://example.com/path')
      expect(result).toBe(true)
    })

    it('should match wildcard subdomain', async () => {
      mockStorage.read.mockResolvedValue(['*.example.com'])
      
      const result1 = await settingsService.isUrlExcluded('https://sub.example.com/path')
      const result2 = await settingsService.isUrlExcluded('https://another.sub.example.com/path')
      const result3 = await settingsService.isUrlExcluded('https://example.com/path')
      
      expect(result1).toBe(true)
      expect(result2).toBe(true)
      expect(result3).toBe(false) // Exact match doesn't match wildcard
    })

    it('should match port wildcards', async () => {
      mockStorage.read.mockResolvedValue(['localhost:*'])
      
      const result1 = await settingsService.isUrlExcluded('http://localhost:3000/')
      const result2 = await settingsService.isUrlExcluded('http://localhost:8080/api')
      const result3 = await settingsService.isUrlExcluded('http://localhost/')
      
      expect(result1).toBe(true)
      expect(result2).toBe(true)
      expect(result3).toBe(false) // No port doesn't match port wildcard
    })

    it('should match path patterns', async () => {
      mockStorage.read.mockResolvedValue(['github.com/*/settings'])
      
      const result1 = await settingsService.isUrlExcluded('https://github.com/user/settings')
      const result2 = await settingsService.isUrlExcluded('https://github.com/org/settings')
      const result3 = await settingsService.isUrlExcluded('https://github.com/user/profile')
      
      expect(result1).toBe(true)
      expect(result2).toBe(true)
      expect(result3).toBe(false)
    })

    it('should handle wildcard path patterns', async () => {
      mockStorage.read.mockResolvedValue(['example.com/admin/*'])
      
      const result1 = await settingsService.isUrlExcluded('https://example.com/admin/dashboard')
      const result2 = await settingsService.isUrlExcluded('https://example.com/admin/users/edit')
      const result3 = await settingsService.isUrlExcluded('https://example.com/public')
      
      expect(result1).toBe(true)
      expect(result2).toBe(true)
      expect(result3).toBe(false)
    })

    it('should handle multiple patterns', async () => {
      mockStorage.read.mockResolvedValue(['*.google.com', 'localhost:*', 'example.com/admin/*'])
      
      const result1 = await settingsService.isUrlExcluded('https://mail.google.com/')
      const result2 = await settingsService.isUrlExcluded('http://localhost:3000/app')
      const result3 = await settingsService.isUrlExcluded('https://example.com/admin/panel')
      const result4 = await settingsService.isUrlExcluded('https://other.com/')
      
      expect(result1).toBe(true)
      expect(result2).toBe(true)
      expect(result3).toBe(true)
      expect(result4).toBe(false)
    })

    it('should handle invalid URLs gracefully', async () => {
      mockStorage.read.mockResolvedValue(['example.com'])
      
      const result = await settingsService.isUrlExcluded('not-a-valid-url')
      expect(result).toBe(false)
    })

    it('should handle empty exclusion list', async () => {
      mockStorage.read.mockResolvedValue([])
      
      const result = await settingsService.isUrlExcluded('https://example.com/')
      expect(result).toBe(false)
    })

    it('should handle null exclusion list', async () => {
      mockStorage.read.mockResolvedValue(null)
      
      const result = await settingsService.isUrlExcluded('https://example.com/')
      expect(result).toBe(false)
    })
  })

  describe('exclusion management', () => {
    it('should add new exclusion patterns', async () => {
      mockStorage.read.mockResolvedValue(['existing.com'])
      
      await settingsService.addExcludedSite('new.com')
      
      expect(mockStorage.write).toHaveBeenCalledWith('excludedSites', ['existing.com', 'new.com'])
    })

    it('should not add duplicate patterns', async () => {
      mockStorage.read.mockResolvedValue(['example.com'])
      
      await settingsService.addExcludedSite('example.com')
      
      expect(mockStorage.write).not.toHaveBeenCalled()
    })

    it('should remove exclusion patterns', async () => {
      mockStorage.read.mockResolvedValue(['keep.com', 'remove.com', 'also-keep.com'])
      
      await settingsService.removeExcludedSite('remove.com')
      
      expect(mockStorage.write).toHaveBeenCalledWith('excludedSites', ['keep.com', 'also-keep.com'])
    })

    it('should get excluded sites', async () => {
      const mockSites = ['site1.com', '*.site2.com']
      mockStorage.read.mockResolvedValue(mockSites)
      
      const result = await settingsService.getExcludedSites()
      
      expect(result).toEqual(mockSites)
      expect(mockStorage.read).toHaveBeenCalledWith('excludedSites')
    })
  })
})