import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { OsmPoi } from '@/features/pois/OverpassClient.js'
import { coveringTiles } from '@/features/pois/tiles.js'

// One shared mock fn referenced by both the module mock and the tests.
const { fetchPoisMock } = vi.hoisted(() => ({ fetchPoisMock: vi.fn() }))

vi.mock('@/features/pois/OverpassClient.js', async (orig) => ({
  ...(await orig<typeof import('@/features/pois/OverpassClient.js')>()),
  fetchPois: fetchPoisMock,
}))

import { createPoiRefresher } from './poiRefresher.js'

// Default: each tile returns one POI, id derived from its bbox corner.
function oneePoiPerTile(b: { south: number; west: number }): OsmPoi[] {
  const id = Math.round(b.south * 100) * 100000 + Math.round(b.west * 100)
  return [{ id, type: 'parking', lat: b.south, lon: b.west, tags: {} }]
}

beforeEach(() => {
  fetchPoisMock.mockReset()
  fetchPoisMock.mockImplementation(async (b: { south: number; west: number }) => oneePoiPerTile(b))
})

function makeDeps(bounds: { south: number; west: number; north: number; east: number } | null) {
  const setMarkers = vi.fn<(p: readonly OsmPoi[]) => void>()
  const setStatus = vi.fn()
  return { deps: { getBounds: () => bounds, setMarkers, setStatus }, setMarkers, setStatus }
}

const flush = () => new Promise(r => setTimeout(r, 0))
const CITY = { south: 48.12, west: 11.56, north: 48.14, east: 11.58 } // 1 tile

describe('createPoiRefresher (tiled)', () => {
  it('fetches each covering tile once and paints the assembled POIs', async () => {
    const { deps, setMarkers } = makeDeps({ south: 48.13, west: 11.56, north: 48.17, east: 11.58 })
    const tileCount = coveringTiles(deps.getBounds()!).length
    expect(tileCount).toBe(2)
    await createPoiRefresher(deps).refresh()
    await flush()
    expect(fetchPoisMock).toHaveBeenCalledTimes(tileCount)
    expect(setMarkers.mock.calls.at(-1)![0]).toHaveLength(tileCount)
  })

  it('serves a revisited viewport entirely from cache (no new fetches)', async () => {
    const { deps } = makeDeps(CITY)
    const r = createPoiRefresher(deps)
    await r.refresh(); await flush()
    expect(fetchPoisMock).toHaveBeenCalledTimes(1)
    fetchPoisMock.mockClear()
    await r.refresh(); await flush()
    expect(fetchPoisMock).not.toHaveBeenCalled()
  })

  it('only fetches the newly revealed tiles when panning', async () => {
    let bounds = { south: 48.12, west: 11.56, north: 48.14, east: 11.58 }
    const r = createPoiRefresher({ getBounds: () => bounds, setMarkers: vi.fn(), setStatus: vi.fn() })
    await r.refresh(); await flush()
    expect(fetchPoisMock).toHaveBeenCalledTimes(1)
    fetchPoisMock.mockClear()
    bounds = { south: 48.13, west: 11.56, north: 48.17, east: 11.58 } // + one new row
    await r.refresh(); await flush()
    expect(fetchPoisMock).toHaveBeenCalledTimes(1)
  })

  it('dedupes POIs shared across tiles', async () => {
    fetchPoisMock.mockImplementation(async () => [{ id: 42, type: 'parking', lat: 48, lon: 11, tags: {} } as OsmPoi])
    const { deps, setMarkers } = makeDeps({ south: 48.13, west: 11.56, north: 48.17, east: 11.58 })
    await createPoiRefresher(deps).refresh(); await flush()
    expect(setMarkers.mock.calls.at(-1)![0]).toHaveLength(1)
  })

  it('refuses an over-wide viewport without fetching', async () => {
    const { deps, setStatus } = makeDeps({ south: 47, west: 10, north: 49, east: 12 })
    await createPoiRefresher(deps).refresh()
    expect(fetchPoisMock).not.toHaveBeenCalled()
    expect(setStatus).toHaveBeenCalledWith('Bitte weiter reinzoomen…')
  })

  it('does nothing without bounds', async () => {
    const { deps, setMarkers } = makeDeps(null)
    await createPoiRefresher(deps).refresh()
    expect(fetchPoisMock).not.toHaveBeenCalled()
    expect(setMarkers).not.toHaveBeenCalled()
  })
})
