import type { OsmPoi } from '@/features/pois/OverpassClient.js'
import type { RoutingMode } from '@/features/routing/DirectionsService.js'

/** Mutable per-session UI state — passed explicitly to controllers instead of
 *  living as scattered closure `let`s. */
export interface Session {
  userPos: { lat: number; lon: number } | null
  routingMode: RoutingMode
  selectedPoi: OsmPoi | null
}

export function createSession(userPos: { lat: number; lon: number } | null): Session {
  return { userPos, routingMode: 'driving', selectedPoi: null }
}
