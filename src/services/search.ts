import Fuse from 'fuse.js'
import type { Tab } from '../types/shared.js'
import { searchLogger } from '../utils/logger.js'

export function searchTabs(tabs: Tab[], query: string) {
  const fuse = new Fuse(tabs, {
    keys: ['title', 'url'],
    threshold: 0.3,  // Tighter threshold for more precise matches
    includeScore: true,
    includeMatches: true,
    minMatchCharLength: 2,  // Require at least 2 characters to match
    ignoreLocation: true,   // Don't penalize matches based on position
    findAllMatches: false   // Stop at first good match
  })
  const results = fuse.search(query)
  return results
}
