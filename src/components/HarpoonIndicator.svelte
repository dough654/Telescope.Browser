<script lang="ts">
  import { onMount } from 'svelte'
  import { harpoonTabs } from '../stores/tabs.js'
  import { shouldFlashBorder } from '../stores/harpoon-flash.js'
  import { harpoonIndicatorState } from '../stores/harpoon-indicator.js'

  let isVisible = false
  let harpoonIndex = -1
  let shouldAnimate = false

  // React to border flash trigger
  $: showBorderFlash = $shouldFlashBorder

  // Use immediate indicator state when available, fall back to harpoon tabs
  $: {
    if ($harpoonIndicatorState.isVisible) {
      isVisible = $harpoonIndicatorState.isVisible
      harpoonIndex = $harpoonIndicatorState.index ?? -1
    } else {
      // TODO - evaluate this to see if it's still needed
      // Fallback to checking harpoon tabs
      const currentUrl = window.location.href
      const index = $harpoonTabs.findIndex((tab) => tab.url === currentUrl)

      if (index !== -1) {
        harpoonIndex = index
        isVisible = true
      } else {
        isVisible = false
        harpoonIndex = -1
      }
    }
  }

  export function show(animate: boolean = false) {
    shouldAnimate = animate
    isVisible = true

    if (animate) {
      // Remove animation class after animation completes
      setTimeout(() => {
        shouldAnimate = false
      }, 500)
    }
  }

  export function hide() {
    isVisible = false
    shouldAnimate = false
  }

  onMount(() => {
    // Check initial state
    const currentUrl = window.location.href
    const index = $harpoonTabs.findIndex((tab) => tab.url === currentUrl)

    if (index !== -1) {
      harpoonIndex = index
      isVisible = true
    }
  })
</script>

<!-- Screen border flash animation -->
{#if showBorderFlash}
  <div class="telescope-border-flash"></div>
{/if}

{#if isVisible}
  <div
    class="telescope-harpoon-indicator"
    class:telescope-harpoon-indicator-animate-on={shouldAnimate}
    class:telescope-harpoon-indicator-animate-off={!shouldAnimate}
  >
    {#if $harpoonIndicatorState.isLoading}
      <div class="telescope-harpoon-spinner"></div>
    {:else if harpoonIndex !== -1}
      {harpoonIndex + 1}
    {/if}
  </div>
{/if}

<style>
  .telescope-harpoon-indicator {
    position: fixed;
    bottom: 20px;
    left: 20px;
    background-color: #ff6b6b;
    color: white;
    padding: 8px 12px;
    border-radius: 20px;
    font-size: 0.9rem;
    font-weight: bold;
    z-index: 9999;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    border: 2px solid #fff;
    min-width: 30px;
    text-align: center;
    font-family: 'Roboto', sans-serif;
    pointer-events: none;
  }

  .telescope-harpoon-indicator-animate-on {
    animation: harpoon-pulse 0.5s ease-in-out;
  }

  .telescope-harpoon-indicator-animate-off {
    animation: none;
  }

  .telescope-border-flash {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border: 4px solid #ff6b6b;
    pointer-events: none;
    z-index: 10000;
    animation: border-flash 1s ease-out forwards;
  }

  @keyframes border-flash {
    0% {
      opacity: 1;
      border-width: 4px;
    }
    50% {
      opacity: 0.8;
      border-width: 6px;
    }
    100% {
      opacity: 0;
      border-width: 2px;
    }
  }

  @keyframes harpoon-pulse {
    0% {
      transform: scale(1);
      opacity: 1;
    }
    50% {
      transform: scale(1.2);
      opacity: 0.8;
    }
    100% {
      transform: scale(1);
      opacity: 1;
    }
  }

  .telescope-harpoon-spinner {
    width: 14px !important;
    height: 14px !important;
    border: 2px solid rgba(255, 255, 255, 0.3) !important;
    border-top: 2px solid #fff !important;
    border-radius: 50% !important;
    animation: harpoon-spin 1s linear infinite !important;
  }

  @keyframes harpoon-spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }
</style>

