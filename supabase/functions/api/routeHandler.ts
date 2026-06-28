import { jsonResponse, errorResponse, parseLatLon, USER_AGENT } from '../_shared/utils.ts'

const OSRM_BASE = 'https://routing.openstreetmap.de'

// routing.openstreetmap.de runs separate OSRM instances per transport mode,
// each loaded with mode-specific map data (car, bike, foot graphs).
const MODE_PREFIX: Record<string, string> = {
  driving: 'routed-car',
  cycling: 'routed-bike',
  foot: 'routed-foot',
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

  const mode = url.searchParams.get('mode') ?? 'driving'
  const prefix = MODE_PREFIX[mode] ?? 'routed-car'

  // OSRM expects lon,lat order
  const coords = `${fromCoords[1]},${fromCoords[0]};${toCoords[1]},${toCoords[0]}`
  const osrmUrl = `${OSRM_BASE}/${prefix}/route/v1/driving/${coords}?overview=full&geometries=geojson`

  try {
    const upstream = await fetch(osrmUrl, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(10_000),
    })

    if (!upstream.ok) {
      console.error(`OSRM upstream error: ${upstream.status} ${upstream.statusText}`)
      return errorResponse('Routing error', upstream.status, origin)
    }

    const data = await upstream.json()

    if (data.code !== 'Ok' || !data.routes?.[0]) {
      console.error('OSRM returned no route:', JSON.stringify(data))
      return errorResponse('No route found', 502, origin)
    }

    return jsonResponse(data, 200, origin)
  } catch (err) {
    console.error('Route handler error:', err)
    if (err instanceof DOMException && err.name === 'TimeoutError') {
      return errorResponse('Routing service timed out', 504, origin)
    }
    return errorResponse('Routing service unreachable', 503, origin)
  }
}
