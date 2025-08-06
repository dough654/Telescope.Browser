# Contributing to Telescope.browser 🤝

Thank you for considering contributing to Telescope.browser! This document provides guidelines and information to help you contribute effectively.

## 🌟 How to Contribute

### Reporting Bugs 🐛

Before creating a bug report, please:

1. **Check existing issues** to avoid duplicates
2. **Use the latest version** to verify the bug still exists
3. **Provide detailed information** using our bug report template

**Good Bug Reports Include:**
- Clear, descriptive title
- Steps to reproduce the issue
- Expected vs actual behavior
- Browser version and OS information
- Screenshots or screen recordings (if applicable)
- Console errors (if any)

### Suggesting Enhancements 💡

Enhancement suggestions are welcome! Please:

1. **Check existing discussions** and issues first
2. **Explain the use case** and why it would be valuable
3. **Consider the scope** - does it align with the project's goals?
4. **Provide mockups or examples** if possible

### Contributing Code 👨‍💻

#### Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/telescope-browser.git
   cd telescope-browser
   ```

3. **Install dependencies**:
   ```bash
   npm install
   ```

4. **Create a branch** for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```

#### Development Workflow

1. **Make your changes** following our coding standards
2. **Add tests** for new functionality
3. **Run the test suite**:
   ```bash
   npm test
   ```
4. **Ensure code quality**:
   ```bash
   npm run lint
   npm run check
   ```
5. **Test manually** by loading the extension in your browser
6. **Commit your changes** with a descriptive message

#### Pull Request Process

1. **Update documentation** if needed
2. **Ensure all tests pass** and code is properly formatted
3. **Create a pull request** with:
   - Clear title and description
   - Reference to related issues
   - Screenshots/GIFs for UI changes
   - Test instructions

4. **Respond to feedback** from maintainers promptly
5. **Keep your branch updated** with the main branch

## 📝 Coding Standards

### General Guidelines

- **Follow the existing code style** and patterns
- **Write self-documenting code** with clear variable names
- **Add comments** for complex logic
- **Keep functions small** and focused on a single responsibility
- **Use TypeScript** properly with strict types

### File Organization

- **Components**: Svelte components in `src/components/`
- **Services**: Business logic in `src/services/`
- **Stores**: Reactive state in `src/stores/`
- **Utilities**: Helper functions in `src/utils/`
- **Tests**: Co-located with source files in `test/` subdirectories

### Naming Conventions

- **Files**: Use kebab-case (`tab-manager.ts`)
- **Functions**: Use camelCase (`switchToTab`)
- **Constants**: Use UPPER_SNAKE_CASE (`MAX_TAB_COUNT`)
- **Components**: Use PascalCase (`TabList.svelte`)
- **CSS Classes**: Use kebab-case with telescope prefix (`telescope-modal`)

### Testing

- **Write tests for new features** and bug fixes
- **Use descriptive test names** that explain the scenario
- **Test edge cases** and error conditions
- **Mock external dependencies** appropriately
- **Keep tests focused** and independent

## 🎨 UI/UX Guidelines

### Design Principles

- **Keyboard-first**: Every action should be accessible via keyboard
- **Fast and responsive**: UI updates should feel instant
- **Vim-inspired**: Follow vim conventions for navigation
- **Minimal and clean**: Avoid visual clutter
- **Consistent**: Use the same patterns throughout

## 🔍 Code Review Guidelines

### For Contributors

- **Self-review** your changes before submitting
- **Test thoroughly** in different scenarios
- **Keep PRs focused** - one feature/fix per PR
- **Respond promptly** to reviewer feedback
- **Be open to suggestions** and learning

### For Reviewers

- **Be constructive** and specific in feedback
- **Focus on the code**, not the person
- **Explain the "why"** behind suggestions
- **Approve when ready** - don't nitpick minor issues
- **Test the changes** if possible

## 🚀 Release Process

### Version Numbers

We use [Semantic Versioning](https://semver.org/):
- **MAJOR**: Breaking changes
- **MINOR**: New features, backwards compatible
- **PATCH**: Bug fixes, backwards compatible

## 📚 Resources

### Browser Extension Development

- [Chrome Extension Documentation](https://developer.chrome.com/docs/extensions/)
- [Manifest V3 Migration Guide](https://developer.chrome.com/docs/extensions/migrating/)
- [Chrome Extension Samples](https://github.com/GoogleChrome/chrome-extensions-samples)

### Technologies Used

- [Svelte](https://svelte.dev/) - UI framework
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [Vitest](https://vitest.dev/) - Unit testing
- [Cypress](https://www.cypress.io/) - E2E testing

## 📄 License

By contributing to Telescope.browser, you agree that your contributions will be licensed under the MIT License.

---

Thank you for helping make Telescope.browser better! 🚀