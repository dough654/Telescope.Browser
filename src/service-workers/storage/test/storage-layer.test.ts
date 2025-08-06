import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SimpleStorage } from '../storage-layer.js'
import type { Tab, SystemHealth } from '../../../types/shared.js'

// Mock Chrome storage API
const mockChromeStorage = {
  local: {
    get: vi.fn(),
    set: vi.fn(),
    remove: vi.fn(),
    clear: vi.fn(),
    getBytesInUse: vi.fn()
  }
}

const mockChromeRuntime = {
  lastError: undefined as any
}

global.chrome = {
  storage: mockChromeStorage,
  runtime: mockChromeRuntime
} as any

// Mock logger
vi.mock('../../../utils/logger.js', () => ({
  serviceWorkerLogger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}))

const createMockTab = (overrides: Partial<Tab> = {}): Tab => ({
  id: 1,
  title: 'Test Tab',
  url: 'https://example.com',
  highlightedTitle: 'Test Tab',
  highlightedUrl: 'https://example.com',
  faviconUrl: 'https://example.com/favicon.ico',
  screenshotUrl: 'https://example.com/screenshot.png',
  windowId: 1,
  ...overrides
})

describe('SimpleStorage', () => {
  let storage: SimpleStorage

  beforeEach(() => {
    vi.clearAllMocks()
    storage = new SimpleStorage()
    mockChromeRuntime.lastError = undefined
  })

  describe('read operations', () => {
    it('should read valid data from storage', async () => {
      const testData = [createMockTab({ id: 1, url: 'https://example.com' })]
      mockChromeStorage.local.get.mockImplementation((keys, callback) => {
        callback({ tabHistory: testData })
      })

      const result = await storage.read<Tab[]>('tabHistory')
      
      expect(result).toEqual(testData)
      expect(mockChromeStorage.local.get).toHaveBeenCalledWith(['tabHistory'], expect.any(Function))
    })

    it('should return null for non-existent keys', async () => {
      mockChromeStorage.local.get.mockImplementation((keys, callback) => {
        callback({}) // Empty result
      })

      const result = await storage.read('tabHistory')
      
      expect(result).toBeNull()
    })

    it('should return null for invalid data and log warning', async () => {
      const invalidData = 'not an array'
      mockChromeStorage.local.get.mockImplementation((keys, callback) => {
        callback({ tabHistory: invalidData })
      })

      const result = await storage.read('tabHistory')
      
      expect(result).toBeNull()
    })

    it('should handle Chrome storage errors', async () => {
      mockChromeRuntime.lastError = { message: 'Storage error' }
      mockChromeStorage.local.get.mockImplementation((keys, callback) => {
        callback(null)
      })

      await expect(storage.read('tabHistory')).rejects.toThrow('Storage error')
    })
  })

  describe('write operations', () => {
    it('should write valid data to storage', async () => {
      const testData = [createMockTab({ id: 1, url: 'https://example.com' })]
      mockChromeStorage.local.set.mockImplementation((data, callback) => {
        callback()
      })

      await storage.write('tabHistory', testData)
      
      expect(mockChromeStorage.local.set).toHaveBeenCalledWith(
        { tabHistory: testData },
        expect.any(Function)
      )
    })

    it('should reject invalid data', async () => {
      const invalidData = 'not an array'
      
      await expect(storage.write('tabHistory', invalidData as any)).rejects.toThrow('Invalid data for key tabHistory')
      
      expect(mockChromeStorage.local.set).not.toHaveBeenCalled()
    })

    it('should handle Chrome storage write errors', async () => {
      const testData = [createMockTab()]
      mockChromeRuntime.lastError = { message: 'Write failed' }
      mockChromeStorage.local.set.mockImplementation((data, callback) => {
        callback()
      })

      await expect(storage.write('tabHistory', testData)).rejects.toThrow('Write failed')
    })
  })

  describe('delete operations', () => {
    it('should delete data from storage', async () => {
      mockChromeStorage.local.remove.mockImplementation((keys, callback) => {
        callback()
      })

      await storage.delete('tabHistory')
      
      expect(mockChromeStorage.local.remove).toHaveBeenCalledWith(['tabHistory'], expect.any(Function))
    })

    it('should handle Chrome storage delete errors', async () => {
      mockChromeRuntime.lastError = { message: 'Delete failed' }
      mockChromeStorage.local.remove.mockImplementation((keys, callback) => {
        callback()
      })

      await expect(storage.delete('tabHistory')).rejects.toThrow('Delete failed')
    })
  })

  describe('storage info operations', () => {
    it('should get storage usage information', async () => {
      const bytesInUse = 1024
      mockChromeStorage.local.getBytesInUse.mockImplementation((keys, callback) => {
        callback(bytesInUse)
      })

      const result = await storage.getStorageInfo()
      
      expect(result).toEqual({
        bytesInUse: 1024,
        quota: 10 * 1024 * 1024 // 10MB
      })
    })

    it('should handle Chrome storage info errors', async () => {
      mockChromeRuntime.lastError = { message: 'Info failed' }
      mockChromeStorage.local.getBytesInUse.mockImplementation((keys, callback) => {
        callback(0)
      })

      await expect(storage.getStorageInfo()).rejects.toThrow('Info failed')
    })
  })

  describe('clear all operations', () => {
    it('should clear all storage', async () => {
      mockChromeStorage.local.clear.mockImplementation((callback) => {
        callback()
      })

      await storage.clearAll()
      
      expect(mockChromeStorage.local.clear).toHaveBeenCalledWith(expect.any(Function))
    })

    it('should handle Chrome storage clear errors', async () => {
      mockChromeRuntime.lastError = { message: 'Clear failed' }
      mockChromeStorage.local.clear.mockImplementation((callback) => {
        callback()
      })

      await expect(storage.clearAll()).rejects.toThrow('Clear failed')
    })
  })

  describe('validation behavior', () => {
    it('should accept valid tab history data', async () => {
      const validTabs = [
        createMockTab({ id: 1, url: 'https://example.com' }),
        createMockTab({ id: 2, url: 'https://another.com' })
      ]
      mockChromeStorage.local.set.mockImplementation((data, callback) => {
        callback()
      })

      await expect(storage.write('tabHistory', validTabs)).resolves.toBeUndefined()
    })

    it('should reject tab history with invalid tabs', async () => {
      const invalidTabs = [
        { id: 'not-a-number', url: 'https://example.com' } // Invalid ID
      ]

      await expect(storage.write('tabHistory', invalidTabs as any)).rejects.toThrow('Invalid data for key tabHistory')
    })

    it('should accept valid harpoon windows data', async () => {
      const validHarpoonWindows = {
        1: [createMockTab({ id: 1, windowId: 1 })],
        2: [createMockTab({ id: 2, windowId: 2 })]
      }
      mockChromeStorage.local.set.mockImplementation((data, callback) => {
        callback()
      })

      await expect(storage.write('harpoonWindows', validHarpoonWindows)).resolves.toBeUndefined()
    })

    it('should reject harpoon windows with invalid structure', async () => {
      const invalidHarpoonWindows = {
        1: 'not an array'
      }

      await expect(storage.write('harpoonWindows', invalidHarpoonWindows as any)).rejects.toThrow('Invalid data for key harpoonWindows')
    })

    it('should accept valid system health data', async () => {
      const validSystemHealth: SystemHealth = {
        version: 1,
        lastCleanup: Date.now(),
        errorCount: 0,
        lastHealthCheck: Date.now()
      }
      mockChromeStorage.local.set.mockImplementation((data, callback) => {
        callback()
      })

      await expect(storage.write('systemHealth', validSystemHealth)).resolves.toBeUndefined()
    })

    it('should reject invalid system health data', async () => {
      const invalidSystemHealth = {
        version: 'not-a-number',
        lastCleanup: Date.now()
      }

      await expect(storage.write('systemHealth', invalidSystemHealth as any)).rejects.toThrow('Invalid data for key systemHealth')
    })

    it('should accept valid screenshot map data', async () => {
      const validScreenshotMap = {
        'https://example.com': 'data:image/png;base64,abc123'
      }
      mockChromeStorage.local.set.mockImplementation((data, callback) => {
        callback()
      })

      await expect(storage.write('tabsScreenshotMap', validScreenshotMap)).resolves.toBeUndefined()
    })

    it('should accept valid window states data', async () => {
      const validWindowStates = {
        1: {
          id: 1,
          focused: true,
          lastActivity: Date.now(),
          activeTabId: 123
        }
      }
      mockChromeStorage.local.set.mockImplementation((data, callback) => {
        callback()
      })

      await expect(storage.write('windowStates', validWindowStates)).resolves.toBeUndefined()
    })
  })

  describe('edge cases', () => {
    it('should handle undefined and null values correctly', async () => {
      mockChromeStorage.local.get.mockImplementation((keys, callback) => {
        callback({ tabHistory: undefined })
      })

      const result = await storage.read('tabHistory')
      expect(result).toBeNull()
    })

    it('should validate empty arrays as valid for tab-related keys', async () => {
      mockChromeStorage.local.set.mockImplementation((data, callback) => {
        callback()
      })

      await expect(storage.write('tabHistory', [])).resolves.toBeUndefined()
      await expect(storage.write('harpoonHistory', [])).resolves.toBeUndefined()
    })

    it('should validate empty objects as valid for object-type keys', async () => {
      mockChromeStorage.local.set.mockImplementation((data, callback) => {
        callback()
      })

      await expect(storage.write('harpoonWindows', {})).resolves.toBeUndefined()
      await expect(storage.write('windowStates', {})).resolves.toBeUndefined()
      await expect(storage.write('tabsScreenshotMap', {})).resolves.toBeUndefined()
    })
  })
})