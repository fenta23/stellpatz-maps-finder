import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { CustomPoi } from './CustomPoi.js'
import { LocalCustomPoiStore } from './CustomPoiStore.js'
import { SyncedCustomPoiStore, type CustomPoiBackend } from './RemoteCustomPoiStore.js'

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

const poi = (id: string, over: Partial<CustomPoi> = {}): CustomPoi => ({
  id, iconId: 'parking', lat: 50, lon: 8, name: `POI ${id}`,
  createdAt: 1, updatedAt: 1, ...over,
})

function fakeBackend(initial: CustomPoi[] = []): CustomPoiBackend & { store: Map<string, CustomPoi> } {
  const store = new Map(initial.map(p => [p.id, p]))
  return {
    store,
    async load() { return [...store.values()] },
    async upsert(p) { store.set(p.id, p) },
    async remove(id) { store.delete(id) },
  }
}

describe('SyncedCustomPoiStore (guest, no backend)', () => {
  it('behaves like the local store', () => {
    const s = new SyncedCustomPoiStore(new LocalCustomPoiStore())
    s.put(poi('1'))
    expect(s.get('1')?.name).toBe('POI 1')
    s.remove('1')
    expect(s.get('1')).toBeUndefined()
  })
})

describe('SyncedCustomPoiStore.connect (login merge)', () => {
  it('pulls server POIs into the local mirror', async () => {
    const s = new SyncedCustomPoiStore(new LocalCustomPoiStore())
    await s.connect(fakeBackend([poi('10'), poi('20')]))
    expect(s.getAll()).toHaveLength(2)
    expect(s.get('10')?.name).toBe('POI 10')
  })

  it('merges union; local copy wins ties and both sides end consistent', async () => {
    const local = new LocalCustomPoiStore()
    local.put(poi('shared', { name: 'LOCAL' }))
    local.put(poi('local-only'))
    const backend = fakeBackend([poi('shared', { name: 'SERVER' }), poi('server-only')])
    const s = new SyncedCustomPoiStore(local)
    await s.connect(backend)
    expect(s.get('shared')?.name).toBe('LOCAL') // local wins conflict
    expect(s.get('server-only')).toBeDefined()  // server extra pulled in
    expect(s.get('local-only')).toBeDefined()
    // server now matches local (no divergence)
    expect(backend.store.get('shared')?.name).toBe('LOCAL')
    expect(backend.store.has('local-only')).toBe(true)
  })

  it('swallows a failing load and stays usable', async () => {
    const s = new SyncedCustomPoiStore(new LocalCustomPoiStore())
    const backend: CustomPoiBackend = {
      load: () => Promise.reject(new Error('net')),
      upsert: vi.fn(() => Promise.resolve()),
      remove: vi.fn(() => Promise.resolve()),
    }
    await expect(s.connect(backend)).resolves.toBeUndefined()
    s.put(poi('1'))
    expect(s.get('1')).toBeDefined()
  })
})

describe('SyncedCustomPoiStore (connected, write-through)', () => {
  it('upserts and removes through to the backend', async () => {
    const backend = fakeBackend()
    const s = new SyncedCustomPoiStore(new LocalCustomPoiStore())
    await s.connect(backend)
    s.put(poi('x', { name: 'placed' }))
    await Promise.resolve()
    expect(backend.store.get('x')?.name).toBe('placed')
    s.remove('x')
    await Promise.resolve()
    expect(backend.store.has('x')).toBe(false)
  })

  it('stops writing through after disconnect', async () => {
    const backend = fakeBackend([poi('a')])
    const removeSpy = vi.spyOn(backend, 'remove')
    const s = new SyncedCustomPoiStore(new LocalCustomPoiStore())
    await s.connect(backend)
    s.disconnect()
    s.remove('a')
    await Promise.resolve()
    expect(removeSpy).not.toHaveBeenCalled()
    expect(s.get('a')).toBeUndefined()
  })

  it('does not throw when a backend write rejects', async () => {
    const backend: CustomPoiBackend = {
      load: () => Promise.resolve([]),
      upsert: () => Promise.reject(new Error('boom')),
      remove: () => Promise.resolve(),
    }
    const s = new SyncedCustomPoiStore(new LocalCustomPoiStore())
    await s.connect(backend)
    expect(() => s.put(poi('z'))).not.toThrow()
    expect(s.get('z')).toBeDefined()
  })
})
