/// <reference types="cypress" />

declare namespace Cypress {
  interface Chainable {
    /**
     * Load the Chrome extension
     */
    loadExtension(): Chainable<void>
    
    /**
     * Get the extension ID
     */
    getExtensionId(): Chainable<string>
    
    /**
     * Get shadow DOM root element
     */
    getShadowRoot(): Chainable<ShadowRoot>
    
    /**
     * Open the telescope modal
     */
    openModal(): Chainable<void>
    
    /**
     * Enter normal mode (press escape)
     */
    enterNormalMode(): Chainable<void>
    
    /**
     * Enter insert mode (press i)
     */
    enterInsertMode(): Chainable<void>
    
    /**
     * Close the modal (double escape)
     */
    closeModal(): Chainable<void>
    
    /**
     * Check if modal is currently open
     */
    checkModalOpen(): Chainable<boolean>
    
    /**
     * Get the currently selected tab index
     */
    getSelectedTabIndex(): Chainable<string | null>
    
    /**
     * Wait for extension to be fully loaded
     */
    waitForExtension(): Chainable<void>
    
    /**
     * Add current tab to harpoon
     */
    addToHarpoon(): Chainable<void>
    
    /**
     * Remove current tab from harpoon
     */
    removeFromHarpoon(): Chainable<void>
    
    /**
     * Open harpoon modal
     */
    openHarpoonModal(): Chainable<void>
    
    /**
     * Navigate to specific harpoon tab by index
     */
    navigateToHarpoonTab(index: number): Chainable<void>
    
    /**
     * Delete harpoon tab with dd command
     */
    deleteHarpoonTab(): Chainable<void>
    
    /**
     * Check if modal is in harpoon mode
     */
    checkHarpoonMode(): Chainable<boolean>
    
    /**
     * Get count of tabs in modal
     */
    getTabCount(): Chainable<number>
  }
}