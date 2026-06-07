import { notNullUndefined } from '../../shared/common.js'

export type PoiType = 'parking' | 'camper' | 'campsite' | 'dump' | 'water'

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
  if (types.has('dump')) {
    parts.push(`node["amenity"="sanitary_dump_station"](${bbox});`)
    parts.push(`way["amenity"="sanitary_dump_station"](${bbox});`)
  }
  if (types.has('water')) {
    parts.push(`node["amenity"="water_point"](${bbox});`)
    parts.push(`way["amenity"="water_point"](${bbox});`)
  }

  return `[out:json][timeout:30];\n(\n  ${parts.join('\n  ')}\n);\nout center tags;`
}

export function elementToPoiType(el: OsmElement): PoiType {
  if (el.tags.tourism === 'camp_site') return 'campsite'
  if (el.tags.tourism === 'camp_pitch') return 'camper'
  if (el.tags.tourism === 'caravan_site') return 'camper'
  if (el.tags.motorhome === 'yes') return 'camper'
  if (el.tags.amenity === 'sanitary_dump_station') return 'dump'
  if (el.tags.amenity === 'water_point') return 'water'
  return 'parking'
}

// OSM access values that mark parking as restricted. Everything else —
// yes/public/permissive/customers or no access tag — counts as public.
const PRIVATE_ACCESS_VALUES = new Set(['private', 'no'])

/** True only for parking POIs whose `access` tag is `private` or `no`. */
export function isPrivateParking(poi: OsmPoi): boolean {
  if (poi.type !== 'parking') return false
  const access = poi.tags['access']
  return access !== undefined && PRIVATE_ACCESS_VALUES.has(access)
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
  const seen = new Set<number>()
  return (data.elements ?? [])
    .filter(el => !seen.has(el.id) && seen.add(el.id))
    .map((el): OsmPoi | null => {
      const pos = elementToLatLon(el)
      if (!pos) return null
      return { id: el.id, type: elementToPoiType(el), lat: pos.lat, lon: pos.lon, tags: el.tags }
    })
    .filter(notNullUndefined)
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
    // exactOptionalPropertyTypes: pass signal only when present
    ...(signal ? { signal } : {}),
  })

  if (!res.ok) {
    throw new Error(`Overpass proxy error: ${res.status} ${res.statusText}`)
  }

  const data = await res.json() as { elements?: OsmElement[] }
  return parseElements(data)
}
