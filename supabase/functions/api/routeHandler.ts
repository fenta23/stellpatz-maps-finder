import { jsonResponse, errorResponse, parseLatLon, decodeValhallaPolyline, USER_AGENT } from '../_shared/utils.ts'

const VALHALLA_URL = 'https://valhalla1.openstreetmap.de/route'

const COSTING: Record<string, string> = {
  driving: 'auto',
  cycling: 'bicycle',
  foot: 'pedestrian',
}

interface ValhallaShape { type: string; coordinates: Array<[number, number]> }
interface ValhallaLeg { shape: string | ValhallaShape }
interface ValhallaResponse {
  trip: {
    legs: ValhallaLeg[]
    summary: { length: number; time: number }
  }
}

function parseCoordPair(raw: string): [number, number] | null {
  const [latStr, lonStr] = raw.split(',')
  const coords = parseLatLon(latStr, lonStr)
  return coords ? [coords.lat, coords.lon] : null
}

export async function handleRoute(req: Request, origin: string | null): Promise<Response> {
  const url = new URL(req.url)
  const fromCoords = parseCoordPair(url.searchParams.get('from') ?? '')
  const toCoords = parseCoordPair(url.searchParams.get('to') ?? '')

  if (!fromCoords || !toCoords) {
    return errorResponse('from and to coordinates required (lat,lon)', 400, origin)
  }

  const costing = COSTING[url.searchParams.get('mode') ?? 'driving'] ?? 'auto'
  const jsonParam = encodeURIComponent(JSON.stringify({
    locations: [
      { lat: fromCoords[0], lon: fromCoords[1] },
      { lat: toCoords[0], lon: toCoords[1] },
    ],
    costing,
    units: 'km',
  }))

  try {
    const upstream = await fetch(`${VALHALLA_URL}?json=${jsonParam}`, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(10_000),
    })
    if (!upstream.ok) return errorResponse('Routing error', upstream.status, origin)

    const data = await upstream.json() as ValhallaResponse
    const leg = data.trip?.legs?.[0]
    if (!leg) return errorResponse('No route found', 502, origin)

    const coordinates = typeof leg.shape === 'string'
      ? decodeValhallaPolyline(leg.shape)
      : (leg.shape as ValhallaShape).coordinates

    return jsonResponse({
      code: 'Ok',
      routes: [{
        distance: data.trip.summary.length * 1000,
        duration: data.trip.summary.time,
        geometry: { coordinates },
      }],
    }, 200, origin)
  } catch {
    return errorResponse('Routing service unreachable', 503, origin)
  }
}
