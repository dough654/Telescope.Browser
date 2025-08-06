/// <reference types="cypress" />

describe('Telescope.browser Extension - Basic Tests', () => {
  beforeEach(() => {
    // Use local test page to avoid network issues
    cy.visit('cypress/fixtures/test-pages/page1.html')
    
    // Wait for extension to be fully loaded (handles CI environment)
    cy.waitForExtension()
  })

  it('should inject content script into pages', () => {
    // Check if our content script is loaded by verifying shadow host creation
    cy.get('#telescope-shadow-host', { timeout: 5000 }).should('exist')
    
    // Verify the shadow host has the correct properties
    cy.get('#telescope-shadow-host').then(($el) => {
      expect($el[0].tagName.toLowerCase()).to.equal('div')
      expect($el[0].id).to.equal('telescope-shadow-host')
    })
  })

  it('should create shadow DOM for modal', () => {
    // Check if shadow host element exists
    cy.get('#telescope-shadow-host').should('exist')
    
    // Check if shadow root is created and contains expected structure
    cy.get('#telescope-shadow-host').then(($el) => {
      const shadowRoot = $el[0].shadowRoot
      expect(shadowRoot).to.exist
      
      // Check for actual shadow DOM structure (Svelte components)
      const modal = shadowRoot.querySelector('.telescope-modal')
      const overlay = shadowRoot.querySelector('.telescope-overlay')
      expect(modal).to.exist
      expect(overlay).to.exist
    })
  })

  it('should respond to space-space keyboard trigger', () => {
    // Trigger modal with space-space
    cy.get('body').type('  ') // Two spaces
    cy.wait(1000)
    
    // Check if modal is actually visible in shadow DOM
    cy.get('#telescope-shadow-host').then(($el) => {
      const shadowRoot = $el[0].shadowRoot
      expect(shadowRoot).to.exist
      
      const modal = shadowRoot.querySelector('.telescope-modal')
      expect(modal).to.exist
      
      // Modal should be visible (not have telescope-hidden class)
      expect(modal.classList.contains('telescope-hidden')).to.be.false
    })
    
    // Close modal with escape
    cy.document().trigger('keydown', { key: 'Escape' })
    cy.wait(500)
  })

  it('should have service worker background script', () => {
    // Test service worker functionality by verifying messaging works
    // We'll test by triggering a harpoon action which requires service worker
    cy.get('body').type(' a') // Add to harpoon
    cy.wait(1000)
    
    // Verify extension is still responsive (service worker working)
    cy.get('#telescope-shadow-host').should('exist')
    
    // Try opening harpoon modal to verify service worker state
    cy.get('body').type(' ho') // Open harpoon modal (hierarchical: space-h-o)
    cy.wait(500)
    
    // Check that harpoon modal appears (confirming service worker communication)
    cy.get('#telescope-shadow-host').then(($el) => {
      const shadowRoot = $el[0].shadowRoot
      expect(shadowRoot).to.exist
      
      const modal = shadowRoot.querySelector('.telescope-modal')
      expect(modal).to.exist
      
      // Modal should be visible (confirming service worker working)
      expect(modal.classList.contains('telescope-hidden')).to.be.false
    })
    
    // Close modal
    cy.document().trigger('keydown', { key: 'Escape' })
    cy.wait(500)
  })
})