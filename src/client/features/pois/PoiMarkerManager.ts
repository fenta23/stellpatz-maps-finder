import type { OsmPoi, PoiType } from './OverpassClient.js'
import { isPrivateParking } from './OverpassClient.js'

export interface MarkerHandle {
  setVisible(visible: boolean): void
  remove(): void
  updateIcon(icon: string): void
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
  readonly poiId: number
  readonly isPrivate: boolean
}

const BASE_ICONS: Record<PoiType, string> = {
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
  dump: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <circle cx="16" cy="16" r="15" fill="#795548" stroke="#fff" stroke-width="2"/>
    <text x="16" y="21" font-family="Arial" font-size="14" fill="#fff" text-anchor="middle">🚿</text>
  </svg>`,
  water: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <circle cx="16" cy="16" r="15" fill="#0277BD" stroke="#fff" stroke-width="2"/>
    <text x="16" y="21" font-family="Arial" font-size="14" fill="#fff" text-anchor="middle">🚰</text>
  </svg>`,
}

// Grey "P" variant for private/restricted parking — same shape, muted colour
const PRIVATE_PARKING_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <circle cx="16" cy="16" r="15" fill="#616161" stroke="#fff" stroke-width="2"/>
    <text x="16" y="21" font-family="Arial" font-size="16" font-weight="bold" fill="#fff" text-anchor="middle">P</text>
  </svg>`

const HEART_BADGE = `<circle cx="26" cy="6" r="7" fill="#E53935" stroke="#fff" stroke-width="1.5"/><text x="26" y="10" font-family="Arial" font-size="10" fill="#fff" text-anchor="middle">♥</text>`

// Lock badge sits bottom-left so it never collides with the heart badge (top-right)
const LOCK_BADGE = `<circle cx="7" cy="26" r="6.5" fill="#fff" stroke="#616161" stroke-width="1"/><rect x="4" y="25.5" width="6" height="5" rx="1" fill="#616161"/><path d="M5.2 25.5 v-1.3 a1.8 1.8 0 0 1 3.6 0 V25.5" fill="none" stroke="#616161" stroke-width="1.2"/>`

export function buildIcon(type: PoiType, isFavorite: boolean, isPrivate = false): string {
  const privateParking = isPrivate && type === 'parking'
  const base = privateParking ? PRIVATE_PARKING_ICON : (BASE_ICONS[type] ?? BASE_ICONS.parking)
  const badges = `${privateParking ? LOCK_BADGE : ''}${isFavorite ? HEART_BADGE : ''}`
  return badges ? base.replace('</svg>', `${badges}</svg>`) : base
}

export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export class PoiMarkerManager {
  private readonly markers = new Map<number, TrackedMarker>()
  private readonly activeTypes: Set<PoiType>
  private favoriteIds: ReadonlySet<string> = new Set()

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
      const isFav = this.favoriteIds.has(String(poi.id))
      const isPrivate = isPrivateParking(poi)
      const icon = svgToDataUrl(buildIcon(poi.type, isFav, isPrivate))
      const handle = this.adapter.createMarker({
        lat: poi.lat,
        lon: poi.lon,
        title: poi.tags.name ?? poi.type,
        icon,
        onClick: () => this.onSelect(poi),
      })
      this.markers.set(poi.id, { handle, poiType: poi.type, poiId: poi.id, isPrivate })
    }

    for (const [, tracked] of this.markers) {
      tracked.handle.setVisible(this.activeTypes.has(tracked.poiType))
    }
  }

  setFavorites(ids: ReadonlySet<string>): void {
    this.favoriteIds = ids
    for (const [, tracked] of this.markers) {
      const isFav = ids.has(String(tracked.poiId))
      tracked.handle.updateIcon(svgToDataUrl(buildIcon(tracked.poiType, isFav, tracked.isPrivate)))
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
