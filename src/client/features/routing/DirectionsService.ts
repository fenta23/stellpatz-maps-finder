import L from 'leaflet'
import { apiUrl } from '@/core/config.js'

export type RoutingMode = 'driving' | 'cycling' | 'foot'

export interface LatLon {
  readonly lat: number
  readonly lon: number
}

export interface RouteResult {
  readonly distanceMeters: number
  readonly durationSeconds: number
  readonly distanceText: string
  readonly durationText: string
  readonly straightLineMeters: number
  readonly detourFactor: number
}

// Earthy route palette to match the app theme
const MODE_COLORS: Record<RoutingMode, string> = {
  driving: '#5E6B4F', // olive
  cycling: '#3F6B4A', // forest green
  foot: '#B5562F',    // terracotta
}

interface OsrmRoute {
  readonly distance: number
  readonly duration: number
  readonly geometry: {
    readonly coordinates: ReadonlyArray<readonly [number, number]>
  }
}

interface OsrmResponse {
  readonly code: string
  readonly routes: readonly OsrmRoute[]
}

export function haversineMeters(a: LatLon, b: LatLon): number {
  const R = 6_371_000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const sinDLat = Math.sin(dLat / 2)
  const sinDLon = Math.sin(dLon / 2)
  const chord =
    sinDLat * sinDLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinDLon * sinDLon
  return 2 * R * Math.asin(Math.sqrt(chord))
}

export function buildOsmPoiLink(destination: LatLon): string {
  return `https://www.openstreetmap.org/?mlat=${destination.lat}&mlon=${destination.lon}&zoom=16`
}

export function buildGoogleMapsLink(destination: LatLon): string {
  return `https://www.google.com/maps?q=${destination.lat},${destination.lon}`
}

export function buildRouteResult(
  distanceMeters: number,
  durationSeconds: number,
  from: LatLon,
  to: LatLon,
): RouteResult {
  const straightLineMeters = haversineMeters(from, to)
  const detourFactor = distanceMeters > 0 ? distanceMeters / straightLineMeters : 1

  const km = distanceMeters / 1000
  const distanceText = km >= 10 ? `${km.toFixed(0)} km` : `${km.toFixed(1)} km`

  const minutes = Math.round(durationSeconds / 60)
  const durationText =
    minutes >= 60
      ? `${Math.floor(minutes / 60)} h ${minutes % 60} min`
      : `${minutes} min`

  return {
    distanceMeters,
    durationSeconds,
    distanceText,
    durationText,
    straightLineMeters,
    detourFactor,
  }
}

export class DirectionsService {
  private routeLine: L.Polyline | null = null

  constructor(private readonly map: L.Map) {}

  async route(from: LatLon, to: LatLon, mode: RoutingMode = 'driving'): Promise<RouteResult> {
    const res = await fetch(
      apiUrl(`/api/route?from=${from.lat},${from.lon}&to=${to.lat},${to.lon}&mode=${mode}`),
    )
    if (!res.ok) throw new Error(`Route API error: ${res.status}`)
    const data = await res.json() as OsrmResponse

    if (data.code !== 'Ok' || !data.routes[0]) throw new Error('No route found')
    const osrmRoute = data.routes[0]

    this.clearRoute()
    // OSRM returns [lon, lat] — Leaflet needs [lat, lon]
    const coords = osrmRoute.geometry.coordinates.map(
      ([lon, lat]) => [lat, lon] as L.LatLngTuple,
    )
    this.routeLine = L.polyline(coords, { color: MODE_COLORS[mode], weight: 5, opacity: 0.75 }).addTo(this.map)

    return buildRouteResult(osrmRoute.distance, osrmRoute.duration, from, to)
  }

  clearRoute(): void {
    if (this.routeLine) {
      this.routeLine.remove()
      this.routeLine = null
    }
  }
}
