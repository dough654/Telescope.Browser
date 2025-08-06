<script lang="ts">
  import { inputMode } from '../stores/modal.js'
</script>

<div class="telescope-mode-indicator">
  <span
    class="telescope-mode-text"
    class:telescope-mode-normal={$inputMode === 'normal'}
    class:telescope-mode-insert={$inputMode === 'insert'}
    class:telescope-mode-visual={$inputMode === 'visual'}
  >
    {$inputMode.toUpperCase()}
  </span>
</div>

<style>
  .telescope-mode-indicator {
    display: flex;
    align-items: center;
    padding: 0;
    margin-top: 0.25rem;
  }

  .telescope-mode-text {
    padding: 0.25rem 0.25rem;
    border-radius: 6px 6px 6px 6px;
    font-size: 0.8rem;
    font-weight: bold;
    letter-spacing: 0.5px;
    transition: all 0.2s ease;
    min-width: 60px;
    text-align: center;
    margin: 0;
    position: relative;
  }

  .telescope-mode-normal {
    background-color: #87ceeb; /* Light blue like neovim */
    color: #1a1a1a;
  }

  .telescope-mode-insert {
    background-color: #90ee90; /* Light green like neovim */
    color: #1a1a1a;
  }

  .telescope-mode-visual {
    background-color: #dda0dd; /* Light purple like neovim */
    color: #1a1a1a;
  }
</style>

