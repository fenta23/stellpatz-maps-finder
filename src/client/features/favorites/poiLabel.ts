import type { OsmPoi, PoiType } from '@/features/pois/OverpassClient.js'
import type { FavoritePoi } from './FavoritesStore.js'

const TYPE_META: Record<PoiType, { icon: string; label: string }> = {
  parking: { icon: '🅿️', label: 'Parkplatz' },
  camper: { icon: '🚐', label: 'Camper-Stellplatz' },
  campsite: { icon: '⛺', label: 'Campingplatz' },
  dump: { icon: '🚿', label: 'Entsorgung' },
  water: { icon: '🚰', label: 'Wasser' },
}

export function typeIcon(type: PoiType): string {
  return TYPE_META[type]?.icon ?? '📍'
}

export function typeLabel(type: PoiType): string {
  return TYPE_META[type]?.label ?? 'Ort'
}

/** Display name for a favorite: its OSM name, else a type-based fallback. */
export function favoriteLabel(fav: FavoritePoi): string {
  return fav.name.trim() || typeLabel(fav.type)
}

/** Snapshot a live POI into the favorite shape stored locally + remotely. */
export function toFavoritePoi(poi: OsmPoi): FavoritePoi {
  return {
    id: String(poi.id),
    type: poi.type,
    name: poi.tags.name ?? '',
    lat: poi.lat,
    lon: poi.lon,
  }
}

/** Rebuild a minimal OsmPoi from a favorite, enough to select + route to it. */
export function favoriteToPoi(fav: FavoritePoi): OsmPoi {
  return {
    id: Number(fav.id),
    type: fav.type,
    lat: fav.lat,
    lon: fav.lon,
    tags: fav.name ? { name: fav.name } : {},
  }
}
