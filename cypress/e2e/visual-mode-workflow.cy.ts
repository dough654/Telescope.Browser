import '../support/visual-mode-commands'

describe('Visual Mode Workflow', () => {
  beforeEach(() => {
    // Just visit one page - multiple tabs cause issues with modal state
    cy.visit('cypress/fixtures/test-pages/page1.html')
    cy.wait(200)
  })

  afterEach(() => {
    // Clean up: close modal if open
    cy.sendKey('Escape')
    cy.wait(100)
    cy.sendKey('Escape')
    cy.wait(100)
  })

  describe('Entering Visual Mode', () => {
    it('should enter visual mode from normal mode in tab list', () => {
      // Open modal and switch to normal mode
      cy.openModal()
      cy.enterNormalMode()
      
      // Should be in normal mode with blue selection
      cy.getShadowRoot().then((shadowRoot) => {
        const modal = shadowRoot?.querySelector('.telescope-modal')
        expect(modal).to.exist
        expect(modal?.classList.contains('telescope-hidden')).to.be.false
        
        const selected = shadowRoot?.querySelector('.telescope-tab-selected')
        expect(selected).to.exist
        
        const visualSelected = shadowRoot?.querySelector('.telescope-tab-visual-selected')
        expect(visualSelected).to.not.exist
      })
      
      // Enter visual mode with 'v'
      cy.enterVisualMode()
      
      // Should switch to visual mode with purple selection
      cy.getShadowRoot().then((shadowRoot) => {
        const visualCursor = shadowRoot?.querySelector('.telescope-tab-visual-cursor')
        expect(visualCursor).to.exist
        
        const visualSelected = shadowRoot?.querySelector('.telescope-tab-visual-selected')
        expect(visualSelected).to.exist
        
        const normalSelected = shadowRoot?.querySelector('.telescope-tab-selected')
        expect(normalSelected).to.not.exist
        
        // Modal border should be purple
        const modal = shadowRoot?.querySelector('.telescope-modal')
        expect(modal?.classList.contains('telescope-modal-visual')).to.be.true
      })
    })

    it('should enter visual mode from normal mode in harpoon list', () => {
      // Add current tab to harpoon
      cy.sendKey(' ') // space
      cy.wait(100)
      cy.sendKey('h')
      cy.wait(300)
      cy.sendKey('a')
      cy.wait(200)
      
      // Open harpoon modal
      cy.sendKey(' ') // space
      cy.wait(100)
      cy.sendKey('h')
      cy.wait(300)
      cy.sendKey('o')
      cy.wait(500)
      cy.enterNormalMode()
      
      // Should be in harpoon mode
      cy.getShadowRoot().then((shadowRoot) => {
        const modal = shadowRoot?.querySelector('.telescope-modal')
        expect(modal).to.exist
        
        const harpoonNumbers = shadowRoot?.querySelectorAll('.telescope-harpoon-number')
        expect(harpoonNumbers?.length).to.be.at.least(1)
      })
      
      // Enter visual mode with 'v'
      cy.enterVisualMode()
      
      // Should switch to visual mode
      cy.getShadowRoot().then((shadowRoot) => {
        const visualCursor = shadowRoot?.querySelector('.telescope-tab-visual-cursor')
        expect(visualCursor).to.exist
        
        const visualSelected = shadowRoot?.querySelector('.telescope-tab-visual-selected')
        expect(visualSelected).to.exist
        
        // Modal border should be purple
        const modal = shadowRoot?.querySelector('.telescope-modal')
        expect(modal?.classList.contains('telescope-modal-visual')).to.be.true
      })
    })

    it('should enter visual mode with Shift+V (line visual mode)', () => {
      cy.openModal()
      cy.enterNormalMode()
      
      // Enter visual mode with Shift+V
      cy.sendKey('V', { shiftKey: true })
      
      // Should switch to visual mode
      cy.getShadowRoot().then((shadowRoot) => {
        const visualCursor = shadowRoot?.querySelector('.telescope-tab-visual-cursor')
        expect(visualCursor).to.exist
        
        const visualSelected = shadowRoot?.querySelector('.telescope-tab-visual-selected')
        expect(visualSelected).to.exist
        
        const modal = shadowRoot?.querySelector('.telescope-modal')
        expect(modal?.classList.contains('telescope-modal-visual')).to.be.true
      })
    })

    it('should not enter visual mode from insert mode', () => {
      cy.openModal()
      // Modal starts in insert mode
      
      // Try to enter visual mode with 'v' - should not work
      cy.sendKey('v')
      cy.wait(200)
      
      // Should still be in insert mode
      cy.getShadowRoot().then((shadowRoot) => {
        const modal = shadowRoot?.querySelector('.telescope-modal')
        expect(modal).to.exist
        expect(modal?.classList.contains('telescope-modal-visual')).to.be.false
        
        const visualSelected = shadowRoot?.querySelector('.telescope-tab-visual-selected')
        expect(visualSelected).to.not.exist
      })
    })
  })

  describe('Visual Mode Navigation', () => {
    it('should handle navigation with single tab', () => {
      cy.openModal()
      cy.enterNormalMode()
      cy.enterVisualMode()
      
      // Check that we have at least one tab selected
      cy.getShadowRoot().then((shadowRoot) => {
        const visualSelected = shadowRoot?.querySelectorAll('.telescope-tab-visual-selected')
        expect(visualSelected?.length).to.be.at.least(1)
        
        // Try to navigate down (might not do anything with single tab)
        cy.sendKey('j')
        cy.wait(200)
        
        // Visual mode should still be active
        const modal = shadowRoot?.querySelector('.telescope-modal')
        expect(modal?.classList.contains('telescope-modal-visual')).to.be.true
      })
    })

    it('should handle selection at boundaries', () => {
      cy.openModal()
      cy.enterNormalMode()
      cy.enterVisualMode()
      
      // Try navigating up at the top
      cy.sendKey('k')
      cy.wait(200)
      cy.sendKey('k')
      cy.wait(200)
      
      // Should still be in visual mode
      cy.getShadowRoot().then((shadowRoot) => {
        const modal = shadowRoot?.querySelector('.telescope-modal')
        expect(modal?.classList.contains('telescope-modal-visual')).to.be.true
        
        const visualSelected = shadowRoot?.querySelectorAll('.telescope-tab-visual-selected')
        expect(visualSelected?.length).to.be.at.least(1)
      })
      
      // Try navigating down at the bottom
      for (let i = 0; i < 10; i++) {
        cy.sendKey('j')
        cy.wait(100)
      }
      
      // Should still be in visual mode
      cy.getShadowRoot().then((shadowRoot) => {
        const modal = shadowRoot?.querySelector('.telescope-modal')
        expect(modal?.classList.contains('telescope-modal-visual')).to.be.true
      })
    })

    it('should maintain cursor position indicator', () => {
      cy.openModal()
      cy.enterNormalMode()
      cy.enterVisualMode()
      
      // Check initial cursor
      cy.getShadowRoot().then((shadowRoot) => {
        const visualCursor = shadowRoot?.querySelector('.telescope-tab-visual-cursor')
        expect(visualCursor).to.exist
        
        // Navigate and check cursor moves
        cy.sendKey('j')
        cy.wait(200)
        
        cy.getShadowRoot().then((shadowRoot) => {
          const cursorAfter = shadowRoot?.querySelector('.telescope-tab-visual-cursor')
          expect(cursorAfter).to.exist
        })
      })
    })

  })

  describe('Exiting Visual Mode', () => {

    it('should exit visual mode with Escape key', () => {
      cy.openModal()
      cy.enterNormalMode()
      cy.enterVisualMode()
      
      // Verify in visual mode
      cy.getShadowRoot().then((shadowRoot) => {
        const modal = shadowRoot?.querySelector('.telescope-modal')
        expect(modal?.classList.contains('telescope-modal-visual')).to.be.true
      })
      
      // Exit visual mode
      cy.sendKey('Escape')
      cy.wait(200)
      
      // Should be back in normal mode
      cy.getShadowRoot().then((shadowRoot) => {
        const modal = shadowRoot?.querySelector('.telescope-modal')
        expect(modal?.classList.contains('telescope-modal-visual')).to.be.false
        
        const normalSelected = shadowRoot?.querySelector('.telescope-tab-selected')
        expect(normalSelected).to.exist
        
        const visualSelected = shadowRoot?.querySelector('.telescope-tab-visual-selected')
        expect(visualSelected).to.not.exist
      })
    })

    it('should exit to normal mode, not close modal with single Escape', () => {
      cy.openModal()
      cy.enterNormalMode()
      cy.enterVisualMode()
      
      // Single Escape
      cy.sendKey('Escape')
      cy.wait(200)
      
      // Modal should still be open in normal mode
      cy.getShadowRoot().then((shadowRoot) => {
        const modal = shadowRoot?.querySelector('.telescope-modal')
        expect(modal).to.exist
        expect(modal?.classList.contains('telescope-hidden')).to.be.false
        expect(modal?.classList.contains('telescope-modal-visual')).to.be.false
      })
    })

    it('should close modal with double Escape from normal mode', () => {
      cy.openModal()
      cy.enterNormalMode()
      cy.enterVisualMode()
      
      // First Escape - exit visual mode
      cy.sendKey('Escape')
      cy.wait(200)
      
      // Second Escape - close modal
      cy.sendKey('Escape')
      cy.wait(200)
      
      // Modal should be closed
      cy.getShadowRoot().then((shadowRoot) => {
        const modal = shadowRoot?.querySelector('.telescope-modal')
        if (modal) {
          expect(modal.classList.contains('telescope-hidden')).to.be.true
        }
      })
    })
  })

  describe('Visual Mode Styling', () => {
    it('should apply purple theme in visual mode', () => {
      cy.openModal()
      cy.enterNormalMode()
      
      // Check normal mode styling first
      cy.getShadowRoot().then((shadowRoot) => {
        const modal = shadowRoot?.querySelector('.telescope-modal')
        expect(modal?.classList.contains('telescope-modal-visual')).to.be.false
      })
      
      cy.enterVisualMode()
      
      // Check visual mode styling
      cy.getShadowRoot().then((shadowRoot) => {
        const modal = shadowRoot?.querySelector('.telescope-modal')
        expect(modal?.classList.contains('telescope-modal-visual')).to.be.true
        
        // Should have visual selection styling
        const visualSelected = shadowRoot?.querySelector('.telescope-tab-visual-selected')
        expect(visualSelected).to.exist
      })
    })

    it('should show visual selection elements', () => {
      cy.openModal()
      cy.enterNormalMode()
      cy.enterVisualMode()
      
      cy.getShadowRoot().then((shadowRoot) => {
        // Should have at least one selected tab
        const visualSelected = shadowRoot?.querySelectorAll('.telescope-tab-visual-selected')
        expect(visualSelected?.length).to.be.at.least(1)
        
        // Should have cursor indicator
        const visualCursor = shadowRoot?.querySelector('.telescope-tab-visual-cursor')
        expect(visualCursor).to.exist
      })
    })

    it('should clear visual styling when exiting visual mode', () => {
      cy.openModal()
      cy.enterNormalMode()
      cy.enterVisualMode()
      
      // Verify visual styling is present
      cy.getShadowRoot().then((shadowRoot) => {
        const visualSelected = shadowRoot?.querySelector('.telescope-tab-visual-selected')
        expect(visualSelected).to.exist
      })
      
      // Exit visual mode
      cy.sendKey('Escape')
      cy.wait(200)
      
      // Visual styling should be gone
      cy.getShadowRoot().then((shadowRoot) => {
        const visualSelected = shadowRoot?.querySelector('.telescope-tab-visual-selected')
        expect(visualSelected).to.not.exist
        
        const visualCursor = shadowRoot?.querySelector('.telescope-tab-visual-cursor')
        expect(visualCursor).to.not.exist
        
        // Normal selection should be back
        const normalSelected = shadowRoot?.querySelector('.telescope-tab-selected')
        expect(normalSelected).to.exist
      })
    })
  })

  describe('Visual Mode in Different Modal Types', () => {
    it('should work in harpoon modal', () => {
      // Add tab to harpoon
      cy.sendKey(' ') // space
      cy.wait(100)
      cy.sendKey('h')
      cy.wait(300)
      cy.sendKey('a')
      cy.wait(200)
      
      // Open harpoon modal
      cy.sendKey(' ') // space
      cy.wait(100)
      cy.sendKey('h')
      cy.wait(300)
      cy.sendKey('o')
      cy.wait(500)
      cy.enterNormalMode()
      
      // Enter visual mode
      cy.enterVisualMode()
      
      // Should work in harpoon modal
      cy.getShadowRoot().then((shadowRoot) => {
        const modal = shadowRoot?.querySelector('.telescope-modal')
        expect(modal?.classList.contains('telescope-modal-visual')).to.be.true
        
        const visualSelected = shadowRoot?.querySelector('.telescope-tab-visual-selected')
        expect(visualSelected).to.exist
        
        // Harpoon numbers should still be visible
        const harpoonNumbers = shadowRoot?.querySelectorAll('.telescope-harpoon-number')
        expect(harpoonNumbers?.length).to.be.at.least(1)
      })
    })

    it('should maintain harpoon numbers in visual mode', () => {
      // Add tab to harpoon
      cy.sendKey(' ') // space
      cy.wait(100)
      cy.sendKey('h')
      cy.wait(300)
      cy.sendKey('a')
      cy.wait(200)
      
      // Open harpoon modal
      cy.sendKey(' ') // space
      cy.wait(100)
      cy.sendKey('h')
      cy.wait(300)
      cy.sendKey('o')
      cy.wait(500)
      cy.enterNormalMode()
      
      // Check harpoon numbers exist
      cy.getShadowRoot().then((shadowRoot) => {
        const harpoonNumbers = shadowRoot?.querySelectorAll('.telescope-harpoon-number')
        expect(harpoonNumbers?.length).to.be.at.least(1)
        
        // Enter visual mode
        cy.enterVisualMode()
        
        // Harpoon numbers should still be there
        cy.getShadowRoot().then((shadowRoot) => {
          const numbersInVisual = shadowRoot?.querySelectorAll('.telescope-harpoon-number')
          expect(numbersInVisual?.length).to.be.at.least(1)
        })
      })
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty tab list gracefully', () => {
      // Try to open modal and enter visual mode
      // Even with no/minimal tabs, it shouldn't crash
      cy.openModal()
      cy.enterNormalMode()
      cy.enterVisualMode()
      
      // Should handle gracefully
      cy.getShadowRoot().then((shadowRoot) => {
        const modal = shadowRoot?.querySelector('.telescope-modal')
        expect(modal).to.exist
      })
    })

    it('should handle rapid key presses without breaking', () => {
      cy.openModal()
      cy.enterNormalMode()
      cy.enterVisualMode()
      
      // Rapid navigation
      for (let i = 0; i < 5; i++) {
        cy.sendKey('j', { delay: 0 })
        cy.sendKey('k', { delay: 0 })
      }
      
      cy.wait(500)
      
      // Should still be in valid state
      cy.getShadowRoot().then((shadowRoot) => {
        const modal = shadowRoot?.querySelector('.telescope-modal')
        expect(modal?.classList.contains('telescope-modal-visual')).to.be.true
      })
    })

    it('should handle switching between insert and visual modes', () => {
      cy.openModal()
      
      // Start in insert mode, switch to normal
      cy.enterNormalMode()
      
      // Enter visual mode
      cy.enterVisualMode()
      
      // Exit to normal
      cy.sendKey('Escape')
      cy.wait(200)
      
      // Switch to insert
      cy.sendKey('i')
      cy.wait(200)
      
      // Try to enter visual (shouldn't work from insert)
      cy.sendKey('v')
      cy.wait(200)
      
      // Should still be in insert mode
      cy.getShadowRoot().then((shadowRoot) => {
        const modal = shadowRoot?.querySelector('.telescope-modal')
        expect(modal?.classList.contains('telescope-modal-visual')).to.be.false
        
        // In insert mode, visual selection should not be present
        const visualSelected = shadowRoot?.querySelector('.telescope-tab-visual-selected')
        expect(visualSelected).to.not.exist
      })
    })
  })
})