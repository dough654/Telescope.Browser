# Changelog

All notable changes to Telescope.browser will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.1] - 2025-08-06

### Added
- Content scripts now auto-inject into existing tabs on extension installation
- Scripting permission to enable auto-injection functionality

### Fixed
- Fixed favicon loading for private/internal sites by using Chrome's native `favIconUrl`
- Fixed filtered search results not updating when tabs are deleted
- Fixed content script initialization when injected into already-loaded pages
- Fixed CI/CD pipeline issues with Chrome 139 by pinning to Chrome 138

### Changed
- Improved search reactivity - search results now automatically update when tabs change
- Simplified search store implementation for better performance

## [1.0.0] - 2025-08-05

### Added
- Initial public release on Chrome Web Store
- Lightning-fast fuzzy search for browser tabs
- Vim-style keyboard navigation (insert/normal/visual modes)
- Harpoon system for quick access to saved tabs
- Visual mode for batch operations
- Tab screenshots and previews
- Window-scoped tab management
- Keyboard shortcuts:
  - `Space Space` - Open tab search modal
  - `Space h` - Open harpoon modal
  - `Space a` - Add current tab to harpoon
  - `Space r` - Remove current tab from harpoon
  - `Space 1-9` - Quick switch to harpoon tab
  - `Ctrl+o` - Switch to last buffer
  - `j/k` - Navigate tabs
  - `Enter` - Switch to selected tab
  - `dd` - Delete tab (normal mode)
  - `v/V` - Enter visual mode
  - `Esc` - Exit mode/close modal

### Technical Features
- Service worker architecture with modular managers
- Automatic tab history tracking
- Screenshot capture and caching
- Storage management with cleanup routines
- Recovery system for data corruption
- Cross-window synchronization
- Shadow DOM for CSS isolation

[Unreleased]: https://github.com/dough654/telescope-browser/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/dough654/telescope-browser/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/dough654/telescope-browser/releases/tag/v1.0.0