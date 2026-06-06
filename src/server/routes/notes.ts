import { Router } from 'express'
import { notNullUndefined } from '../../shared/common.js'
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

      // notNullUndefined acts as type guard for the first comment,
      // replacing the separate comments.length > 0 + [0]! pattern.
      const notes = (raw.features ?? []).flatMap(f => {
        const first = f.properties.comments[0]
        if (!notNullUndefined(first)) return []
        const text = first.text.trim()
        if (!text) return []
        return [{ id: f.properties.id, date: f.properties.date_created.slice(0, 10), text }]
      })

      res.json(notes)
    } catch {
      res.status(503).json({ error: 'OSM Notes unreachable' })
    }
  })

  return router
}
