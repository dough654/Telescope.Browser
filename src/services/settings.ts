import { storage } from '../service-workers/storage/storage-layer.js'

export class SettingsService {
  /**
   * Get all excluded site patterns
   */
  async getExcludedSites(): Promise<string[]> {
    const sites = await storage.read<string[]>('excludedSites')
    return sites || []
  }

  /**
   * Add a new exclusion pattern
   */
  async addExcludedSite(pattern: string): Promise<void> {
    const sites = await this.getExcludedSites()
    
    // Don't add duplicates
    if (sites.includes(pattern)) {
      return
    }
    
    sites.push(pattern)
    await storage.write('excludedSites', sites)
  }

  /**
   * Remove an exclusion pattern
   */
  async removeExcludedSite(pattern: string): Promise<void> {
    const sites = await this.getExcludedSites()
    const filtered = sites.filter(site => site !== pattern)
    await storage.write('excludedSites', filtered)
  }

  /**
   * Check if a URL matches any exclusion pattern
   */
  async isUrlExcluded(url: string): Promise<boolean> {
    const sites = await this.getExcludedSites()
    
    if (sites.length === 0) {
      return false
    }
    
    try {
      const urlObj = new URL(url)
      const hostname = urlObj.hostname
      const pathname = urlObj.pathname
      const port = urlObj.port
      const fullHost = port ? `${hostname}:${port}` : hostname
      
      for (const pattern of sites) {
        if (this.matchesPattern(fullHost, pathname, pattern)) {
          return true
        }
      }
    } catch {
      // Invalid URL, don't exclude
      return false
    }
    
    return false
  }

  /**
   * Check if a hostname and path match a pattern
   */
  private matchesPattern(host: string, path: string, pattern: string): boolean {
    // Handle path patterns (e.g., "github.com/*/settings")
    if (pattern.includes('/')) {
      const [patternHost, ...patternPathParts] = pattern.split('/')
      const patternPath = '/' + patternPathParts.join('/')
      
      if (!this.matchesHostPattern(host, patternHost)) {
        return false
      }
      
      return this.matchesPathPattern(path, patternPath)
    }
    
    // Just host pattern
    return this.matchesHostPattern(host, pattern)
  }

  /**
   * Check if a hostname matches a host pattern
   */
  private matchesHostPattern(host: string, pattern: string): boolean {
    // Handle port wildcards (e.g., "localhost:*")
    if (pattern.includes(':*')) {
      const [patternHost] = pattern.split(':')
      const [actualHost, actualPort] = host.split(':')
      
      // Pattern expects a port, but URL has no port - no match
      if (!actualPort) {
        return false
      }
      
      return this.matchesSimplePattern(actualHost, patternHost)
    }
    
    return this.matchesSimplePattern(host, pattern)
  }

  /**
   * Check if a path matches a path pattern
   */
  private matchesPathPattern(path: string, pattern: string): boolean {
    return this.matchesSimplePattern(path, pattern)
  }

  /**
   * Simple wildcard matching
   */
  private matchesSimplePattern(text: string, pattern: string): boolean {
    // Convert wildcard pattern to regex
    const regexPattern = pattern
      .split('*')
      .map(part => this.escapeRegex(part))
      .join('.*')
    
    const regex = new RegExp(`^${regexPattern}$`)
    return regex.test(text)
  }

  /**
   * Escape special regex characters
   */
  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }
}

// Export singleton instance
export const settingsService = new SettingsService()