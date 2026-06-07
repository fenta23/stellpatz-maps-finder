import type L from 'leaflet'

// Keep the detail panel / bottom sheet from hiding a freshly selected POI.
// Desktop: a 320px side panel on the right → pan the POI into the left strip.
// Mobile: a 60dvh bottom sheet → pan the POI up into the strip above it.
// Mirrors the CSS in index.html (@media max-width:600px, height:60dvh).

export const PANEL_WIDTH = 320
export const MOBILE_BREAKPOINT = 600
export const MOBILE_SHEET_FRACTION = 0.6

export interface PanInput {
  /** POI position in map-container pixel coordinates. */
  readonly poi: { readonly x: number; readonly y: number }
  readonly isMobile: boolean
  readonly mapWidth: number
  readonly mapTop: number
  readonly viewportHeight: number
}

/** Pure: how far to pan so the POI sits in the still-visible strip. Never pans
 *  a POI that is already clear (returns 0). */
export function computePan(i: PanInput): { dx: number; dy: number } {
  if (i.isMobile) {
    const sheetTop = i.viewportHeight * (1 - MOBILE_SHEET_FRACTION) - i.mapTop
    const targetY = Math.max(sheetTop / 2, 40)
    const dy = i.poi.y - targetY
    return { dx: 0, dy: dy > 0 ? dy : 0 }
  }
  const visibleWidth = i.mapWidth - PANEL_WIDTH
  const targetX = Math.max(visibleWidth / 2, 40)
  const dx = i.poi.x - targetX
  return { dx: dx > 0 ? dx : 0, dy: 0 }
}

/** Thin DOM/Leaflet wrapper around computePan. */
export function panPoiIntoView(
  map: L.Map,
  container: HTMLElement,
  poi: { lat: number; lon: number },
): void {
  const point = map.latLngToContainerPoint([poi.lat, poi.lon])
  const { dx, dy } = computePan({
    poi: { x: point.x, y: point.y },
    isMobile: window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches,
    mapWidth: container.clientWidth,
    mapTop: container.getBoundingClientRect().top,
    viewportHeight: window.innerHeight,
  })
  if (dx !== 0 || dy !== 0) map.panBy([dx, dy], { animate: true })
}
