import { defineConfig } from 'cypress'
import path from 'path'

export default defineConfig({
  e2e: {
    setupNodeEvents(on: Cypress.PluginEvents, config: Cypress.PluginConfigOptions) {
      // Set CI environment variable for tests
      config.env.CI = process.env.CI || false
      
      // Configure Chrome to load the extension
      on('before:browser:launch', (browser, launchOptions) => {
        if (browser.name === 'chrome') {
          const extensionPath = path.resolve('./dist')
          
          launchOptions.args.push(`--load-extension=${extensionPath}`)
          launchOptions.args.push(`--disable-extensions-except=${extensionPath}`)
          launchOptions.args.push('--disable-web-security')
          launchOptions.args.push('--disable-features=VizDisplayCompositor')
          
          // Additional flags for CI environment
          if (process.env.CI) {
            launchOptions.args.push('--no-sandbox')
            launchOptions.args.push('--disable-dev-shm-usage')
            launchOptions.args.push('--disable-gpu')
            launchOptions.args.push('--disable-setuid-sandbox')
            // Ensure extension has time to load
            launchOptions.args.push('--enable-logging')
            launchOptions.args.push('--v=1')
          }
          
          return launchOptions
        }
      })
      
      return config
    },
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: 'cypress/support/e2e.ts',
    video: false,
    screenshotOnRunFailure: true,
    viewportWidth: 1280,
    viewportHeight: 720,
    defaultCommandTimeout: process.env.CI ? 30000 : 10000,
    requestTimeout: process.env.CI ? 30000 : 10000,
    responseTimeout: process.env.CI ? 30000 : 10000,
    pageLoadTimeout: process.env.CI ? 60000 : 30000,
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