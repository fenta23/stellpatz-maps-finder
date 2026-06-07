// Force a fresh app version: drop all service-worker caches and unregister the
// worker. User data in localStorage (favorites, filters) is intentionally kept.
// Callers typically reload afterwards so the latest assets are fetched anew.

export async function clearAppCache(): Promise<void> {
  const cacheStore = globalThis.caches
  if (cacheStore) {
    const keys = await cacheStore.keys()
    await Promise.all(keys.map(key => cacheStore.delete(key)))
  }
  const sw = navigator.serviceWorker
  if (sw) {
    const regs = await sw.getRegistrations()
    await Promise.all(regs.map(reg => reg.unregister()))
  }
}
