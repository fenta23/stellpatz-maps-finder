import { describe, it, expect, beforeEach, vi } from 'vitest'
import { LocalFavoritesStore } from './FavoritesStore.js'
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

function fakeBackend(initial: string[] = []): FavoritesBackend & {
  ids: Set<string>; loadCalls: number
} {
  const ids = new Set(initial)
  return {
    ids,
    loadCalls: 0,
    async load() { this.loadCalls++; return [...ids] },
    async add(id) { ids.add(id) },
    async remove(id) { ids.delete(id) },
  }
}

describe('SyncedFavoritesStore (guest, no backend)', () => {
  it('behaves like the local store', () => {
    const store = new SyncedFavoritesStore(new LocalFavoritesStore())
    expect(store.toggle('1')).toBe(true)
    expect(store.has('1')).toBe(true)
    expect(store.toggle('1')).toBe(false)
    expect(store.has('1')).toBe(false)
  })

  it('forwards onChange from the local store', () => {
    const store = new SyncedFavoritesStore(new LocalFavoritesStore())
    let n = 0
    store.onChange(() => n++)
    store.toggle('a')
    expect(n).toBe(1)
  })
})

describe('SyncedFavoritesStore.connect (login merge)', () => {
  it('pulls server favorites into the local mirror', async () => {
    const store = new SyncedFavoritesStore(new LocalFavoritesStore())
    await store.connect(fakeBackend(['10', '20']))
    expect([...store.getAll()].sort()).toEqual(['10', '20'])
  })

  it('pushes guest-only favorites up to the server (union)', async () => {
    const local = new LocalFavoritesStore()
    local.toggle('guest-1')
    const backend = fakeBackend(['server-1'])
    const store = new SyncedFavoritesStore(local)
    await store.connect(backend)
    expect([...store.getAll()].sort()).toEqual(['guest-1', 'server-1'])
    expect(backend.ids.has('guest-1')).toBe(true) // pushed up
  })

  it('does not re-push ids that already exist on the server', async () => {
    const local = new LocalFavoritesStore()
    local.toggle('shared')
    const backend = fakeBackend(['shared'])
    const addSpy = vi.spyOn(backend, 'add')
    const store = new SyncedFavoritesStore(local)
    await store.connect(backend)
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
    expect(store.toggle('1')).toBe(true)
  })
})

describe('SyncedFavoritesStore (connected, write-through)', () => {
  it('writes adds and removes through to the backend', async () => {
    const backend = fakeBackend()
    const store = new SyncedFavoritesStore(new LocalFavoritesStore())
    await store.connect(backend)
    store.toggle('x')
    await Promise.resolve() // let the fire-and-forget op settle
    expect(backend.ids.has('x')).toBe(true)
    store.toggle('x')
    await Promise.resolve()
    expect(backend.ids.has('x')).toBe(false)
  })

  it('stops writing to the backend after disconnect', async () => {
    const backend = fakeBackend()
    const addSpy = vi.spyOn(backend, 'add')
    const store = new SyncedFavoritesStore(new LocalFavoritesStore())
    await store.connect(backend)
    store.disconnect()
    store.toggle('y')
    await Promise.resolve()
    expect(addSpy).not.toHaveBeenCalled()
    expect(store.has('y')).toBe(true) // local mirror still works
  })

  it('does not throw when a backend write rejects', async () => {
    const backend: FavoritesBackend = {
      load: () => Promise.resolve([]),
      add: () => Promise.reject(new Error('boom')),
      remove: () => Promise.resolve(),
    }
    const store = new SyncedFavoritesStore(new LocalFavoritesStore())
    await store.connect(backend)
    expect(() => store.toggle('z')).not.toThrow()
    expect(store.has('z')).toBe(true)
  })
})
