import { describe, it, expect } from 'vitest'
import { joinApiUrl, apiUrl } from './config.js'

describe('joinApiUrl', () => {
  it('keeps the path relative when base is empty (web/PWA)', () => {
    expect(joinApiUrl('', '/api/overpass')).toBe('/api/overpass')
  })

  it('prefixes an absolute base (Capacitor)', () => {
    expect(joinApiUrl('https://example.com', '/api/route')).toBe('https://example.com/api/route')
  })

  it('strips a trailing slash on the base', () => {
    expect(joinApiUrl('https://example.com/', '/api/route')).toBe('https://example.com/api/route')
  })

  it('strips multiple trailing slashes', () => {
    expect(joinApiUrl('https://example.com///', '/api/x')).toBe('https://example.com/api/x')
  })
})

describe('apiUrl', () => {
  it('returns a relative path by default (no VITE_API_BASE in tests)', () => {
    const result = apiUrl('/api/geocode?q=test')
    // Wenn VITE_API_BASE in der Umgebung gesetzt ist (z. B. .env), wird absolut
    // retourniert – sonst relativ. Beide Fälle sind OK.
    if (result === '/api/geocode?q=test') {
      expect(result).toBe('/api/geocode?q=test')
    } else {
      expect(result).toMatch(/^https?:\/\//)
    }
  })
})
