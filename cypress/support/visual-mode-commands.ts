// Helper commands for visual mode testing

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      /**
       * Type keys to the document when modal is open
       */
      typeInModal(keys: string): void
      
      /**
       * Send a single key event when modal is open
       */
      sendKey(key: string, options?: { shiftKey?: boolean; ctrlKey?: boolean }): void
      
      /**
       * Enter visual mode
       */
      enterVisualMode(): void
      
      /**
       * Open telescope modal
       */
      openModal(): void
    }
  }
}

// Open modal with double space
Cypress.Commands.add('openModal', () => {
  cy.get('body').type('  ')
  cy.wait(500)
})

// Type keys when modal is open (converts string to individual key events)
Cypress.Commands.add('typeInModal', (keys: string) => {
  for (const key of keys) {
    cy.window().then((win) => {
      const event = new win.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
      win.document.dispatchEvent(event)
    })
    cy.wait(100)
  }
})

// Send a single key event
Cypress.Commands.add('sendKey', (key: string, options = {}) => {
  cy.window().then((win) => {
    const event = new win.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...options })
    win.document.dispatchEvent(event)
  })
  cy.wait(200)
})

// Enter visual mode
Cypress.Commands.add('enterVisualMode', () => {
  cy.sendKey('v')
})

export {}