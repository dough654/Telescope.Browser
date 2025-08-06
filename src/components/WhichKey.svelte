<script lang="ts">
  import { isWhichKeyVisible, whichKeyHints } from '../stores/which-key.js'
</script>

{#if $isWhichKeyVisible}
  <div class="which-key-popup">
    <div class="which-key-content">
      {#each $whichKeyHints as hint}
        <div class="which-key-item">
          <span class="which-key-key">{hint.key}</span>
          <span class="which-key-arrow">→</span>
          <span class="which-key-description">{hint.description}</span>
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  .which-key-popup {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background-color: #282c34;
    border-top: 1px solid #3e4451;
    z-index: 10002;
    padding: 0.75rem 1.5rem;
    font-family: 'Roboto Mono', 'Courier New', monospace !important;
    font-size: 0.85rem;
    line-height: 1.4;
  }

  .which-key-content {
    display: flex;
    flex-wrap: wrap;
    gap: 2rem;
    justify-content: center;
    max-width: 1200px;
    margin: 0 auto;
  }

  .which-key-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .which-key-key {
    color: #61afef;
    font-weight: 600;
    letter-spacing: 0.02em;
    font-family: 'Roboto Mono', 'Courier New', monospace !important;
  }

  .which-key-arrow {
    color: #5c6370;
    margin: 0 0.25rem;
    font-weight: normal;
    font-family: 'Roboto Mono', 'Courier New', monospace !important;
  }

  .which-key-description {
    color: #abb2bf;
    font-weight: normal;
    font-family: 'Roboto Mono', 'Courier New', monospace !important;
  }
</style>