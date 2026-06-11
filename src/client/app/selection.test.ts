import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createSelection, type SelectionDeps } from './selection.js'
import { createSession } from './session.js'
import type { OsmPoi } from '@/features/pois/OverpassClient.js'

const poi: OsmPoi = { id: 1, type: 'parking', lat: 48.1, lon: 11.5, tags: {} }

function makeDeps(userPos: { lat: number; lon: number } | null) {
  const session = createSession(userPos)
  const directions = { route: vi.fn().mockResolvedValue({ distanceText: '1 km' }), clearRoute: vi.fn() }
  const panel = { show: vi.fn(), hide: vi.fn() }
  const favorites = { has: vi.fn().mockReturnValue(false), toggle: vi.fn(), getAll: vi.fn(), onChange: vi.fn() }
  const onStartSet = vi.fn()
  const onStartReset = vi.fn()
  const deps = {
    session,
    directions,
    panel,
    favorites,
    panIntoView: vi.fn(),
    loadDetails: vi.fn(),
    onNoLocation: vi.fn(),
    onStartSet,
    onStartReset,
  } as unknown as SelectionDeps
  return { deps, session, directions, panel, onStartSet, onStartReset }
}

describe('createSelection.select', () => {
  it('with location: pans, routes, shows panel, loads details', async () => {
    const { deps, session, directions, panel } = makeDeps({ lat: 48, lon: 11 })
    const sel = createSelection(deps)
    await sel.select(poi)
    expect(session.selectedPoi).toBe(poi)
    expect(deps.panIntoView).toHaveBeenCalledWith(poi)
    expect(directions.route).toHaveBeenCalledOnce()
    expect(panel.show).toHaveBeenCalledOnce()
    expect(deps.loadDetails).toHaveBeenCalledWith(poi)
  })

  it('without location: shows panel + loads details without routing, signals no-location', async () => {
    const { deps, directions, panel } = makeDeps(null)
    const sel = createSelection(deps)
    await sel.select(poi)
    expect(directions.route).not.toHaveBeenCalled()
    expect(panel.show).toHaveBeenCalledOnce()
    expect(deps.onNoLocation).toHaveBeenCalledOnce()
    // details (images / nearby / notes) load even without a location/route
    expect(deps.loadDetails).toHaveBeenCalledWith(poi)
  })
})

describe('createSelection.navigate', () => {
  it('without location: only signals, does not show or route', async () => {
    const { deps, directions, panel } = makeDeps(null)
    const sel = createSelection(deps)
    await sel.navigate(poi)
    expect(deps.onNoLocation).toHaveBeenCalledOnce()
    expect(directions.route).not.toHaveBeenCalled()
    expect(panel.show).not.toHaveBeenCalled()
  })
})

describe('createSelection.reroute', () => {
  it('re-routes the current selection without reloading details', async () => {
    const { deps, session, directions } = makeDeps({ lat: 48, lon: 11 })
    session.selectedPoi = poi
    const sel = createSelection(deps)
    await sel.reroute()
    expect(directions.route).toHaveBeenCalledOnce()
    expect(deps.loadDetails).not.toHaveBeenCalled()
  })

  it('clears the route when nothing is selected', async () => {
    const { deps, directions } = makeDeps({ lat: 48, lon: 11 })
    const sel = createSelection(deps)
    await sel.reroute()
    expect(directions.clearRoute).toHaveBeenCalledOnce()
    expect(directions.route).not.toHaveBeenCalled()
  })
})

describe('createSelection.setStart', () => {
  it('sets the open POI as the route origin, clears route + selection, signals', () => {
    const { deps, session, directions, panel, onStartSet } = makeDeps({ lat: 48, lon: 11 })
    session.selectedPoi = poi
    const sel = createSelection(deps)
    sel.setStart()
    expect(session.routeOrigin).toEqual({ lat: 48.1, lon: 11.5, label: 'Gewählter Start' })
    expect(session.selectedPoi).toBeNull()
    expect(directions.clearRoute).toHaveBeenCalledOnce()
    expect(panel.hide).toHaveBeenCalledOnce()
    expect(onStartSet).toHaveBeenCalledWith('Gewählter Start')
  })

  it('uses the POI name as the start label when present', () => {
    const named: OsmPoi = { ...poi, tags: { name: 'Wanderparkplatz' } }
    const { deps, session } = makeDeps({ lat: 48, lon: 11 })
    session.selectedPoi = named
    createSelection(deps).setStart()
    expect(session.routeOrigin?.label).toBe('Wanderparkplatz')
  })

  it('does nothing when no POI is open', () => {
    const { deps, session, directions } = makeDeps({ lat: 48, lon: 11 })
    createSelection(deps).setStart()
    expect(session.routeOrigin).toBeNull()
    expect(directions.clearRoute).not.toHaveBeenCalled()
  })

  it('enables routing without GPS (custom origin makes resolveOrigin non-null)', async () => {
    const { deps, session, directions } = makeDeps(null) // no GPS
    session.selectedPoi = poi
    const sel = createSelection(deps)
    sel.setStart() // poi becomes origin
    session.selectedPoi = { ...poi, id: 2, lat: 49, lon: 12 }
    await sel.navigate(session.selectedPoi)
    expect(directions.route).toHaveBeenCalledOnce() // routes despite no GPS
  })
})

describe('createSelection.resetStart', () => {
  it('clears the custom origin, re-routes the open POI, signals', async () => {
    const { deps, session, directions, onStartReset } = makeDeps({ lat: 48, lon: 11 })
    session.routeOrigin = { lat: 50, lon: 9, label: 'X' }
    session.selectedPoi = poi
    await createSelection(deps).resetStart()
    expect(session.routeOrigin).toBeNull()
    expect(onStartReset).toHaveBeenCalledOnce()
    expect(directions.route).toHaveBeenCalledOnce()
  })
})

describe('createSelection.clear', () => {
  it('drops the selection and clears the route', () => {
    const { deps, session, directions } = makeDeps({ lat: 48, lon: 11 })
    session.selectedPoi = poi
    const sel = createSelection(deps)
    sel.clear()
    expect(session.selectedPoi).toBeNull()
    expect(directions.clearRoute).toHaveBeenCalledOnce()
  })
})
