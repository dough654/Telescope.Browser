# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Build & Watch

- `npm run build` - Builds the extension using TypeScript and esbuild
- `npm run build:firefox` - Builds for Firefox with Firefox-specific manifest
- `npm run build:store` - Builds for Chrome Web Store distribution
- `npm run build:watch` - Watches for changes and rebuilds automatically
- `npm run postbuild` - Copies public assets to dist/ (runs after build)

### Testing

- `npm test` - Runs both unit and e2e tests
- `npm run test:unit` - Runs unit tests with vitest
- `npm run test:unit -- --grep "pattern"` - Run specific unit tests by pattern
- `npm run test:e2e` - Runs end-to-end tests with Cypress
- `npm run test:e2e:open` - Opens Cypress interactive mode
- `npm run test:e2e -- --spec "cypress/e2e/specific-test.cy.ts"` - Run specific e2e test

### Code Quality

- `npm run lint` - Runs prettier and eslint checks
- `npm run format` - Formats code with prettier
- `npm run check` - Runs svelte-check for type checking
- `npm run check:watch` - Watches for type checking

### E2E Testing Setup

E2E tests use Cypress and automatically load the extension. Tests require the extension to be built first:

```bash
npm run build
npm run test:e2e
```

For interactive testing:
```bash
npm run test:e2e:open
```

## Architecture Overview

This is a browser extension called "Telescope.browser" that provides a fuzzy search interface for browser tabs and a "harpoon" system for bookmarking specific tabs.

### Core Components

**Service Worker (`src/service-workers/new-service-worker.ts`)**

- Coordinates all service worker managers in a modular architecture
- Handles Chrome extension lifecycle events and message routing
- Manages tab history, harpoon functionality, and screenshot capture
- Provides centralized messaging API for content scripts
- Implements recovery and health monitoring systems

**Service Worker Managers (`src/service-workers/managers/`)**

- **TabManager**: Handles tab lifecycle events and tab history management
- **HarpoonManager**: Specialized harpoon functionality with window-scoped isolation
- **ScreenshotManager**: Efficient screenshot capture and storage management
- **WindowManager**: Window state tracking and coordination
- **RecoveryManager**: System health monitoring and corruption recovery

**Content Script (`src/content-scripts/content.ts`)**

- Injected into all web pages using shadow DOM for CSS isolation
- Initializes Svelte Modal component and keyboard handlers
- Displays harpoon indicators on saved tabs
- Handles DOM content loading and shadow root creation

**Svelte Components (`src/components/`)**

- **Modal.svelte**: Main UI container with tab switching interface
- **TabList.svelte**: Renders filtered tab list with keyboard navigation
- **SearchBar.svelte**: Input field for fuzzy search
- **TabPreview.svelte**: Shows tab screenshots and metadata
- **HarpoonIndicator.svelte**: Visual indicators for saved tabs
- **LoadingSpinner.svelte, ModeIndicator.svelte, WhichKey.svelte**: UI helpers

**Svelte Stores (`src/stores/`)**

- **modal.ts**: Modal open/close state
- **tabs.ts**: Tab data and filtering logic
- **search.ts**: Search query and results
- **keyboard.ts**: Keyboard navigation state
- **loading.ts, harpoon-indicator.ts, harpoon-flash.ts**: UI state management

**Services (`src/services/`)**

- **search.ts**: Fuse.js fuzzy search implementation
- **keyboard-handler.ts**: Keyboard event routing and shortcuts
- **service-worker-bridge.ts**: Communication layer with service worker
- **screenshot-loader.ts**: Lazy loading of tab screenshots
- **tab-history.ts**: Tab tracking and history management

### Key Features

1. **Tab History**: Automatically tracks and stores recent tabs with screenshots
2. **Harpoon System**: Allows users to save specific tabs for quick access
3. **Fuzzy Search**: Search through tabs by title or URL using Fuse.js
4. **Visual Previews**: Shows page screenshots when browsing tabs
5. **Keyboard Navigation**: Full keyboard support for tab switching

### Build System

- **TypeScript**: Compiles to ES2020 target with strict typing
- **esbuild**: Bundles with esbuild-svelte plugin for Svelte compilation
- **Entry Points**: `src/content-scripts/content.ts` and `src/service-workers/new-service-worker.ts`
- **Output**: IIFE format bundled files go to `dist/` directory
- **Assets**: Public files and manifest.json copied from `src/public/` to `dist/`
- **Svelte Integration**: CSS injected into bundle, TypeScript preprocessing enabled
- **Source Maps**: Enabled for debugging

### Extension Structure

- **Manifest V3**: Modern Chrome extension format
- **Permissions**: tabs, storage, scripting, and host permissions for all URLs
- **Content Scripts**: Injected into all pages at document_start
- **Web Accessible Resources**: HTML and CSS files for modal UI
- **Cross-browser**: Includes Firefox compatibility settings

### Storage

Uses Chrome's local storage API to persist:

- `tabHistory`: Recent tabs with metadata and screenshots
- `harpoonHistory`: User-saved tabs
- `tabsScreenshotMap`: URL-to-screenshot mappings

The extension implements cleanup routines to prevent storage bloat from old screenshots.

### Testing Infrastructure

**Unit Tests (`vitest`)**
- Environment: jsdom with Chrome API mocks
- Location: `src/**/test/*.test.ts` files
- Setup: `tests/setup.ts` provides Chrome API stubs
- Coverage: Focused on business logic and state management
- Global test utilities available via `tests/setup.ts`

**E2E Tests (`cypress`)**
- Loads actual extension in Chrome via `--load-extension`
- Test pages: Static HTML fixtures in `cypress/fixtures/test-pages/`
- Configuration: `cypress.config.ts` with extension-specific Chrome flags
- Custom commands: `cypress/support/visual-mode-commands.ts` for visual mode testing
- Scope: User workflows and extension integration testing
- Extensions must be built before running e2e tests

## Development Workflow

### Making Changes

1. **Extension Development**: Always run `npm run build` after changes before testing
2. **Live Development**: Use `npm run build:watch` for continuous building
3. **Testing Changes**: Build extension before running e2e tests
4. **Loading in Browser**: Load the `dist/` directory as unpacked extension

### Browser Extension Loading

- **Chrome**: Load unpacked extension from `dist/` directory
- **Firefox**: Use `manifest.firefix.json` for Firefox-specific build
- Extension requires tabs, storage, scripting, and <all_urls> permissions
