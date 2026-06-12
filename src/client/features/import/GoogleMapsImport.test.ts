import { describe, it, expect } from 'vitest'
import { parseGoogleMapsJson, parseGoogleMapsCsv } from './GoogleMapsImport.js'

const validDoc = `{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [12.2082464, 51.3509472] },
      "properties": { "name": "Startseite", "address": "Südstraße 19, 04435 Schkeuditz, Deutschland" }
    },
    {
      "type": "Feature",
      "geometry": { "type": "Point", "coordinates": [12.373179, 51.329933] },
      "properties": { "name": "Geschäftlich" }
    }
  ]
}`

describe('parseGoogleMapsJson', () => {
  it('returns empty for invalid JSON', () => {
    expect(parseGoogleMapsJson('not json')).toHaveLength(0)
  })

  it('returns empty for non-object', () => {
    expect(parseGoogleMapsJson('null')).toHaveLength(0)
    expect(parseGoogleMapsJson('42')).toHaveLength(0)
  })

  it('returns empty for doc without features', () => {
    expect(parseGoogleMapsJson('{}')).toHaveLength(0)
  })

  it('parses valid Google Maps Takeout JSON', () => {
    const pois = parseGoogleMapsJson(validDoc)
    expect(pois).toHaveLength(2)
    expect(pois[0]!.name).toBe('Startseite')
    expect(pois[0]!.lat).toBe(51.3509472)
    expect(pois[0]!.lon).toBe(12.2082464)
    expect(pois[0]!.iconId).toBe('pin')
    expect(pois[0]!.street).toBe('Südstraße 19')
    expect(pois[0]!.city).toBe('04435 Schkeuditz')
    expect(pois[1]!.name).toBe('Geschäftlich')
    expect(pois[1]!.street).toBeUndefined()
    expect(pois[1]!.city).toBeUndefined()
  })

  it('generates unique IDs for each POI', () => {
    const pois = parseGoogleMapsJson(validDoc)
    expect(pois[0]!.id).not.toBe(pois[1]!.id)
  })

  it('skips features with invalid coordinates', () => {
    const json = `{
      "features": [
        { "geometry": { "coordinates": [999, 51] }, "properties": { "name": "bad lon" } },
        { "geometry": { "coordinates": [12, 91] }, "properties": { "name": "bad lat" } },
        { "geometry": { "coordinates": [12, 51] }, "properties": { "name": "ok" } }
      ]
    }`
    const pois = parseGoogleMapsJson(json)
    expect(pois).toHaveLength(1)
    expect(pois[0]!.name).toBe('ok')
  })

  it('skips features without geometry', () => {
    const json = `{
      "features": [
        { "properties": { "name": "no geo" } },
        { "geometry": { "coordinates": [12, 51] }, "properties": { "name": "ok" } }
      ]
    }`
    const pois = parseGoogleMapsJson(json)
    expect(pois).toHaveLength(1)
    expect(pois[0]!.name).toBe('ok')
  })

  it('uses default name for unnamed POIs', () => {
    const json = `{
      "features": [
        { "geometry": { "coordinates": [12, 51] }, "properties": {} }
      ]
    }`
    const pois = parseGoogleMapsJson(json)
    expect(pois).toHaveLength(1)
    expect(pois[0]!.name).toBe('Unbenannter Ort')
  })

  it('sets timestamps', () => {
    const pois = parseGoogleMapsJson(validDoc)
    for (const p of pois) {
      expect(p.createdAt).toBeGreaterThan(0)
      expect(p.updatedAt).toBeGreaterThan(0)
    }
  })
})

describe('parseGoogleMapsCsv', () => {
  it('returns empty for empty CSV or header-only', () => {
    expect(parseGoogleMapsCsv('').instant).toHaveLength(0)
    expect(parseGoogleMapsCsv('Titel,Notiz,URL,Tags,Kommentar').instant).toHaveLength(0)
  })

  it('parses search URLs with coordinates', () => {
    const csv = `Titel,Notiz,URL,Tags,Kommentar
,,,,
Gesetzte Markierung,Klettergebiet,"https://www.google.com/maps/search/51.3379107,12.3724663",,`
    const result = parseGoogleMapsCsv(csv)
    expect(result.instant).toHaveLength(1)
    expect(result.instant[0]!.name).toBe('Gesetzte Markierung')
    expect(result.instant[0]!.lat).toBe(51.3379107)
    expect(result.instant[0]!.lon).toBe(12.3724663)
    expect(result.instant[0]!.description).toBe('Klettergebiet')
    expect(result.geocodeQueue).toHaveLength(0)
  })

  it('queues place URLs for geocoding', () => {
    const csv = `Titel,Notiz,URL,Tags,Kommentar
,,,,
Eiscafé Mario Gelato,,https://www.google.com/maps/place/Eiscaf%C3%A9+Mario+Gelato/data=!4m2!3m1!1s0x47a65b5bba21f629:0xaab8027bc6e3ca54,,`
    const result = parseGoogleMapsCsv(csv)
    expect(result.instant).toHaveLength(0)
    expect(result.geocodeQueue).toHaveLength(1)
    expect(result.geocodeQueue[0]!.name).toBe('Eiscafé Mario Gelato')
  })

  it('handles mixed search and place URLs', () => {
    const csv = `Titel,Notiz,URL,Tags,Kommentar
,,,,
Eiscafé,,https://www.google.com/maps/place/Eiscaf%C3%A9/data=!abc,,
Gesetzte Markierung,note,"https://www.google.com/maps/search/52.4677345,13.3903445",,`
    const result = parseGoogleMapsCsv(csv)
    expect(result.instant).toHaveLength(1)
    expect(result.instant[0]!.lat).toBe(52.4677345)
    expect(result.instant[0]!.lon).toBe(13.3903445)
    expect(result.geocodeQueue).toHaveLength(1)
    expect(result.geocodeQueue[0]!.name).toBe('Eiscafé')
  })

  it('handles quoted fields with commas', () => {
    const csv = `Titel,Notiz,URL,Tags,Kommentar
,,,,
"Campingplatz Seesen, Am Brillteich",Urlaub,"https://www.google.com/maps/place/Campingplatz+Seesen,+Am+Brillteich/data=!foo",,`
    const result = parseGoogleMapsCsv(csv)
    expect(result.geocodeQueue).toHaveLength(1)
    expect(result.geocodeQueue[0]!.name).toBe('Campingplatz Seesen, Am Brillteich')
  })

  it('skips rows with empty title or URL', () => {
    const csv = `Titel,Notiz,URL,Tags,Kommentar
,,,,
,,https://www.google.com/maps/search/51.0,12.0,,
Platz,, ,,`
    const result = parseGoogleMapsCsv(csv)
    expect(result.instant).toHaveLength(0)
    expect(result.geocodeQueue).toHaveLength(0)
  })

  it('uses note as description', () => {
    const csv = `Titel,Notiz,URL,Tags,Kommentar
,,,,
Parkplatz,Womo parken,"https://www.google.com/maps/search/48.5,11.2",,`
    const result = parseGoogleMapsCsv(csv)
    expect(result.instant[0]!.description).toBe('Womo parken')
  })
})
