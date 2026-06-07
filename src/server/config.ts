export const OVERPASS_ENDPOINTS = [
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
] as const

export const USER_AGENT = 'stellpatz-maps-finder/0.1 (https://github.com/local/stellpatz)'

export const CACHE_TTL_MS = 25 * 60 * 1000
export const CACHE_MAX_ENTRIES = 20000
export const BBOX_SNAP_DEG = 0.05
