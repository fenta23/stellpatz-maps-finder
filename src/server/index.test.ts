import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import { createApp } from './index.js'

describe('Express server', () => {
  const originalKey = process.env['GOOGLE_MAPS_API_KEY']

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env['GOOGLE_MAPS_API_KEY']
    } else {
      process.env['GOOGLE_MAPS_API_KEY'] = originalKey
    }
  })

  it('GET /api/health returns ok', async () => {
    const app = createApp()
    const res = await request(app).get('/api/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok' })
  })

  it('GET /api/maps-key returns key when configured', async () => {
    process.env['GOOGLE_MAPS_API_KEY'] = 'test-key-123'
    const app = createApp()
    const res = await request(app).get('/api/maps-key')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ key: 'test-key-123' })
  })

  it('GET /api/maps-key returns 503 when key missing', async () => {
    delete process.env['GOOGLE_MAPS_API_KEY']
    const app = createApp()
    const res = await request(app).get('/api/maps-key')
    expect(res.status).toBe(503)
    expect(res.body).toHaveProperty('error')
  })

  it('does not expose raw key in non-api routes', async () => {
    process.env['GOOGLE_MAPS_API_KEY'] = 'secret-key'
    const app = createApp()
    const res = await request(app).get('/api/health')
    expect(JSON.stringify(res.body)).not.toContain('secret-key')
  })
})
