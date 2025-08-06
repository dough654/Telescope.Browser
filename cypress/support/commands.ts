/// <reference types="cypress" />

// ***********************************************
// This example commands.ts shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************

// Custom commands for Chrome extension testing

Cypress.Commands.add('loadExtension', () => {
  // Extension is loaded via browser launch args in cypress/plugins/index.js
  // This command can be used to wait for extension to be ready
  cy.window().then((win) => {
    // Wait for extension to inject content script
    cy.wait(1000)
  })
})

Cypress.Commands.add('getExtensionId', () => {
  return cy.window().then((win) => {
    // Get extension ID from chrome.runtime if available
    return new Promise<string>((resolve) => {
      if ((win as Record<string, unknown>).chrome && (win as Record<string, unknown>).chrome.runtime) {
        resolve((win as Record<string, unknown>).chrome.runtime.id)
      } else {
        // Fallback: look for service worker
        setTimeout(() => {
          resolve('test-extension-id')
        }, 100)
      }
    })
  })
})

// Helper to get shadow DOM root
Cypress.Commands.add('getShadowRoot', () => {
  return cy.get('#telescope-shadow-host').then(($host) => {
    return cy.wrap($host[0].shadowRoot)
  })
})

// Helper to open modal and wait
Cypress.Commands.add('openModal', () => {
  cy.get('body').type('  ')
  cy.wait(1000)
})

// Helper to enter normal mode
Cypress.Commands.add('enterNormalMode', () => {
  cy.window().then((win) => {
    const event = new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    win.document.dispatchEvent(event)
  })
  cy.wait(200)
})

// Helper to enter insert mode
Cypress.Commands.add('enterInsertMode', () => {
  cy.get('body').type('i')
  cy.wait(200)
})

// Helper to close modal
Cypress.Commands.add('closeModal', () => {
  cy.get('body').type('{esc}{esc}')
  cy.wait(500)
})

// Helper to check if modal is open
Cypress.Commands.add('checkModalOpen', () => {
  return cy.get('#telescope-shadow-host').then(($host) => {
    const shadowRoot = $host[0].shadowRoot
    const modal = shadowRoot?.querySelector('.telescope-modal')
    return !modal?.classList.contains('telescope-hidden')
  })
})

// Helper to get selected tab index
Cypress.Commands.add('getSelectedTabIndex', () => {
  return cy.get('#telescope-shadow-host').then(($host) => {
    const shadowRoot = $host[0].shadowRoot
    const selectedTab = shadowRoot?.querySelector('.telescope-tab-selected')
    return selectedTab?.getAttribute('data-index')
  })
})

// Helper to wait for extension to be fully loaded
Cypress.Commands.add('waitForExtension', () => {
  cy.wait(2000)
  cy.get('#telescope-shadow-host').should('exist')
})

// Helper to add tab to harpoon
Cypress.Commands.add('addToHarpoon', () => {
  cy.get('body').type(' a')
  cy.wait(500)
})

// Helper to remove tab from harpoon
Cypress.Commands.add('removeFromHarpoon', () => {
  cy.get('body').type(' r')
  cy.wait(500)
})

// Helper to open harpoon modal
Cypress.Commands.add('openHarpoonModal', () => {
  cy.get('body').type(' h')
  cy.wait(1000)
})

// Helper to navigate harpoon tabs
Cypress.Commands.add('navigateToHarpoonTab', (index: number) => {
  cy.get('body').type(` ${index}`)
  cy.wait(1000)
})

// Helper to delete harpoon tab with dd
Cypress.Commands.add('deleteHarpoonTab', () => {
  cy.enterNormalMode()
  cy.get('body').type('dd')
  cy.wait(500)
})

// Helper to check if modal is in harpoon mode
Cypress.Commands.add('checkHarpoonMode', () => {
  return cy.get('#telescope-shadow-host').then(($host) => {
    const shadowRoot = $host[0].shadowRoot
    const harpoonNumbers = shadowRoot?.querySelectorAll('.telescope-harpoon-number')
    return harpoonNumbers && harpoonNumbers.length > 0
  })
})

// Helper to count tabs in modal
Cypress.Commands.add('getTabCount', () => {
  return cy.get('#telescope-shadow-host').then(($host) => {
    const shadowRoot = $host[0].shadowRoot
    const tabItems = shadowRoot?.querySelectorAll('.telescope-tab-item')
    return tabItems?.length || 0
  })
})