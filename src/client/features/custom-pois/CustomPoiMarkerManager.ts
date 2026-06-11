import type { MapAdapter, MarkerHandle } from '@/features/pois/PoiMarkerManager.js'
import { svgToDataUrl } from '@/features/pois/PoiMarkerManager.js'
import type { CustomPoi } from './CustomPoi.js'
import { findIcon } from './CustomPoi.js'

const MARKER_FILL = '#FF8F00'

function buildIcon(poi: CustomPoi): string {
  const icon = findIcon(poi.iconId)
  const paths = icon.path
  return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <circle cx="16" cy="16" r="15" fill="${MARKER_FILL}" stroke="#fff" stroke-width="2"/>
    <g transform="translate(4,4)" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none">${paths}</g>
  </svg>`
}

export class CustomPoiMarkerManager {
  private readonly markers = new Map<string, MarkerHandle>()
  private visible = true

  constructor(
    private readonly adapter: MapAdapter,
    private readonly onSelect: (poi: CustomPoi) => void,
  ) {}

  updatePois(pois: readonly CustomPoi[]): void {
    const incoming = new Set(pois.map(p => p.id))

    for (const [id, handle] of this.markers) {
      if (!incoming.has(id)) {
        handle.remove()
        this.markers.delete(id)
      }
    }

    for (const poi of pois) {
      if (this.markers.has(poi.id)) continue
      const icon = svgToDataUrl(buildIcon(poi))
      const handle = this.adapter.createMarker({
        lat: poi.lat,
        lon: poi.lon,
        title: poi.name || findIcon(poi.iconId).label,
        icon,
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
