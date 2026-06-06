import { Router } from 'express'
import { USER_AGENT } from '../config.js'

const OSM_NOTES_API = 'https://api.openstreetmap.org/api/0.6/notes.json'
const RADIUS_DEG = 0.003 // ~300 m

export function createNotesRouter(): Router {
  const router = Router()

  router.get('/', async (req, res) => {
    const lat = parseFloat(String(req.query['lat'] ?? ''))
    const lon = parseFloat(String(req.query['lon'] ?? ''))

    if (isNaN(lat) || isNaN(lon)) {
      res.status(400).json({ error: 'lat and lon required' })
      return
    }

    const bbox = `${lon - RADIUS_DEG},${lat - RADIUS_DEG},${lon + RADIUS_DEG},${lat + RADIUS_DEG}`
    const url = `${OSM_NOTES_API}?bbox=${bbox}&limit=5&closed=0`

    try {
      const upstream = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT },
        signal: AbortSignal.timeout(8_000),
      })
      if (!upstream.ok) {
        res.status(upstream.status).json({ error: 'OSM Notes error' })
        return
      }

      const raw = await upstream.json() as {
        features?: Array<{
          properties: {
            id: number
            date_created: string
            comments: Array<{ text: string }>
          }
        }>
      }

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

  return router
}
