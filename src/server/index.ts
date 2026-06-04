import 'dotenv/config'
import express from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const OVERPASS_ENDPOINTS = [
  'https://overpass.openstreetmap.fr/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
]

const UA = 'stellpatz-maps-finder/0.1 (https://github.com/local/stellpatz)'

// Snap bbox coordinates to a grid so nearby viewports share cache entries.
// floor for south/west (expand outward), ceil for north/east.
const BBOX_SNAP = 0.05
function snapBboxInQuery(query: string): string {
  return query.replace(
    /\((-?\d+\.?\d*),(-?\d+\.?\d*),(-?\d+\.?\d*),(-?\d+\.?\d*)\)/g,
    (_m, s, w, n, e) => {
      const fl = (v: string) => (Math.floor(parseFloat(v) / BBOX_SNAP) * BBOX_SNAP).toFixed(2)
      const ce = (v: string) => (Math.ceil(parseFloat(v) / BBOX_SNAP) * BBOX_SNAP).toFixed(2)
      return `(${fl(s)},${fl(w)},${ce(n)},${ce(e)})`
    },
  )
}

export function createApp() {
  const app = express()

  // Behind Firebase Hosting / GCP Load Balancer — req.ip is the LB IP without this.
  app.set('trust proxy', 1)

  // Security headers: CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, …
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"], // Leaflet needs inline styles
        imgSrc: [
          "'self'", 'data:', 'blob:',
          'https://*.tile.openstreetmap.org',
          'https://upload.wikimedia.org',
          'https://commons.wikimedia.org',
          'https://images.mapillary.com',
          'https://graph.mapillary.com',
        ],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
  }))

  // Per-app cache so tests start clean; TTL 5 min, max 200 entries (LRU-evict oldest).
  const overpassCache = new Map<string, { data: unknown; expiresAt: number }>()
  const CACHE_TTL = 5 * 60 * 1000
  const CACHE_MAX = 200

  const apiLimiter = rateLimit({
    windowMs: 60_000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
  })

  app.use('/api', apiLimiter)

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' })
  })

  // ── Overpass proxy ────────────────────────────────────────────────────────
  let overpassIdx = 0
  app.post(
    '/api/overpass',
    express.text({ type: 'application/x-www-form-urlencoded', limit: '4kb' }),
    async (req, res) => {
      const rawBody = req.body as string

      // Decode query, snap bbox, re-encode — larger but stable cache keys
      const rawQuery = decodeURIComponent(rawBody.startsWith('data=') ? rawBody.slice(5) : rawBody)
      const snappedQuery = snapBboxInQuery(rawQuery)
      const cacheKey = snappedQuery

      // Serve from cache if fresh
      const now = Date.now()
      const cached = overpassCache.get(cacheKey)
      if (cached && cached.expiresAt > now) {
        res.json(cached.data)
        return
      }

      const body = 'data=' + encodeURIComponent(snappedQuery)
      const n = OVERPASS_ENDPOINTS.length
      for (let i = 0; i < n; i++) {
        const url = OVERPASS_ENDPOINTS[overpassIdx % n]!
        overpassIdx++
        try {
          const upstream = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
            body,
            signal: AbortSignal.timeout(20000),
          })
          if (upstream.status === 429 || upstream.status === 503) {
            if (i < n - 1) continue
            res.status(429).json({ error: 'Overpass rate limited on all endpoints' })
            return
          }
          if (!upstream.ok) {
            res.status(upstream.status).json({ error: `Overpass error: ${upstream.statusText}` })
            return
          }
          const data = await upstream.json() as unknown

          // Store in cache; evict oldest entry if over limit
          overpassCache.set(cacheKey, { data, expiresAt: now + CACHE_TTL })
          if (overpassCache.size > CACHE_MAX) {
            overpassCache.delete(overpassCache.keys().next().value!)
          }

          res.json(data)
          return
        } catch {
          if (i < n - 1) continue
          res.status(503).json({ error: 'All Overpass endpoints unreachable' })
          return
        }
      }
    },
  )

  // ── Nominatim geocoding proxy ──────────────────────────────────────────────
  app.get('/api/geocode', async (req, res) => {
    const q = String(req.query['q'] ?? '').trim()
    if (!q) { res.status(400).json({ error: 'q is required' }); return }

    const params = new URLSearchParams({ q, format: 'json', limit: '6', addressdetails: '0' })
    const viewbox = req.query['viewbox']
    // Validate viewbox format: four finite decimal numbers separated by commas.
    if (viewbox) {
      const vb = String(viewbox)
      if (/^-?\d+\.?\d*,-?\d+\.?\d*,-?\d+\.?\d*,-?\d+\.?\d*$/.test(vb)) {
        params.set('viewbox', vb)
      }
    }

    try {
      const upstream = await fetch(
        `https://nominatim.openstreetmap.org/search?${params}`,
        { headers: { 'User-Agent': UA, 'Accept-Language': 'de,en' }, signal: AbortSignal.timeout(8000) },
      )
      if (!upstream.ok) { res.status(upstream.status).json({ error: 'Nominatim error' }); return }
      const data = await upstream.json() as unknown
      res.json(data)
    } catch {
      res.status(503).json({ error: 'Nominatim unreachable' })
    }
  })

  // ── Valhalla routing proxy ────────────────────────────────────────────────
  // OSRM public demo only has the driving profile built in; Valhalla supports
  // auto/bicycle/pedestrian with genuinely different routing algorithms.
  const VALHALLA_COSTING: Record<string, string> = {
    driving: 'auto',
    cycling: 'bicycle',
    foot: 'pedestrian',
  }

  interface ValhallaShape { type: string; coordinates: Array<[number, number]> }
  interface ValhallaLeg { shape: string | ValhallaShape; summary?: { length: number; time: number } }
  interface ValhallaResponse { trip: { legs: ValhallaLeg[]; summary: { length: number; time: number } } }

  function decodeValhallaPolyline(encoded: string): Array<[number, number]> {
    const coords: Array<[number, number]> = []
    let index = 0, lat = 0, lng = 0
    while (index < encoded.length) {
      let b, shift = 0, result = 0
      do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20)
      lat += (result & 1) ? ~(result >> 1) : (result >> 1)
      shift = 0; result = 0
      do { b = encoded.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5 } while (b >= 0x20)
      lng += (result & 1) ? ~(result >> 1) : (result >> 1)
      coords.push([lng / 1e6, lat / 1e6]) // [lon, lat] for GeoJSON
    }
    return coords
  }

  app.get('/api/route', async (req, res) => {
    const from = String(req.query['from'] ?? '')
    const to = String(req.query['to'] ?? '')
    const modeParam = String(req.query['mode'] ?? 'driving')
    const [fromLat, fromLon] = from.split(',')
    const [toLat, toLon] = to.split(',')

    const fromLatN = Number(fromLat), fromLonN = Number(fromLon)
    const toLatN = Number(toLat), toLonN = Number(toLon)
    if (
      !fromLat || !fromLon || !toLat || !toLon ||
      [fromLatN, fromLonN, toLatN, toLonN].some(n => !isFinite(n)) ||
      Math.abs(fromLatN) > 90 || Math.abs(fromLonN) > 180 ||
      Math.abs(toLatN) > 90 || Math.abs(toLonN) > 180
    ) {
      res.status(400).json({ error: 'from and to coordinates required (lat,lon)' })
      return
    }

    const costing = VALHALLA_COSTING[modeParam] ?? 'auto'
    const jsonParam = encodeURIComponent(JSON.stringify({
      locations: [
        { lat: Number(fromLat), lon: Number(fromLon) },
        { lat: Number(toLat), lon: Number(toLon) },
      ],
      costing,
      units: 'km',
    }))

    try {
      const upstream = await fetch(`https://valhalla1.openstreetmap.de/route?json=${jsonParam}`, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(10000),
      })
      if (!upstream.ok) { res.status(upstream.status).json({ error: 'Routing error' }); return }

      const data = await upstream.json() as ValhallaResponse
      const leg = data.trip?.legs?.[0]
      if (!leg) { res.status(502).json({ error: 'No route found' }); return }

      const shape = leg.shape
      const coordinates = typeof shape === 'string'
        ? decodeValhallaPolyline(shape)
        : (shape as ValhallaShape).coordinates

      res.json({
        code: 'Ok',
        routes: [{
          distance: data.trip.summary.length * 1000, // km → meters
          duration: data.trip.summary.time,
          geometry: { coordinates },
        }],
      })
    } catch {
      res.status(503).json({ error: 'Routing service unreachable' })
    }
  })

  // ── Nearby amenities proxy ────────────────────────────────────────────────
  const NEARBY_ICONS: Record<string, string> = {
    fuel: '⛽', supermarket: '🛒', pharmacy: '💊',
    bakery: '🥐', water: '🚰', dump: '🚿',
  }
  const NEARBY_LABELS: Record<string, string> = {
    fuel: 'Tankstelle', supermarket: 'Supermarkt', pharmacy: 'Apotheke',
    bakery: 'Bäckerei', water: 'Frischwasser', dump: 'Entsorgung',
  }

  function classifyNearby(tags: Record<string, string>): string | null {
    if (tags['amenity'] === 'fuel') return 'fuel'
    if (tags['shop'] === 'supermarket') return 'supermarket'
    if (tags['amenity'] === 'pharmacy') return 'pharmacy'
    if (tags['shop'] === 'bakery') return 'bakery'
    if (tags['amenity'] === 'water_point') return 'water'
    if (tags['amenity'] === 'sanitary_dump_station') return 'dump'
    return null
  }

  function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6_371_000
    const toRad = (d: number) => d * Math.PI / 180
    const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1)
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }

  app.get('/api/nearby', async (req, res) => {
    const lat = parseFloat(String(req.query['lat'] ?? ''))
    const lon = parseFloat(String(req.query['lon'] ?? ''))
    if (isNaN(lat) || isNaN(lon)) { res.status(400).json({ error: 'lat and lon required' }); return }

    const query = `[out:json][timeout:15];\n(\n  node["amenity"="fuel"](around:2000,${lat},${lon});\n  way["amenity"="fuel"](around:2000,${lat},${lon});\n  node["shop"="supermarket"](around:2000,${lat},${lon});\n  way["shop"="supermarket"](around:2000,${lat},${lon});\n  node["amenity"="pharmacy"](around:2000,${lat},${lon});\n  node["shop"="bakery"](around:2000,${lat},${lon});\n  node["amenity"="water_point"](around:2000,${lat},${lon});\n  node["amenity"="sanitary_dump_station"](around:2000,${lat},${lon});\n);\nout center tags;`

    try {
      const upstream = await fetch(OVERPASS_ENDPOINTS[0]!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(12000),
      })
      if (!upstream.ok) { res.status(upstream.status).json({ error: 'Overpass error' }); return }

      const data = await upstream.json() as {
        elements?: Array<{
          id: number; lat?: number; lon?: number
          center?: { lat: number; lon: number }
          tags: Record<string, string>
        }>
      }
      const seen = new Set<number>()
      const items = (data.elements ?? [])
        .filter(el => { if (seen.has(el.id)) return false; seen.add(el.id); return true })
        .map(el => {
          const pos = el.lat !== undefined ? { lat: el.lat, lon: el.lon! } : el.center
          if (!pos) return null
          const kind = classifyNearby(el.tags)
          if (!kind) return null
          return {
            kind,
            icon: NEARBY_ICONS[kind]!,
            name: el.tags['name'] ?? NEARBY_LABELS[kind]!,
            distance: Math.round(haversineMeters(lat, lon, pos.lat, pos.lon)),
          }
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 15)

      res.json(items)
    } catch {
      res.status(503).json({ error: 'Overpass unreachable' })
    }
  })

  // ── Mapillary proxy ───────────────────────────────────────────────────────
  app.get('/api/mapillary', async (req, res) => {
    const lat = parseFloat(String(req.query['lat'] ?? ''))
    const lon = parseFloat(String(req.query['lon'] ?? ''))
    if (isNaN(lat) || isNaN(lon)) { res.status(400).json({ error: 'lat and lon required' }); return }

    const token = process.env['MAPILLARY_ACCESS_TOKEN']
    if (!token) { res.json([]); return }

    const r = 0.0005 // ~50 m radius
    const bbox = `${(lon - r).toFixed(6)},${(lat - r).toFixed(6)},${(lon + r).toFixed(6)},${(lat + r).toFixed(6)}`
    // Token in Authorization header, not URL — avoids leaking it into access logs.
    const url = `https://graph.mapillary.com/images?bbox=${bbox}&fields=id,thumb_256_url,captured_at&limit=6`

    try {
      const upstream = await fetch(url, {
        headers: { 'User-Agent': UA, 'Authorization': `OAuth ${token}` },
        signal: AbortSignal.timeout(8000),
      })
      if (!upstream.ok) { res.status(upstream.status).json({ error: 'Mapillary error' }); return }
      const raw = await upstream.json() as {
        data?: Array<{ id: string; thumb_256_url: string; captured_at: number }>
      }
      const images = (raw.data ?? []).map(img => ({
        src: img.thumb_256_url,
        link: `https://www.mapillary.com/app/?pKey=${img.id}`,
        caption: `Mapillary · ${new Date(img.captured_at).toISOString().slice(0, 7)}`,
      }))
      res.json(images)
    } catch {
      res.status(503).json({ error: 'Mapillary unreachable' })
    }
  })

  // ── OSM Notes proxy ───────────────────────────────────────────────────────
  app.get('/api/notes', async (req, res) => {
    const lat = parseFloat(String(req.query['lat'] ?? ''))
    const lon = parseFloat(String(req.query['lon'] ?? ''))
    if (isNaN(lat) || isNaN(lon)) { res.status(400).json({ error: 'lat and lon required' }); return }

    const r = 0.003 // ~300m radius
    const bbox = `${lon - r},${lat - r},${lon + r},${lat + r}`
    const url = `https://api.openstreetmap.org/api/0.6/notes.json?bbox=${bbox}&limit=5&closed=0`

    try {
      const upstream = await fetch(url, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(8000),
      })
      if (!upstream.ok) { res.status(upstream.status).json({ error: 'OSM Notes error' }); return }
      const raw = await upstream.json() as { features?: Array<{
        properties: { id: number; date_created: string; comments: Array<{ text: string }> }
      }> }

      const notes = (raw.features ?? [])
        .filter(f => f.properties.comments.length > 0)
        .map(f => ({
          id: f.properties.id,
          date: f.properties.date_created.slice(0, 10),
          text: f.properties.comments[0]!.text.trim(),
        }))
        .filter(n => n.text.length > 0)

      res.json(notes)
    } catch {
      res.status(503).json({ error: 'OSM Notes unreachable' })
    }
  })

  // ── Static serving (production build) ─────────────────────────────────────
  const clientDist = path.resolve(__dirname, '../../dist/client')
  app.use(express.static(clientDist))
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'))
  })

  return app
}

if (process.env['NODE_ENV'] !== 'test') {
  const port = Number(process.env['SERVER_PORT'] ?? process.env['PORT'] ?? 3000)
  const app = createApp()
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`)
  })
}
