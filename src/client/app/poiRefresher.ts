import { fetchPois, type LatLngBounds, type OsmPoi } from '@/features/pois/OverpassClient.js'
import type { FilterDef } from '@/features/filters/filterModel.js'
import { markCovered, uncoveredBounds, withinBounds } from '@/features/pois/coverage.js'
import { overpassErrorMessage, poiCountMessage } from '@/features/pois/statusMessages.js'

const MAX_SPAN_DEG = 1.5 // refuse to query an over-wide viewport
const SLOW_HINT_MS = 8000

export interface PoiRefresherDeps {
  readonly getBounds: () => LatLngBounds | null
  readonly setMarkers: (pois: readonly OsmPoi[]) => void
  readonly setStatus: (msg: string, isError?: boolean) => void
  /** Returns all OSM filter definitions (built-in + user-created) for the fetch. */
  readonly getOsmFilters: () => readonly FilterDef[]
}

/**
 * One Overpass query per genuinely-new area, with client-side accumulation.
 *
 * Every fetched POI is kept in a store and the 0.05° cells it came from are
 * marked covered. A refresh renders the store clipped to the viewport, so:
 *   • a viewport of already-seen cells → instant, no network;
 *   • a partially-new viewport → a single query over just the uncovered strip;
 *   • a cold viewport → a single full query (same as before tiling).
 * The previous in-flight query is aborted when a newer refresh starts, so
 * rapid panning issues at most one upstream query at a time.
 */
export function createPoiRefresher(deps: PoiRefresherDeps): { refresh(): Promise<void> } {
  const store = new Map<number, OsmPoi>()
  const covered = new Set<string>()
  let inFlight: AbortController | null = null
  let generation = 0
  let lastRenderedIds = new Set<number>()

  function render(bounds: LatLngBounds): number {
    const pois: OsmPoi[] = []
    for (const p of store.values()) if (withinBounds(p, bounds)) pois.push(p)
    // Skip redundant re-renders (e.g. the pre-fetch paint on zoom-out shows the
    // same markers already on screen) — re-running setMarkers would churn the
    // marker-cluster layer and make POIs flicker.
    const ids = new Set(pois.map(p => p.id))
    if (!sameIds(ids, lastRenderedIds)) {
      lastRenderedIds = ids
      deps.setMarkers(pois)
    }
    return pois.length
  }

  async function refresh(): Promise<void> {
    const bounds = deps.getBounds()
    if (!bounds) return

    if (bounds.north - bounds.south > MAX_SPAN_DEG || bounds.east - bounds.west > MAX_SPAN_DEG) {
      deps.setStatus('Bitte weiter reinzoomen…')
      return
    }

    const myGen = ++generation
    const fetchArea = uncoveredBounds(bounds, covered)

    // Whole viewport already seen → paint from the store, no request.
    if (!fetchArea) {
      deps.setStatus(poiCountMessage(render(bounds)))
      setTimeout(() => { if (generation === myGen) deps.setStatus('') }, 2000)
      return
    }

    render(bounds) // show what we already have while the new strip loads
    inFlight?.abort()
    inFlight = new AbortController()
    deps.setStatus('Suche Orte…')
    const slowTimer = setTimeout(() => {
      if (generation === myGen) deps.setStatus('Warte auf Overpass-Server – kann etwas dauern…')
    }, SLOW_HINT_MS)

    try {
      const pois = await fetchPois(fetchArea, deps.getOsmFilters(), inFlight.signal)
      clearTimeout(slowTimer)
      if (generation !== myGen) return
      for (const p of pois) store.set(p.id, p)
      markCovered(bounds, covered)
      deps.setStatus(poiCountMessage(render(bounds)))
      setTimeout(() => { if (generation === myGen) deps.setStatus('') }, 3000)
    } catch (err) {
      clearTimeout(slowTimer)
      if ((err as Error).name === 'AbortError') return
      if (generation !== myGen) return
      console.error('POI fetch failed:', err)
      deps.setStatus(overpassErrorMessage(err), true)
    }
  }

  return { refresh }
}

function sameIds(a: ReadonlySet<number>, b: ReadonlySet<number>): boolean {
  if (a.size !== b.size) return false
  for (const id of a) if (!b.has(id)) return false
  return true
}
