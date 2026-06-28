import { describe, it, expect, beforeEach, vi } from 'vitest'
import { LocalFavoritesStore, type FavoritePoi } from './FavoritesStore.js'
import { SyncedFavoritesStore, type FavoritesBackend } from './RemoteFavoritesStore.js'

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v },
    removeItem: (k: string) => { delete store[k] },
    clear: () => { store = {} },
  }
})()

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

beforeEach(() => localStorageMock.clear())

const poi = (id: string): FavoritePoi => ({ id, type: 'parking', name: `POI ${id}`, lat: 50, lon: 8 })

function fakeBackend(initial: FavoritePoi[] = []): FavoritesBackend & { store: Map<string, FavoritePoi> } {
  const store = new Map(initial.map(p => [p.id, p]))
  return {
    store,
    async load() { return [...store.values()] },
    async add(p) { store.set(p.id, p) },
    async remove(id) { store.delete(id) },
  }
}

describe('SyncedFavoritesStore (guest, no backend)', () => {
  it('behaves like the local store', () => {
    const store = new SyncedFavoritesStore(new LocalFavoritesStore())
    expect(store.toggle(poi('1'))).toBe(true)
    expect(store.has('1')).toBe(true)
    expect(store.list()).toHaveLength(1)
    expect(store.toggle(poi('1'))).toBe(false)
    expect(store.has('1')).toBe(false)
  })
})

describe('SyncedFavoritesStore.connect (login merge)', () => {
  it('pulls server favorites into the local mirror', async () => {
    const store = new SyncedFavoritesStore(new LocalFavoritesStore())
    await store.connect(fakeBackend([poi('10'), poi('20')]))
    expect([...store.getAll()].sort()).toEqual(['10', '20'])
    expect(store.list()).toHaveLength(2)
  })

  it('pushes guest-only favorites up to the server (union)', async () => {
    const local = new LocalFavoritesStore()
    local.toggle(poi('guest-1'))
    const backend = fakeBackend([poi('server-1')])
    const store = new SyncedFavoritesStore(local)
    await store.connect(backend)
    expect([...store.getAll()].sort()).toEqual(['guest-1', 'server-1'])
    expect(backend.store.has('guest-1')).toBe(true)
  })

  it('does not re-push ids that already exist on the server', async () => {
    const local = new LocalFavoritesStore()
    local.toggle(poi('shared'))
    const backend = fakeBackend([poi('shared')])
    const addSpy = vi.spyOn(backend, 'add')
    await new SyncedFavoritesStore(local).connect(backend)
    expect(addSpy).not.toHaveBeenCalled()
  })

  it('swallows a failing load and stays usable', async () => {
    const store = new SyncedFavoritesStore(new LocalFavoritesStore())
    const backend: FavoritesBackend = {
      load: () => Promise.reject(new Error('network')),
      add: vi.fn(() => Promise.resolve()),
      remove: vi.fn(() => Promise.resolve()),
    }
    await expect(store.connect(backend)).resolves.toBeUndefined()
    expect(store.toggle(poi('1'))).toBe(true)
  })

  it('does not re-run the full merge when already connected', async () => {
    const backend = fakeBackend([poi('server-1')])
    const loadSpy = vi.spyOn(backend, 'load')
    const store = new SyncedFavoritesStore(new LocalFavoritesStore())
    await store.connect(backend)
    expect(loadSpy).toHaveBeenCalledTimes(1)
    await store.connect(backend)
    await store.connect(backend)
    expect(loadSpy).toHaveBeenCalledTimes(1) // guarded
  })
})

describe('SyncedFavoritesStore (connected, write-through)', () => {
  it('writes adds and removes through to the backend', async () => {
    const backend = fakeBackend()
    const store = new SyncedFavoritesStore(new LocalFavoritesStore())
    await store.connect(backend)
    store.toggle(poi('x'))
    await Promise.resolve()
    expect(backend.store.has('x')).toBe(true)
    store.toggle(poi('x'))
    await Promise.resolve()
    expect(backend.store.has('x')).toBe(false)
  })

  it('stops writing to the backend after disconnect', async () => {
    const backend = fakeBackend()
    const addSpy = vi.spyOn(backend, 'add')
    const store = new SyncedFavoritesStore(new LocalFavoritesStore())
    await store.connect(backend)
    store.disconnect()
    store.toggle(poi('y'))
    await Promise.resolve()
    expect(addSpy).not.toHaveBeenCalled()
    expect(store.has('y')).toBe(true)
  })

  it('does not throw when a backend write rejects', async () => {
    const backend: FavoritesBackend = {
      load: () => Promise.resolve([]),
      add: () => Promise.reject(new Error('boom')),
      remove: () => Promise.resolve(),
    }
    const store = new SyncedFavoritesStore(new LocalFavoritesStore())
    await store.connect(backend)
    expect(() => store.toggle(poi('z'))).not.toThrow()
    expect(store.has('z')).toBe(true)
  })
})

describe('SyncedFavoritesStore deletion reconciliation', () => {
  it('removes locally-cached favorites that were deleted on another device', async () => {
    // Simulate: device A synced poi('10'), then deleted it on server.
    // Device B reloads from localStorage → must drop the stale local item.
    const local = new LocalFavoritesStore()
    local.toggle(poi('10')) // was synced on previous session

    const store = new SyncedFavoritesStore(local)
    // First connect: syncs poi('10') — server has it
    const backend1 = fakeBackend([poi('10')])
    await store.connect(backend1)
    expect(store.has('10')).toBe(true)
    store.disconnect()

    // Now device A deleted poi('10'), server is empty.
    // Simulate reload (re-read from localStorage which still has poi('10')).
    const local2 = new LocalFavoritesStore() // loads from localStorage with poi('10')
    expect(local2.has('10')).toBe(true)
    const store2 = new SyncedFavoritesStore(local2)
    const backend2 = fakeBackend([])
    await store2.connect(backend2)
    expect(store2.has('10')).toBe(false) // must be removed
    expect(backend2.store.has('10')).toBe(false) // must NOT have been pushed back up
  })

  it('keeps genuine guest-only favorites (never synced) and pushes them up', async () => {
    const local = new LocalFavoritesStore()
    local.toggle(poi('guest'))

    const store = new SyncedFavoritesStore(local)
    const backend = fakeBackend([poi('server-1')])
    await store.connect(backend)
    expect(store.has('guest')).toBe(true)
    expect(store.has('server-1')).toBe(true)
    expect(backend.store.has('guest')).toBe(true) // pushed up
  })
})
