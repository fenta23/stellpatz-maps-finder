import { jsonResponse, errorResponse, parseLatLon, USER_AGENT } from '../_shared/utils.ts'

const MAPILLARY_API = 'https://graph.mapillary.com/images'
const RADIUS_DEG = 0.0005

export async function handleMapillary(req: Request, origin: string | null): Promise<Response> {
  const url = new URL(req.url)
  const coords = parseLatLon(url.searchParams.get('lat'), url.searchParams.get('lon'))
  if (!coords) return errorResponse('lat and lon required', 400, origin)

  const { lat, lon } = coords

  const token = Deno.env.get('MAPILLARY_ACCESS_TOKEN')
  if (!token) return jsonResponse([], 200, origin)

  const bbox = [
    (lon - RADIUS_DEG).toFixed(6),
    (lat - RADIUS_DEG).toFixed(6),
    (lon + RADIUS_DEG).toFixed(6),
    (lat + RADIUS_DEG).toFixed(6),
  ].join(',')

  const mapillaryUrl = `${MAPILLARY_API}?bbox=${bbox}&fields=id,thumb_256_url,captured_at&limit=6`

  try {
    const upstream = await fetch(mapillaryUrl, {
      headers: { 'User-Agent': USER_AGENT, 'Authorization': `OAuth ${token}` },
      signal: AbortSignal.timeout(8_000),
    })
    if (!upstream.ok) return errorResponse('Mapillary error', upstream.status, origin)

    const raw = await upstream.json() as {
      data?: Array<{ id: string; thumb_256_url: string; captured_at: number }>
    }

    const images = (raw.data ?? []).map(img => ({
      src: img.thumb_256_url,
      link: `https://www.mapillary.com/app/?pKey=${img.id}`,
      caption: `Mapillary · ${new Date(img.captured_at).toISOString().slice(0, 7)}`,
    }))

    return jsonResponse(images, 200, origin)
  } catch {
    return errorResponse('Mapillary unreachable', 503, origin)
  }
}
