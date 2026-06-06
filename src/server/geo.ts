import { BBOX_SNAP_DEG } from './config.js'

// ── BBox snapping ─────────────────────────────────────────────────────────────
// Nearby viewports hit the same cache key by rounding coordinates to a grid.
// South/West are floored (expand outward), North/East are ceiled.

const BBOX_RE = /\((-?\d+\.?\d*),(-?\d+\.?\d*),(-?\d+\.?\d*),(-?\d+\.?\d*)\)/g

const snapFloor = (v: string) =>
  (Math.floor(parseFloat(v) / BBOX_SNAP_DEG) * BBOX_SNAP_DEG).toFixed(2)

const snapCeil = (v: string) =>
  (Math.ceil(parseFloat(v) / BBOX_SNAP_DEG) * BBOX_SNAP_DEG).toFixed(2)

export function snapBboxInQuery(query: string): string {
  return query.replace(
    BBOX_RE,
    (_m, s, w, n, e) => `(${snapFloor(s)},${snapFloor(w)},${snapCeil(n)},${snapCeil(e)})`,
  )
}

// ── Haversine distance ────────────────────────────────────────────────────────

const EARTH_RADIUS_M = 6_371_000
const toRad = (deg: number) => (deg * Math.PI) / 180

export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ── Valhalla polyline decoder ─────────────────────────────────────────────────
// Valhalla uses 6-decimal precision (factor 1e6) instead of the standard 1e5.

function decodeVarInt(encoded: string, startIndex: number): { value: number; nextIndex: number } {
  let result = 0
  let shift = 0
  let index = startIndex
  let b: number
  do {
    b = encoded.charCodeAt(index++) - 63
    result |= (b & 0x1f) << shift
    shift += 5
  } while (b >= 0x20)
  return { value: result & 1 ? ~(result >> 1) : result >> 1, nextIndex: index }
}

export function decodeValhallaPolyline(encoded: string): Array<[number, number]> {
  const coords: Array<[number, number]> = []
  let index = 0
  let lat = 0
  let lng = 0

  while (index < encoded.length) {
    const latResult = decodeVarInt(encoded, index)
    index = latResult.nextIndex
    lat += latResult.value

    const lngResult = decodeVarInt(encoded, index)
    index = lngResult.nextIndex
    lng += lngResult.value

    coords.push([lng / 1e6, lat / 1e6]) // [lon, lat] for GeoJSON
  }

  return coords
}
