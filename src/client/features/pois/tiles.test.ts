import { describe, it, expect } from 'vitest'
import { pickTileSize, coveringTiles, tileBounds, tileKey, type Tile } from './tiles.js'

describe('pickTileSize', () => {
  it('uses the finest grid for a small (city) viewport', () => {
    expect(pickTileSize(0.04, 0.04)).toBe(0.05)
  })

  it('steps up the ladder as the span grows (≤16 tiles)', () => {
    expect(pickTileSize(0.3, 0.3)).toBe(0.1)  // 0.05→36 tiles, 0.1→9
    expect(pickTileSize(0.6, 0.6)).toBe(0.2)  // 0.1→36, 0.2→9
    expect(pickTileSize(1.4, 1.4)).toBe(0.4)  // 0.2→49, 0.4→16
  })

  it('keeps the tile count bounded', () => {
    for (const span of [0.04, 0.2, 0.5, 1.0, 1.5]) {
      const size = pickTileSize(span, span)
      const count = Math.ceil(span / size) * Math.ceil(span / size)
      expect(count).toBeLessThanOrEqual(16)
    }
  })
})

describe('coveringTiles', () => {
  it('returns a single tile for a viewport inside one cell', () => {
    const tiles = coveringTiles({ south: 48.12, west: 11.56, north: 48.14, east: 11.58 })
    expect(tiles).toHaveLength(1)
    expect(tileKey(tiles[0]!)).toBe('0.05:962:231')
  })

  it('returns multiple tiles when the viewport straddles boundaries', () => {
    // spans 48.13–48.17 (crosses 48.15) × 11.56–11.58 → 2 rows × 1 col
    const tiles = coveringTiles({ south: 48.13, west: 11.56, north: 48.17, east: 11.58 })
    expect(tiles).toHaveLength(2)
  })

  it('all covering tiles share the chosen size', () => {
    const tiles = coveringTiles({ south: 48.0, west: 11.0, north: 48.5, east: 11.5 })
    const sizes = new Set(tiles.map(t => t.size))
    expect(sizes.size).toBe(1)
  })
})

describe('tileBounds', () => {
  it('produces grid-aligned bounds (no float drift)', () => {
    const t: Tile = { size: 0.05, ty: 963, tx: 231 }
    expect(tileBounds(t)).toEqual({ south: 48.15, west: 11.55, north: 48.2, east: 11.6 })
  })
})

describe('tileKey', () => {
  it('is stable and unique per (size, ty, tx)', () => {
    expect(tileKey({ size: 0.1, ty: 10, tx: 20 })).toBe('0.1:10:20')
    expect(tileKey({ size: 0.1, ty: 10, tx: 20 })).toBe(tileKey({ size: 0.1, ty: 10, tx: 20 }))
    expect(tileKey({ size: 0.1, ty: 10, tx: 20 })).not.toBe(tileKey({ size: 0.05, ty: 10, tx: 20 }))
  })
})
