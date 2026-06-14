import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.int.test.ts'],
    // These hit the live Edge Function (and via it, Overpass) — a cold/slow
    // upstream call can exceed 10s. Generous timeout + one retry so a transient
    // upstream hiccup doesn't fail the deploy gate.
    testTimeout: 30_000,
    retry: 1,
    globals: true,
  },
})
