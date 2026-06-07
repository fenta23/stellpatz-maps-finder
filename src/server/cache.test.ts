import { describe, it, expect } from 'vitest'
import { createInMemoryCache } from './cache.js'

describe('createInMemoryCache', () => {
  it('stores and returns a value', async () => {
    const cache = createInMemoryCache(60_000, 100)
    await cache.set('k', { a: 1 })
    expect(await cache.get('k')).toEqual({ a: 1 })
  })

  it('returns null for a missing key', async () => {
    const cache = createInMemoryCache(60_000, 100)
    expect(await cache.get('nope')).toBeNull()
  })

  it('expires entries past the TTL', async () => {
    const cache = createInMemoryCache(-1, 100) // already expired on read
    await cache.set('k', 'v')
    expect(await cache.get('k')).toBeNull()
  })

  it('evicts the oldest entry past the max size', async () => {
    const cache = createInMemoryCache(60_000, 2)
    await cache.set('a', 1)
    await cache.set('b', 2)
    await cache.set('c', 3) // evicts 'a'
    expect(await cache.get('a')).toBeNull()
    expect(await cache.get('b')).toBe(2)
    expect(await cache.get('c')).toBe(3)
  })
})
