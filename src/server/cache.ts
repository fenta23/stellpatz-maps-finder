export type CacheEntry<T> = { readonly data: T; readonly expiresAt: number }
export type Cache<T> = Map<string, CacheEntry<T>>

export function createCache<T>(): Cache<T> {
  return new Map()
}

export function getCached<T>(cache: Cache<T>, key: string): T | null {
  const entry = cache.get(key)
  return entry !== undefined && entry.expiresAt > Date.now() ? entry.data : null
}

export function setCached<T>(
  cache: Cache<T>,
  key: string,
  data: T,
  ttlMs: number,
  maxEntries: number,
): void {
  cache.set(key, { data, expiresAt: Date.now() + ttlMs })
  if (cache.size > maxEntries) {
    // Map preserves insertion order → first key is the oldest
    cache.delete(cache.keys().next().value!)
  }
}
