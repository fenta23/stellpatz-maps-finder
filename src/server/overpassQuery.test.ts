import { describe, it, expect } from 'vitest'
import { isValidPoiQuery } from './overpassQuery.js'
import { buildQuery, type PoiType } from '../client/features/pois/OverpassClient.js'

const BOUNDS = { south: 48.1, west: 11.5, north: 48.2, east: 11.6 }
const ALL_TYPES: PoiType[] = ['parking', 'camper', 'campsite', 'dump', 'water']

describe('isValidPoiQuery — accepts everything the client builds', () => {
  it('accepts the full all-types query', () => {
    expect(isValidPoiQuery(buildQuery(BOUNDS, new Set(ALL_TYPES)))).toBe(true)
  })

  it.each(ALL_TYPES)('accepts a single-type query (%s)', type => {
    expect(isValidPoiQuery(buildQuery(BOUNDS, new Set([type])))).toBe(true)
  })

  it('accepts negative coordinates and integer coordinates', () => {
    expect(isValidPoiQuery(buildQuery(
      { south: -34, west: -59, north: -33.9, east: -58.9 }, new Set(['parking']),
    ))).toBe(true)
  })

  it('accepts a query without a timeout header (legacy cache shape)', () => {
    expect(isValidPoiQuery(
      '[out:json];(node["amenity"="parking"](48.00,11.00,48.05,11.05););out center tags;',
    )).toBe(true)
  })
})

describe('isValidPoiQuery — rejects everything else', () => {
  it.each([
    ['free text', 'test'],
    ['empty', ''],
    ['around filter', '[out:json];(node["amenity"="parking"](around:5000,48.1,11.5););out center tags;'],
    ['full body dump', '[out:json];(node["amenity"="parking"](48,11,49,12););out body;'],
    ['recursion', '[out:json];(node["amenity"="parking"](48,11,49,12);>;);out center tags;'],
    ['no bbox (global scan)', '[out:json];(node["amenity"="parking"];);out center tags;'],
    ['excessive timeout', '[out:json][timeout:900];(node["amenity"="parking"](48,11,49,12););out center tags;'],
    ['trailing extra statement', '[out:json];(node["amenity"="parking"](48,11,49,12););out center tags;out body;'],
    ['regex tag value', '[out:json];(node["amenity"~"."](48,11,49,12););out center tags;'],
  ])('rejects %s', (_label, query) => {
    expect(isValidPoiQuery(query)).toBe(false)
  })

  it('rejects more than 40 statements', () => {
    const stmt = 'node["amenity"="parking"](48,11,49,12);'
    expect(isValidPoiQuery(`[out:json];(${stmt.repeat(41)});out center tags;`)).toBe(false)
    expect(isValidPoiQuery(`[out:json];(${stmt.repeat(40)});out center tags;`)).toBe(true)
  })
})
