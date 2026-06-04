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

  // ── OSRM routing proxy ─────────────────────────────────────────────────────
  const OSRM_PROFILES: Record<string, string> = { driving: 'driving', cycling: 'cycling', foot: 'foot' }

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

    const profile = OSRM_PROFILES[modeParam] ?? 'driving'
    // OSRM coordinate order: lon,lat
    const url = `https://router.project-osrm.org/route/v1/${profile}/${fromLon},${fromLat};${toLon},${toLat}?overview=full&geometries=geojson`

    try {
      const upstream = await fetch(url, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(10000),
      })
      if (!upstream.ok) { res.status(upstream.status).json({ error: 'OSRM error' }); return }
      const data = await upstream.json() as unknown
      res.json(data)
    } catch {
      res.status(503).json({ error: 'OSRM unreachable' })
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
