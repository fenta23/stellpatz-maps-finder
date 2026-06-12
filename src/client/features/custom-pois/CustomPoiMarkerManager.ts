import type { MapAdapter, MarkerHandle } from '@/features/pois/PoiMarkerManager.js'
import { svgToDataUrl } from '@/features/pois/PoiMarkerManager.js'
import type { CustomPoi } from './CustomPoi.js'
import { findIcon } from './CustomPoi.js'

/** Default personal-group colour — distinct from the OSM type colours so a custom
 *  POI that reuses a type icon (e.g. "parking") is still visually unmistakable. */
export const DEFAULT_PERSONAL_COLOR = '#D81B60'

function buildIcon(poi: CustomPoi, fill: string): string {
  const icon = findIcon(poi.iconId)
  const paths = icon.path
  return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <circle cx="16" cy="16" r="15" fill="${fill}" stroke="#fff" stroke-width="2"/>
    <g transform="translate(4,4)" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none">${paths}</g>
  </svg>`
}

export class CustomPoiMarkerManager {
  private readonly markers = new Map<string, MarkerHandle>()
  private visible = true
  private color: string
  private last: readonly CustomPoi[] = []

  constructor(
    private readonly adapter: MapAdapter,
    private readonly onSelect: (poi: CustomPoi) => void,
    color: string = DEFAULT_PERSONAL_COLOR,
  ) {
    this.color = color
  }

  updatePois(pois: readonly CustomPoi[]): void {
    const prevMap = new Map(this.last.map(p => [p.id, p] as const))
    this.last = pois
    const incoming = new Set(pois.map(p => p.id))

    for (const [id, handle] of this.markers) {
      if (!incoming.has(id)) {
        handle.remove()
        this.markers.delete(id)
      }
    }

    for (const poi of pois) {
      const iconUrl = svgToDataUrl(buildIcon(poi, this.color))
      const prev = prevMap.get(poi.id)
      if (this.markers.has(poi.id)) {
        const handle = this.markers.get(poi.id)!
        if (prev && (poi.name !== prev.name || poi.lat !== prev.lat || poi.lon !== prev.lon || poi.iconId !== prev.iconId)) {
          handle.remove()
          this.markers.delete(poi.id)
        } else {
          handle.updateIcon(iconUrl)
          continue
        }
      }
      const handle = this.adapter.createMarker({
        lat: poi.lat,
        lon: poi.lon,
        title: poi.name || findIcon(poi.iconId).label,
        icon: iconUrl,
        onClick: () => this.onSelect(poi),
      })
      handle.setVisible(this.visible)
      this.markers.set(poi.id, handle)
    }
  }

  setVisible(visible: boolean): void {
    this.visible = visible
    for (const [, handle] of this.markers) {
      handle.setVisible(visible)
    }
  }

  /** Recolour all personal markers (when the personal group's colour changed). */
  setColor(color: string): void {
    if (color === this.color) return
    this.color = color
    const pois = this.last
    this.clear()
    this.updatePois(pois)
  }

  get isVisible(): boolean {
    return this.visible
  }

  clear(): void {
    for (const [, handle] of this.markers) {
      handle.remove()
    }
    this.markers.clear()
  }

  get count(): number {
    return this.markers.size
  }
}
