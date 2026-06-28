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

  it('skips push for unchanged filters where local def matches remote', async () => {
    const local = new LocalFilterStore()
    local.put(userFilter('same', 'Unchanged'))
    const { backend } = fakeBackend([userFilter('same', 'Unchanged')])
    const s = new SyncedFilterStore(local)
    await s.connect(backend)
    const upsertedForSame = backend.upsert.mock.calls.filter(c => (c[0] as FilterDef).id === 'same')
    expect(upsertedForSame).toHaveLength(0)
  })

  it('pushes only new and locally modified filters', async () => {
    const local = new LocalFilterStore()
    local.put(userFilter('new', 'NewName'))
    local.put(userFilter('changed', 'ChangedName'))
    local.put(userFilter('identical', 'IdenticalName'))
    const { backend } = fakeBackend([
      userFilter('changed', 'OldName'),
      userFilter('identical', 'IdenticalName'),
    ])
    const s = new SyncedFilterStore(local)
    await s.connect(backend)
    const upsertedIds = backend.upsert.mock.calls.map(c => (c[0] as FilterDef).id).sort()
    expect(upsertedIds).toEqual(['changed', 'new'])
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

describe('SyncedFilterStore deletion reconciliation', () => {
  it('removes locally-cached user filters that were deleted on another device', async () => {
    const local = new LocalFilterStore()
    local.put(userFilter('u-local', 'LocalFilter'))

    const { backend: b1 } = fakeBackend([userFilter('u-local', 'LocalFilter')])
    const s = new SyncedFilterStore(local)
    await s.connect(b1)
    expect(s.get('u-local')).toBeDefined()
    s.disconnect()

    // Server deleted by device A
    const local2 = new LocalFilterStore()
    expect(local2.get('u-local')).toBeDefined()
    const { backend: b2 } = fakeBackend([])
    const s2 = new SyncedFilterStore(local2)
    await s2.connect(b2)
    expect(s2.get('u-local')).toBeUndefined()
    // Should not have been pushed back up
    const upsertedIds = b2.upsert.mock.calls.map(c => (c[0] as FilterDef).id)
    expect(upsertedIds).not.toContain('u-local')
  })

  it('keeps genuine guest-only filters (never synced) and pushes them up', async () => {
    const local = new LocalFilterStore()
    local.put(userFilter('guest', 'GuestFilter'))

    const { backend } = fakeBackend([userFilter('srv', 'ServerFilter')])
    const s = new SyncedFilterStore(local)
    await s.connect(backend)
    expect(s.get('guest')).toBeDefined()
    expect(s.get('srv')).toBeDefined()
    const upsertedIds = backend.upsert.mock.calls.map(c => (c[0] as FilterDef).id)
    expect(upsertedIds).toContain('guest')
  })
})
