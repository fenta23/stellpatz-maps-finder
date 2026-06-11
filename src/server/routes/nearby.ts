import { Router } from 'express'
import { haversineMeters, parseLatLon } from '../geo.js'
import { OVERPASS_ENDPOINTS, USER_AGENT } from '../config.js'

const SEARCH_RADIUS_M = 2000
const MAX_RESULTS = 15

const KIND_META: Record<string, { icon: string; label: string }> = {
  fuel:        { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 13h2a2 2 0 0 1 2 2v2a2 2 0 0 0 4 0v-6.998a2 2 0 0 0-.59-1.42L18 5"/><path d="M14 21V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v16"/><path d="M2 21h13"/><path d="M3 9h11"/></svg>', label: 'Tankstelle' },
  supermarket: { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 10a4 4 0 0 1-8 0"/><path d="M3.103 6.034h17.794"/><path d="M3.4 5.467a2 2 0 0 0-.4 1.2V20a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6.667a2 2 0 0 0-.4-1.2l-2-2.667A2 2 0 0 0 17 2H7a2 2 0 0 0-1.6.8z"/></svg>', label: 'Supermarkt' },
  pharmacy:    { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg>', label: 'Apotheke' },
  bakery:      { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>', label: 'Bäckerei' },
  water:       { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>', label: 'Frischwasser' },
  dump:        { icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 11v6"/><path d="M14 11v6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>', label: 'Entsorgung' },
}

type Tags = Record<string, string>

function classifyKind(tags: Tags): string | null {
  if (tags['amenity'] === 'fuel') return 'fuel'
  if (tags['shop'] === 'supermarket') return 'supermarket'
  if (tags['amenity'] === 'pharmacy') return 'pharmacy'
  if (tags['shop'] === 'bakery') return 'bakery'
  if (tags['amenity'] === 'water_point') return 'water'
  if (tags['amenity'] === 'sanitary_dump_station') return 'dump'
  return null
}

function buildNearbyQuery(lat: number, lon: number): string {
  const r = SEARCH_RADIUS_M
  const filters = [
    `node["amenity"="fuel"](around:${r},${lat},${lon})`,
    `way["amenity"="fuel"](around:${r},${lat},${lon})`,
    `node["shop"="supermarket"](around:${r},${lat},${lon})`,
    `way["shop"="supermarket"](around:${r},${lat},${lon})`,
    `node["amenity"="pharmacy"](around:${r},${lat},${lon})`,
    `node["shop"="bakery"](around:${r},${lat},${lon})`,
    `node["amenity"="water_point"](around:${r},${lat},${lon})`,
    `node["amenity"="sanitary_dump_station"](around:${r},${lat},${lon})`,
  ].join(';\n  ')
  return `[out:json][timeout:15];\n(\n  ${filters};\n);\nout center tags;`
}

type OverpassElement = {
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags: Tags
}

export function createNearbyRouter(): Router {
  const router = Router()

  router.get('/', async (req, res) => {
    const coords = parseLatLon(req.query['lat'], req.query['lon'])
    if (!coords) {
      res.status(400).json({ error: 'lat and lon required' })
      return
    }
    const { lat, lon } = coords

    try {
      const upstream = await fetch(OVERPASS_ENDPOINTS[0]!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': USER_AGENT },
        body: `data=${encodeURIComponent(buildNearbyQuery(lat, lon))}`,
        signal: AbortSignal.timeout(12_000),
      })
      if (!upstream.ok) {
        res.status(upstream.status).json({ error: 'Overpass error' })
        return
      }

      const data = await upstream.json() as { elements?: OverpassElement[] }
      const seen = new Set<number>()

      const items = (data.elements ?? [])
        .filter(el => !seen.has(el.id) && seen.add(el.id))
        .flatMap(el => {
          const pos = el.lat !== undefined ? { lat: el.lat, lon: el.lon! } : el.center
          const kind = classifyKind(el.tags)
          if (!pos || !kind) return []
          const meta = KIND_META[kind]!
          return [{
            kind,
            icon: meta.icon,
            name: el.tags['name'] ?? meta.label,
            distance: Math.round(haversineMeters(lat, lon, pos.lat, pos.lon)),
            lat: pos.lat,
            lon: pos.lon,
          }]
        })
        .sort((a, b) => a.distance - b.distance)
        .slice(0, MAX_RESULTS)

      res.json(items)
    } catch {
      res.status(503).json({ error: 'Overpass unreachable' })
    }
  })

  return router
}
