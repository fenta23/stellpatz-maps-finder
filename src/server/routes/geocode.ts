import { Router } from 'express'
import { USER_AGENT } from '../config.js'

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search'
const VIEWBOX_RE = /^-?\d+\.?\d*,-?\d+\.?\d*,-?\d+\.?\d*,-?\d+\.?\d*$/

export function createGeocodeRouter(): Router {
  const router = Router()

  router.get('/', async (req, res) => {
    const q = String(req.query['q'] ?? '').trim()
    if (!q) {
      res.status(400).json({ error: 'q is required' })
      return
    }

    const params = new URLSearchParams({ q, format: 'json', limit: '6', addressdetails: '0' })

    const viewbox = req.query['viewbox']
    if (viewbox) {
      const vb = String(viewbox)
      if (VIEWBOX_RE.test(vb)) params.set('viewbox', vb)
    }

    try {
      const upstream = await fetch(`${NOMINATIM_URL}?${params}`, {
        headers: { 'User-Agent': USER_AGENT, 'Accept-Language': 'de,en' },
        signal: AbortSignal.timeout(8_000),
      })
      if (!upstream.ok) {
        res.status(upstream.status).json({ error: 'Nominatim error' })
        return
      }
      res.json(await upstream.json())
    } catch {
      res.status(503).json({ error: 'Nominatim unreachable' })
    }
  })

  return router
}
