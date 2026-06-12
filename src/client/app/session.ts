import type { OsmPoi } from '@/features/pois/OverpassClient.js'
import type { RoutingMode, RoutePoint } from '@/features/routing/DirectionsService.js'

/** Mutable per-session UI state — passed explicitly to controllers instead of
 *  living as scattered closure `let`s. */
export interface Session {
  userPos: { lat: number; lon: number } | null
  routingMode: RoutingMode
  selectedPoi: OsmPoi | null
  /** Route start. `null` means "use my current location" (the default). */
  routeOrigin: RoutePoint | null
}

export function createSession(userPos: { lat: number; lon: number } | null): Session {
  return { userPos, routingMode: 'driving', selectedPoi: null, routeOrigin: null }
}

/** Resolve the effective start point: an explicit custom origin, else the live
 *  current location (labelled), else null when neither is available. */
export function resolveOrigin(session: Session): RoutePoint | null {
  if (session.routeOrigin) return session.routeOrigin
  if (session.userPos) return { lat: session.userPos.lat, lon: session.userPos.lon, label: 'Mein Standort' }
  return null
}
