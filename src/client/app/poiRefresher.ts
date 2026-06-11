import { fetchPois, type LatLngBounds, type OsmPoi, type PoiType } from '@/features/pois/OverpassClient.js'
import { coveringTiles, tileBounds, tileKey, type Tile } from '@/features/pois/tiles.js'
import { overpassErrorMessage, poiCountMessage } from '@/features/pois/statusMessages.js'

const MAX_SPAN_DEG = 1.5 // refuse to query an over-wide viewport
const SLOW_HINT_MS = 8000
// Overpass instances allow only a couple of concurrent slots per client — keep
// the upstream pressure low (one shared gate across all refreshes), otherwise
// rapid panning stacks parallel tile queries and trips upstream 429s.
const MAX_INFLIGHT = 2

const ALL_TYPES: ReadonlySet<PoiType> = new Set<PoiType>(['parking', 'camper', 'campsite', 'dump', 'water'])

export interface PoiRefresherDeps {
  readonly getBounds: () => LatLngBounds | null
  readonly setMarkers: (pois: readonly OsmPoi[]) => void
  readonly setStatus: (msg: string, isError?: boolean) => void
}

/**
 * Tile-based, cached bounds → Overpass → markers flow. The viewport is split
 * into grid tiles; cached tiles paint instantly, only missing tiles are
 * fetched through a shared concurrency gate (≤ MAX_INFLIGHT upstream calls at
 * once, across overlapping refreshes). When a newer refresh supersedes this
 * one, still-queued tiles are dropped before they hit Overpass — so fast
 * panning doesn't flood the upstream. A single tile failing (e.g. 429) doesn't
 * fail the whole refresh; that tile is simply left uncached and retried later.
 */
export function createPoiRefresher(deps: PoiRefresherDeps): { refresh(): Promise<void> } {
  const cache = new Map<string, readonly OsmPoi[]>()
  const gate = createGate(MAX_INFLIGHT)
  let generation = 0

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

    if (missing.length === 0) {
      deps.setStatus(poiCountMessage(assemble(tiles)))
      setTimeout(() => { if (generation === myGen) deps.setStatus('') }, 2000)
      return
    }

    assemble(tiles) // paint cached tiles immediately
    deps.setStatus('Lade Stellplätze…')
    const slowTimer = setTimeout(() => {
      if (generation === myGen) deps.setStatus('Warte auf Overpass-Server – kann etwas dauern…')
    }, SLOW_HINT_MS)

    let failures = 0
    await Promise.all(missing.map(t => gate(async () => {
      // Superseded by a newer viewport while queued → don't bother Overpass.
      if (generation !== myGen) return
      try {
        const pois = await fetchPois(tileBounds(t), ALL_TYPES)
        cache.set(tileKey(t), pois)
        if (generation === myGen) assemble(tiles)
      } catch (err) {
        failures++
        if ((err as Error).name !== 'AbortError') console.warn('POI tile failed:', err)
      }
    })))

    clearTimeout(slowTimer)
    if (generation !== myGen) return
    if (failures === missing.length) {
      deps.setStatus('Overpass überlastet – bitte kurz warten', true)
      return
    }
    deps.setStatus(poiCountMessage(assemble(tiles)))
    setTimeout(() => { if (generation === myGen) deps.setStatus('') }, 3000)
  }

  return { refresh }
}

/** A concurrency gate: at most `limit` tasks run at once; the rest queue. */
function createGate(limit: number): <T>(task: () => Promise<T>) => Promise<T> {
  let active = 0
  const queue: Array<() => void> = []
  const release = () => {
    active--
    queue.shift()?.()
  }
  const acquire = () =>
    new Promise<void>(resolve => {
      if (active < limit) { active++; resolve() }
      else queue.push(() => { active++; resolve() })
    })
  return async <T>(task: () => Promise<T>): Promise<T> => {
    await acquire()
    try { return await task() }
    finally { release() }
  }
}
