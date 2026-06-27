import { describe, it, expect, beforeEach, vi } from 'vitest'
import { SyncedFilterStore, type FilterBackend } from './RemoteFilterStore.js'
import { LocalFilterStore } from './FilterStore.js'
import type { FilterDef } from './filterModel.js'

const userFilter = (id = 'u1', name = 'Tankstelle'): FilterDef => ({
  id, name, iconId: 'fuel', color: '#C62828',
  enabled: true, kind: 'osm', builtin: false, order: 100,
  selectors: [{ elements: ['node'], tags: [{ key: 'amenity', value: 'fuel' }] }],
})

function fakeBackend(initial: FilterDef[] = []) {
  const rows = new Map(initial.map(d => [d.id, d]))
  return {
    rows,
    backend: {
      load: vi.fn(async () => [...rows.values()]),
      upsert: vi.fn(async (d: FilterDef) => { rows.set(d.id, d) }),
      remove: vi.fn(async (id: string) => { rows.delete(id) }),
    } satisfies FilterBackend,
  }
}

beforeEach(() => localStorage.clear())

describe('SyncedFilterStore', () => {
  it('reads through to the local mirror', () => {
    const s = new SyncedFilterStore(new LocalFilterStore())
    expect(s.list().length).toBeGreaterThan(0)
  })

  it('put mirrors to backend.upsert after connect', async () => {
    const { backend } = fakeBackend()
    const s = new SyncedFilterStore(new LocalFilterStore())
    await s.connect(backend)
    s.put(userFilter())
    await Promise.resolve()
    expect(backend.upsert).toHaveBeenCalledWith(expect.objectContaining({ id: 'u1' }))
  })

  it('removing a user filter calls backend.remove', async () => {
    const { backend } = fakeBackend()
    const s = new SyncedFilterStore(new LocalFilterStore())
    await s.connect(backend)
    s.put(userFilter())
    s.remove('u1')
    await Promise.resolve()
    expect(backend.remove).toHaveBeenCalledWith('u1')
  })

  it('resetting a built-in upserts the reset state (not remove)', async () => {
    const { backend } = fakeBackend()
    const s = new SyncedFilterStore(new LocalFilterStore())
    await s.connect(backend)
    s.setEnabled('parking', false)
    backend.upsert.mockClear()
    s.remove('parking') // reset built-in
    await Promise.resolve()
    expect(backend.remove).not.toHaveBeenCalledWith('parking')
    expect(backend.upsert).toHaveBeenCalledWith(expect.objectContaining({ id: 'parking', enabled: true }))
  })

  it('connect merges remote records and pushes the union (local wins)', async () => {
    const local = new LocalFilterStore()
    local.put(userFilter('local', 'LocalName'))
    const { backend } = fakeBackend([userFilter('local', 'RemoteName'), userFilter('remoteOnly', 'Remote')])
    const s = new SyncedFilterStore(local)
    await s.connect(backend)
    expect(s.get('local')?.name).toBe('LocalName') // tie → local wins
    expect(s.get('remoteOnly')?.name).toBe('Remote') // adopted
    expect(backend.upsert).toHaveBeenCalled() // union pushed
  })

  it('swallows backend failures without throwing', async () => {
    const backend: FilterBackend = {
      load: vi.fn(async () => { throw new Error('offline') }),
      upsert: vi.fn(async () => { throw new Error('offline') }),
      remove: vi.fn(async () => { throw new Error('offline') }),
    }
    const s = new SyncedFilterStore(new LocalFilterStore())
    await expect(s.connect(backend)).resolves.toBeUndefined()
    expect(() => s.put(userFilter())).not.toThrow()
    expect(() => s.remove('u1')).not.toThrow()
  })

  it('does not re-run the full merge when already connected', async () => {
    const { backend } = fakeBackend()
    const s = new SyncedFilterStore(new LocalFilterStore())
    await s.connect(backend)
    expect(backend.load).toHaveBeenCalledTimes(1)
    await s.connect(backend)
    await s.connect(backend)
    expect(backend.load).toHaveBeenCalledTimes(1) // guarded
  })
})
