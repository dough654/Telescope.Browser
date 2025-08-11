# Privacy Policy for Telescope.browser

**Last Updated**: January 26, 2025  
**Effective Date**: January 26, 2025

## Overview

Telescope.browser ("the Extension") is committed to protecting your privacy. This Privacy Policy explains how we handle information when you use our browser extension for tab search and management.

## Information We Collect

### What We Collect
Telescope.browser collects and processes the following information **locally on your device**:

- **Tab Information**: Tab titles, URLs, and favicons of your open browser tabs
- **Tab Screenshots**: Visual previews of web pages for quick identification
- **Harpoon Bookmarks**: Tabs you've manually bookmarked using the harpoon feature
- **Usage Preferences**: Your extension settings and keyboard shortcuts

### What We DON'T Collect
- **Personal Data**: We do not collect names, email addresses, or other personal information
- **Browsing History**: We do not track or store your complete browsing history
- **Analytics**: We do not collect usage statistics or telemetry
- **Remote Data**: No information is sent to external servers

## How We Use Information

All data processing happens **entirely on your device**:

- **Tab Search**: Tab titles and URLs are used to provide fuzzy search functionality
- **Visual Previews**: Screenshots are captured and stored locally for tab identification
- **Harpoon System**: Bookmarked tabs are saved locally for quick access
- **Performance**: Data is cached locally to ensure fast response times

## Data Storage

### Local Storage Only
- All data is stored using your browser's local storage API on your device
- No data is transmitted to external servers or third parties
- Data is automatically cleaned up to prevent storage bloat

### Data Retention
- **Tab History**: Recent tabs are kept temporarily for search functionality
- **Harpoon Bookmarks**: Persist until manually removed by the user
- **Screenshots**: Automatically cleaned up after 30 days or when tabs are closed
- **Settings**: Persist until extension is uninstalled

## Permissions Explained

Telescope.browser requests the following permissions and here's why:

### Required Permissions

#### `tabs`
- **Purpose**: Read tab titles, URLs, and favicons for search functionality
- **Data Access**: Title, URL, favicon of all open tabs
- **Usage**: Enable fuzzy search and tab switching
- **Limitation**: Cannot read page content, only metadata

#### `storage`
- **Purpose**: Save harpoon bookmarks and user settings locally
- **Data Access**: Extension preferences and bookmarked tabs
- **Usage**: Persist user data between browser sessions
- **Limitation**: Only stores extension-related data

#### `<all_urls>` (Host Permissions)
- **Purpose**: Make the search modal available on all websites
- **Data Access**: Permission to inject UI on any website
- **Usage**: Ensure consistent functionality across all sites
- **Limitation**: Only used for UI injection, not content access

## Third-Party Services

Telescope.browser does **NOT** use any third-party services:
- No analytics services (Google Analytics, etc.)
- No crash reporting services
- No advertising networks
- No external APIs or servers

## Data Security

### Local Data Protection
- Data is stored using Chrome's secure storage APIs
- Screenshots are stored as data URLs, not files
- No data transmission over networks
- Extension runs in Chrome's sandboxed environment

## Your Privacy Rights

### Control Over Your Data
- **View Data**: Inspect what data is stored via Chrome's extension tools
- **Delete Data**: Uninstall the extension to remove all stored data
- **Opt-Out**: Disable specific features like screenshots in settings
- **Export**: Tab data can be accessed through Chrome's developer tools

### Data Portability
While Telescope.browser doesn't provide export functionality, your data remains:
- Accessible through your browser's extension storage
- In standard formats (JSON for settings, data URLs for screenshots)
- Removable by uninstalling the extension

## Changes to This Policy

We may update this Privacy Policy to:
- Reflect changes in functionality
- Address new privacy regulations
- Improve clarity and transparency

**Notification**: Updates will be posted in the extension's GitHub repository and browser extension store listing.

## Compliance

### Legal Basis (GDPR)
Data processing is based on:
- **Legitimate Interest**: Providing tab search functionality
- **Consent**: User voluntarily installs and uses the extension
- **Local Processing**: Data never leaves your device

### California Privacy Rights (CCPA)
As we don't collect personal information or transmit data externally, traditional privacy rights don't apply. However:
- You can request information about data processing (this policy)
- You can delete all data by uninstalling the extension
- We don't sell or share personal information

## Contact Information

For privacy-related questions or concerns:

- **GitHub Issues**: [Report Privacy Concerns](https://github.com/dough654/telescope-browser/issues)
- **GitHub Repository**: [https://github.com/dough654/telescope-browser](https://github.com/dough654/telescope-browser)
- **Open Source**: Full code review available for transparency

## Verification

You can verify our privacy practices by:
1. **Reviewing Source Code**: All code is open source and publicly available
2. **Network Monitoring**: Use browser dev tools to confirm no network requests
3. **Storage Inspection**: Check your browser's extension storage to see what's stored
4. **Community Review**: Join our GitHub community for transparency discussions

---

**Summary**: Telescope.browser processes tab information entirely on your device to provide fast tab search. No data is sent to external servers, no tracking occurs, and you maintain full control over your information.
