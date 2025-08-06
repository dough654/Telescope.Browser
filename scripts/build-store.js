#!/usr/bin/env node

/**
 * Build script for Chrome Web Store submission
 * Removes the "key" field from manifest.json and creates a zip file
 */

import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

const DIST_DIR = 'dist'
const MANIFEST_PATH = path.join(DIST_DIR, 'manifest.json')

console.log('🔧 Building for Chrome Web Store...')

// Read the manifest
if (!fs.existsSync(MANIFEST_PATH)) {
  console.error('❌ manifest.json not found in dist/. Run "npm run build" first.')
  process.exit(1)
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))

// Remove the key field for store submission
if (manifest.key) {
  console.log('🔑 Removing "key" field for store submission...')
  delete manifest.key
  
  // Write back the modified manifest
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2))
  console.log('✅ Manifest updated for store submission')
}

// Create zip file
const version = manifest.version
const zipFileName = `telescope-browser-store-v${version}.zip`

console.log(`📦 Creating zip file: ${zipFileName}`)

try {
  // Remove existing zip if it exists
  if (fs.existsSync(zipFileName)) {
    fs.unlinkSync(zipFileName)
  }
  
  // Create zip (change to dist directory first to avoid including 'dist/' in zip paths)
  execSync(`cd ${DIST_DIR} && zip -r ../${zipFileName} .`, { stdio: 'inherit' })
  
  console.log(`✅ Store package created: ${zipFileName}`)
  console.log('')
  console.log('🚀 Ready for Chrome Web Store submission!')
  console.log(`📁 Upload: ${zipFileName}`)
  
} catch (error) {
  console.error('❌ Failed to create zip file:', error.message)
  process.exit(1)
}