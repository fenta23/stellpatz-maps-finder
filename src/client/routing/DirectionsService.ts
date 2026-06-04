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

export function buildGoogleMapsDeeplink(destination: LatLon): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lon}&travelmode=driving`
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
  private currentRenderer: google.maps.DirectionsRenderer | null = null

  constructor(private readonly map: google.maps.Map) {}

  async route(from: LatLon, to: LatLon): Promise<RouteResult> {
    const service = new google.maps.DirectionsService()

    const result = await service.route({
      origin: { lat: from.lat, lng: from.lon },
      destination: { lat: to.lat, lng: to.lon },
      travelMode: google.maps.TravelMode.DRIVING,
    })

    const leg = result.routes[0]?.legs[0]
    if (!leg) throw new Error('No route found')

    const distanceMeters = leg.distance?.value ?? 0
    const durationSeconds = leg.duration?.value ?? 0

    if (this.currentRenderer) {
      this.currentRenderer.setMap(null)
    }
    this.currentRenderer = new google.maps.DirectionsRenderer({
      map: this.map,
      directions: result,
      suppressMarkers: false,
    })

    return buildRouteResult(distanceMeters, durationSeconds, from, to)
  }

  clearRoute(): void {
    if (this.currentRenderer) {
      this.currentRenderer.setMap(null)
      this.currentRenderer = null
    }
  }
}
