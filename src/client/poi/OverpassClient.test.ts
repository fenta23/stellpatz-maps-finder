import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchPois, buildQuery, elementToPoiType } from './OverpassClient.js'
import type { LatLngBounds, OsmElement } from './OverpassClient.js'

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
    expect(q).toContain('"tourism"="campsite"')
    expect(q).not.toContain('"amenity"="parking"')
  })

  it('includes all queries when all types active', () => {
    const q = buildQuery(BOUNDS, new Set(['parking', 'camper', 'campsite']))
    expect(q).toContain('"amenity"="parking"')
    expect(q).toContain('"tourism"="camp_pitch"')
    expect(q).toContain('"tourism"="campsite"')
    expect(q).toContain('"motorhome"="yes"')
    expect(q).toContain('"tourism"="caravan_site"')
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

  it('classifies campsite', () => {
    expect(elementToPoiType({ ...base, tags: { tourism: 'campsite' } })).toBe('campsite')
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

  it('defaults to parking', () => {
    expect(elementToPoiType({ ...base, tags: { amenity: 'parking' } })).toBe('parking')
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
        { type: 'way', id: 99, center: { lat: 48.2, lon: 11.2 }, tags: { tourism: 'campsite' } },
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
