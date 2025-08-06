import '../support/visual-mode-commands'

describe('Basic Visual Mode Tests', () => {
  beforeEach(() => {
    cy.visit('cypress/fixtures/test-pages/page1.html')
    // Wait for extension to be fully loaded (handles CI environment)
    cy.waitForExtension()
  })

  afterEach(() => {
    cy.get('body').then($body => {
      $body.trigger('keydown', { key: 'Escape' })
      $body.trigger('keydown', { key: 'Escape' })
    })
    cy.wait(100)
  })

  it('should successfully enter visual mode and show visual selection', () => {
    // Open modal and verify it works
    cy.openModal()
    
    cy.getShadowRoot().then((shadowRoot) => {
      const modal = shadowRoot?.querySelector('.telescope-modal')
      const modeIndicator = shadowRoot?.querySelector('.telescope-mode-badge')
      
      expect(modal).to.exist
      expect(modal?.classList.contains('telescope-hidden')).to.be.false
      expect(modeIndicator?.textContent).to.equal('INSERT')
    })
    
    // Enter normal mode
    cy.enterNormalMode()
    
    cy.getShadowRoot().then((shadowRoot) => {
      const modeIndicator = shadowRoot?.querySelector('.telescope-mode-badge')
      const selectedTab = shadowRoot?.querySelector('.telescope-tab-selected')
      
      expect(modeIndicator?.textContent).to.equal('NORMAL')
      expect(selectedTab).to.exist
    })
    
    // Enter visual mode
    cy.enterVisualMode()
    
    cy.getShadowRoot().then((shadowRoot) => {
      const modal = shadowRoot?.querySelector('.telescope-modal')
      const modeIndicator = shadowRoot?.querySelector('.telescope-mode-badge')
      const visualSelected = shadowRoot?.querySelectorAll('.telescope-tab-visual-selected')
      const visualCursor = shadowRoot?.querySelector('.telescope-tab-visual-cursor')
      
      expect(modeIndicator?.textContent).to.equal('VISUAL')
      expect(modal?.classList.contains('telescope-modal-visual')).to.be.true
      expect(visualSelected?.length).to.be.at.least(1)
      expect(visualCursor).to.exist
    })
  })
  
  it('should allow navigation in visual mode with j/k keys', () => {
    // Open modal, enter normal mode, enter visual mode
    cy.openModal()
    cy.enterNormalMode()
    cy.enterVisualMode()
    
    // Check initial state
    cy.getShadowRoot().then((shadowRoot) => {
      const allTabs = shadowRoot?.querySelectorAll('.telescope-tab-item')
      const initialSelected = shadowRoot?.querySelectorAll('.telescope-tab-visual-selected')
      
      // Only test navigation if we have multiple tabs
      if (allTabs?.length && allTabs.length > 1) {
        expect(initialSelected?.length).to.equal(1)
        
        // Press j to move down
        cy.sendKey('j')
        cy.wait(300)
        
        cy.getShadowRoot().then((shadowRoot) => {
          const afterJSelected = shadowRoot?.querySelectorAll('.telescope-tab-visual-selected')
          
          // Should have extended selection
          expect(afterJSelected?.length).to.be.at.least(2)
        })
      } else {
        cy.log('Only one tab available - skipping navigation test')
        expect(initialSelected?.length).to.equal(1)
      }
    })
  })
})