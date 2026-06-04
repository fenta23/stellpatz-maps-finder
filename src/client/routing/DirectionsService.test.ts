import { describe, it, expect } from 'vitest'
import { haversineMeters, buildGoogleMapsDeeplink, buildRouteResult } from './DirectionsService.js'

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

describe('buildGoogleMapsDeeplink', () => {
  it('includes destination coordinates', () => {
    const url = buildGoogleMapsDeeplink({ lat: 48.123, lon: 11.456 })
    expect(url).toContain('48.123')
    expect(url).toContain('11.456')
    expect(url).toContain('travelmode=driving')
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
