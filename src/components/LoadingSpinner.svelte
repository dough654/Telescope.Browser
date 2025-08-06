<script lang="ts">
  import { loadingState } from '../stores/loading.js'
</script>

{#if $loadingState.isLoading}
  <div class="telescope-loading-overlay">
    <div class="telescope-loading-container">
      <div class="telescope-spinner"></div>
      {#if $loadingState.message}
        <div class="telescope-loading-message">{$loadingState.message}</div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .telescope-loading-overlay {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    right: 0 !important;
    bottom: 0 !important;
    background: rgba(0, 0, 0, 0.7) !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    z-index: 2147483647 !important;
    width: 100% !important;
    height: 100% !important;
  }

  .telescope-loading-container {
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    gap: 1rem !important;
  }

  .telescope-spinner {
    width: 40px !important;
    height: 40px !important;
    border: 3px solid rgba(221, 221, 221, 0.3) !important;
    border-top: 3px solid #ddd !important;
    border-radius: 50% !important;
    animation: telescope-spin 1s linear infinite !important;
  }

  .telescope-loading-message {
    color: #ddd !important;
    font-size: 0.9rem !important;
    font-weight: 500 !important;
    text-align: center !important;
    font-family: 'Roboto', sans-serif !important;
  }

  @keyframes telescope-spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
</style>