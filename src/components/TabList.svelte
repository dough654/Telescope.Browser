<script lang="ts">
  import { onMount, afterUpdate } from 'svelte'
  import { filteredTabsFromSearch } from '../stores/search.js'
  import { selectedTabIndex, setSelectedTab, inputMode } from '../stores/modal.js'
  import { modalMode } from '../stores/modal.js'
  import { switchToTab } from '../services/service-worker-bridge.js'
  import { closeModal } from '../stores/modal.js'
  import { updateFilteredTabs } from '../stores/tabs.js'
  import { visualSelectionIndices } from '../stores/visual-selection.js'

  let tabListContainer: HTMLDivElement
  let tabList: HTMLUListElement

  // Update filtered tabs when search results change
  $: {
    updateFilteredTabs($filteredTabsFromSearch)
  }

  // Scroll to selected tab
  $: if (tabListContainer && $selectedTabIndex >= 0) {
    // Small delay to ensure other scroll operations complete first
    setTimeout(() => {
      scrollToSelectedTab()
    }, 50)
  }

  // Track initial scroll with afterUpdate lifecycle
  let hasInitiallyScrolled = false

  function scrollToSelectedTab() {
    const selectedTab = tabList?.querySelector(`[data-index="${$selectedTabIndex}"]`)
    
    if (selectedTab && tabListContainer) {
      // Get the position of the selected tab relative to the container
      const selectedTabElement = selectedTab as HTMLElement
      const containerTop = tabListContainer.scrollTop
      const containerBottom = containerTop + tabListContainer.clientHeight
      const tabTop = selectedTabElement.offsetTop
      const tabBottom = tabTop + selectedTabElement.offsetHeight
      const tabHeight = selectedTabElement.offsetHeight

      // Buffer space: 1-2 tabs worth of height for smoother scrolling
      const bufferSize = tabHeight * 1.5

      // More aggressive scrolling with buffer
      // Start scrolling when tab gets within buffer distance of the edges
      if (tabTop < containerTop + bufferSize) {
        // Position the tab with buffer space above it
        tabListContainer.scrollTop = Math.max(0, tabTop - bufferSize)
      } else if (tabBottom > containerBottom - bufferSize) {
        // Position the tab with buffer space below it
        tabListContainer.scrollTop = tabBottom + bufferSize - tabListContainer.clientHeight
      }
    }
  }

  async function handleTabClick(index: number) {
    setSelectedTab(index)
    await handleTabSelect()
  }

  async function handleTabSelect() {
    const selectedTab = $filteredTabsFromSearch[$selectedTabIndex]
    if (selectedTab) {
      try {
        await switchToTab(selectedTab.id)
        closeModal()
      } catch (error) {
        console.error('Failed to switch to tab:', error)
      }
    }
  }

  onMount(() => {
    // Set initial selection to the first tab
    if ($filteredTabsFromSearch.length > 0) {
      setSelectedTab(0)
    }
  })

  afterUpdate(() => {
    // Scroll to bottom after DOM updates, but only once initially
    if (!hasInitiallyScrolled && tabListContainer && $filteredTabsFromSearch.length > 0 && tabListContainer.scrollHeight > 0) {
      tabListContainer.scrollTop = tabListContainer.scrollHeight - tabListContainer.clientHeight
      hasInitiallyScrolled = true
    }
  })
</script>

<div class="telescope-tab-list-container" bind:this={tabListContainer}>
  <ul class="telescope-tab-list" bind:this={tabList}>
    {#each $filteredTabsFromSearch as tab, index (tab.id)}
      <button
        class="telescope-tab-item"
        class:telescope-tab-selected={index === $selectedTabIndex && $inputMode !== 'visual'}
        class:telescope-tab-visual-selected={$inputMode === 'visual' && $visualSelectionIndices.includes(index)}
        class:telescope-tab-visual-cursor={$inputMode === 'visual' && index === $selectedTabIndex}
        data-index={index}
        on:click={() => handleTabClick(index)}
        type="button"
      >
        {#if $modalMode === 'harpoon'}
          <span class="telescope-harpoon-number">{index + 1}</span>
        {/if}
        <img class="telescope-favicon" src={tab.faviconUrl} alt="" />
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        <span class="telescope-tab-title">{@html tab.highlightedTitle}</span>
      </button>
    {/each}
  </ul>
</div>

<style>
  .telescope-tab-list-container {
    all: initial !important;
    flex: 1 !important;
    overflow-y: auto !important;
    background-color: #2a2a2a !important;
    border-radius: 4px !important;
    border: 1px solid #555 !important;
    padding: 8px !important;
    box-sizing: border-box !important;
    display: block !important;
  }

  .telescope-tab-list {
    all: initial !important;
    list-style: none !important;
    padding: 0 !important;
    margin: 0 !important;
    display: flex !important;
    flex-direction: column-reverse !important;
    min-height: 100% !important;
    box-sizing: border-box !important;
  }

  .telescope-tab-item {
    all: initial !important;
    display: flex !important;
    align-items: center !important;
    gap: 8px !important;
    padding: 6px !important;
    margin-bottom: 3px !important;
    background-color: #363636 !important;
    border-radius: 4px !important;
    cursor: pointer !important;
    color: #ddd !important;
    font-size: 13px !important;
    line-height: 1 !important;
    height: 33px !important;
    border: 1px solid transparent !important;
    width: 100% !important;
    text-align: left !important;
    font-family: 'Roboto Mono', 'Courier New', monospace !important;
    box-sizing: border-box !important;
  }

  .telescope-tab-item:hover {
    background-color: #404040 !important;
  }

  .telescope-tab-item.telescope-tab-selected {
    background-color: #87ceeb !important;
    color: #1a1a1a !important;
    border-color: #6bb6ff !important;
  }

  .telescope-tab-item.telescope-tab-visual-selected {
    background-color: #dda0dd !important; /* Light purple for visual selection */
    color: #1a1a1a !important;
    border-color: #da70d6 !important; /* Slightly darker purple border */
  }

  .telescope-tab-item.telescope-tab-visual-cursor {
    background-color: #da70d6 !important; /* Darker purple for cursor position */
    color: #1a1a1a !important;
    border-color: #ba55d3 !important; /* Even darker purple border for cursor */
  }

  .telescope-harpoon-number {
    background-color: #ff6b6b !important;
    color: white !important;
    padding: 3px 4px !important;
    border-radius: 3px !important;
    font-size: 11px !important;
    font-weight: bold !important;
    min-width: 16px !important;
    text-align: center !important;
    align-self: center !important;
    line-height: 1 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
  }

  .telescope-favicon {
    width: 16px !important;
    height: 16px !important;
    flex-shrink: 0 !important;
    align-self: center !important;
  }

  .telescope-tab-title {
    flex: 1 !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    white-space: nowrap !important;
    line-height: 1 !important;
    font-size: 13px !important;
    font-family: 'Roboto Mono', 'Courier New', monospace !important;
    display: flex !important;
    align-items: center !important;
    align-self: center !important;
  }

  :global(.telescope-highlighted) {
    background-color: #ffeb3b;
    color: #000;
    padding: 1px 2px;
    border-radius: 2px;
  }
</style>
