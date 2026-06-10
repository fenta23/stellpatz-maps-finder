import type { LatLngBounds } from './OverpassClient.js'

// Fixed-grid tiling so overlapping viewports share cached POI data.
//
// The viewport is covered by grid-aligned tiles; each tile is fetched + cached
// independently. Panning reuses already-loaded tiles, and a tile is cached
// forever (client) / for the TTL (server). Tile sizes are a power-of-two-ish
// ladder of the 0.05° base grid: zooming picks a coarser/finer size so the
// viewport is always covered by a bounded number of tiles. All sizes are
// multiples of 0.05°, so tile bounds land on the server's snap grid (the
// server-side snap is then a no-op → stable cache keys).

export const TILE_SIZES = [0.05, 0.1, 0.2, 0.4, 0.8] as const
const MAX_TILES = 16

export interface Tile {
  readonly size: number
  readonly ty: number // floor(lat / size)
  readonly tx: number // floor(lon / size)
}

/** Smallest tile size that covers the span with at most MAX_TILES tiles. */
export function pickTileSize(latSpan: number, lonSpan: number): number {
  for (const size of TILE_SIZES) {
    const count = Math.ceil(latSpan / size) * Math.ceil(lonSpan / size)
    if (count <= MAX_TILES) return size
  }
  return TILE_SIZES[TILE_SIZES.length - 1]!
}

/** All grid tiles (at a single, span-appropriate size) covering the bounds. */
export function coveringTiles(bounds: LatLngBounds): Tile[] {
  const size = pickTileSize(bounds.north - bounds.south, bounds.east - bounds.west)
  const y0 = Math.floor(bounds.south / size)
  const y1 = Math.floor(bounds.north / size)
  const x0 = Math.floor(bounds.west / size)
  const x1 = Math.floor(bounds.east / size)
  const tiles: Tile[] = []
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      tiles.push({ size, ty, tx })
    }
  }
  return tiles
}

const round4 = (v: number) => Math.round(v * 1e4) / 1e4

export function tileBounds(t: Tile): LatLngBounds {
  return {
    south: round4(t.ty * t.size),
    west: round4(t.tx * t.size),
    north: round4((t.ty + 1) * t.size),
    east: round4((t.tx + 1) * t.size),
  }
}

export function tileKey(t: Tile): string {
  return `${t.size}:${t.ty}:${t.tx}`
}
