import 'dotenv/config'
import express from 'express'
import rateLimit from 'express-rate-limit'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.ru/api/interpreter',
]

export function createApp() {
  const app = express()

  const apiLimiter = rateLimit({
    windowMs: 60_000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
  })

  app.use('/api', apiLimiter)

  app.get('/api/maps-key', (_req, res) => {
    const key = process.env['GOOGLE_MAPS_API_KEY']
    if (!key) {
      res.status(503).json({ error: 'GOOGLE_MAPS_API_KEY not configured' })
      return
    }
    res.json({ key })
  })

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' })
  })

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
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'User-Agent': 'stellpatz-maps-finder/0.1 (https://github.com/local/stellpatz)',
            },
            body,
            signal: AbortSignal.timeout(12000),
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

  const clientDist = path.resolve(__dirname, '../../dist/client')
  app.use(express.static(clientDist))
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'))
  })

  return app
}

if (process.env['NODE_ENV'] !== 'test') {
  // Use SERVER_PORT to avoid conflict with Vite's PORT injection in preview environments
  const port = Number(process.env['SERVER_PORT'] ?? process.env['PORT'] ?? 3000)
  const app = createApp()
  app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`)
  })
}
