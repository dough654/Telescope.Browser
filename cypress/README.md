# Telescope.browser E2E Tests

This directory contains comprehensive end-to-end tests for the Telescope.browser extension using Cypress.

## Test Files

### `telescope-modal.cy.ts`
Basic functionality tests covering:
- Extension loading and shadow DOM injection
- Modal opening and rendering
- Basic UI components verification
- CSS styling checks

### `telescope-comprehensive.cy.ts`
Core feature tests covering:
- Modal opening/closing with Space-Space and Escape
- Insert/Normal mode switching
- j/k navigation in normal mode
- Search functionality with highlighting
- Tab selection and switching
- Tab preview functionality
- Tab ordering by recent visits

### `telescope-harpoon.cy.ts`
Harpoon system tests covering:
- Adding tabs to harpoon with Space-a
- Harpoon navigation with Space-1, Space-2, etc.
- Harpoon modal mode
- Harpoon persistence across sessions
- Error handling for harpoon operations

### `telescope-edge-cases.cy.ts`
Edge cases and performance tests covering:
- Performance with many tabs
- Special characters and Unicode handling
- Network and loading error scenarios
- Rapid key presses and mode switching
- Browser state changes during modal usage
- Memory management and cleanup

## Running Tests

### Interactive Mode (Recommended for Development)
```bash
npm run test:e2e:open
```
This opens the Cypress GUI where you can:
- Select which tests to run
- Watch tests run in real-time
- Debug failing tests
- See detailed error information

### Headless Mode (CI/Automated)
```bash
npm run test:e2e
```
This runs all tests in headless mode and outputs results to the console.

### Unit Tests Only
```bash
npm run test:unit
```

### All Tests
```bash
npm test
```

## Test Architecture

### Shadow DOM Testing
Since the extension uses Shadow DOM, tests access elements using:
```typescript
cy.get('#telescope-shadow-host').then(($host) => {
  const shadowRoot = $host[0].shadowRoot
  const modal = shadowRoot?.querySelector('.telescope-modal')
  // ... test the element
})
```

### Custom Commands
Helper commands are available in `cypress/support/commands.ts`:
- `cy.loadExtension()` - Wait for extension to load
- `cy.openModal()` - Open modal with Space-Space
- `cy.enterNormalMode()` - Press Escape to enter normal mode
- `cy.enterInsertMode()` - Press 'i' to enter insert mode
- `cy.closeModal()` - Close modal with double Escape
- `cy.getShadowRoot()` - Get shadow DOM root element

### Extension Configuration
The Cypress configuration automatically:
- Builds the extension before running tests
- Loads the extension in Chrome with proper flags
- Disables other extensions to avoid conflicts
- Sets up proper permissions for extension testing

## Test Scenarios Covered

### Core Functionality ✅
- [x] Modal opening with Space-Space
- [x] Modal closing with Escape sequences
- [x] Insert/Normal mode switching
- [x] Vim-style navigation (j/k keys)
- [x] Search with highlighting
- [x] Tab switching with Enter
- [x] URL preview with highlighting

### Harpoon System ✅
- [x] Adding tabs to harpoon
- [x] Harpoon navigation shortcuts
- [x] Harpoon modal mode
- [x] Persistence across sessions

### Edge Cases ✅
- [x] Performance with many tabs
- [x] Special characters and Unicode
- [x] Network errors and loading issues
- [x] Rapid key sequences
- [x] Memory management

### Browser Integration ✅
- [x] Tab creation/deletion during modal use
- [x] Cross-tab functionality
- [x] Extension lifecycle management

## Known Test Limitations

1. **Tab Switching**: Some tab switching tests are simplified due to Cypress iframe limitations
2. **Screenshots**: Screenshot capture testing is basic due to Chrome extension permission model
3. **Service Worker**: Direct service worker testing requires separate unit tests
4. **Performance**: Memory leak detection is simplified (use browser dev tools for detailed analysis)

## Debugging Failed Tests

1. **Use Interactive Mode**: Run `npm run test:e2e:open` to see exactly what's happening
2. **Check Console**: Look for extension console logs during test execution
3. **Screenshot Analysis**: Failed tests automatically capture screenshots
4. **Increase Timeouts**: If tests are flaky, increase wait times in specific tests
5. **Extension Logs**: Check browser extension logs in developer tools

## Adding New Tests

When adding new functionality to the extension:

1. **Update Existing Tests**: Modify relevant test files if behavior changes
2. **Add Feature Tests**: Create new test cases in the appropriate file
3. **Test Edge Cases**: Add edge case scenarios to `telescope-edge-cases.cy.ts`
4. **Update Documentation**: Update this README with new test coverage

## Test Data and Fixtures

Tests use real websites (example.com, github.com, etc.) for realistic scenarios. If you need test-specific data, add fixtures to the `cypress/fixtures/` directory.