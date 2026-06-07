// API base URL resolution.
//
// Web + PWA: served same-origin by Express → base is empty, calls stay relative
// (`/api/...`). Packaged builds (Capacitor) run from a non-HTTP origin
// (`capacitor://`, `file://`), so relative calls would miss the server — set
// VITE_API_BASE to the deployed origin (e.g. https://stellplatz-maps-finder.onrender.com)
// at build time and every call is rewritten to an absolute URL.

/** Joins an API base with a path, tolerating a trailing slash on the base. */
export function joinApiUrl(base: string, path: string): string {
  return base.replace(/\/+$/, '') + path
}

function readBase(): string {
  try {
    // Vite statically replaces this at build; undefined under plain Node/tests.
    const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env
    return env?.['VITE_API_BASE'] ?? ''
  } catch {
    return ''
  }
}

export const API_BASE = readBase()

/** Resolve an API path (e.g. `/api/overpass`) to the right URL for this build target. */
export const apiUrl = (path: string): string => joinApiUrl(API_BASE, path)
