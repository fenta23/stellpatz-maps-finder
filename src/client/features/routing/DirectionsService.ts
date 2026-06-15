import L from 'leaflet'
import { apiUrl } from '@/core/config.js'

export type RoutingMode = 'driving' | 'cycling' | 'foot'

export interface LatLon {
  readonly lat: number
  readonly lon: number
}

/** A routing endpoint with a human-readable label (e.g. "Mein Standort", a POI name). */
export interface RoutePoint extends LatLon {
  readonly label: string
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

// Distinct, dashed line for the secondary "POI → nearby" track
const SECONDARY_COLOR = '#2F6FB5' // blue — clearly different from the travel route

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

/**
 * Google Maps link to the POI. With a name we query "name lat,lon" so Maps
 * resolves to the matching place card (POI selected); coordinates alone just
 * drop a pin. Uses the official Maps URL search API.
 */
export function buildGoogleMapsPoiLink(destination: LatLon, name?: string): string {
  const coords = `${destination.lat},${destination.lon}`
  const query = name && name.trim() ? `${name.trim()} ${coords}` : coords
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

// ── Turn-by-turn hand-off (deeplink to the phone's nav app) ────────────────────
// The app only *shows* the route; real navigation happens in Google/Apple Maps.

export type NavPlatform = 'apple' | 'google'

/** Apple Maps on iOS/iPadOS/macOS, Google Maps everywhere else. */
export function detectNavPlatform(userAgent: string, platform: string): NavPlatform {
  return /iphone|ipad|ipod|macintosh|mac os/i.test(`${userAgent} ${platform}`) ? 'apple' : 'google'
}

const GOOGLE_TRAVELMODE: Record<RoutingMode, string> = { driving: 'driving', cycling: 'bicycling', foot: 'walking' }
// Apple Maps has no cycling flag → fall back to driving (bike ≈ road network).
const APPLE_DIRFLG: Record<RoutingMode, string> = { driving: 'd', cycling: 'd', foot: 'w' }

const coord = (p: LatLon) => `${p.lat},${p.lon}`

export function buildGoogleDirectionsLink(to: LatLon, mode: RoutingMode, from?: LatLon | null): string {
  const params = new URLSearchParams({ api: '1', destination: coord(to), travelmode: GOOGLE_TRAVELMODE[mode] })
  if (from) params.set('origin', coord(from))
  return `https://www.google.com/maps/dir/?${params.toString()}`
}

export function buildAppleDirectionsLink(to: LatLon, mode: RoutingMode, from?: LatLon | null): string {
  const params = new URLSearchParams({ daddr: coord(to), dirflg: APPLE_DIRFLG[mode] })
  if (from) params.set('saddr', coord(from))
  return `https://maps.apple.com/?${params.toString()}`
}

/** Build a directions deeplink for the current platform. `from` omitted → the
 *  nav app uses the device's own location as the start. */
export function buildNavLink(
  to: LatLon,
  mode: RoutingMode,
  opts: { from?: LatLon | null; platform?: NavPlatform } = {},
): string {
  const platform = opts.platform
    ?? detectNavPlatform(navigator.userAgent, (navigator as { platform?: string }).platform ?? '')
  return platform === 'apple'
    ? buildAppleDirectionsLink(to, mode, opts.from)
    : buildGoogleDirectionsLink(to, mode, opts.from)
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

async function fetchOsrmRoute(from: LatLon, to: LatLon, mode: RoutingMode): Promise<OsrmRoute> {
  const res = await fetch(
    apiUrl(`/api/route?from=${from.lat},${from.lon}&to=${to.lat},${to.lon}&mode=${mode}`),
  )
  if (!res.ok) throw new Error(`Route API error: ${res.status}`)
  const data = await res.json() as OsrmResponse
  if (data.code !== 'Ok' || !data.routes[0]) throw new Error('No route found')
  return data.routes[0]
}

// OSRM returns [lon, lat] — Leaflet needs [lat, lon]
function toLeafletCoords(route: OsrmRoute): L.LatLngTuple[] {
  return route.geometry.coordinates.map(([lon, lat]) => [lat, lon] as L.LatLngTuple)
}

export class DirectionsService {
  private routeLine: L.Polyline | null = null
  private secondaryLine: L.Polyline | null = null

  constructor(private readonly map: L.Map) {}

  /** Main travel route (current location → selected POI). */
  async route(from: LatLon, to: LatLon, mode: RoutingMode = 'driving'): Promise<RouteResult> {
    const osrmRoute = await fetchOsrmRoute(from, to, mode)
    this.clearRoute() // also drops any secondary track from a previous selection
    this.routeLine = L.polyline(toLeafletCoords(osrmRoute), {
      color: MODE_COLORS[mode], weight: 5, opacity: 0.75,
    }).addTo(this.map)
    return buildRouteResult(osrmRoute.distance, osrmRoute.duration, from, to)
  }

  /** Secondary track (selected POI → a nearby POI), drawn dashed in a distinct color. */
  async routeSecondary(from: LatLon, to: LatLon, mode: RoutingMode = 'foot'): Promise<RouteResult> {
    const osrmRoute = await fetchOsrmRoute(from, to, mode)
    this.clearSecondaryRoute()
    this.secondaryLine = L.polyline(toLeafletCoords(osrmRoute), {
      color: SECONDARY_COLOR, weight: 4, opacity: 0.9, dashArray: '6 8',
    }).addTo(this.map)
    return buildRouteResult(osrmRoute.distance, osrmRoute.duration, from, to)
  }

  clearSecondaryRoute(): void {
    if (this.secondaryLine) {
      this.secondaryLine.remove()
      this.secondaryLine = null
    }
  }

  clearRoute(): void {
    if (this.routeLine) {
      this.routeLine.remove()
      this.routeLine = null
    }
    this.clearSecondaryRoute()
  }
}
