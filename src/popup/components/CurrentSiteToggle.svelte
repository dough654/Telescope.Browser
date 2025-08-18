<script lang="ts">
  import { onMount } from 'svelte'

  export let domain: string

  let isExcluded = false
  let loading = true

  onMount(async () => {
    // Check if current domain is excluded
    const response = await chrome.runtime.sendMessage({
      message: 'isUrlExcluded',
      url: `https://${domain}`
    })
    isExcluded = response?.isExcluded || false
    loading = false
  })

  async function toggleExclusion() {
    if (loading) return
    
    loading = true
    
    if (isExcluded) {
      // Remove exclusion
      await chrome.runtime.sendMessage({
        message: 'removeExcludedSite',
        pattern: domain
      })
    } else {
      // Add exclusion
      await chrome.runtime.sendMessage({
        message: 'addExcludedSite',
        pattern: domain
      })
    }
    
    isExcluded = !isExcluded
    loading = false

    // Reload current tab to apply changes
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tabs[0]?.id) {
      chrome.tabs.reload(tabs[0].id)
    }
  }
</script>

<div class="current-site">
  <div class="site-info">
    <div class="label">Current Site</div>
    <div class="domain">{domain}</div>
  </div>
  
  <button 
    class="toggle-button"
    class:excluded={isExcluded}
    on:click={toggleExclusion}
    disabled={loading}
  >
    {loading ? '...' : isExcluded ? 'Excluded' : 'Enabled'}
  </button>
</div>

<style>
  .current-site {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px;
    background: #2a2a2a;
    border-radius: 6px;
  }

  .site-info {
    flex: 1;
  }

  .label {
    display: block;
    font-size: 11px;
    text-transform: uppercase;
    color: #888;
    margin-bottom: 4px;
    letter-spacing: 0.5px;
  }

  .domain {
    font-size: 14px;
    color: #f0f0f0;
    font-weight: 500;
    word-break: break-all;
  }

  .toggle-button {
    padding: 6px 16px;
    border: 1px solid #4a4a4a;
    background: #3a3a3a;
    color: #4ade80;
    border-radius: 4px;
    font-family: inherit;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
  }

  .toggle-button:hover:not(:disabled) {
    background: #4a4a4a;
  }

  .toggle-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .toggle-button.excluded {
    color: #f87171;
    border-color: #7f1d1d;
  }
</style>