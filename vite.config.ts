import { defineConfig } from 'vite'
import { resolve } from 'node:path'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  root: '.',
  publicDir: 'public',
  resolve: {
    // Order matters: @shared must be matched before the broader @ alias.
    alias: [
      { find: '@shared', replacement: resolve(__dirname, 'src/shared') },
      { find: '@', replacement: resolve(__dirname, 'src/client') },
    ],
  },
  plugins: [
    VitePWA({
      // Prompt mode: a new SW stays waiting until the user clicks "update" in the
      // banner (see features/update/UpdateBanner.ts). autoUpdate would silently
      // skipWaiting + auto-reload, which raced the banner and made updates
      // inconsistent.
      registerType: 'prompt',
      // We register the SW ourselves from the app bundle via `virtual:pwa-register`
      // (bundled JS = script-src 'self', CSP-safe) so we can wire onNeedRefresh.
      injectRegister: null,
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'logo.svg'],
      manifest: {
        name: 'Stellpatz Finder',
        short_name: 'Stellpatz',
        description: 'Parkplätze, Camper-Stellplätze und Campingplätze auf der Karte finden',
        lang: 'de',
        theme_color: '#4B5640',
        background_color: '#F4F1EA',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallbackDenylist: [/^\/api\//], // never serve the app shell for API routes
        // IMPORTANT: do NOT add map-tile hosts here. A runtime-caching route makes the
        // SW fetch tiles itself, which is then subject to the SW's CSP `connect-src`
        // (not `img-src`) and gets blocked → grey map. Tiles must stay plain <img>
        // loads (governed by img-src), exactly as without a SW.
        runtimeCaching: [
          {
            // API proxy — fresh-first, fall back to cache when offline (same-origin → CSP 'self')
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api',
              networkTimeoutSeconds: 6,
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false }, // SW only in production builds
    }),
  ],
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      // changeOrigin:false keeps Host = localhost:5173 so it matches the
      // browser's Origin header on POSTs — required by the API origin guard.
      '/api': { target: 'http://localhost:3000', changeOrigin: false },
    },
  },
  test: {
    root: resolve(__dirname, '.'),
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
})
