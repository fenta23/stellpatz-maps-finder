export type PoiType = 'parking' | 'camper' | 'campsite'

// Multiple public Overpass endpoints — rotated to spread load
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
]
let endpointIndex = 0
function nextEndpoint(): string {
  const url = OVERPASS_ENDPOINTS[endpointIndex % OVERPASS_ENDPOINTS.length]!
  endpointIndex++
  return url
}

// Global cooldown: minimum ms between completed requests
let lastRequestFinishedAt = 0
const MIN_REQUEST_INTERVAL_MS = 3000

export interface LatLngBounds {
  readonly south: number
  readonly west: number
  readonly north: number
  readonly east: number
}

export interface OsmTags {
  readonly name?: string
  readonly opening_hours?: string
  readonly phone?: string
  readonly website?: string
  readonly fee?: string
  readonly capacity?: string
  readonly operator?: string
  readonly description?: string
  readonly motorhome?: string
  readonly tourism?: string
  readonly amenity?: string
  readonly [key: string]: string | undefined
}

export interface OsmElement {
  readonly type: 'node' | 'way' | 'relation'
  readonly id: number
  readonly lat?: number
  readonly lon?: number
  readonly center?: { readonly lat: number; readonly lon: number }
  readonly tags: OsmTags
}

export interface OsmPoi {
  readonly id: number
  readonly type: PoiType
  readonly lat: number
  readonly lon: number
  readonly tags: OsmTags
}

export function buildQuery(bounds: LatLngBounds, types: ReadonlySet<PoiType>): string {
  const { south, west, north, east } = bounds
  const bbox = `${south},${west},${north},${east}`
  const parts: string[] = []

  if (types.has('parking')) {
    // only pure parking, not motorhome spots (those go to camper)
    parts.push(`node["amenity"="parking"]["motorhome"!="yes"](${bbox});`)
    parts.push(`way["amenity"="parking"]["motorhome"!="yes"](${bbox});`)
  }
  if (types.has('camper')) {
    parts.push(`node["tourism"="camp_pitch"](${bbox});`)
    parts.push(`way["tourism"="camp_pitch"](${bbox});`)
    parts.push(`relation["tourism"="camp_pitch"](${bbox});`)
    parts.push(`node["amenity"="parking"]["motorhome"="yes"](${bbox});`)
    parts.push(`way["amenity"="parking"]["motorhome"="yes"](${bbox});`)
    // dedicated motorhome areas
    parts.push(`node["tourism"="caravan_site"](${bbox});`)
    parts.push(`way["tourism"="caravan_site"](${bbox});`)
    parts.push(`relation["tourism"="caravan_site"](${bbox});`)
  }
  if (types.has('campsite')) {
    parts.push(`node["tourism"="campsite"](${bbox});`)
    parts.push(`way["tourism"="campsite"](${bbox});`)
    parts.push(`relation["tourism"="campsite"](${bbox});`)
  }

  return `[out:json][timeout:30];\n(\n  ${parts.join('\n  ')}\n);\nout center tags;`
}

export function elementToPoiType(el: OsmElement): PoiType {
  if (el.tags.tourism === 'campsite') return 'campsite'
  if (el.tags.tourism === 'camp_pitch') return 'camper'
  if (el.tags.tourism === 'caravan_site') return 'camper'
  if (el.tags.motorhome === 'yes') return 'camper'
  return 'parking'
}

function elementToLatLon(el: OsmElement): { lat: number; lon: number } | null {
  if (el.lat !== undefined && el.lon !== undefined) {
    return { lat: el.lat, lon: el.lon }
  }
  if (el.center) {
    return { lat: el.center.lat, lon: el.center.lon }
  }
  return null
}

async function fetchFromEndpoint(
  url: string,
  query: string,
  signal?: AbortSignal,
): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
    signal,
  })
}

function parseElements(data: { elements?: OsmElement[] }): readonly OsmPoi[] {
  const elements = data.elements ?? []
  const seen = new Set<number>()
  return elements
    .filter(el => {
      if (seen.has(el.id)) return false
      seen.add(el.id)
      return true
    })
    .map((el): OsmPoi | null => {
      const pos = elementToLatLon(el)
      if (!pos) return null
      return {
        id: el.id,
        type: elementToPoiType(el),
        lat: pos.lat,
        lon: pos.lon,
        tags: el.tags,
      }
    })
    .filter((p): p is OsmPoi => p !== null)
}

export async function fetchPois(
  bounds: LatLngBounds,
  types: ReadonlySet<PoiType>,
  signal?: AbortSignal,
): Promise<readonly OsmPoi[]> {
  if (types.size === 0) return []

  // Enforce minimum interval between requests to avoid 429
  const now = Date.now()
  const wait = lastRequestFinishedAt + MIN_REQUEST_INTERVAL_MS - now
  if (wait > 0) {
    await new Promise<void>(resolve => setTimeout(resolve, wait))
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
  }

  const query = buildQuery(bounds, types)

  // Try each endpoint in rotation; on 429 move to next
  const attempts = OVERPASS_ENDPOINTS.length
  for (let i = 0; i < attempts; i++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    const url = nextEndpoint()
    try {
      const res = await fetchFromEndpoint(url, query, signal)
      lastRequestFinishedAt = Date.now()

      if (res.status === 429 || res.status === 503) {
        // rate-limited on this endpoint — try the next one
        if (i < attempts - 1) continue
        throw new Error(`Overpass API error: ${res.status} ${res.statusText}`)
      }

      if (!res.ok) {
        throw new Error(`Overpass API error: ${res.status} ${res.statusText}`)
      }

      const data = await res.json() as { elements?: OsmElement[] }
      return parseElements(data)
    } catch (err) {
      if ((err as Error).name === 'AbortError') throw err
      if (i < attempts - 1) continue // try next endpoint
      throw err
    }
  }

  throw new Error('All Overpass endpoints failed')
}
