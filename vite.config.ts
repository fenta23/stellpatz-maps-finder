import { defineConfig } from 'vite'
import { resolve } from 'node:path'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  root: '.',
  publicDir: 'public',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      // External register script (not inline) so helmet's `script-src 'self'` CSP allows it.
      injectRegister: 'script',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'logo.svg'],
      manifest: {
        name: 'Stellpatz Finder',
        short_name: 'Stellpatz',
        description: 'Parkplätze, Camper-Stellplätze und Campingplätze auf der Karte finden',
        lang: 'de',
        theme_color: '#1565C0',
        background_color: '#1565C0',
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
      '/api': 'http://localhost:3000',
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
