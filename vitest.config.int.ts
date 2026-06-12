import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.int.test.ts'],
    testTimeout: 10_000,
    globals: true,
  },
})
