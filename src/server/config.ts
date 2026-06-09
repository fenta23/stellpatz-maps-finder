// Tried in order, with fallback to the next on timeout / 429 / 5xx.
// HPI (Hasso-Plattner-Institut) first — fast and reliable for our viewport
// queries; the others stay as fallbacks.
export const OVERPASS_ENDPOINTS = [
  'https://osm.hpi.de/overpass/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
] as const

export const USER_AGENT = 'stellpatz-maps-finder/0.1 (https://github.com/local/stellpatz)'

// In-memory fallback cache (used when Supabase is not configured)
export const CACHE_TTL_MS = 25 * 60 * 1000
export const CACHE_MAX_ENTRIES = 20000
export const BBOX_SNAP_DEG = 0.05

// Persistent POI cache (Supabase Postgres) — long TTL, OSM data changes slowly
export const POI_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
export const SUPABASE_URL = process.env['SUPABASE_URL'] ?? ''
export const SUPABASE_SERVICE_KEY = process.env['SUPABASE_SERVICE_KEY'] ?? ''
