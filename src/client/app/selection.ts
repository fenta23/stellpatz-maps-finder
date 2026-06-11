import type { OsmPoi } from '@/features/pois/OverpassClient.js'
import type { DirectionsService } from '@/features/routing/DirectionsService.js'
import type { PoiDetailPanel, PanelConfig } from '@/features/poi-detail/PoiDetailPanel.js'
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
  readonly getNote?: (poi: OsmPoi) => string
  /** For custom POIs: open the edit dialog. */
  readonly onEditCustomPoi?: () => void
  /** For custom POIs: delete the POI and close panel. */
  readonly onDeleteCustomPoi?: () => void
}

export interface Selection {
  select(poi: OsmPoi): Promise<void>
  navigate(poi: OsmPoi): Promise<void>
  reroute(): Promise<void>
  clear(): void
}

export function createSelection(deps: SelectionDeps): Selection {
  const { session, directions, panel, favorites } = deps
  const isFav = (poi: OsmPoi) => favorites.has(String(poi.id))
  const noteOf = (poi: OsmPoi) => deps.getNote?.(poi) ?? ''

  const isCustom = (poi: OsmPoi) => poi.id < 0

  function buildConfig(poi: OsmPoi): PanelConfig | undefined {
    return isCustom(poi)
      ? { isCustom: true, onEdit: () => deps.onEditCustomPoi?.(), onDelete: () => deps.onDeleteCustomPoi?.() }
      : undefined
  }

  async function routeAndShow(poi: OsmPoi, withDetails: boolean): Promise<void> {
    const route = await directions
      .route(session.userPos!, { lat: poi.lat, lon: poi.lon }, session.routingMode)
      .catch(() => undefined)
    panel.show(poi, route, session.routingMode, isFav(poi), noteOf(poi), buildConfig(poi))
    if (withDetails && !isCustom(poi)) deps.loadDetails(poi)
  }

  return {
    async select(poi) {
      session.selectedPoi = poi
      deps.panIntoView(poi)
      if (!session.userPos) {
        panel.show(poi, undefined, undefined, isFav(poi), noteOf(poi), buildConfig(poi))
        if (!isCustom(poi)) deps.loadDetails(poi)
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
