import { describe, it, expect, vi } from 'vitest'
import { createSupabaseCache } from './supabaseCache.js'

const opts = (fetchImpl: typeof fetch, ttlMs = 60_000) => ({
  url: 'https://proj.supabase.co/',
  serviceKey: 'service-key',
  ttlMs,
  fetchImpl,
})

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: () => Promise.resolve(body) } as Response
}

describe('createSupabaseCache.get', () => {
  it('returns fresh data and queries the right endpoint with auth', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse([{ data: { elements: [1] }, fetched_at: new Date().toISOString() }]),
    )
    const cache = createSupabaseCache(opts(fetchImpl as unknown as typeof fetch))
    const result = await cache.get('q1')
    expect(result).toEqual({ elements: [1] })
    const [url, init] = fetchImpl.mock.calls[0]!
    expect(String(url)).toContain('/rest/v1/poi_cache?key=eq.q1')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer service-key')
  })

  it('treats an entry older than the TTL as a miss', async () => {
    const old = new Date(Date.now() - 10 * 60_000).toISOString()
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse([{ data: 'x', fetched_at: old }]))
    const cache = createSupabaseCache(opts(fetchImpl as unknown as typeof fetch, 60_000))
    expect(await cache.get('q')).toBeNull()
  })

  it('returns null on empty result, error status, or thrown fetch', async () => {
    const empty = createSupabaseCache(opts(vi.fn().mockResolvedValue(jsonResponse([])) as unknown as typeof fetch))
    expect(await empty.get('q')).toBeNull()

    const bad = createSupabaseCache(opts(vi.fn().mockResolvedValue(jsonResponse(null, false)) as unknown as typeof fetch))
    expect(await bad.get('q')).toBeNull()

    const threw = createSupabaseCache(opts(vi.fn().mockRejectedValue(new Error('net')) as unknown as typeof fetch))
    expect(await threw.get('q')).toBeNull()
  })
})

describe('createSupabaseCache.set', () => {
  it('upserts via POST with merge-duplicates and the key/data', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, true))
    const cache = createSupabaseCache(opts(fetchImpl as unknown as typeof fetch))
    await cache.set('q1', { elements: [] })
    const [url, init] = fetchImpl.mock.calls[0]!
    expect(String(url)).toContain('/rest/v1/poi_cache')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>).Prefer).toBe('resolution=merge-duplicates')
    const body = JSON.parse(init.body as string)
    expect(body).toMatchObject({ key: 'q1', data: { elements: [] } })
    expect(body.fetched_at).toBeTypeOf('string')
  })

  it('never throws when the write fails', async () => {
    const cache = createSupabaseCache(opts(vi.fn().mockRejectedValue(new Error('net')) as unknown as typeof fetch))
    await expect(cache.set('q', {})).resolves.toBeUndefined()
  })
})
