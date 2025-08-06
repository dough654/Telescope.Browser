<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import {
    isModalOpen,
    modalTitle,
    closeModal,
    inputMode,
    switchToInsertMode
  } from '../stores/modal.js'
  import { loadTabs } from '../stores/tabs.js'
  import { disableScrolling, enableScrolling } from '../utils/html-utils.js'

  import SearchBar from './SearchBar.svelte'
  import TabList from './TabList.svelte'
  import TabPreview from './TabPreview.svelte'
  import HarpoonIndicator from './HarpoonIndicator.svelte'
  import WhichKey from './WhichKey.svelte'
  import LoadingSpinner from './LoadingSpinner.svelte'

  let modalElement
  let overlayElement
  let syncInterval: ReturnType<typeof setInterval> | null = null

  // Reactive statements
  $: if ($isModalOpen) {
    disableScrolling()
    // Start periodic sync when modal opens
    if (syncInterval === null) {
      syncInterval = setInterval(() => {
        // Periodic sync to keep tabs fresh
        loadTabs().catch((error) => {
          console.error('Failed to sync tabs periodically:', error)
        })
      }, 5000) // Sync every 5 seconds while modal is open
    }
  } else {
    enableScrolling()
    // Stop periodic sync when modal closes
    if (syncInterval !== null) {
      clearInterval(syncInterval)
      syncInterval = null
    }
  }

  onMount(async () => {
    await loadTabs()
  })

  onDestroy(() => {
    // Clean up interval if component is destroyed
    if (syncInterval !== null) {
      clearInterval(syncInterval)
      syncInterval = null
    }
  })

  function handleOverlayClick() {
    closeModal()
  }
</script>

<!-- Overlay -->
<div
  bind:this={overlayElement}
  class="telescope-overlay"
  class:telescope-hidden={!$isModalOpen}
  on:click={handleOverlayClick}
  role="presentation"
  aria-hidden="true"
></div>

<!-- Modal -->
<section
  bind:this={modalElement}
  class="telescope-modal"
  class:telescope-hidden={!$isModalOpen}
  class:telescope-modal-normal={$inputMode === 'normal'}
  class:telescope-modal-insert={$inputMode === 'insert'}
  class:telescope-modal-visual={$inputMode === 'visual'}
  role="dialog"
  aria-modal="true"
  aria-labelledby="telescope-title"
>
  <div class="telescope-modal-header">
    <span id="telescope-title" class="telescope-title">{$modalTitle}</span>
    <span
      class="telescope-mode-badge"
      class:telescope-mode-normal={$inputMode === 'normal'}
      class:telescope-mode-insert={$inputMode === 'insert'}
      class:telescope-mode-visual={$inputMode === 'visual'}
    >
      {$inputMode.toUpperCase()}
    </span>
  </div>

  <div class="telescope-modal-body">
    <div class="telescope-left-pane">
      <TabList />
      <SearchBar />
    </div>

    <div class="telescope-right-pane">
      <TabPreview />
    </div>
  </div>

  <div class="telescope-modal-footer">
    <!-- Mode indicator now integrated into header -->
  </div>
</section>

<!-- Harpoon Indicator -->
<HarpoonIndicator />

<!-- Which Key Popup -->
<WhichKey />

<!-- Global Loading Spinner -->
<LoadingSpinner />

<style>
  /* CSS Reset for complete isolation */
  * {
    margin: 0;
    padding: 0;
    border: 0;
    outline: 0;
    font-size: 100%;
    vertical-align: baseline;
    background: transparent;
    box-sizing: border-box;
    font-family: inherit;
    line-height: 1;
    text-decoration: none;
    list-style: none;
    border-collapse: collapse;
    border-spacing: 0;
  }

  /* Reset all CSS properties that could be inherited */
  *,
  *::before,
  *::after {
    all: unset;
    display: revert;
    box-sizing: border-box;
  }

  :global(body.telescope-scroll-disabled) {
    overflow: hidden;
  }

  /* ===== Scrollbar CSS ===== */
  /* Firefox */
  .telescope-modal * {
    scrollbar-width: auto;
    scrollbar-color: #808588 #363636;
  }

  /* Chrome, Edge, and Safari */
  .telescope-modal *::-webkit-scrollbar {
    width: 9px;
    height: 9px;
  }

  .telescope-modal *::-webkit-scrollbar-track {
    background: #363636;
  }

  .telescope-modal *::-webkit-scrollbar-thumb {
    background-color: #808588;
    border-radius: 6px;
    border: 2px none #ffffff;
  }

  .telescope-modal,
  .telescope-modal * {
    font-family: 'Roboto Mono', 'Courier New', monospace !important;
  }

  .telescope-modal {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 6px;
    width: 80%;
    padding: 21px;
    padding-top: 10px;
    height: 85%;
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background-color: #363636;
    border: 3px solid #ddd;
    border-radius: 8px;
    z-index: 2147483647;
    color: #ddd;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    transition: border-color 0.2s ease;
  }

  .telescope-modal-normal {
    border-color: #87ceeb; /* Light blue for normal mode */
  }

  .telescope-modal-insert {
    border-color: #90ee90; /* Light green for insert mode */
  }

  .telescope-modal-visual {
    border-color: #dda0dd; /* Light purple for visual mode */
  }

  .telescope-modal-footer {
    display: flex;
    justify-content: flex-start;
    align-items: flex-end;
    padding: 0;
    margin: 0;
    position: relative;
  }

  .telescope-modal-header {
    display: flex !important;
    justify-content: space-between !important;
    align-items: center !important;
    padding: 8px !important;
  }

  .telescope-title {
    font-size: 19px !important;
    font-weight: bold !important;
    color: #ddd !important;
  }

  .telescope-mode-badge {
    padding: 4px 8px !important;
    border-radius: 6px !important;
    font-size: 13px !important;
    font-weight: bold !important;
    letter-spacing: 0.5px !important;
    transition: all 0.2s ease !important;
    text-align: center !important;
    margin: 0 !important;
    min-width: 60px !important;
    display: inline-block !important;
  }

  .telescope-mode-normal {
    background-color: #87ceeb !important; /* Light blue like neovim */
    color: #1a1a1a !important;
  }

  .telescope-mode-insert {
    background-color: #90ee90 !important; /* Light green like neovim */
    color: #1a1a1a !important;
  }

  .telescope-mode-visual {
    background-color: #dda0dd !important; /* Light purple like neovim */
    color: #1a1a1a !important;
  }

  .telescope-modal-body {
    display: flex;
    flex: 1;
    gap: 16px;
    overflow: hidden;
  }

  .telescope-left-pane {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
  }

  .telescope-right-pane {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
  }

  .telescope-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    z-index: 2147483646;
  }

  .telescope-hidden {
    display: none !important;
  }
</style>
