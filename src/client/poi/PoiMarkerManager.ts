import type { OsmPoi, PoiType } from './OverpassClient.js'

export interface MarkerHandle {
  setVisible(visible: boolean): void
  remove(): void
}

export interface MapAdapter {
  createMarker(options: {
    lat: number
    lon: number
    title: string
    icon: string
    onClick: () => void
  }): MarkerHandle
}

interface TrackedMarker {
  readonly handle: MarkerHandle
  readonly poiType: PoiType
}

const ICONS: Record<PoiType, string> = {
  parking: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <circle cx="16" cy="16" r="15" fill="#1565C0" stroke="#fff" stroke-width="2"/>
    <text x="16" y="21" font-family="Arial" font-size="16" font-weight="bold" fill="#fff" text-anchor="middle">P</text>
  </svg>`,
  camper: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <circle cx="16" cy="16" r="15" fill="#2E7D32" stroke="#fff" stroke-width="2"/>
    <text x="16" y="21" font-family="Arial" font-size="14" fill="#fff" text-anchor="middle">🚐</text>
  </svg>`,
  campsite: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <circle cx="16" cy="16" r="15" fill="#E65100" stroke="#fff" stroke-width="2"/>
    <text x="16" y="21" font-family="Arial" font-size="14" fill="#fff" text-anchor="middle">⛺</text>
  </svg>`,
}

export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export class PoiMarkerManager {
  private readonly markers = new Map<number, TrackedMarker>()
  private readonly activeTypes: Set<PoiType>

  constructor(
    private readonly adapter: MapAdapter,
    private readonly onSelect: (poi: OsmPoi) => void,
    initialTypes: ReadonlySet<PoiType> = new Set(['parking', 'camper', 'campsite']),
  ) {
    this.activeTypes = new Set(initialTypes)
  }

  updatePois(pois: readonly OsmPoi[]): void {
    const incoming = new Set(pois.map(p => p.id))

    for (const [id, tracked] of this.markers) {
      if (!incoming.has(id)) {
        tracked.handle.remove()
        this.markers.delete(id)
      }
    }

    for (const poi of pois) {
      if (this.markers.has(poi.id)) continue
      const icon = svgToDataUrl(ICONS[poi.type] ?? ICONS.parking)
      const handle = this.adapter.createMarker({
        lat: poi.lat,
        lon: poi.lon,
        title: poi.tags.name ?? poi.type,
        icon,
        onClick: () => this.onSelect(poi),
      })
      this.markers.set(poi.id, { handle, poiType: poi.type })
    }

    for (const [, tracked] of this.markers) {
      tracked.handle.setVisible(this.activeTypes.has(tracked.poiType))
    }
  }

  setTypeVisible(type: PoiType, visible: boolean): void {
    if (visible) {
      this.activeTypes.add(type)
    } else {
      this.activeTypes.delete(type)
    }
    for (const [, tracked] of this.markers) {
      if (tracked.poiType === type) {
        tracked.handle.setVisible(visible)
      }
    }
  }

  getActiveTypes(): ReadonlySet<PoiType> {
    return this.activeTypes
  }

  clear(): void {
    for (const [, tracked] of this.markers) {
      tracked.handle.remove()
    }
    this.markers.clear()
  }

  get count(): number {
    return this.markers.size
  }
}
