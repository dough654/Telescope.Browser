<script lang="ts">
  import { onMount } from 'svelte'
  import CurrentSiteToggle from './CurrentSiteToggle.svelte'
  import ExcludedSites from './ExcludedSites.svelte'

  let currentTab: chrome.tabs.Tab | null = null
  let currentDomain: string = ''

  onMount(async () => {
    // Get current tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tabs[0]) {
      currentTab = tabs[0]
      if (currentTab.url) {
        try {
          const url = new URL(currentTab.url)
          currentDomain = url.hostname
        } catch {
          currentDomain = 'Invalid URL'
        }
      }
    }
  })
</script>

<div class="popup-container">
  <header class="header">
    <h1>Telescope.browser</h1>
    <p class="subtitle">Settings</p>
  </header>

  {#if currentDomain}
    <CurrentSiteToggle domain={currentDomain} />
  {/if}

  <ExcludedSites />
</div>

<style>
  .popup-container {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .header {
    border-bottom: 1px solid #3a3a3a;
    padding-bottom: 12px;
  }

  h1 {
    font-size: 18px;
    font-weight: 700;
    color: #f0f0f0;
    margin: 0;
  }

  .subtitle {
    font-size: 12px;
    color: #888;
    margin-top: 4px;
  }
</style>