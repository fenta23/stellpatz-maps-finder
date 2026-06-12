import { jsonResponse, errorResponse, USER_AGENT } from '../_shared/utils.ts'

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
const VIEWBOX_RE = /^-?\d+\.?\d*,-?\d+\.?\d*,-?\d+\.?\d*,-?\d+\.?\d*$/

export async function handleGeocode(req: Request, origin: string | null): Promise<Response> {
  const url = new URL(req.url)
  const q = url.searchParams.get('q')?.trim()
  if (!q) return errorResponse('q is required', 400, origin)

  const params = new URLSearchParams({ q, format: 'json', limit: '6', addressdetails: '0' })

  const viewbox = url.searchParams.get('viewbox')
  if (viewbox && VIEWBOX_RE.test(viewbox)) params.set('viewbox', viewbox)

  try {
    const upstream = await fetch(`${NOMINATIM_URL}?${params}`, {
      headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'de,en' },
      signal: AbortSignal.timeout(8_000),
    })
    if (!upstream.ok) return errorResponse('Nominatim error', upstream.status, origin)
    return jsonResponse(await upstream.json(), 200, origin)
  } catch {
    return errorResponse('Nominatim unreachable', 503, origin)
  }
}
