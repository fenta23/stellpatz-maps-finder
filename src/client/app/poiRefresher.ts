import { fetchPois, type LatLngBounds, type OsmPoi, type PoiType } from '@/features/pois/OverpassClient.js'
import { overpassErrorMessage, poiCountMessage } from '@/features/pois/statusMessages.js'

const MAX_SPAN_DEG = 1.5 // refuse to query an over-wide viewport
const SLOW_HINT_MS = 8000

export interface PoiRefresherDeps {
  readonly getBounds: () => LatLngBounds | null
  readonly getActiveTypes: () => ReadonlySet<PoiType>
  readonly setMarkers: (pois: readonly OsmPoi[]) => void
  readonly clearMarkers: () => void
  readonly setStatus: (msg: string, isError?: boolean) => void
}

/** Owns the debounced bounds → Overpass → markers → status flow, including the
 *  abort-in-flight, slow-hint timer and over-wide-viewport guard. */
export function createPoiRefresher(deps: PoiRefresherDeps): { refresh(): Promise<void> } {
  let abortController: AbortController | null = null
  let isLoading = false

  async function refresh(): Promise<void> {
    const bounds = deps.getBounds()
    if (!bounds) return

    if (bounds.north - bounds.south > MAX_SPAN_DEG || bounds.east - bounds.west > MAX_SPAN_DEG) {
      deps.setStatus('Bitte weiter reinzoomen…')
      return
    }

    const types = deps.getActiveTypes()
    if (types.size === 0) {
      deps.clearMarkers()
      deps.setStatus('')
      return
    }

    abortController?.abort()
    abortController = new AbortController()
    isLoading = true
    deps.setStatus('Lade Stellplätze…')

    const slowTimer = setTimeout(() => {
      if (isLoading) deps.setStatus('Warte auf Overpass-Server – kann bis 30 s dauern…')
    }, SLOW_HINT_MS)

    try {
      const pois = await fetchPois(bounds, types, abortController.signal)
      clearTimeout(slowTimer)
      deps.setMarkers(pois)
      deps.setStatus(poiCountMessage(pois.length))
      setTimeout(() => { if (!isLoading) deps.setStatus('') }, 3000)
    } catch (err) {
      clearTimeout(slowTimer)
      if ((err as Error).name === 'AbortError') return
      console.error('POI fetch failed:', err)
      deps.setStatus(overpassErrorMessage(err), true)
    } finally {
      isLoading = false
    }
  }

  return { refresh }
}
