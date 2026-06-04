import 'dotenv/config'
import express from 'express'
import rateLimit from 'express-rate-limit'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

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
