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
    expect(apiUrl('/api/geocode?q=test')).toBe('/api/geocode?q=test')
  })
})
