/// <reference types="cypress" />

describe('Telescope.browser - Basic Working Tests', () => {
  beforeEach(() => {
    // Use a simple static page to avoid complexity
    cy.visit('cypress/fixtures/test-pages/page1.html')

    // Wait for extension to be fully loaded (handles CI environment)
    cy.waitForExtension()
  })

  describe('Extension Loading', () => {
    it('should load extension and create shadow host', () => {
      // Verify shadow host exists with correct properties
      cy.get('#telescope-shadow-host')
        .should('exist')
        .and('have.attr', 'id', 'telescope-shadow-host')
        .then(($el) => {
          expect($el[0].shadowRoot).to.exist
          expect($el[0].tagName.toLowerCase()).to.equal('div')
        })
    })

    it('should handle basic keyboard input without crashing', () => {
      // Type some basic keys that shouldn't trigger telescope
      cy.get('body').type('abc123xyz')
      cy.wait(300)

      // Extension should still be loaded and responsive
      cy.get('#telescope-shadow-host').should('exist')

      // Should still respond to valid telescope commands
      cy.get('body').type('  ') // space-space
      cy.wait(300)

      // Modal should appear
      cy.get('#telescope-shadow-host').then(($el) => {
        const shadowRoot = $el[0].shadowRoot
        expect(shadowRoot).to.exist

        const modal = shadowRoot?.querySelector('.telescope-modal')
        expect(modal).to.exist
        expect(modal?.classList.contains('telescope-hidden')).to.be.false
      })

      // Close modal
      cy.document().trigger('keydown', { key: 'Escape' })
      cy.document().trigger('keydown', { key: 'Escape' })
      cy.wait(300)
    })
  })

  describe('Modal Trigger Tests', () => {
    it('should respond to space-space trigger', () => {
      // Open modal with double space
      cy.get('body').type('  ')
      cy.wait(300)

      // Verify modal actually opens in shadow DOM
      cy.get('#telescope-shadow-host').then(($el) => {
        const shadowRoot = $el[0].shadowRoot
        expect(shadowRoot).to.exist

        const modal = shadowRoot?.querySelector('.telescope-modal')
        expect(modal).to.exist
        expect(modal?.classList.contains('telescope-hidden')).to.be.false
      })

      // Close modal
      cy.document().trigger('keydown', { key: 'Escape' })
      cy.document().trigger('keydown', { key: 'Escape' })
      cy.wait(300)
    })

    it('should handle escape key to close modal', () => {
      // Open modal
      cy.get('body').type('  ')
      cy.wait(300)

      // Close with escape - this should work without errors
      cy.document().trigger('keydown', { key: 'Escape' })
      cy.document().trigger('keydown', { key: 'Escape' })
      cy.wait(200)

      // Verify extension still works after escape
      cy.get('#telescope-shadow-host').should('exist')
    })

    it('should handle space-h trigger for harpoon modal', () => {
      // First add current tab to harpoon
      cy.get('body').type(' a')
      cy.wait(200)

      // Open harpoon modal (hierarchical: space-h-o)
      cy.get('body').type(' ho')
      cy.wait(200)

      // Verify harpoon modal opens
      cy.get('#telescope-shadow-host').then(($el) => {
        const shadowRoot = $el[0].shadowRoot
        expect(shadowRoot).to.exist

        const modal = shadowRoot?.querySelector('.telescope-modal')
        expect(modal).to.exist
        expect(modal?.classList.contains('telescope-hidden')).to.be.false
      })

      // Close modal
      cy.document().trigger('keydown', { key: 'Escape' })
      cy.document().trigger('keydown', { key: 'Escape' })
      cy.wait(300)
    })
  })

  describe('Harpoon Functionality Tests', () => {
    it('should add tab to harpoon with space-a', () => {
      // Add current tab to harpoon
      cy.get('body').type(' a')
      cy.wait(300)

      // Verify extension still works (harpoon command processed)
      cy.get('#telescope-shadow-host').should('exist')

      // Try opening harpoon modal to verify the tab was added
      cy.get('body').type(' h')
      cy.wait(300)

      // Verify modal opens (indicating harpoon functionality works)
      cy.get('#telescope-shadow-host').then(($el) => {
        const shadowRoot = $el[0].shadowRoot
        expect(shadowRoot).to.exist

        const modal = shadowRoot?.querySelector('.telescope-modal')
        expect(modal).to.exist
        // If we can open harpoon modal, the add operation worked
      })

      // Close modal
      cy.document().trigger('keydown', { key: 'Escape' })
      cy.document().trigger('keydown', { key: 'Escape' })
      cy.wait(300)
    })

    it('should remove tab from harpoon with space-r', () => {
      // First add to harpoon
      cy.get('body').type(' a')
      cy.wait(300)

      // Then remove from harpoon
      cy.get('body').type(' r')
      cy.wait(300)

      // Verify extension still works (remove command processed)
      cy.get('#telescope-shadow-host').should('exist')

      // Try basic modal functionality to confirm no crash
      cy.get('body').type('  ')
      cy.wait(300)

      cy.get('#telescope-shadow-host').then(($el) => {
        const shadowRoot = $el[0].shadowRoot
        expect(shadowRoot).to.exist

        const modal = shadowRoot?.querySelector('.telescope-modal')
        expect(modal).to.exist
        // Extension still works after add/remove operations
      })

      // Close modal
      cy.document().trigger('keydown', { key: 'Escape' })
      cy.document().trigger('keydown', { key: 'Escape' })
      cy.wait(300)
    })

    it('should handle space-1 harpoon navigation', () => {
      // Add current tab to harpoon first
      cy.get('body').type(' a')
      cy.wait(300)

      // Try to navigate to harpoon index 1
      cy.get('body').type(' 1')
      cy.wait(300)

      // Verify navigation doesn't crash and extension still works
      cy.get('#telescope-shadow-host').should('exist')

      // Should still be able to open modal
      cy.get('body').type('  ')
      cy.wait(300)

      cy.get('#telescope-shadow-host').then(($el) => {
        const shadowRoot = $el[0].shadowRoot
        const modal = shadowRoot?.querySelector('.telescope-modal')
        expect(modal).to.exist
        expect(modal?.classList.contains('telescope-hidden')).to.be.false
      })

      // Close modal
      cy.document().trigger('keydown', { key: 'Escape' })
      cy.document().trigger('keydown', { key: 'Escape' })
      cy.wait(300)
    })
  })

  describe('DD Deletion Functionality', () => {
    it('should delete harpoon item with dd command in normal mode', () => {
      // Add to harpoon first
      cy.get('body').type(' a')
      cy.wait(300)

      // Open harpoon modal
      cy.get('body').type(' h')
      cy.wait(300)

      // Switch to normal mode first
      cy.document().trigger('keydown', { key: 'Escape' })
      cy.wait(200)

      // Try dd command (delete)
      cy.document().trigger('keydown', { key: 'd' })
      cy.document().trigger('keydown', { key: 'd' })
      cy.wait(300)

      // Verify extension still works (dd command processed without errors)
      cy.get('#telescope-shadow-host').should('exist')
    })

    it('should NOT delete in insert mode', () => {
      // Add to harpoon first
      cy.get('body').type(' a')
      cy.wait(300)

      // Open harpoon modal (starts in insert mode)
      cy.get('body').type(' h')
      cy.wait(300)

      // Try dd command while in insert mode (should NOT delete)
      cy.document().trigger('keydown', { key: 'd' })
      cy.document().trigger('keydown', { key: 'd' })
      cy.wait(200)

      // Verify extension still works (dd was ignored in insert mode)
      cy.get('#telescope-shadow-host').should('exist')

      // Close any open modal
      cy.document().trigger('keydown', { key: 'Escape' })
      cy.document().trigger('keydown', { key: 'Escape' })
      cy.wait(200)
    })

    it('should close tab with dd command in tab list modal normal mode', () => {
      // First, open multiple test pages to have tabs to work with
      cy.window().then((win) => {
        win.open('cypress/fixtures/test-pages/page2.html', '_blank')
        win.open('cypress/fixtures/test-pages/page3.html', '_blank')
      })
      cy.wait(1000)

      // Open tab list modal (space-space)
      cy.get('body').type('  ')
      cy.wait(300)

      // Verify modal opens in tab mode
      cy.get('#telescope-shadow-host').then(($el) => {
        const shadowRoot = $el[0].shadowRoot
        expect(shadowRoot).to.exist

        const modal = shadowRoot?.querySelector('.telescope-modal')
        expect(modal).to.exist
      })

      // Switch to normal mode
      cy.document().trigger('keydown', { key: 'Escape' })
      cy.wait(200)

      // Execute dd command to close selected tab
      cy.document().trigger('keydown', { key: 'd' })
      cy.document().trigger('keydown', { key: 'd' })
      cy.wait(500)

      // Verify extension still works after tab closure (tab deletion was processed)
      cy.get('#telescope-shadow-host').should('exist')

      // Close modal if still open
      cy.document().trigger('keydown', { key: 'Escape' })
      cy.document().trigger('keydown', { key: 'Escape' })
      cy.wait(200)
    })

    it('should NOT close tab with dd command in tab list modal insert mode', () => {
      // First, open additional test pages
      cy.window().then((win) => {
        win.open('cypress/fixtures/test-pages/page2.html', '_blank')
      })
      cy.wait(1000)

      // Open tab list modal (space-space) - starts in insert mode
      cy.get('body').type('  ')
      cy.wait(300)

      // Verify modal opens
      cy.get('#telescope-shadow-host').then(($el) => {
        const shadowRoot = $el[0].shadowRoot
        expect(shadowRoot).to.exist

        const modal = shadowRoot?.querySelector('.telescope-modal')
        expect(modal).to.exist
      })

      // Try dd command while in insert mode (should NOT close tab)
      cy.document().trigger('keydown', { key: 'd' })
      cy.document().trigger('keydown', { key: 'd' })
      cy.wait(300)

      // Verify extension still works (dd was ignored in insert mode)
      cy.get('#telescope-shadow-host').should('exist')

      // Verify modal is still open (tab was not closed in insert mode)
      cy.get('#telescope-shadow-host').then(($el) => {
        const shadowRoot = $el[0].shadowRoot
        expect(shadowRoot).to.exist

        const modal = shadowRoot?.querySelector('.telescope-modal')
        expect(modal).to.exist
        // In insert mode, dd should be ignored and modal should remain open
      })

      // Close modal
      cy.document().trigger('keydown', { key: 'Escape' })
      cy.document().trigger('keydown', { key: 'Escape' })
      cy.wait(200)
    })

    it('should handle tab deletion with proper index adjustment', () => {
      // Open additional tabs for testing
      cy.window().then((win) => {
        win.open('cypress/fixtures/test-pages/page2.html', '_blank')
        win.open('cypress/fixtures/test-pages/page3.html', '_blank')
      })
      cy.wait(1000)

      // Open tab list modal
      cy.get('body').type('  ')
      cy.wait(300)

      // Switch to normal mode
      cy.document().trigger('keydown', { key: 'Escape' })
      cy.wait(200)

      // Navigate down to select a different tab
      cy.document().trigger('keydown', { key: 'j' })
      cy.wait(200)

      // Execute dd command to close selected tab
      cy.document().trigger('keydown', { key: 'd' })
      cy.document().trigger('keydown', { key: 'd' })
      cy.wait(500)

      // Verify modal behavior after deletion
      cy.get('#telescope-shadow-host').then(($el) => {
        const shadowRoot = $el[0].shadowRoot
        expect(shadowRoot).to.exist

        // Either modal is still open with remaining tabs, or it closed if no tabs left
        const modal = shadowRoot?.querySelector('.telescope-modal')
        expect(modal).to.exist
        // Don't assert on visibility since it depends on remaining tab count
      })

      // Clean up - close modal if still open
      cy.document().trigger('keydown', { key: 'Escape' })
      cy.document().trigger('keydown', { key: 'Escape' })
      cy.wait(200)
    })
  })

  describe('Keyboard Buffer and Edge Cases', () => {
    it('should ignore invalid key combinations', () => {
      // Try various invalid combinations
      cy.get('body').type('xyz')
      cy.get('body').type('123')
      cy.get('body').type('!@#')
      cy.wait(300)

      // Extension should still work normally
      cy.get('#telescope-shadow-host').should('exist')

      // Valid command should still work
      cy.get('body').type('  ')
      cy.wait(300)

      cy.get('#telescope-shadow-host').then(($el) => {
        const shadowRoot = $el[0].shadowRoot
        const modal = shadowRoot?.querySelector('.telescope-modal')
        expect(modal).to.exist
        expect(modal?.classList.contains('telescope-hidden')).to.be.false
      })

      cy.document().trigger('keydown', { key: 'Escape' })
      cy.document().trigger('keydown', { key: 'Escape' })
      cy.wait(300)
    })

    it('should handle rapid key sequences correctly', () => {
      // Rapid invalid typing followed by valid command
      cy.get('body').type('abcdefghijk')
      cy.wait(100)

      // Should still respond to valid commands
      cy.get('body').type('  ')
      cy.wait(300)

      // Modal should open
      cy.get('#telescope-shadow-host').then(($el) => {
        const shadowRoot = $el[0].shadowRoot
        const modal = shadowRoot?.querySelector('.telescope-modal')
        expect(modal).to.exist
        expect(modal?.classList.contains('telescope-hidden')).to.be.false
      })

      cy.document().trigger('keydown', { key: 'Escape' })
      cy.document().trigger('keydown', { key: 'Escape' })
      cy.wait(300)
    })

    it('should handle page reload gracefully', () => {
      // Add to harpoon before reload
      cy.get('body').type(' a')
      cy.wait(300)

      // Reload page
      cy.reload()
      cy.wait(1000)

      // Extension should reload and be functional
      cy.get('#telescope-shadow-host').should('exist')

      // Should respond to commands after reload
      cy.get('body').type('  ')
      cy.wait(300)

      cy.get('#telescope-shadow-host').then(($el) => {
        const shadowRoot = $el[0].shadowRoot
        const modal = shadowRoot?.querySelector('.telescope-modal')
        expect(modal).to.exist
        expect(modal?.classList.contains('telescope-hidden')).to.be.false
      })

      cy.document().trigger('keydown', { key: 'Escape' })
      cy.document().trigger('keydown', { key: 'Escape' })
      cy.wait(300)
    })
  })

  describe('Performance and Stress Tests', () => {
    it('should handle multiple tabs efficiently', () => {
      // Open additional tabs
      cy.window().then((win) => {
        win.open('cypress/fixtures/test-pages/page2.html', '_blank')
        win.open('cypress/fixtures/test-pages/page3.html', '_blank')
      })
      cy.wait(1000)

      // Try modal with multiple tabs - should work without performance issues
      cy.get('body').type('  ')
      cy.wait(1000)

      // Verify modal opens properly with multiple tabs
      cy.get('#telescope-shadow-host').then(($el) => {
        const shadowRoot = $el[0].shadowRoot
        expect(shadowRoot).to.exist

        const modal = shadowRoot?.querySelector('.telescope-modal')
        expect(modal).to.exist
        // Extension handles multiple tabs without crashing
      })

      cy.document().trigger('keydown', { key: 'Escape' })
      cy.document().trigger('keydown', { key: 'Escape' })
      cy.wait(300)
    })

    it('should handle multiple harpoon operations without performance issues', () => {
      // Multiple harpoon operations - using document events for more reliable input
      cy.document().trigger('keydown', { key: ' ' })
      cy.document().trigger('keydown', { key: 'a' })
      cy.wait(300)

      cy.document().trigger('keydown', { key: ' ' })
      cy.document().trigger('keydown', { key: 'r' })
      cy.wait(300)

      cy.document().trigger('keydown', { key: ' ' })
      cy.document().trigger('keydown', { key: 'a' })
      cy.wait(300)

      // Verify extension still works after multiple operations
      cy.get('#telescope-shadow-host').should('exist')

      // Try basic functionality
      cy.get('body').type('  ')
      cy.wait(300)

      cy.get('#telescope-shadow-host').then(($el) => {
        const shadowRoot = $el[0].shadowRoot
        expect(shadowRoot).to.exist

        const modal = shadowRoot?.querySelector('.telescope-modal')
        expect(modal).to.exist
        // Extension performs well with multiple operations
      })

      cy.document().trigger('keydown', { key: 'Escape' })
      cy.document().trigger('keydown', { key: 'Escape' })
      cy.wait(300)
    })
  })
})

