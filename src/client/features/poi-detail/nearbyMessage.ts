import type { NearbyItem } from './PoiDetailPanel.js'
import type { RouteResult } from '@/features/routing/DirectionsService.js'

/**
 * Plain-text status-toast for a tapped nearby POI route. The status toast is
 * rendered via `textContent`, so this must be plain text — no icons/markup.
 * (A previous version interpolated a non-existent `item.icon`, which showed as
 * a literal "undefined" before the name.)
 */
export function nearbyRouteMessage(item: NearbyItem, route: RouteResult): string {
  return `${item.name} · ${route.distanceText} · ${route.durationText} zu Fuß`
}
