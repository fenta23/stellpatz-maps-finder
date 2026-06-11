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

// Helper: wrap Lucide paths inside a coloured circle marker.
function svgMarker(fill: string, paths: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
    <circle cx="16" cy="16" r="15" fill="${fill}" stroke="#fff" stroke-width="2"/>
    <g transform="translate(4,4)" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none">${paths}</g>
  </svg>`
}

const BASE_ICONS: Record<PoiType, string> = {
  parking: svgMarker('#1565C0', '<path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>'),
  camper: svgMarker('#2E7D32', '<path d="M13 6v5a1 1 0 0 0 1 1h6.102a1 1 0 0 1 .712.298l.898.91a1 1 0 0 1 .288.702V17a1 1 0 0 1-1 1h-3"/><path d="M5 18H3a1 1 0 0 1-1-1V8a2 2 0 0 1 2-2h12c1.1 0 2.1.8 2.4 1.8l1.176 4.2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2" fill="#fff"/><circle cx="7" cy="18" r="2" fill="#fff"/>'),
  campsite: svgMarker('#E65100', '<path d="M3.5 21 14 3"/><path d="M20.5 21 10 3"/><path d="M15.5 21 12 15l-3.5 6"/><path d="M2 21h20"/>'),
  dump: svgMarker('#795548', '<path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'),
  water: svgMarker('#0277BD', '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>'),
  climbing: svgMarker('#7B1FA2', '<path d="m8 3 4 8 5-5 5 15H2L8 3z"/>'),
}

// Grey "P" variant for private/restricted parking — same Lucide path, muted colour
const PRIVATE_PARKING_ICON = svgMarker('#616161', '<path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>')

// Red heart badge (top-right corner) — Lucide heart
const HEART_BADGE = `<circle cx="26" cy="6" r="7" fill="#E53935" stroke="#fff" stroke-width="1.5"/><g transform="translate(21.2,1.2) scale(0.4)" fill="#fff"><path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"/></g>`

// Note badge (bottom-right corner) — Lucide sticky-note
const NOTE_BADGE = `<circle cx="26" cy="26" r="6.5" fill="#4CAF50" stroke="#fff" stroke-width="1.5"/><g transform="translate(21.8,21.8) scale(0.35)" fill="#fff"><path d="M21 9a2.4 2.4 0 0 0-.706-1.706l-3.588-3.588A2.4 2.4 0 0 0 15 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z"/><path d="M15 3v5a1 1 0 0 0 1 1h5"/></g>`

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
