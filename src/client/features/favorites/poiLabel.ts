import type { OsmPoi } from '@/features/pois/OverpassClient.js'
import { typeLabel } from '@/features/pois/poiMeta.js'
import type { FavoritePoi } from './FavoritesStore.js'

export { typeIcon, typeLabel } from '@/features/pois/poiMeta.js'

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
