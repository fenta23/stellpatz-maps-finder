import { Router } from 'express'
import { USER_AGENT } from '../config.js'

const MAPILLARY_API = 'https://graph.mapillary.com/images'
const RADIUS_DEG = 0.0005 // ~50 m

export function createMapillaryRouter(): Router {
  const router = Router()

  router.get('/', async (req, res) => {
    const lat = parseFloat(String(req.query['lat'] ?? ''))
    const lon = parseFloat(String(req.query['lon'] ?? ''))

    if (isNaN(lat) || isNaN(lon)) {
      res.status(400).json({ error: 'lat and lon required' })
      return
    }

    const token = process.env['MAPILLARY_ACCESS_TOKEN']
    if (!token) {
      res.json([])
      return
    }

    const bbox = [
      (lon - RADIUS_DEG).toFixed(6),
      (lat - RADIUS_DEG).toFixed(6),
      (lon + RADIUS_DEG).toFixed(6),
      (lat + RADIUS_DEG).toFixed(6),
    ].join(',')

    const url = `${MAPILLARY_API}?bbox=${bbox}&fields=id,thumb_256_url,captured_at&limit=6`

    try {
      const upstream = await fetch(url, {
        // Token in Authorization header, not URL — avoids leaking it into access logs
        headers: { 'User-Agent': USER_AGENT, 'Authorization': `OAuth ${token}` },
        signal: AbortSignal.timeout(8_000),
      })
      if (!upstream.ok) {
        res.status(upstream.status).json({ error: 'Mapillary error' })
        return
      }

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

  return router
}
