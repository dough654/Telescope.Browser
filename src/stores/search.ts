import { writable, derived } from 'svelte/store'
import type { Tab } from '../types/shared.js'
import { searchTabs } from '../services/search.js'
import { tabsToDisplay } from './tabs.js'
import { setSelectedTab } from './modal.js'

// Core search state
export const searchQuery = writable('')

// Derived stores
export const hasSearchQuery = derived(searchQuery, ($query) => {
  return $query.trim().length > 0
})

export const filteredTabsFromSearch = derived(
  [searchQuery, tabsToDisplay],
  ([$query, $tabsToDisplay]) => {
    if (!$query.trim()) {
      // Return tabs with original titles and URLs when no search query
      return $tabsToDisplay.map((tab) => ({
        ...tab,
        highlightedTitle: tab.title,
        highlightedUrl: tab.url
      }))
    }

    // Re-run search with current tabs whenever tabsToDisplay changes
    const results = searchTabs($tabsToDisplay, $query)
    
    return results
      .sort((a, b) => (a.score || 0) - (b.score || 0))
      .map((result) => {
        const tab = result.item
        let highlightedTitle = tab.title
        let highlightedUrl = tab.url

        // Process matches to create highlighted title and URL
        if (result.matches) {
          const titleMatch = result.matches.find((match) => match.key === 'title')
          if (titleMatch && titleMatch.indices) {
            highlightedTitle = highlightMatches(tab.title, titleMatch.indices)
          }
          
          const urlMatch = result.matches.find((match) => match.key === 'url')
          if (urlMatch && urlMatch.indices) {
            highlightedUrl = highlightMatches(tab.url, urlMatch.indices)
          }
        }

        return {
          ...tab,
          highlightedTitle,
          highlightedUrl
        }
      })
  }
)

function highlightMatches(text: string, indices: readonly [number, number][]): string {
  let result = ''
  let lastIndex = 0

  // Filter out single character matches and sort by start position
  const validIndices = indices
    .filter(([start, end]) => end - start >= 1) // At least 2 characters
    .sort((a, b) => a[0] - b[0])

  for (const [start, end] of validIndices) {
    // Add text before the match
    result += text.slice(lastIndex, start)
    // Add highlighted match
    result += `<span class="telescope-highlighted">${text.slice(start, end + 1)}</span>`
    lastIndex = end + 1
  }

  // Add remaining text
  result += text.slice(lastIndex)

  return result
}

// Actions
export function updateSearchQuery(query: string) {
  searchQuery.set(query)
  
  // Always select the first tab after search to ensure preview updates
  setSelectedTab(0)
}

export function clearSearch() {
  searchQuery.set('')
  setSelectedTab(0)
}

