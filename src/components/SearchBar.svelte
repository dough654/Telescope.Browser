<script lang="ts">
  import { searchQuery, updateSearchQuery } from '../stores/search.js'
  import { tabCount } from '../stores/tabs.js'
  import { isModalOpen, inputMode } from '../stores/modal.js'

  let searchInput: HTMLInputElement

  // Auto-focus when modal opens in insert mode
  $: if ($isModalOpen && $inputMode === 'insert' && searchInput) {
    // Small delay to ensure modal is fully rendered
    setTimeout(() => {
      searchInput.focus()
    }, 100)
  }

  // Blur search bar when switching to normal mode
  $: if ($inputMode === 'normal' && searchInput) {
    searchInput.blur()
  }

  function handleInput(event: Event) {
    const target = event.target as HTMLInputElement
    updateSearchQuery(target.value)
  }

  // No need for keydown handler anymore - keyboard-handler.ts handles escape
</script>

<div class="telescope-searchbar-wrapper">
  <div class="telescope-prompt-container">
    <span>&gt;</span>
    {#if $inputMode === 'normal'}
      <span class="telescope-normal-mode-cursor">█</span>
    {/if}
  </div>

  <input
    bind:this={searchInput}
    bind:value={$searchQuery}
    type="text"
    placeholder="Search..."
    class="telescope-searchbar"
    on:input={handleInput}
  />

  <div class="telescope-search-number">
    <span>{$tabCount}</span>
  </div>
</div>

<style>
  .telescope-searchbar-wrapper {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px;
    background-color: #2a2a2a;
    border-radius: 4px;
    border: 1px solid #555;
    margin-top: 8px;
  }

  .telescope-prompt-container {
    display: flex;
    align-items: center;
    color: #ddd;
    font-weight: bold;
    min-width: 20px;
  }

  .telescope-searchbar {
    flex: 1;
    background: transparent;
    border: none;
    color: #ddd;
    font-size: 16px;
    outline: none;
    padding: 4px;
  }

  .telescope-searchbar::placeholder {
    color: #888;
  }

  .telescope-search-number {
    color: #888;
    font-size: 14px;
    min-width: 50px;
    text-align: right;
  }

  .telescope-normal-mode-cursor {
    color: #87ceeb;
    margin-left: 4px;
    font-size: 19px;
    transform: scaleX(0.6) scaleY(1.2);
    display: inline-block;
    line-height: 1;
  }
</style>

