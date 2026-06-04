export type PoiType = 'parking' | 'camper' | 'campsite'

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

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'

function buildQuery(bounds: LatLngBounds, types: ReadonlySet<PoiType>): string {
  const { south, west, north, east } = bounds
  const bbox = `${south},${west},${north},${east}`
  const parts: string[] = []

  if (types.has('parking')) {
    parts.push(`node["amenity"="parking"](${bbox});`)
    parts.push(`way["amenity"="parking"](${bbox});`)
  }
  if (types.has('camper')) {
    parts.push(`node["tourism"="camp_pitch"](${bbox});`)
    parts.push(`way["tourism"="camp_pitch"](${bbox});`)
    parts.push(`node["amenity"="parking"]["motorhome"="yes"](${bbox});`)
    parts.push(`way["amenity"="parking"]["motorhome"="yes"](${bbox});`)
  }
  if (types.has('campsite')) {
    parts.push(`node["tourism"="campsite"](${bbox});`)
    parts.push(`way["tourism"="campsite"](${bbox});`)
  }

  return `[out:json][timeout:25];\n(\n  ${parts.join('\n  ')}\n);\nout center;`
}

function elementToPoiType(el: OsmElement): PoiType {
  if (el.tags.tourism === 'campsite') return 'campsite'
  if (el.tags.tourism === 'camp_pitch') return 'camper'
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

export async function fetchPois(
  bounds: LatLngBounds,
  types: ReadonlySet<PoiType>,
  signal?: AbortSignal,
): Promise<readonly OsmPoi[]> {
  if (types.size === 0) return []

  const query = buildQuery(bounds, types)
  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
    signal,
  })

  if (!res.ok) {
    throw new Error(`Overpass API error: ${res.status} ${res.statusText}`)
  }

  const data = await res.json() as { elements: OsmElement[] }

  return data.elements
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

export { buildQuery, elementToPoiType }
