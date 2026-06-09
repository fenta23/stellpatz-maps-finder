import type { OsmPoi } from '@/features/pois/OverpassClient.js'
import type { DirectionsService } from '@/features/routing/DirectionsService.js'
import type { PoiDetailPanel } from '@/features/poi-detail/PoiDetailPanel.js'
import type { IFavoritesStore } from '@/features/favorites/FavoritesStore.js'
import type { Session } from './session.js'

export interface SelectionDeps {
  readonly session: Session
  readonly directions: DirectionsService
  readonly panel: PoiDetailPanel
  readonly favorites: IFavoritesStore
  readonly panIntoView: (poi: { lat: number; lon: number }) => void
  readonly loadDetails: (poi: OsmPoi) => void
  readonly onNoLocation: () => void
  /** Current personal note text for a POI (defaults to none). */
  readonly getNote?: (poi: OsmPoi) => string
}

export interface Selection {
  /** A marker was clicked: pan it into view, show the panel, route + load details. */
  select(poi: OsmPoi): Promise<void>
  /** "Route hierhin" pressed in the panel: route + load details (panel already open). */
  navigate(poi: OsmPoi): Promise<void>
  /** Routing mode changed: re-route the current selection (no detail reload). */
  reroute(): Promise<void>
  /** Panel closed: drop selection and clear the route line. */
  clear(): void
}

/**
 * Owns the "selected POI" flow that was previously duplicated across the marker
 * click handler, the navigate button, and the routing-mode change. One place,
 * three entry points.
 */
export function createSelection(deps: SelectionDeps): Selection {
  const { session, directions, panel, favorites } = deps
  const isFav = (poi: OsmPoi) => favorites.has(String(poi.id))
  const noteOf = (poi: OsmPoi) => deps.getNote?.(poi) ?? ''

  async function routeAndShow(poi: OsmPoi, withDetails: boolean): Promise<void> {
    const route = await directions
      .route(session.userPos!, { lat: poi.lat, lon: poi.lon }, session.routingMode)
      .catch(() => undefined)
    panel.show(poi, route, session.routingMode, isFav(poi), noteOf(poi))
    if (withDetails) deps.loadDetails(poi)
  }

  return {
    async select(poi) {
      session.selectedPoi = poi
      deps.panIntoView(poi)
      if (!session.userPos) {
        panel.show(poi, undefined, undefined, isFav(poi), noteOf(poi))
        deps.onNoLocation()
        return
      }
      await routeAndShow(poi, true)
    },

    async navigate(poi) {
      if (!session.userPos) {
        deps.onNoLocation()
        return
      }
      await routeAndShow(poi, true)
    },

    async reroute() {
      if (session.selectedPoi && session.userPos) await routeAndShow(session.selectedPoi, false)
      else directions.clearRoute()
    },

    clear() {
      session.selectedPoi = null
      directions.clearRoute()
    },
  }
}
