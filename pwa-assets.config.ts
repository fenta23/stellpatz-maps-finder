import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Generates PWA icon set (192/512/maskable/apple-touch) from one source SVG.
// Run: npm run generate-pwa-assets  →  outputs PNGs next to the source in public/.
export default defineConfig({
  preset: minimal2023Preset,
  images: ['public/logo.svg'],
})
