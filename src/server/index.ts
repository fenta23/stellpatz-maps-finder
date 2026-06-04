import 'dotenv/config'
import express from 'express'
import rateLimit from 'express-rate-limit'
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

export function createApp() {
  const app = express()

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
    express.text({ type: 'application/x-www-form-urlencoded' }),
    async (req, res) => {
      const body = req.body as string
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
    if (viewbox) params.set('viewbox', String(viewbox))

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

    if (!fromLat || !fromLon || !toLat || !toLon) {
      res.status(400).json({ error: 'from and to coordinates required (lat,lon)' })
      return
    }

    const costing = VALHALLA_COSTING[modeParam] ?? 'auto'
    const requestBody = JSON.stringify({
      locations: [
        { lat: Number(fromLat), lon: Number(fromLon) },
        { lat: Number(toLat), lon: Number(toLon) },
      ],
      costing,
      units: 'km',
      shape_format: 'geojson',
    })

    try {
      const upstream = await fetch('https://valhalla.openstreetmap.de/route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
        body: requestBody,
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
