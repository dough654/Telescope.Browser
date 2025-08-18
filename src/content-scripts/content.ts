import Modal from '../components/Modal.svelte'
import { setupKeyboardHandler, cleanupKeyboardHandler } from '../services/keyboard-handler.js'
import { openModal, isModalOpen, closeModal } from '../stores/modal.js'
import { get } from 'svelte/store'
import { updateAllTabs, updateHarpoonTabs } from '../stores/tabs.js'
import { requestInitialSync } from '../services/service-worker-bridge.js'
import { hideLoading } from '../stores/loading.js'
import { updateHarpoonIndicator, hideHarpoonIndicator } from '../stores/harpoon-indicator.js'
import { contentLogger } from '../utils/logger.js'
import { configureLogs } from '../utils/logging-config.js'
import type { Tab } from '../types/shared.js'

// Configure logging levels
configureLogs()

// Reset loading state when content script loads on new page
hideLoading()

let modalApp: Modal
let extensionNavigating = false // Flag to track extension-initiated navigation
let isInitialized = false
let cleanupFunctions: (() => void)[] = []

async function checkIfSiteExcluded(): Promise<boolean> {
  try {
    const response = await chrome.runtime.sendMessage({
      message: 'isUrlExcluded',
      url: window.location.href
    })
    return response?.isExcluded || false
  } catch (error) {
    contentLogger.error('Failed to check if site is excluded:', error)
    return false
  }
}

function cleanupExtension() {
  if (!isInitialized) return
  
  contentLogger.info('Cleaning up Telescope extension due to site exclusion')
  
  // Close modal if open
  if (get(isModalOpen)) {
    closeModal()
  }
  
  // Remove shadow host
  const shadowHost = document.getElementById('telescope-shadow-host')
  if (shadowHost) {
    shadowHost.remove()
  }
  
  // Clean up keyboard handler
  cleanupKeyboardHandler()
  
  // Run cleanup functions
  cleanupFunctions.forEach(cleanup => cleanup())
  cleanupFunctions = []
  
  // Destroy svelte app
  if (modalApp) {
    modalApp.$destroy()
    modalApp = null as any
  }
  
  isInitialized = false
}

function initializeTelescopeExtension() {
  if (isInitialized) return
  isInitialized = true
  
  contentLogger.info('Initializing Telescope extension')
  
  // Create shadow DOM container
  const shadowHost = document.createElement('div')
  shadowHost.id = 'telescope-shadow-host'

  // Apply aggressive CSS isolation to the shadow host
  shadowHost.style.cssText = `
    all: initial !important;
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    height: 100% !important;
    pointer-events: none !important;
    z-index: 2147483647 !important;
    font-family: 'Roboto Mono', 'Courier New', monospace !important;
    font-size: 14px !important;
    line-height: 1.4 !important;
    font-weight: 400 !important;
    color: initial !important;
    background: initial !important;
    border: initial !important;
    margin: initial !important;
    padding: initial !important;
    zoom: 1 !important;
    transform: none !important;
  `

  document.body.appendChild(shadowHost)

  const shadowRoot = shadowHost.attachShadow({ mode: 'open' })

  // Inject font faces directly
  const fontStyle = document.createElement('style')
  const regularFont = chrome.runtime.getURL('public/fonts/RobotoMono-Regular.woff2')
  const mediumFont = chrome.runtime.getURL('public/fonts/RobotoMono-Medium.woff2')
  const boldFont = chrome.runtime.getURL('public/fonts/RobotoMono-Bold.woff2')

  fontStyle.textContent = `
    @font-face {
      font-family: 'Roboto Mono';
      font-style: normal;
      font-weight: 400;
      font-display: swap;
      src: url('${regularFont}') format('woff2');
    }
    
    @font-face {
      font-family: 'Roboto Mono';
      font-style: normal;
      font-weight: 500;
      font-display: swap;
      src: url('${mediumFont}') format('woff2');
    }
    
    @font-face {
      font-family: 'Roboto Mono';
      font-style: normal;
      font-weight: 700;
      font-display: swap;
      src: url('${boldFont}') format('woff2');
    }
  `

  shadowRoot.appendChild(fontStyle)

  // Create container for the Svelte app with font isolation
  const appContainer = document.createElement('div')
  appContainer.style.cssText = `
    pointer-events: none;
    width: 100% !important;
    height: 100% !important;
    font-family: 'Roboto Mono', 'Courier New', monospace !important;
    font-size: 14px !important;
    line-height: 1.4 !important;
    font-weight: 400 !important;
    zoom: 1 !important;
    transform: none !important;
    box-sizing: border-box !important;
  `
  shadowRoot.appendChild(appContainer)

  // Initialize Svelte modal component
  modalApp = new Modal({
    target: appContainer
  })

  // Update pointer events based on modal state
  isModalOpen.subscribe((isOpen) => {
    appContainer.style.pointerEvents = isOpen ? 'auto' : 'none'

    // Notify service worker about modal state change
    // This prevents the screenshot manager from capturing screenshots while the modal is open,
    // which would result in screenshots that include our own UI instead of the actual tab content
    chrome.runtime
      .sendMessage({
        message: 'modalStateChanged',
        isOpen: isOpen
      })
      .catch((error) => {
        // Ignore errors - service worker might not be ready
        // Ignore errors - service worker might not be ready
      })
  })
}

// Listen for messages from service worker
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // Handle modal opening requests from service worker
  // This is used when keyboard shortcuts are triggered inside iframes - the iframe's content script
  // detects the shortcut and notifies the service worker, which then tells the parent frame's
  // content script to open the modal (preventing the modal from appearing inside the iframe)
  if (request.message === 'showModal') {
    openModal(request.mode)
    sendResponse({ success: true })
  }

  if (request.message === 'tabsUpdated') {
    // Update the stores with the latest tab data
    if (request.allTabs) {
      updateAllTabs(request.allTabs)
    }
    // Note: harpoonTabs are no longer sent in tabsUpdated messages
    // Harpoon updates are handled via harpoonChanged messages for proper window scoping
    sendResponse({ success: true })
  }

  if (request.message === 'harpoonChanged') {
    // Request fresh window-specific data
    requestInitialSync()
      .then((syncData) => {
        updateAllTabs(syncData.allTabs)
        updateHarpoonTabs(syncData.harpoonTabs)

        // Update harpoon indicator based on current tab
        const currentUrl = window.location.href
        const index = syncData.harpoonTabs.findIndex((tab: Tab) => tab.url === currentUrl)

        if (index !== -1) {
          updateHarpoonIndicator(index)
        } else {
          hideHarpoonIndicator()
        }
      })
      .catch((error) => {
        contentLogger.error('Failed to sync after harpoon change:', error)
      })

    sendResponse({ success: true })
  }

  if (request.message === 'isModalOpen') {
    // Check if modal is currently open
    const modalState = get(isModalOpen)
    sendResponse({ isOpen: modalState })
  }

  if (request.message === 'extensionNavigating') {
    // Extension is about to navigate to this tab - set flag to prevent auto-close
    extensionNavigating = true
    sendResponse({ success: true })
  }

  if (request.message === 'settingsChanged' && request.type === 'excludedSites') {
    // Settings changed, check if we should clean up or re-enable
    checkIfSiteExcluded().then(isExcluded => {
      if (isExcluded) {
        cleanupExtension()
      } else if (!isInitialized) {
        // Site was excluded but now isn't - re-enable everything
        setupKeyboardHandler() // Ensure keyboard handler is active
        initializeTelescopeExtension()
      }
    })
    sendResponse({ success: true })
  }

  // Return true to indicate we will send a response asynchronously
  return true
})

// Setup keyboard event handling IMMEDIATELY to ensure priority over other extensions
setupKeyboardHandler()

// Initialize the extension - check exclusion asynchronously
async function initializeIfNotExcluded() {
  const isExcluded = await checkIfSiteExcluded()
  
  if (isExcluded) {
    contentLogger.info('Site is excluded, not initializing Telescope extension')
    return
  }
  
  initializeTelescopeExtension()
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeIfNotExcluded)
} else {
  // DOM is already loaded, initialize immediately
  initializeIfNotExcluded()
}

// Auto-close modal on manual tab navigation
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    // Small delay to allow extension-initiated tab switches to complete
    setTimeout(() => {
      if (get(isModalOpen) && !extensionNavigating) {
        closeModal()
      }
      // Clear the extension navigation flag after checking
      extensionNavigating = false
    }, 150) // 150ms delay to allow extension navigation to complete
  }
})
