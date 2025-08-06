# Browser Extension Store Assets Checklist

## Current Assets ✅
- **Source Icon**: `logo.png` and `src/public/logo.png` (Perfect telescope icon for browser extension)

## Required for Extension Store Submission

### Extension Icons (Required)
- [ ] 16x16 px icon (manifest, browser toolbar)
- [ ] 32x32 px icon (Windows)
- [ ] 48x48 px icon (extension management page)
- [ ] 128x128 px icon (Extension store, installation)

### Store Listing Images (Required)
- [ ] **Store Icon**: 128x128 px (same as extension icon)
- [ ] **Screenshots**: 1-5 screenshots at 1280x800 px showing:
  - [ ] Tab search in action
  - [ ] Harpoon functionality
  - [ ] Visual mode selection
  - [ ] Keyboard shortcuts overlay
  - [ ] Search results with highlighting
- [ ] **Small Promotional Image**: 440x280 px

### Optional Store Assets
- [ ] **Large Promotional Image**: 920x680 px (for featured listings)
- [ ] **Marquee Promotional Image**: 1400x560 px (for featured listings)
- [ ] **Demo Video**: 2-3 minute showcase video

## Asset Generation Plan

### Icons
Use the existing `logo.png` to generate required sizes:
```bash
# Using ImageMagick or similar tool
convert logo.png -resize 16x16 icons/icon-16.png
convert logo.png -resize 32x32 icons/icon-32.png
convert logo.png -resize 48x48 icons/icon-48.png
convert logo.png -resize 128x128 icons/icon-128.png
```

### Screenshots Plan
1. **Tab Search**: Show modal open with search results
2. **Harpoon**: Show harpoon modal with numbered tabs
3. **Visual Mode**: Show purple selection highlighting
4. **Keyboard Shortcuts**: Show which-key overlay
5. **Search Highlighting**: Show fuzzy search matches highlighted

### Promotional Images
- Feature the telescope icon prominently
- Use the extension's color scheme (dark theme, blue/purple accents)
- Include tagline: "Lightning-fast tab search with vim-style navigation"
- Show key features: Search, Harpoon, Visual Mode

## Screenshot Requirements
- **Dimensions**: 1280x800 px (minimum), exactly
- **Format**: PNG or JPEG
- **Content**: Actual extension UI in use
- **Quality**: High-quality, no blurriness
- **Text**: Readable at full size
- **Browser**: Use clean browser UI without personal data

## Next Steps
1. Generate icon sizes from existing logo
2. Take screenshots of extension features
3. Create promotional images
4. Prepare store listing copy
5. Submit for review