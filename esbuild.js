import esbuild from 'esbuild'
import sveltePlugin from 'esbuild-svelte'
import sveltePreprocess from 'svelte-preprocess'

const esbuildConfig = {
  entryPoints: ['src/content-scripts/content.ts', 'src/service-workers/service-worker.ts'], // Your main content script
  bundle: true, // Bundle all dependencies
  outdir: 'dist',
  target: 'es2020', // Match your TS target
  platform: 'browser', // For Chrome extension
  format: 'iife', // IIFE for classic script compatibility
  sourcemap: true, // Optional: for debugging
  plugins: [
    sveltePlugin({
      compilerOptions: {
        css: 'injected', // Inject CSS into the bundle for Chrome extension compatibility
        hydratable: false,
        immutable: true
      },
      preprocess: sveltePreprocess({
        typescript: true
      })
    }),
    {
      name: 'rebuild-notify',
      setup(build) {
        build.onEnd((result) => {
          console.log(`build ended with ${result.errors.length} errors`)
          // HERE: somehow restart the server from here, e.g., by sending a signal that you trap and react to inside the server.
        })
      }
    }
  ]
}

async function watch() {
  const ctx = await esbuild.context(esbuildConfig)
  await ctx.watch()
  console.log('Watching for changes...')
}

if (process.argv.includes('--watch')) {
  watch()
} else {
  esbuild
    .build(esbuildConfig)
    .then(() => {
      console.log('Build succeeded!')
    })
    .catch((error) => {
      console.error('Build failed:', error)
      process.exit(1)
    })
}
