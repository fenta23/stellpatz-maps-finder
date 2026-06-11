import { describe, it, expect } from 'vitest'
import { markCovered, uncoveredBounds, withinBounds } from './coverage.js'

const B = { south: 48.10, west: 11.55, north: 48.15, east: 11.60 } // one 0.05° cell-ish

describe('uncoveredBounds', () => {
  it('returns the full area when nothing is covered yet', () => {
    const u = uncoveredBounds(B, new Set())
    expect(u).not.toBeNull()
    expect(u!.south).toBeLessThanOrEqual(B.south)
    expect(u!.north).toBeGreaterThanOrEqual(B.north)
  })

  it('returns null once the viewport is fully covered', () => {
    const covered = new Set<string>()
    markCovered(B, covered)
    expect(uncoveredBounds(B, covered)).toBeNull()
  })

  it('returns only the new strip when panning into partly-seen area', () => {
    const covered = new Set<string>()
    markCovered({ south: 48.10, west: 11.55, north: 48.15, east: 11.60 }, covered)
    // pan north: viewport now spans 48.10–48.25, lower part already covered
    const u = uncoveredBounds({ south: 48.10, west: 11.55, north: 48.25, east: 11.60 }, covered)
    expect(u).not.toBeNull()
    expect(u!.south).toBeGreaterThanOrEqual(48.15) // only the unseen northern strip
    expect(u!.north).toBeCloseTo(48.25, 5)
  })
})

describe('markCovered + idempotence', () => {
  it('covering the same area twice leaves it fully covered', () => {
    const covered = new Set<string>()
    markCovered(B, covered)
    const size1 = covered.size
    markCovered(B, covered)
    expect(covered.size).toBe(size1)
    expect(uncoveredBounds(B, covered)).toBeNull()
  })
})

describe('withinBounds', () => {
  it('includes points inside and excludes points outside', () => {
    expect(withinBounds({ lat: 48.12, lon: 11.57 }, B)).toBe(true)
    expect(withinBounds({ lat: 48.40, lon: 11.57 }, B)).toBe(false)
    expect(withinBounds({ lat: 48.12, lon: 12.50 }, B)).toBe(false)
  })
})
