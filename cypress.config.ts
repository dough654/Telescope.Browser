import { defineConfig } from 'cypress'
import path from 'path'

export default defineConfig({
  e2e: {
    setupNodeEvents(on: Cypress.PluginEvents, config: Cypress.PluginConfigOptions) {
      // Configure Chrome to load the extension
      on('before:browser:launch', (browser, launchOptions) => {
        if (browser.name === 'chrome') {
          // Use EXTENSION_PATH env var if set (for CI), otherwise use ./dist
          const extensionPath = process.env.EXTENSION_PATH 
            ? path.resolve(process.env.EXTENSION_PATH)
            : path.resolve('./dist')
          
          launchOptions.args.push(`--load-extension=${extensionPath}`)
          launchOptions.args.push(`--disable-extensions-except=${extensionPath}`)
          launchOptions.args.push('--disable-web-security')
          launchOptions.args.push('--disable-features=VizDisplayCompositor')
          
          return launchOptions
        }
      })
    },
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: 'cypress/support/e2e.ts',
    video: false,
    screenshotOnRunFailure: true,
    viewportWidth: 1280,
    viewportHeight: 720,
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 10000,
    chromeWebSecurity: false, // Needed for extension testing
  },
  
  // Chrome extension specific configuration
  env: {
    extensionPath: path.resolve('./dist'),
  },
  
  // Configure for headless Chrome with extension
  component: {
    devServer: {
      framework: 'svelte',
      bundler: 'vite',
    },
  },
})