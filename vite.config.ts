import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig({
  root: 'public',
  publicDir: 'assets',
  build: {
    outDir: '../dist/client',
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
