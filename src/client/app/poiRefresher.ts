import { fetchPois, type LatLngBounds, type OsmPoi, type PoiType } from '@/features/pois/OverpassClient.js'
import { coveringTiles, tileBounds, tileKey, type Tile } from '@/features/pois/tiles.js'
import { overpassErrorMessage, poiCountMessage } from '@/features/pois/statusMessages.js'

const MAX_SPAN_DEG = 1.5 // refuse to query an over-wide viewport
const SLOW_HINT_MS = 8000
const CONCURRENCY = 4 // parallel tile fetches — polite to Overpass

// All POI types are fetched per tile so a tile is cached once regardless of the
// active filters; toggling filters is then pure marker visibility (no refetch).
const ALL_TYPES: ReadonlySet<PoiType> = new Set<PoiType>(['parking', 'camper', 'campsite', 'dump', 'water'])

export interface PoiRefresherDeps {
  readonly getBounds: () => LatLngBounds | null
  readonly setMarkers: (pois: readonly OsmPoi[]) => void
  readonly setStatus: (msg: string, isError?: boolean) => void
}

/**
 * Tile-based, cached bounds → Overpass → markers flow. The viewport is split
 * into grid tiles; cached tiles paint instantly, only missing tiles are
 * fetched (bounded concurrency). Tiles fetched for a superseded viewport are
 * still cached — they speed up the next pan/zoom. Assembly dedupes by id
 * (ways spanning tiles appear in each).
 */
export function createPoiRefresher(deps: PoiRefresherDeps): { refresh(): Promise<void> } {
  const cache = new Map<string, readonly OsmPoi[]>()
  let generation = 0 // bumped each refresh; stale assemblies are skipped

  function assemble(tiles: readonly Tile[]): number {
    const byId = new Map<number, OsmPoi>()
    for (const t of tiles) {
      const pois = cache.get(tileKey(t))
      if (pois) for (const p of pois) byId.set(p.id, p)
    }
    const pois = [...byId.values()]
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
    const tiles = coveringTiles(bounds)
    const missing = tiles.filter(t => !cache.has(tileKey(t)))

    // Everything cached → instant paint, no spinner.
    if (missing.length === 0) {
      deps.setStatus('')
      deps.setStatus(poiCountMessage(assemble(tiles)))
      setTimeout(() => { if (generation === myGen) deps.setStatus('') }, 2000)
      return
    }

    // Paint cached tiles immediately, then stream in the rest.
    assemble(tiles)
    deps.setStatus('Lade Stellplätze…')
    const slowTimer = setTimeout(() => {
      if (generation === myGen) deps.setStatus('Warte auf Overpass-Server – kann etwas dauern…')
    }, SLOW_HINT_MS)

    try {
      await runPool(missing, CONCURRENCY, async (t) => {
        // No AbortController: a fetch for a superseded viewport still yields a
        // valid tile worth caching for later. We just skip the stale repaint.
        const pois = await fetchPois(tileBounds(t), ALL_TYPES)
        cache.set(tileKey(t), pois)
        if (generation === myGen) assemble(tiles)
      })
      clearTimeout(slowTimer)
      if (generation !== myGen) return
      deps.setStatus(poiCountMessage(assemble(tiles)))
      setTimeout(() => { if (generation === myGen) deps.setStatus('') }, 3000)
    } catch (err) {
      clearTimeout(slowTimer)
      if (generation !== myGen) return
      console.error('POI fetch failed:', err)
      deps.setStatus(overpassErrorMessage(err), true)
    }
  }

  return { refresh }
}

/** Run `worker` over `items` with at most `limit` in flight at once. */
async function runPool<T>(items: readonly T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let i = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const item = items[i++]!
      await worker(item)
    }
  })
  await Promise.all(runners)
}
