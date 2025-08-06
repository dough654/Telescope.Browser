import { writable, derived } from 'svelte/store'
import { modalLogger } from '../utils/logger.js'
import type { InputMode, ModalMode } from '../types/shared.js'

// Helper function to communicate with main world script
function notifyMainWorldScript(modalOpen: boolean, mode: InputMode) {
  try {
    window.postMessage(
      {
        type: 'TELESCOPE_STATE',
        modalOpen,
        inputMode: mode
      },
      '*'
    )
  } catch (e) {
    modalLogger.error('Failed to send state to main world:', e)
  }
}

// Core modal state
export const isModalOpen = writable(false)
export const modalMode = writable<ModalMode>('tab')
export const inputMode = writable<InputMode>('insert')
export const selectedTabIndex = writable(0)

// Derived stores
export const modalTitle = derived(modalMode, ($mode) => {
  return $mode === 'tab' ? 'Tabs' : 'Harpoon'
})

// Actions
export function openModal(mode: ModalMode = 'tab') {
  modalMode.set(mode)
  inputMode.set('insert') // Always start in insert mode
  selectedTabIndex.set(0)
  isModalOpen.set(true)

  // Sync tabs when modal opens to ensure fresh data
  import('./tabs.js').then(({ loadTabs }) => {
    loadTabs().catch((error) => {
      modalLogger.error('Failed to sync tabs when opening modal:', error)
    })
  })

  // Notify main world script about modal state
  notifyMainWorldScript(true, 'insert')
}

export function closeModal() {
  isModalOpen.set(false)
  inputMode.set('insert') // Reset to insert mode
  selectedTabIndex.set(0)

  // Clear search bar and results (avoid circular import)
  import('./search.js').then(({ clearSearch }) => {
    clearSearch()
  })

  // Clear visual selection if it exists
  import('./visual-selection.js')
    .then(({ clearVisualSelection }) => {
      clearVisualSelection()
    })
    .catch(() => {
      // Ignore error if visual-selection module doesn't exist yet
    })

  // Notify main world script about modal state
  notifyMainWorldScript(false, 'insert')
}

export function setSelectedTab(index: number) {
  selectedTabIndex.set(index)
}

export function switchMode(mode: ModalMode) {
  modalMode.set(mode)
  selectedTabIndex.set(0)
}

export function setInputMode(mode: InputMode) {
  inputMode.set(mode)
}

export function switchToNormalMode() {
  inputMode.set('normal')

  // Notify main world script about mode change
  notifyMainWorldScript(true, 'normal')
}

export function switchToInsertMode() {
  inputMode.set('insert')

  // Notify main world script about mode change
  notifyMainWorldScript(true, 'insert')
}

export function switchToVisualMode() {
  inputMode.set('visual')

  // Notify main world script about mode change
  notifyMainWorldScript(true, 'visual')
}

