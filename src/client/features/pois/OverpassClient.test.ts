import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchPois, buildQuery, elementToPoiType, isPrivateParking } from './OverpassClient.js'
import type { LatLngBounds, OsmElement, OsmPoi } from './OverpassClient.js'

const BOUNDS: LatLngBounds = { south: 48.0, west: 11.0, north: 48.5, east: 11.5 }

afterEach(() => vi.unstubAllGlobals())

function stubFetch(status: number, body: unknown) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    status,
    ok: status >= 200 && status < 300,
    statusText: status === 429 ? 'Too Many Requests' : 'OK',
    json: () => Promise.resolve(body),
  }))
}

const PARKING_RESPONSE = {
  elements: [
    { type: 'node', id: 42, lat: 48.1, lon: 11.1, tags: { amenity: 'parking', name: 'Testparkplatz' } },
  ],
}

describe('buildQuery', () => {
  it('includes parking query when parking type active', () => {
    const q = buildQuery(BOUNDS, new Set(['parking']))
    expect(q).toContain('"amenity"="parking"')
    expect(q).toContain('48,11,48.5,11.5')
  })

  it('includes campsite query when campsite type active', () => {
    const q = buildQuery(BOUNDS, new Set(['campsite']))
    expect(q).toContain('"tourism"="camp_site"')
    expect(q).not.toContain('"amenity"="parking"')
  })

  it('includes all queries when all types active', () => {
    const q = buildQuery(BOUNDS, new Set(['parking', 'camper', 'campsite']))
    expect(q).toContain('"amenity"="parking"')
    expect(q).toContain('"tourism"="camp_pitch"')
    expect(q).toContain('"tourism"="camp_site"')
    expect(q).toContain('"motorhome"="yes"')
    expect(q).toContain('"tourism"="caravan_site"')
  })

  it('includes climbing query when climbing type active', () => {
    const q = buildQuery(BOUNDS, new Set(['climbing']))
    expect(q).toContain('"sport"="climbing"')
    expect(q).toContain('relation["sport"="climbing"]')
    expect(q).not.toContain('"amenity"="parking"')
  })

  it('excludes motorhome spots from pure parking query', () => {
    const q = buildQuery(BOUNDS, new Set(['parking']))
    expect(q).toContain('"motorhome"!="yes"')
  })

  it('returns empty-ish query when no types', () => {
    const q = buildQuery(BOUNDS, new Set())
    expect(q).not.toContain('"amenity"')
    expect(q).not.toContain('"tourism"')
  })
})

describe('elementToPoiType', () => {
  const base: OsmElement = { type: 'node', id: 1, lat: 48, lon: 11, tags: {} }

  it('classifies camp_site as campsite', () => {
    expect(elementToPoiType({ ...base, tags: { tourism: 'camp_site' } })).toBe('campsite')
  })

  it('classifies camp_pitch as camper', () => {
    expect(elementToPoiType({ ...base, tags: { tourism: 'camp_pitch' } })).toBe('camper')
  })

  it('classifies motorhome parking as camper', () => {
    expect(elementToPoiType({ ...base, tags: { amenity: 'parking', motorhome: 'yes' } })).toBe('camper')
  })

  it('classifies caravan_site as camper', () => {
    expect(elementToPoiType({ ...base, tags: { tourism: 'caravan_site' } })).toBe('camper')
  })

  it('classifies sanitary_dump_station as dump', () => {
    expect(elementToPoiType({ ...base, tags: { amenity: 'sanitary_dump_station' } })).toBe('dump')
  })

  it('classifies water_point as water', () => {
    expect(elementToPoiType({ ...base, tags: { amenity: 'water_point' } })).toBe('water')
  })

  it('classifies sport=climbing as climbing', () => {
    expect(elementToPoiType({ ...base, tags: { sport: 'climbing' } })).toBe('climbing')
  })

  it('defaults to parking', () => {
    expect(elementToPoiType({ ...base, tags: { amenity: 'parking' } })).toBe('parking')
  })
})

describe('isPrivateParking', () => {
  const parking = (access?: string): OsmPoi => ({
    id: 1, type: 'parking', lat: 48, lon: 11,
    tags: access !== undefined ? { access } : {},
  })

  it('treats parking without access tag as public', () => {
    expect(isPrivateParking(parking())).toBe(false)
  })

  it('treats access=private as private', () => {
    expect(isPrivateParking(parking('private'))).toBe(true)
  })

  it('treats access=no as private', () => {
    expect(isPrivateParking(parking('no'))).toBe(true)
  })

  it.each(['yes', 'public', 'permissive', 'customers'])('treats access=%s as public', (a) => {
    expect(isPrivateParking(parking(a))).toBe(false)
  })

  it('returns false for non-parking POIs even with access=private', () => {
    const campsite: OsmPoi = { id: 2, type: 'campsite', lat: 48, lon: 11, tags: { access: 'private' } }
    expect(isPrivateParking(campsite)).toBe(false)
  })
})

describe('fetchPois', () => {
  it('returns empty array when no types selected', async () => {
    const result = await fetchPois(BOUNDS, new Set())
    expect(result).toEqual([])
  })

  it('parses node elements correctly', async () => {
    stubFetch(200, PARKING_RESPONSE)
    const result = await fetchPois(BOUNDS, new Set(['parking']))
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ id: 42, type: 'parking', lat: 48.1, lon: 11.1 })
    expect(result[0]?.tags.name).toBe('Testparkplatz')
  })

  it('uses center for way elements', async () => {
    stubFetch(200, {
      elements: [
        { type: 'way', id: 99, center: { lat: 48.2, lon: 11.2 }, tags: { tourism: 'camp_site' } },
      ],
    })
    const result = await fetchPois(BOUNDS, new Set(['campsite']))
    expect(result[0]).toMatchObject({ lat: 48.2, lon: 11.2, type: 'campsite' })
  })

  it('throws on proxy error response', async () => {
    stubFetch(429, { error: 'rate limited' })
    await expect(fetchPois(BOUNDS, new Set(['parking']))).rejects.toThrow('429')
  })

  it('filters elements without coordinates', async () => {
    stubFetch(200, {
      elements: [
        { type: 'way', id: 1, tags: { amenity: 'parking' } },
        { type: 'node', id: 2, lat: 48.3, lon: 11.3, tags: { amenity: 'parking' } },
      ],
    })
    const result = await fetchPois(BOUNDS, new Set(['parking']))
    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe(2)
  })

  it('handles missing elements field gracefully', async () => {
    stubFetch(200, { version: 0.6, generator: 'Overpass' })
    const result = await fetchPois(BOUNDS, new Set(['parking']))
    expect(result).toEqual([])
  })

  it('deduplicates elements with same id', async () => {
    stubFetch(200, {
      elements: [
        { type: 'node', id: 7, lat: 48.1, lon: 11.1, tags: { amenity: 'parking' } },
        { type: 'node', id: 7, lat: 48.1, lon: 11.1, tags: { amenity: 'parking' } },
      ],
    })
    const result = await fetchPois(BOUNDS, new Set(['parking']))
    expect(result).toHaveLength(1)
  })
})
