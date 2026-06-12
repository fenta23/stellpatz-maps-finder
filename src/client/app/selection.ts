import type { OsmPoi } from '@/features/pois/OverpassClient.js'
import type { DirectionsService } from '@/features/routing/DirectionsService.js'
import type { PoiDetailPanel, PanelConfig, PanelRouting } from '@/features/poi-detail/PoiDetailPanel.js'
import type { IFavoritesStore } from '@/features/favorites/FavoritesStore.js'
import { resolveOrigin, type Session } from './session.js'

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
  /** Notify that a custom route start was set (e.g. flash a hint). */
  readonly onStartSet?: (label: string) => void
  /** Notify that the start was reset to the current location. */
  readonly onStartReset?: () => void
}

export interface Selection {
  select(poi: OsmPoi): Promise<void>
  navigate(poi: OsmPoi): Promise<void>
  reroute(): Promise<void>
  /** Use the currently-open POI as the route start, then ask for a destination. */
  setStart(): void
  /** Reset the start back to the current location. */
  resetStart(): Promise<void>
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

  /** Start info for the panel: effective origin label, whether it's custom, and
   *  the coords to seed the nav deeplink (null → nav app uses device location). */
  function buildRouting(): PanelRouting {
    const eff = resolveOrigin(session)
    return {
      originLabel: eff?.label ?? 'Mein Standort',
      isCustomOrigin: session.routeOrigin !== null,
      from: eff ? { lat: eff.lat, lon: eff.lon } : null,
    }
  }

  async function routeAndShow(poi: OsmPoi, withDetails: boolean): Promise<void> {
    const from = resolveOrigin(session)
    const route = from
      ? await directions.route(from, { lat: poi.lat, lon: poi.lon }, session.routingMode).catch(() => undefined)
      : undefined
    panel.show(poi, route, session.routingMode, isFav(poi), noteOf(poi), buildConfig(poi), buildRouting())
    if (withDetails && !isCustom(poi)) deps.loadDetails(poi)
  }

  return {
    async select(poi) {
      session.selectedPoi = poi
      deps.panIntoView(poi)
      if (!resolveOrigin(session)) {
        // No start available (no GPS, no custom origin) → show info + nav deeplink,
        // but no in-app route line.
        panel.show(poi, undefined, session.routingMode, isFav(poi), noteOf(poi), buildConfig(poi), buildRouting())
        if (!isCustom(poi)) deps.loadDetails(poi)
        deps.onNoLocation()
        return
      }
      await routeAndShow(poi, true)
    },

    async navigate(poi) {
      if (!resolveOrigin(session)) {
        deps.onNoLocation()
        return
      }
      await routeAndShow(poi, true)
    },

    async reroute() {
      if (session.selectedPoi && resolveOrigin(session)) await routeAndShow(session.selectedPoi, false)
      else directions.clearRoute()
    },

    setStart() {
      const poi = session.selectedPoi
      if (!poi) return
      const label = poi.tags.name?.trim() || 'Gewählter Start'
      session.routeOrigin = { lat: poi.lat, lon: poi.lon, label }
      session.selectedPoi = null
      directions.clearRoute()
      panel.hide()
      deps.onStartSet?.(label)
    },

    async resetStart() {
      session.routeOrigin = null
      deps.onStartReset?.()
      if (session.selectedPoi) await routeAndShow(session.selectedPoi, false)
    },

    clear() {
      session.selectedPoi = null
      directions.clearRoute()
    },
  }
}
