import { fetchPois, type LatLngBounds, type OsmPoi, type PoiType } from '@/features/pois/OverpassClient.js'
import { markCovered, uncoveredBounds, withinBounds } from '@/features/pois/coverage.js'
import { overpassErrorMessage, poiCountMessage } from '@/features/pois/statusMessages.js'

const MAX_SPAN_DEG = 1.5 // refuse to query an over-wide viewport
const SLOW_HINT_MS = 8000

// All POI types are fetched so a region is fetched once regardless of active
// filters; toggling filters is then pure marker visibility (no refetch).
const ALL_TYPES: ReadonlySet<PoiType> = new Set<PoiType>(['parking', 'camper', 'campsite', 'dump', 'water'])

export interface PoiRefresherDeps {
  readonly getBounds: () => LatLngBounds | null
  readonly setMarkers: (pois: readonly OsmPoi[]) => void
  readonly setStatus: (msg: string, isError?: boolean) => void
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

  function render(bounds: LatLngBounds): number {
    const pois: OsmPoi[] = []
    for (const p of store.values()) if (withinBounds(p, bounds)) pois.push(p)
    deps.setMarkers(pois)
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
    deps.setStatus('Lade Stellplätze…')
    const slowTimer = setTimeout(() => {
      if (generation === myGen) deps.setStatus('Warte auf Overpass-Server – kann etwas dauern…')
    }, SLOW_HINT_MS)

    try {
      const pois = await fetchPois(fetchArea, ALL_TYPES, inFlight.signal)
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
