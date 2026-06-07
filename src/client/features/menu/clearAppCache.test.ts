import { describe, it, expect, vi, afterEach } from 'vitest'
import { clearAppCache } from './clearAppCache.js'

afterEach(() => vi.unstubAllGlobals())

describe('clearAppCache', () => {
  it('deletes every cache and unregisters every service worker', async () => {
    const del = vi.fn().mockResolvedValue(true)
    vi.stubGlobal('caches', { keys: vi.fn().mockResolvedValue(['precache', 'api']), delete: del })

    const unregister = vi.fn().mockResolvedValue(true)
    vi.stubGlobal('navigator', {
      serviceWorker: { getRegistrations: vi.fn().mockResolvedValue([{ unregister }, { unregister }]) },
    })

    await clearAppCache()

    expect(del).toHaveBeenCalledTimes(2)
    expect(del).toHaveBeenCalledWith('precache')
    expect(del).toHaveBeenCalledWith('api')
    expect(unregister).toHaveBeenCalledTimes(2)
  })

  it('is a no-op when caches / serviceWorker are unavailable', async () => {
    vi.stubGlobal('caches', undefined)
    vi.stubGlobal('navigator', {})
    await expect(clearAppCache()).resolves.toBeUndefined()
  })
})
