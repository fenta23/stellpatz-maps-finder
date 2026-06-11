import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { OsmPoi } from '@/features/pois/OverpassClient.js'

// Shared mock fn referenced by both the module mock and the tests.
const { fetchPoisMock } = vi.hoisted(() => ({ fetchPoisMock: vi.fn() }))

vi.mock('@/features/pois/OverpassClient.js', async (orig) => ({
  ...(await orig<typeof import('@/features/pois/OverpassClient.js')>()),
  fetchPois: fetchPoisMock,
}))

import { createPoiRefresher } from './poiRefresher.js'

// Each fetched area returns one POI placed at the SW corner of the queried
// region (so distinct areas → distinct ids).
function poiAt(b: { south: number; west: number }): OsmPoi[] {
  const id = Math.round(b.south * 100) * 100000 + Math.round(b.west * 100)
  return [{ id, type: 'parking', lat: b.south + 0.01, lon: b.west + 0.01, tags: {} }]
}

beforeEach(() => {
  fetchPoisMock.mockReset()
  fetchPoisMock.mockImplementation(async (b: { south: number; west: number }) => poiAt(b))
})

function makeDeps(bounds: { south: number; west: number; north: number; east: number } | null) {
  const setMarkers = vi.fn<(p: readonly OsmPoi[]) => void>()
  const setStatus = vi.fn()
  return { deps: { getBounds: () => bounds, setMarkers, setStatus }, setMarkers, setStatus }
}

const flush = () => new Promise(r => setTimeout(r, 0))
const CITY = { south: 48.10, west: 11.55, north: 48.15, east: 11.60 }

describe('createPoiRefresher (single-query + accumulation)', () => {
  it('cold viewport → exactly one query, paints the result', async () => {
    const { deps, setMarkers } = makeDeps(CITY)
    await createPoiRefresher(deps).refresh(); await flush()
    expect(fetchPoisMock).toHaveBeenCalledTimes(1)
    expect(setMarkers.mock.calls.at(-1)![0].length).toBeGreaterThanOrEqual(1)
  })

  it('revisiting a fully-seen viewport makes no request', async () => {
    const { deps } = makeDeps(CITY)
    const r = createPoiRefresher(deps)
    await r.refresh(); await flush()
    expect(fetchPoisMock).toHaveBeenCalledTimes(1)
    fetchPoisMock.mockClear()
    await r.refresh(); await flush()
    expect(fetchPoisMock).not.toHaveBeenCalled() // served from the store
  })

  it('panning into new area queries only the uncovered strip (once)', async () => {
    let bounds = { ...CITY }
    const r = createPoiRefresher({ getBounds: () => bounds, setMarkers: vi.fn(), setStatus: vi.fn() })
    await r.refresh(); await flush()
    expect(fetchPoisMock).toHaveBeenCalledTimes(1)
    fetchPoisMock.mockClear()
    // pan north: lower half already covered
    bounds = { south: 48.10, west: 11.55, north: 48.25, east: 11.60 }
    await r.refresh(); await flush()
    expect(fetchPoisMock).toHaveBeenCalledTimes(1)
    const queried = fetchPoisMock.mock.calls[0]![0] as { south: number; north: number }
    expect(queried.south).toBeGreaterThanOrEqual(48.15) // only the new northern strip
  })

  it('accumulates POIs across areas and clips render to the viewport', async () => {
    let bounds = { ...CITY }
    const setMarkers = vi.fn<(p: readonly OsmPoi[]) => void>()
    const r = createPoiRefresher({ getBounds: () => bounds, setMarkers, setStatus: vi.fn() })
    await r.refresh(); await flush()
    bounds = { south: 48.20, west: 11.55, north: 48.25, east: 11.60 } // disjoint north area
    await r.refresh(); await flush()
    // viewport now only over the northern area → southern POI clipped out
    const lastMarkers = setMarkers.mock.calls.at(-1)![0]
    expect(lastMarkers.every(p => p.lat >= 48.20)).toBe(true)
  })

  it('shows an error when the fetch fails', async () => {
    fetchPoisMock.mockImplementation(async () => { throw new Error('Overpass proxy error: 503') })
    const { deps, setStatus } = makeDeps(CITY)
    await createPoiRefresher(deps).refresh(); await flush()
    expect(setStatus).toHaveBeenCalledWith(expect.any(String), true)
  })

  it('aborting (superseded refresh) does not surface an error', async () => {
    // first refresh hangs; second supersedes and aborts it
    let abortErr: Error | undefined
    fetchPoisMock.mockImplementationOnce((_b: unknown, _t: unknown, signal: AbortSignal) =>
      new Promise((_res, rej) => signal.addEventListener('abort', () => {
        abortErr = Object.assign(new Error('aborted'), { name: 'AbortError' }); rej(abortErr)
      })))
    let bounds = { ...CITY }
    const { setStatus } = { setStatus: vi.fn() }
    const r = createPoiRefresher({ getBounds: () => bounds, setMarkers: vi.fn(), setStatus })
    const p1 = r.refresh()
    bounds = { south: 48.20, west: 11.55, north: 48.25, east: 11.60 }
    await r.refresh(); await p1; await flush()
    expect(setStatus).not.toHaveBeenCalledWith(expect.any(String), true)
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
