<script lang="ts">
  import { onMount } from 'svelte'

  let excludedSites: string[] = []
  let newPattern = ''
  let loading = false
  let error = ''

  onMount(async () => {
    loadExcludedSites()
    
    // Listen for storage changes
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.excludedSites) {
        excludedSites = changes.excludedSites.newValue || []
      }
    })
  })

  async function loadExcludedSites() {
    const response = await chrome.runtime.sendMessage({
      message: 'getExcludedSites'
    })
    excludedSites = response?.sites || []
  }

  async function addPattern() {
    if (!newPattern.trim() || loading) return
    
    error = ''
    loading = true
    
    try {
      await chrome.runtime.sendMessage({
        message: 'addExcludedSite',
        pattern: newPattern.trim()
      })
      newPattern = ''
      await loadExcludedSites()
    } catch (e) {
      error = 'Failed to add pattern'
    } finally {
      loading = false
    }
  }

  async function removePattern(pattern: string) {
    if (loading) return
    
    loading = true
    
    try {
      await chrome.runtime.sendMessage({
        message: 'removeExcludedSite',
        pattern
      })
      await loadExcludedSites()
    } catch (e) {
      error = 'Failed to remove pattern'
    } finally {
      loading = false
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      addPattern()
    }
  }
</script>

<div class="excluded-sites">
  <h2 class="section-title">Excluded Sites</h2>
  
  {#if excludedSites.length > 0}
    <div class="sites-list">
      {#each excludedSites as site}
        <div class="site-item">
          <span class="site-pattern">{site}</span>
          <button
            class="remove-button"
            on:click={() => removePattern(site)}
            disabled={loading}
            title="Remove"
          >
            ×
          </button>
        </div>
      {/each}
    </div>
  {:else}
    <div class="empty-state">
      No excluded sites
    </div>
  {/if}

  <div class="add-pattern">
    <input
      type="text"
      bind:value={newPattern}
      on:keydown={handleKeydown}
      placeholder="Add pattern (e.g., *.google.com)"
      class="pattern-input"
      disabled={loading}
    />
    <button
      class="add-button"
      on:click={addPattern}
      disabled={!newPattern.trim() || loading}
    >
      Add
    </button>
  </div>

  {#if error}
    <div class="error">{error}</div>
  {/if}

  <div class="examples">
    <span class="examples-label">Examples:</span>
    <code>example.com</code>
    <code>*.github.com</code>
    <code>localhost:*</code>
  </div>
</div>

<style>
  .excluded-sites {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .section-title {
    font-size: 14px;
    font-weight: 600;
    color: #e0e0e0;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .sites-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    max-height: 200px;
    overflow-y: auto;
  }

  .site-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    background: #2a2a2a;
    border-radius: 4px;
    transition: background 0.2s;
  }

  .site-item:hover {
    background: #3a3a3a;
  }

  .site-pattern {
    font-size: 13px;
    color: #f0f0f0;
    font-family: 'Roboto Mono', monospace;
    word-break: break-all;
  }

  .remove-button {
    width: 24px;
    height: 24px;
    border: none;
    background: #7f1d1d;
    color: #f87171;
    border-radius: 4px;
    font-size: 20px;
    line-height: 1;
    cursor: pointer;
    transition: all 0.2s;
    flex-shrink: 0;
  }

  .remove-button:hover:not(:disabled) {
    background: #991b1b;
  }

  .remove-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .empty-state {
    padding: 20px;
    text-align: center;
    color: #666;
    font-size: 13px;
    background: #2a2a2a;
    border-radius: 4px;
  }

  .add-pattern {
    display: flex;
    gap: 8px;
  }

  .pattern-input {
    flex: 1;
    padding: 8px 12px;
    background: #2a2a2a;
    border: 1px solid #3a3a3a;
    color: #f0f0f0;
    border-radius: 4px;
    font-family: inherit;
    font-size: 13px;
  }

  .pattern-input:focus {
    outline: none;
    border-color: #4a4a4a;
    background: #3a3a3a;
  }

  .pattern-input::placeholder {
    color: #666;
  }

  .add-button {
    padding: 8px 20px;
    background: #065f46;
    color: #4ade80;
    border: none;
    border-radius: 4px;
    font-family: inherit;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }

  .add-button:hover:not(:disabled) {
    background: #047857;
  }

  .add-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .error {
    padding: 8px 12px;
    background: #7f1d1d;
    color: #fca5a5;
    border-radius: 4px;
    font-size: 12px;
  }

  .examples {
    padding: 8px 12px;
    background: #1f1f1f;
    border-radius: 4px;
    font-size: 11px;
    color: #888;
  }

  .examples-label {
    margin-right: 8px;
  }

  .examples code {
    background: #2a2a2a;
    padding: 2px 6px;
    border-radius: 3px;
    margin: 0 4px;
    color: #a0a0a0;
  }
</style>