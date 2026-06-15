import { describe, it, expect } from 'vitest'
import {
  haversineMeters, buildGoogleMapsPoiLink, buildRouteResult,
  detectNavPlatform, buildGoogleDirectionsLink, buildAppleDirectionsLink, buildNavLink,
} from './DirectionsService.js'

describe('haversineMeters', () => {
  it('returns ~0 for identical points', () => {
    expect(haversineMeters({ lat: 48, lon: 11 }, { lat: 48, lon: 11 })).toBeCloseTo(0)
  })

  it('returns ~111km per degree latitude', () => {
    const d = haversineMeters({ lat: 48, lon: 11 }, { lat: 49, lon: 11 })
    expect(d).toBeGreaterThan(110_000)
    expect(d).toBeLessThan(113_000)
  })

  it('is symmetric', () => {
    const a = { lat: 48.1, lon: 11.5 }
    const b = { lat: 48.5, lon: 11.1 }
    expect(haversineMeters(a, b)).toBeCloseTo(haversineMeters(b, a), 0)
  })
})

describe('buildGoogleMapsPoiLink', () => {
  it('points at Google Maps with the destination coordinates', () => {
    const url = buildGoogleMapsPoiLink({ lat: 48.123, lon: 11.456 })
    expect(url).toContain('google.com/maps/search/')
    expect(url).toContain('48.123')
    expect(url).toContain('11.456')
  })

  it('includes the POI name (URL-encoded) so Maps selects the matching place', () => {
    const url = buildGoogleMapsPoiLink({ lat: 48.1, lon: 11.5 }, 'Stellplatz am See')
    expect(url).toContain(encodeURIComponent('Stellplatz am See 48.1,11.5'))
  })

  it('falls back to coordinates only when no name is given', () => {
    const url = buildGoogleMapsPoiLink({ lat: 48.1, lon: 11.5 }, '   ')
    expect(url).toContain(encodeURIComponent('48.1,11.5'))
    expect(url).not.toContain('+')
  })
})

describe('detectNavPlatform', () => {
  it('returns apple for iPhone/iPad/Mac user agents', () => {
    expect(detectNavPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)', 'iPhone')).toBe('apple')
    expect(detectNavPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X)', 'MacIntel')).toBe('apple')
  })
  it('returns google for Android/Windows/Linux', () => {
    expect(detectNavPlatform('Mozilla/5.0 (Linux; Android 14)', 'Linux armv8l')).toBe('google')
    expect(detectNavPlatform('Mozilla/5.0 (Windows NT 10.0)', 'Win32')).toBe('google')
  })
})

describe('buildGoogleDirectionsLink', () => {
  const to = { lat: 48.1, lon: 11.5 }
  it('encodes destination + travelmode, omits origin when absent', () => {
    const url = buildGoogleDirectionsLink(to, 'driving')
    expect(url).toContain('google.com/maps/dir/')
    expect(url).toContain('destination=48.1%2C11.5')
    expect(url).toContain('travelmode=driving')
    expect(url).not.toContain('origin=')
  })
  it('includes origin when given and maps cycling/foot to Google modes', () => {
    expect(buildGoogleDirectionsLink(to, 'cycling', { lat: 50, lon: 9 })).toContain('travelmode=bicycling')
    expect(buildGoogleDirectionsLink(to, 'foot')).toContain('travelmode=walking')
    expect(buildGoogleDirectionsLink(to, 'driving', { lat: 50, lon: 9 })).toContain('origin=50%2C9')
  })
})

describe('buildAppleDirectionsLink', () => {
  const to = { lat: 48.1, lon: 11.5 }
  it('uses daddr/saddr + dirflg, cycling falls back to drive', () => {
    expect(buildAppleDirectionsLink(to, 'foot')).toContain('dirflg=w')
    expect(buildAppleDirectionsLink(to, 'cycling')).toContain('dirflg=d')
    const url = buildAppleDirectionsLink(to, 'driving', { lat: 50, lon: 9 })
    expect(url).toContain('maps.apple.com')
    expect(url).toContain('daddr=48.1%2C11.5')
    expect(url).toContain('saddr=50%2C9')
  })
})

describe('buildNavLink', () => {
  const to = { lat: 48.1, lon: 11.5 }
  it('picks Apple vs Google by explicit platform', () => {
    expect(buildNavLink(to, 'driving', { platform: 'apple' })).toContain('maps.apple.com')
    expect(buildNavLink(to, 'driving', { platform: 'google' })).toContain('google.com/maps/dir')
  })
  it('passes the from coords through', () => {
    expect(buildNavLink(to, 'driving', { platform: 'google', from: { lat: 50, lon: 9 } })).toContain('origin=50%2C9')
  })
})

describe('buildRouteResult', () => {
  const from = { lat: 48, lon: 11 }
  const to = { lat: 48.5, lon: 11 }

  it('computes detour factor', () => {
    const r = buildRouteResult(60_000, 3600, from, to)
    expect(r.detourFactor).toBeGreaterThan(1)
  })

  it('formats duration in minutes under 1h', () => {
    const r = buildRouteResult(10_000, 25 * 60, from, to)
    expect(r.durationText).toBe('25 min')
  })

  it('formats duration as h+min over 1h', () => {
    const r = buildRouteResult(100_000, 90 * 60, from, to)
    expect(r.durationText).toBe('1 h 30 min')
  })

  it('formats distance in km', () => {
    const r = buildRouteResult(55_500, 3600, from, to)
    expect(r.distanceText).toContain('km')
  })

  it('uses detourFactor 1 when distanceMeters is 0', () => {
    const r = buildRouteResult(0, 0, from, to)
    expect(r.detourFactor).toBe(1)
  })
})
