<script lang="ts">
  import { filteredTabsFromSearch } from '../stores/search.js'
  import { selectedTabIndex } from '../stores/modal.js'

  // Reactive values
  $: selectedTab = $filteredTabsFromSearch[$selectedTabIndex]
  $: hasScreenshot = selectedTab?.screenshotUrl && selectedTab.screenshotUrl.trim() !== ''
  $: previewImageUrl = selectedTab?.screenshotUrl || ''
  $: previewUrl = selectedTab?.highlightedUrl || 'No URL available'

  function handleImageError(event: Event) {
    const img = event.target as HTMLImageElement
    img.style.display = 'none'
    // Show placeholder when image fails to load
    hasScreenshot = false
  }
</script>

<div class="telescope-preview-container">
  <div class="telescope-preview-image-container">
    {#if hasScreenshot}
      <img
        class="telescope-preview-image"
        src={previewImageUrl}
        alt="Tab preview"
        on:error={handleImageError}
      />
    {:else}
      <div class="telescope-placeholder">
        <div class="telescope-placeholder-icon">📸</div>
        <div class="telescope-placeholder-title">Screenshot not available yet</div>
        <div class="telescope-placeholder-subtitle">Visit this tab to capture a preview</div>
      </div>
    {/if}
  </div>
  
  <div class="telescope-url-preview">
    <span class="telescope-url-preview-label">URL Preview</span>
    <div class="telescope-url-wrapper">
      <!-- eslint-disable-next-line svelte/no-at-html-tags -->
      <span class="telescope-url">{@html previewUrl}</span>
    </div>
  </div>
</div>

<style>
  .telescope-preview-container {
    display: flex !important;
    flex-direction: column !important;
    height: 100% !important;
    background-color: #2a2a2a !important;
    border-radius: 4px !important;
    border: 1px solid #555 !important;
    overflow: hidden !important;
  }

  .telescope-preview-image-container {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    background-color: #1a1a1a;
  }

  .telescope-preview-image {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }

  .telescope-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    color: #888;
    height: 100%;
    min-height: 200px;
    padding: 2rem;
  }

  .telescope-placeholder-icon {
    font-size: 3rem;
    margin-bottom: 1rem;
    opacity: 0.6;
  }

  .telescope-placeholder-title {
    font-size: 15px !important;
    font-weight: 500 !important;
    color: #bbb !important;
    margin-bottom: 0.5rem;
    line-height: 1.4 !important;
  }

  .telescope-placeholder-subtitle {
    font-size: 13px !important;
    color: #777 !important;
    line-height: 1.4 !important;
    max-width: 240px;
  }

  .telescope-url-preview {
    padding: 1rem !important;
    background-color: #363636 !important;
    border-top: 1px solid #555 !important;
  }

  .telescope-url-preview-label {
    display: block;
    color: #888 !important;
    font-size: 11px !important;
    margin-bottom: 0.5rem;
    text-transform: uppercase;
    letter-spacing: 0.5px !important;
  }

  .telescope-url-wrapper {
    background-color: #2a2a2a !important;
    padding: 0.5rem !important;
    border-radius: 4px !important;
    border: 1px solid #555 !important;
  }

  .telescope-url {
    color: #ddd !important;
    font-size: 13px !important;
    word-break: break-all;
    line-height: 1.4 !important;
  }

  :global(.telescope-url .telescope-highlighted) {
    background-color: #ffeb3b;
    color: #000;
    padding: 1px 2px;
    border-radius: 2px;
  }
</style>