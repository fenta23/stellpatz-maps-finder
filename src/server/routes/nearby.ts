import { Router } from 'express'
import { haversineMeters } from '../geo.js'
import { OVERPASS_ENDPOINTS, USER_AGENT } from '../config.js'

const SEARCH_RADIUS_M = 2000
const MAX_RESULTS = 15

const KIND_META: Record<string, { icon: string; label: string }> = {
  fuel:        { icon: '⛽', label: 'Tankstelle' },
  supermarket: { icon: '🛒', label: 'Supermarkt' },
  pharmacy:    { icon: '💊', label: 'Apotheke' },
  bakery:      { icon: '🥐', label: 'Bäckerei' },
  water:       { icon: '🚰', label: 'Frischwasser' },
  dump:        { icon: '🚿', label: 'Entsorgung' },
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
    const lat = parseFloat(String(req.query['lat'] ?? ''))
    const lon = parseFloat(String(req.query['lon'] ?? ''))

    if (isNaN(lat) || isNaN(lon)) {
      res.status(400).json({ error: 'lat and lon required' })
      return
    }

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
