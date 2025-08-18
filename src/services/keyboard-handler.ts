import { get } from 'svelte/store'
import { targetIsText, isRunningInIFrame } from '../utils/html-utils.js'
import {
  keyBuffer,
  addKeyToBuffer,
  clearKeyBuffer,
  checkModalTrigger,
  checkEscapeSequence,
  checkHarpoonAdd,
  checkHarpoonRemove,
  checkHarpoonSwitch,
  checkDeleteSequence,
  checkSubmenuInvalidation,
  getHarpoonSubmenuHints,
  harpoonSubmenuActive,
  activateHarpoonSubmenu,
  clearHarpoonSubmenu,
  checkLastTab
} from '../stores/keyboard.js'
import {
  openModal,
  closeModal,
  isModalOpen,
  inputMode,
  switchToNormalMode,
  switchToInsertMode,
  switchToVisualMode,
  selectedTabIndex,
  setSelectedTab,
  modalMode
} from '../stores/modal.js'
import { filteredTabsFromSearch } from '../stores/search.js'
import {
  addTabToHarpoon,
  removeTabFromHarpoon,
  removeTabFromHarpoonById,
  getHarpoonTabs,
  sendOpenModalFromIFrame,
  switchToTab,
  closeTab,
  switchToLastBuffer
} from './service-worker-bridge.js'
import { updateHarpoonTabs, removeTabOptimistically } from '../stores/tabs.js'
import { triggerBorderFlash } from '../stores/harpoon-flash.js'
import {
  scheduleWhichKey,
  hideWhichKey,
  isWhichKeyVisible,
  showWhichKey
} from '../stores/which-key.js'
import { showTabSwitchLoading, hideLoading } from '../stores/loading.js'
import {
  showHarpoonIndicatorLoading,
  updateHarpoonIndicator,
  hideHarpoonIndicator
} from '../stores/harpoon-indicator.js'
import {
  startVisualSelection,
  clearVisualSelection,
  updateVisualCursor,
  visualSelectionIndices
} from '../stores/visual-selection.js'
import { keyboardLogger, harpoonLogger } from '../utils/logger.js'

function getSearchBar(): HTMLInputElement | null {
  const shadowHost = document.querySelector('#telescope-shadow-host')
  if (shadowHost?.shadowRoot) {
    return shadowHost.shadowRoot.querySelector('.telescope-searchbar') as HTMLInputElement
  }
  return null
}

function isSearchBarFocused(): boolean {
  const shadowHost = document.querySelector('#telescope-shadow-host')
  if (shadowHost?.shadowRoot) {
    const searchBar = getSearchBar()
    return shadowHost.shadowRoot.activeElement === searchBar
  }
  return false
}

let keyboardHandlerActive = false

export function setupKeyboardHandler() {
  if (keyboardHandlerActive) return
  window.addEventListener('keydown', handleKeydown, { capture: true, passive: false })
  keyboardHandlerActive = true
}

export function cleanupKeyboardHandler() {
  if (!keyboardHandlerActive) return
  window.removeEventListener('keydown', handleKeydown, { capture: true })
  keyboardHandlerActive = false
}

function handleKeydown(event: KeyboardEvent) {
  const userIsTyping = targetIsText(event)
  const currentIsModalOpen = get(isModalOpen)

  // AGGRESSIVE: If modal is open, immediately stop ALL propagation except for typing
  if (currentIsModalOpen) {
    const currentInputMode = get(inputMode)

    // Only allow typing in search bar in insert mode
    if (currentInputMode === 'insert') {
      // Always stop propagation to prevent website shortcuts
      event.stopPropagation()
      event.stopImmediatePropagation()

      if (!isSearchBarFocused()) {
        // Still prevent default for non-search bar events
        event.preventDefault()
      }
    } else {
      // In normal mode, stop ALL events immediately
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
    }
  }

  // Add key to buffer for command detection
  addKeyToBuffer(event.key)

  // Get current key buffer
  const currentKeyBuffer = get(keyBuffer)

  // Non-modal suppressions
  const nonModalSuppressions = [' ']
  if (nonModalSuppressions.includes(event.key) && !currentIsModalOpen && !userIsTyping) {
    event.preventDefault()
    event.stopImmediatePropagation()
  }

  // Modal suppression logic moved to top of function for maximum effectiveness

  if (userIsTyping) return

  const last2 = currentKeyBuffer.slice(-2)
  const last3 = currentKeyBuffer.slice(-3)

  // Define when commands should be allowed
  const modalClosed = !currentIsModalOpen
  const modalOpenInNormalMode = currentIsModalOpen && get(inputMode) === 'normal'
  const commandsAllowed = modalClosed || modalOpenInNormalMode

  // Which-key logic: Show hints when space is pressed and no modal is open
  if (event.key === ' ' && !currentIsModalOpen) {
    const whichKeyHints = [
      { key: 'space', description: 'tabs' },
      { key: 'h', description: '[H]arpoon' },
      { key: 'l', description: '[L]ast tab' },
      { key: '1-9', description: '[H]arpoon [1-9]' }
    ]
    scheduleWhichKey(whichKeyHints, 500)
  }

  // Special handling for harpoon submenu activation - CHECK THIS FIRST before hiding which-key
  if (last2.join('').toLowerCase() === ' h' && !currentIsModalOpen) {
    const isWhichKeyCurrentlyVisible = get(isWhichKeyVisible)

    if (isWhichKeyCurrentlyVisible) {
      // Which-key is already visible, show harpoon submenu immediately
      event.preventDefault()

      // Manually set submenu as active (without the timeout)
      harpoonSubmenuActive.set(true)

      // Show harpoon hints immediately without hiding first
      const harpoonHints = getHarpoonSubmenuHints()
      showWhichKey(harpoonHints) // Direct show, no delay or hiding
      return
    } else {
      // Which-key not visible, use normal submenu activation with timeout
      activateHarpoonSubmenu()
      return
    }
  }

  // Hide which-key when any non-space key is pressed, unless in harpoon submenu
  const isInHarpoonSubmenu = get(harpoonSubmenuActive)

  if (event.key !== ' ' && !isInHarpoonSubmenu) {
    hideWhichKey()
  }

  // Handle harpoon submenu keys - prevent propagation to avoid conflicts with Vimium
  if (isInHarpoonSubmenu && ['o', 'a', 'r'].includes(event.key.toLowerCase())) {
    event.preventDefault()
    event.stopPropagation()
    event.stopImmediatePropagation()
  }

  // Check for submenu invalidation (invalid key after "space h")
  if (checkSubmenuInvalidation(last3)) {
    hideWhichKey()
  }

  // Check for modal trigger (handles both 2-key and 3-key sequences)
  const modalTrigger2 = checkModalTrigger(last2)
  const modalTrigger3 = checkModalTrigger(last3)
  const modalTrigger = modalTrigger3 || modalTrigger2

  if (modalTrigger && !currentIsModalOpen) {
    event.preventDefault()
    clearKeyBuffer()
    hideWhichKey()

    if (isRunningInIFrame()) {
      sendOpenModalFromIFrame(modalTrigger)
    } else {
      openModal(modalTrigger)
    }
    return
  }

  // Handle escape key behavior based on current mode
  if (event.key === 'Escape' && currentIsModalOpen) {
    const currentInputMode = get(inputMode)

    if (currentInputMode === 'insert') {
      // In insert mode, single Escape switches to normal mode
      event.preventDefault()
      event.stopImmediatePropagation()
      switchToNormalMode()
      return
    } else {
      // In normal mode, check for double escape to close modal
      if (checkEscapeSequence(last2)) {
        closeModal()
        return
      }
    }
  }

  if (currentIsModalOpen && event.key === 'Enter') {
    event.preventDefault()
    event.stopImmediatePropagation()

    const filteredTabs = get(filteredTabsFromSearch)
    const currentIndex = get(selectedTabIndex)
    const selectedTab = filteredTabs[currentIndex]

    if (selectedTab) {
      showTabSwitchLoading()
      switchToTab(selectedTab.id)
        .then(() => {
          hideLoading()
          closeModal()
        })
        .catch((error) => {
          hideLoading()
          keyboardLogger.error('Failed to switch to tab:', error)
        })
    }
    return
  }

  // Handle arrow key navigation in both insert and normal modes
  if (currentIsModalOpen && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
    event.preventDefault()
    event.stopImmediatePropagation()

    const filteredTabs = get(filteredTabsFromSearch)
    const currentIndex = get(selectedTabIndex)

    if (event.key === 'ArrowDown') {
      // Because of column-reverse, going down visually means decreasing index
      if (currentIndex - 1 >= 0) {
        setSelectedTab(currentIndex - 1)
      }
    } else if (event.key === 'ArrowUp') {
      // Because of column-reverse, going up visually means increasing index
      if (currentIndex + 1 <= filteredTabs.length - 1) {
        setSelectedTab(currentIndex + 1)
      }
    }
    return
  }

  // Handle vim-style navigation keys in normal mode only
  if (currentIsModalOpen && get(inputMode) === 'normal') {
    const downKeys = ['j'] // j goes down visually
    const upKeys = ['k'] // k goes up visually

    const keysThatReturnToInsertMode = ['i', 'I', 'a', 'A']

    if (downKeys.includes(event.key)) {
      event.preventDefault()
      event.stopImmediatePropagation()

      const filteredTabs = get(filteredTabsFromSearch)
      const currentIndex = get(selectedTabIndex)

      // Because of column-reverse, going down visually means decreasing index
      if (currentIndex - 1 >= 0) {
        setSelectedTab(currentIndex - 1)
      }
      return
    } else if (upKeys.includes(event.key)) {
      event.preventDefault()
      event.stopImmediatePropagation()

      const filteredTabs = get(filteredTabsFromSearch)
      const currentIndex = get(selectedTabIndex)

      // Because of column-reverse, going up visually means increasing index
      if (currentIndex + 1 <= filteredTabs.length - 1) {
        setSelectedTab(currentIndex + 1)
      }
      return
    } else if (keysThatReturnToInsertMode.includes(event.key)) {
      // Switch back to insert mode and focus search bar
      switchToInsertMode()

      const searchBar = getSearchBar()
      if (searchBar) {
        searchBar.focus()
      }
      return
    } else if (event.key === 'v' && !event.shiftKey) {
      // Enter visual mode from normal mode (v key)
      event.preventDefault()
      event.stopImmediatePropagation()

      const currentIndex = get(selectedTabIndex)
      startVisualSelection(currentIndex)
      switchToVisualMode()
      return
    } else if (event.key === 'V' && event.shiftKey) {
      // Enter visual mode from normal mode (Shift+V key, same as v for our purposes)
      event.preventDefault()
      event.stopImmediatePropagation()

      const currentIndex = get(selectedTabIndex)
      startVisualSelection(currentIndex)
      switchToVisualMode()
      return
    }
  }

  // Handle visual mode navigation
  if (currentIsModalOpen && get(inputMode) === 'visual') {
    const downKeys = ['j'] // j goes down visually
    const upKeys = ['k'] // k goes up visually

    if (downKeys.includes(event.key)) {
      event.preventDefault()
      event.stopImmediatePropagation()

      const filteredTabs = get(filteredTabsFromSearch)
      const currentIndex = get(selectedTabIndex)

      // Because of column-reverse, going down visually means decreasing index
      if (currentIndex - 1 >= 0) {
        const newIndex = currentIndex - 1
        setSelectedTab(newIndex)
        updateVisualCursor(newIndex)
      }
      return
    } else if (upKeys.includes(event.key)) {
      event.preventDefault()
      event.stopImmediatePropagation()

      const filteredTabs = get(filteredTabsFromSearch)
      const currentIndex = get(selectedTabIndex)

      // Because of column-reverse, going up visually means increasing index
      if (currentIndex + 1 <= filteredTabs.length - 1) {
        const newIndex = currentIndex + 1
        setSelectedTab(newIndex)
        updateVisualCursor(newIndex)
      }
      return
    } else if (event.key === 'Escape') {
      // Exit visual mode back to normal mode
      event.preventDefault()
      event.stopImmediatePropagation()

      clearVisualSelection()
      switchToNormalMode()
      return
    }
  }

  // Handle arrow key navigation in visual mode
  if (
    currentIsModalOpen &&
    get(inputMode) === 'visual' &&
    (event.key === 'ArrowDown' || event.key === 'ArrowUp')
  ) {
    event.preventDefault()
    event.stopImmediatePropagation()

    const filteredTabs = get(filteredTabsFromSearch)
    const currentIndex = get(selectedTabIndex)

    if (event.key === 'ArrowDown') {
      // Because of column-reverse, going down visually means decreasing index
      if (currentIndex - 1 >= 0) {
        const newIndex = currentIndex - 1
        setSelectedTab(newIndex)
        updateVisualCursor(newIndex)
      }
    } else if (event.key === 'ArrowUp') {
      // Because of column-reverse, going up visually means increasing index
      if (currentIndex + 1 <= filteredTabs.length - 1) {
        const newIndex = currentIndex + 1
        setSelectedTab(newIndex)
        updateVisualCursor(newIndex)
      }
    }
    return
  }

  // Handle harpoon deletion in modal (dd command)
  if (currentIsModalOpen && get(inputMode) === 'normal' && get(modalMode) === 'harpoon') {
    if (checkDeleteSequence(last2)) {
      event.preventDefault()
      clearKeyBuffer()

      const filteredTabs = get(filteredTabsFromSearch)
      const currentIndex = get(selectedTabIndex)
      const selectedTab = filteredTabs[currentIndex]

      if (selectedTab) {
        // Show visual feedback
        triggerBorderFlash()

        // Remove the tab from harpoon
        removeTabFromHarpoonById(selectedTab.id)
          .then(() => {
            // Adjust selection index after deletion
            const newFilteredTabs = get(filteredTabsFromSearch)
            if (newFilteredTabs.length === 0) {
              // No tabs left, close modal
              closeModal()
            } else {
              // Adjust index to stay within bounds
              const newIndex = Math.min(currentIndex, newFilteredTabs.length - 1)
              setSelectedTab(newIndex)
            }
          })
          .catch((err) => {
            harpoonLogger.error('Failed to remove tab from harpoon:', err)
          })
      }
      return
    }
  }

  // Handle tab deletion in tab list modal (dd command)
  if (currentIsModalOpen && get(inputMode) === 'normal' && get(modalMode) === 'tab') {
    if (checkDeleteSequence(last2)) {
      event.preventDefault()
      clearKeyBuffer()

      const filteredTabs = get(filteredTabsFromSearch)
      const currentIndex = get(selectedTabIndex)
      const selectedTab = filteredTabs[currentIndex]

      if (selectedTab) {
        // Show visual feedback
        triggerBorderFlash()

        // Calculate what the filtered tabs will be after removal (before store updates)
        const filteredTabsAfterRemoval = filteredTabs.filter((tab) => tab.id !== selectedTab.id)

        // Optimistically remove the tab from UI immediately for responsive feedback
        removeTabOptimistically(selectedTab.id)

        // Adjust selection index based on calculated filtered tabs
        if (filteredTabsAfterRemoval.length === 0) {
          // No tabs left, close modal
          closeModal()
        } else {
          // Adjust index to stay within bounds after removal
          const newIndex = Math.min(currentIndex, filteredTabsAfterRemoval.length - 1)
          setSelectedTab(newIndex)
        }

        // Close the actual browser tab (this will trigger service worker cleanup)
        closeTab(selectedTab.id).catch((err) => {
          keyboardLogger.error('Failed to close tab:', err)
          // If tab closure fails, we could add logic here to restore the tab to the UI
          // For now, the service worker event will eventually sync the state
        })
      }
      return
    }
  }

  // Handle batch tab deletion in visual mode (dd command)
  if (currentIsModalOpen && get(inputMode) === 'visual' && get(modalMode) === 'tab') {
    if (checkDeleteSequence(last2)) {
      event.preventDefault()
      clearKeyBuffer()

      const filteredTabs = get(filteredTabsFromSearch)
      const selectedIndices = get(visualSelectionIndices)

      if (selectedIndices.length > 0) {
        // Show visual feedback
        triggerBorderFlash()

        // Get all tabs to be deleted
        const tabsToDelete = selectedIndices
          .map((index) => filteredTabs[index])
          .filter((tab) => tab) // Filter out any undefined tabs

        if (tabsToDelete.length === 0) {
          return
        }

        // Optimistically remove all selected tabs from UI
        tabsToDelete.forEach((tab) => {
          removeTabOptimistically(tab.id)
        })

        // Calculate what the filtered tabs will be after removal (before store updates)
        const filteredTabsAfterRemoval = filteredTabs.filter(
          (tab) => !tabsToDelete.some((deletedTab) => deletedTab.id === tab.id)
        )

        // Clear visual selection and return to normal mode
        clearVisualSelection()
        switchToNormalMode()

        // Check if we need to close modal or adjust selection based on calculated filtered tabs
        if (filteredTabsAfterRemoval.length === 0) {
          // No tabs left, close modal
          closeModal()
        } else {
          // Adjust selection index to stay within bounds after removal
          const minSelectedIndex = Math.min(...selectedIndices)
          const newIndex = Math.min(minSelectedIndex, filteredTabsAfterRemoval.length - 1)
          setSelectedTab(Math.max(0, newIndex))
        }

        // Close all selected browser tabs
        tabsToDelete.forEach((tab) => {
          closeTab(tab.id).catch((err) => {
            keyboardLogger.error(`Failed to close tab ${tab.id}:`, err)
          })
        })

        keyboardLogger.info(`Batch deleted ${tabsToDelete.length} tabs in visual mode`)
      }
      return
    }
  }

  // Handle batch harpoon deletion in visual mode (dd command)
  if (currentIsModalOpen && get(inputMode) === 'visual' && get(modalMode) === 'harpoon') {
    if (checkDeleteSequence(last2)) {
      event.preventDefault()
      clearKeyBuffer()

      const filteredTabs = get(filteredTabsFromSearch)
      const selectedIndices = get(visualSelectionIndices)

      if (selectedIndices.length > 0) {
        // Show visual feedback
        triggerBorderFlash()

        // Get all tabs to be removed from harpoon
        const tabsToRemove = selectedIndices
          .map((index) => filteredTabs[index])
          .filter((tab) => tab) // Filter out any undefined tabs

        if (tabsToRemove.length === 0) {
          return
        }

        // Optimistically remove all selected tabs from UI immediately for responsive feedback
        tabsToRemove.forEach((tab) => {
          removeTabOptimistically(tab.id)
        })

        // Clear visual selection and return to normal mode
        clearVisualSelection()
        switchToNormalMode()

        // Check if we need to close modal or adjust selection immediately after optimistic removal
        const newFilteredTabs = get(filteredTabsFromSearch)
        if (newFilteredTabs.length === 0) {
          // No tabs left, close modal
          closeModal()
        } else {
          // Adjust selection index to stay within bounds
          const minSelectedIndex = Math.min(...selectedIndices)
          const newIndex = Math.min(minSelectedIndex, newFilteredTabs.length - 1)
          setSelectedTab(Math.max(0, newIndex))
        }

        // Remove all selected tabs from harpoon in the background (sequentially to avoid race conditions)
        const removeTabsSequentially = async () => {
          for (const tab of tabsToRemove) {
            try {
              await removeTabFromHarpoonById(tab.id)
            } catch (err) {
              harpoonLogger.error(`Failed to remove tab ${tab.id} from harpoon:`, err)
            }
          }
        }

        // Fire and forget - let it run in the background
        removeTabsSequentially().catch((err) => {
          harpoonLogger.error('Failed to remove tabs from harpoon:', err)
        })

        harpoonLogger.info(`Batch removed ${tabsToRemove.length} tabs from harpoon in visual mode`)
      }
      return
    }
  }

  // Check for harpoon add (now uses 3-key sequence: space h a)
  if (checkHarpoonAdd(last3) && commandsAllowed) {
    event.preventDefault()
    clearKeyBuffer()
    hideWhichKey()

    // Show immediate feedback
    showHarpoonIndicatorLoading()
    triggerBorderFlash()

    addTabToHarpoon()
      .then((response: { message: string; harpoonIndex?: number }) => {
        // Update indicator immediately with the index from the response
        if (response && typeof response.harpoonIndex === 'number' && response.harpoonIndex >= 0) {
          updateHarpoonIndicator(response.harpoonIndex)
        }
      })
      .catch((err) => {
        harpoonLogger.error('Failed to add tab to harpoon:', err)
        hideHarpoonIndicator()
      })
    return
  }

  // Check for harpoon remove (now uses 3-key sequence: space h r)
  if (checkHarpoonRemove(last3) && commandsAllowed) {
    event.preventDefault()
    clearKeyBuffer()
    hideWhichKey()

    // Show immediate feedback
    triggerBorderFlash()
    hideHarpoonIndicator()

    removeTabFromHarpoon().catch((err) => {
      harpoonLogger.error('Failed to remove tab from harpoon:', err)
      hideHarpoonIndicator()
    })
    return
  }

  // Check for harpoon switch
  const harpoonIndex = checkHarpoonSwitch(last2)
  if (harpoonIndex !== null && commandsAllowed) {
    event.preventDefault()
    hideWhichKey()

    showTabSwitchLoading()
    getHarpoonTabs()
      .then((tabs) => {
        if (tabs[harpoonIndex]) {
          return switchToTab(tabs[harpoonIndex].id)
        } else {
          hideLoading()
          harpoonLogger.warn(`No harpoon tab at index ${harpoonIndex + 1}`)
        }
      })
      .then(() => {
        hideLoading()
      })
      .catch((error) => {
        hideLoading()
        harpoonLogger.error('Error switching to harpoon tab:', error)
      })
    return
  }

  // Check for last tab (space l)
  if (checkLastTab(last2) && commandsAllowed) {
    event.preventDefault()
    clearKeyBuffer()
    hideWhichKey()

    showTabSwitchLoading()
    switchToLastBuffer()
      .then(() => {
        hideLoading()
      })
      .catch((error) => {
        hideLoading()
        keyboardLogger.error('Error switching to last tab:', error)
      })
    return
  }

  // Clean up key buffer if it gets too long
  if (currentKeyBuffer.length > 10) {
    clearKeyBuffer()
  }
}
