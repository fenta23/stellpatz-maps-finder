import { jsonResponse, errorResponse, parseLatLon, USER_AGENT } from '../_shared/utils.ts'

const OSM_NOTES_API = 'https://api.openstreetmap.org/api/0.6/notes.json'
const RADIUS_DEG = 0.003

function notNullUndefined<T>(val: T | null | undefined): val is T {
  return val !== null && val !== undefined
}

export async function handleNotes(req: Request, origin: string | null): Promise<Response> {
  const url = new URL(req.url)
  const coords = parseLatLon(url.searchParams.get('lat'), url.searchParams.get('lon'))
  if (!coords) return errorResponse('lat and lon required', 400, origin)

  const { lat, lon } = coords

  const bbox = `${lon - RADIUS_DEG},${lat - RADIUS_DEG},${lon + RADIUS_DEG},${lat + RADIUS_DEG}`
  const notesUrl = `${OSM_NOTES_API}?bbox=${bbox}&limit=5&closed=0`

  try {
    const upstream = await fetch(notesUrl, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(8_000),
    })
    if (!upstream.ok) return errorResponse('OSM Notes error', upstream.status, origin)

    const raw = await upstream.json() as {
      features?: Array<{
        properties: {
          id: number
          date_created: string
          comments: Array<{ text: string }>
        }
      }>
    }

    const notes = (raw.features ?? []).flatMap(f => {
      const first = f.properties.comments[0]
      if (!notNullUndefined(first)) return []
      const text = first.text.trim()
      if (!text) return []
      return [{ id: f.properties.id, date: f.properties.date_created.slice(0, 10), text }]
    })

    return jsonResponse(notes, 200, origin)
  } catch {
    return errorResponse('OSM Notes unreachable', 503, origin)
  }
}
