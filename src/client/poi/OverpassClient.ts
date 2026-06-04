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
    // OSM tag is camp_site (with underscore), not campsite
    parts.push(`node["tourism"="camp_site"](${bbox});`)
    parts.push(`way["tourism"="camp_site"](${bbox});`)
    parts.push(`relation["tourism"="camp_site"](${bbox});`)
  }

  return `[out:json][timeout:30];\n(\n  ${parts.join('\n  ')}\n);\nout center tags;`
}

export function elementToPoiType(el: OsmElement): PoiType {
  if (el.tags.tourism === 'camp_site') return 'campsite'
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

  const query = buildQuery(bounds, types)
  const res = await fetch('/api/overpass', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
    signal,
  })

  if (!res.ok) {
    throw new Error(`Overpass proxy error: ${res.status} ${res.statusText}`)
  }

  const data = await res.json() as { elements?: OsmElement[] }
  return parseElements(data)
}
