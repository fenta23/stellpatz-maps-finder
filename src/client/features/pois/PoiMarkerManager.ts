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
    <path d="M14 9h4a3 3 0 0 1 3 3v3a3 3 0 0 1-3 3h-1v4h-2v-4h-1V12a3 3 0 0 1 0-3zm3 1h-3v5h3a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1z" fill="#fff"/>
  </svg>`,
  camper: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <circle cx="16" cy="16" r="15" fill="#2E7D32" stroke="#fff" stroke-width="2"/>
    <path d="M8 12h16v8H8v-3h1v-1h-1v-4zm2 3h2v1h-2v-1zm4 0h2v1h-2v-1zm4 0h2v1h-2v-1z" fill="#fff" stroke="#fff" stroke-width="0.5"/>
    <path d="M9 10h14c1 0 1-1 1-1h-16c0 0 0 1 1 1z" fill="#fff"/>
  </svg>`,
  campsite: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <circle cx="16" cy="16" r="15" fill="#E65100" stroke="#fff" stroke-width="2"/>
    <path d="M16 8l7 9H9l7-9zm-6 10h12v2h-12v-2zm2 3h8v2h-8v-2z" fill="#fff"/>
  </svg>`,
  dump: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <circle cx="16" cy="16" r="15" fill="#795548" stroke="#fff" stroke-width="2"/>
    <path d="M10 9h12v2h-1v9h-10v-9h-1V9zm2 2v8h8v-8h-8zm2 1h1v6h-1v-6zm2 0h1v6h-1v-6zm3 0h1v6h-1v-6z" fill="#fff"/>
  </svg>`,
  water: `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <circle cx="16" cy="16" r="15" fill="#0277BD" stroke="#fff" stroke-width="2"/>
    <path d="M16 9c-1.5 2-3 4-3 6 0 2.2 1.3 4 3 4s3-1.8 3-4c0-2-1.5-4-3-6zm0 8.5c-1.4 0-2.5-1-2.5-2.5 0-1 1-2.5 2.5-4.5 1.5 2 2.5 3.5 2.5 4.5 0 1.5-1.1 2.5-2.5 2.5z" fill="#fff"/>
  </svg>`,
}

// Grey "P" variant for private/restricted parking — same shape, muted colour
const PRIVATE_PARKING_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <circle cx="16" cy="16" r="15" fill="#616161" stroke="#fff" stroke-width="2"/>
    <path d="M14 9h4a3 3 0 0 1 3 3v3a3 3 0 0 1-3 3h-1v4h-2v-4h-1V12a3 3 0 0 1 0-3zm3 1h-3v5h3a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1z" fill="#fff"/>
  </svg>`

// Red heart badge (top-right corner)
const HEART_BADGE = `<circle cx="26" cy="6" r="7" fill="#E53935" stroke="#fff" stroke-width="1.5"/><path d="M24 3.5c-.4-.4-1-.6-1.6-.6-.6 0-1.2.2-1.6.6l-.8.8-.8-.8c-.4-.4-1-.6-1.6-.6-.6 0-1.2.2-1.6.6-.9.8-.9 2.2 0 3l4 4 4-4c.9-.8.9-2.2 0-3z" fill="#fff"/>`

// Note badge (bottom-right corner) - a small notepad icon
const NOTE_BADGE = `<circle cx="26" cy="26" r="6.5" fill="#4CAF50" stroke="#fff" stroke-width="1.5"/><path d="M24 23h3v5h-3v-5zm-.5-1h4v1h-4v-1z" fill="#fff" stroke="#fff" stroke-width="0.3"/>`

// Lock badge sits bottom-left so it never collides with badges on right side
const LOCK_BADGE = `<circle cx="7" cy="26" r="6.5" fill="#fff" stroke="#616161" stroke-width="1"/><rect x="4" y="25.5" width="6" height="5" rx="1" fill="#616161"/><path d="M5.2 25.5 v-1.3 a1.8 1.8 0 0 1 3.6 0 V25.5" fill="none" stroke="#fff" stroke-width="1.2"/>`

export function buildIcon(type: PoiType, isFavorite: boolean, hasNote = false, isPrivate = false): string {
  const privateParking = isPrivate && type === 'parking'
  const base = privateParking ? PRIVATE_PARKING_ICON : (BASE_ICONS[type] ?? BASE_ICONS.parking)
  const badges = `${privateParking ? LOCK_BADGE : ''}${isFavorite ? HEART_BADGE : ''}${hasNote ? NOTE_BADGE : ''}`
  return badges ? base.replace('</svg>', `${badges}</svg>`) : base
}

export function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export class PoiMarkerManager {
  private readonly markers = new Map<number, TrackedMarker>()
  private readonly activeTypes: Set<PoiType>
  private favoriteIds: ReadonlySet<string> = new Set()
  private noteIds: ReadonlySet<string> = new Set()

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
      const hasNote = this.noteIds.has(String(poi.id))
      const isPrivate = isPrivateParking(poi)
      const icon = svgToDataUrl(buildIcon(poi.type, isFav, hasNote, isPrivate))
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
      const hasNote = this.noteIds.has(String(tracked.poiId))
      tracked.handle.updateIcon(svgToDataUrl(buildIcon(tracked.poiType, isFav, hasNote, tracked.isPrivate)))
    }
  }

  setNotes(ids: ReadonlySet<string>): void {
    this.noteIds = ids
    for (const [, tracked] of this.markers) {
      const isFav = this.favoriteIds.has(String(tracked.poiId))
      const hasNote = ids.has(String(tracked.poiId))
      tracked.handle.updateIcon(svgToDataUrl(buildIcon(tracked.poiType, isFav, hasNote, tracked.isPrivate)))
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
