import { describe, it, expect, beforeEach, vi } from 'vitest'
import { LocalNotesStore, type NoteTarget, type PoiNote } from './NotesStore.js'
import { SyncedNotesStore, type NotesBackend } from './RemoteNotesStore.js'

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

const target = (id: string): NoteTarget => ({ id, type: 'parking', name: `POI ${id}`, lat: 50, lon: 8 })
const note = (id: string, text: string): PoiNote => ({ ...target(id), text })

function fakeBackend(initial: PoiNote[] = []): NotesBackend & { store: Map<string, PoiNote> } {
  const store = new Map(initial.map(n => [n.id, n]))
  return {
    store,
    async load() { return [...store.values()] },
    async upsert(n) { store.set(n.id, n) },
    async remove(id) { store.delete(id) },
  }
}

describe('SyncedNotesStore (guest, no backend)', () => {
  it('behaves like the local store', () => {
    const s = new SyncedNotesStore(new LocalNotesStore())
    s.set(target('1'), 'hi')
    expect(s.get('1')).toBe('hi')
    s.remove('1')
    expect(s.has('1')).toBe(false)
  })
})

describe('SyncedNotesStore.connect (login merge)', () => {
  it('pulls server notes into the local mirror', async () => {
    const s = new SyncedNotesStore(new LocalNotesStore())
    await s.connect(fakeBackend([note('10', 'a'), note('20', 'b')]))
    expect(s.list()).toHaveLength(2)
    expect(s.get('10')).toBe('a')
  })

  it('merges union; local edit wins ties and both sides end consistent', async () => {
    const local = new LocalNotesStore()
    local.set(target('shared'), 'LOCAL text')
    local.set(target('local-only'), 'mine')
    const backend = fakeBackend([note('shared', 'SERVER text'), note('server-only', 'theirs')])
    const s = new SyncedNotesStore(local)
    await s.connect(backend)
    // local wins the conflict, server extra pulled in
    expect(s.get('shared')).toBe('LOCAL text')
    expect(s.get('server-only')).toBe('theirs')
    expect(s.get('local-only')).toBe('mine')
    // server now matches local (no divergence)
    expect(backend.store.get('shared')?.text).toBe('LOCAL text')
    expect(backend.store.has('local-only')).toBe(true)
  })

  it('swallows a failing load and stays usable', async () => {
    const s = new SyncedNotesStore(new LocalNotesStore())
    const backend: NotesBackend = {
      load: () => Promise.reject(new Error('net')),
      upsert: vi.fn(() => Promise.resolve()),
      remove: vi.fn(() => Promise.resolve()),
    }
    await expect(s.connect(backend)).resolves.toBeUndefined()
    expect(s.set(target('1'), 'hi')).toBe('hi')
  })

  it('skips push for unchanged notes where local text matches remote', async () => {
    const local = new LocalNotesStore()
    local.set(target('same'), 'hello')
    const backend = fakeBackend([note('same', 'hello')])
    const upsertSpy = vi.spyOn(backend, 'upsert')
    const s = new SyncedNotesStore(local)
    await s.connect(backend)
    expect(upsertSpy).not.toHaveBeenCalled()
    expect(s.get('same')).toBe('hello')
  })

  it('pushes only new notes and locally modified notes', async () => {
    const local = new LocalNotesStore()
    local.set(target('new'), 'fresh')
    local.set(target('changed'), 'v2')
    local.set(target('identical'), 'v1')
    const backend = fakeBackend([
      note('changed', 'v1'),
      note('identical', 'v1'),
    ])
    const upsertSpy = vi.spyOn(backend, 'upsert')
    const s = new SyncedNotesStore(local)
    await s.connect(backend)
    expect(upsertSpy).toHaveBeenCalledTimes(2)
    const upsertedIds = upsertSpy.mock.calls.map(c => (c[0] as PoiNote).id).sort()
    expect(upsertedIds).toEqual(['changed', 'new'])
  })

  it('does not re-run the full merge when already connected', async () => {
    const backend = fakeBackend([note('server-1', 'a')])
    const loadSpy = vi.spyOn(backend, 'load')
    const s = new SyncedNotesStore(new LocalNotesStore())
    await s.connect(backend)
    expect(loadSpy).toHaveBeenCalledTimes(1)
    await s.connect(backend)
    await s.connect(backend)
    expect(loadSpy).toHaveBeenCalledTimes(1) // guarded
  })
})

describe('SyncedNotesStore (connected, write-through)', () => {
  it('upserts and removes through to the backend', async () => {
    const backend = fakeBackend()
    const s = new SyncedNotesStore(new LocalNotesStore())
    await s.connect(backend)
    s.set(target('x'), 'note')
    await Promise.resolve()
    expect(backend.store.get('x')?.text).toBe('note')
    s.set(target('x'), '   ') // clears
    await Promise.resolve()
    expect(backend.store.has('x')).toBe(false)
  })

  it('remove writes through and stops after disconnect', async () => {
    const backend = fakeBackend([note('a', '1')])
    const removeSpy = vi.spyOn(backend, 'remove')
    const s = new SyncedNotesStore(new LocalNotesStore())
    await s.connect(backend)
    s.disconnect()
    s.remove('a')
    await Promise.resolve()
    expect(removeSpy).not.toHaveBeenCalled()
    expect(s.has('a')).toBe(false)
  })

  it('does not throw when a backend write rejects', async () => {
    const backend: NotesBackend = {
      load: () => Promise.resolve([]),
      upsert: () => Promise.reject(new Error('boom')),
      remove: () => Promise.resolve(),
    }
    const s = new SyncedNotesStore(new LocalNotesStore())
    await s.connect(backend)
    expect(() => s.set(target('z'), 'hi')).not.toThrow()
    expect(s.get('z')).toBe('hi')
  })
})

describe('SyncedNotesStore deletion reconciliation', () => {
  it('removes locally-cached notes that were deleted on another device', async () => {
    // Simulate: device A synced note('10', 'text'), then deleted it.
    // Device B reloads → must drop the stale local item.
    const local = new LocalNotesStore()
    local.set(target('10'), 'text')

    const s = new SyncedNotesStore(local)
    const b1 = fakeBackend([note('10', 'text')])
    await s.connect(b1)
    expect(s.has('10')).toBe(true)
    s.disconnect()

    // Server deleted by device A, local still has it from localStorage
    const local2 = new LocalNotesStore() // loads from localStorage
    expect(local2.has('10')).toBe(true)
    const s2 = new SyncedNotesStore(local2)
    const b2 = fakeBackend([])
    await s2.connect(b2)
    expect(s2.has('10')).toBe(false)
    expect(b2.store.has('10')).toBe(false)
  })

  it('keeps genuine guest-only notes (never synced) and pushes them up', async () => {
    const local = new LocalNotesStore()
    local.set(target('guest'), 'offline note')

    const s = new SyncedNotesStore(local)
    const b = fakeBackend([note('srv', 'server')])
    await s.connect(b)
    expect(s.get('guest')).toBe('offline note')
    expect(s.get('srv')).toBe('server')
    expect(b.store.get('guest')?.text).toBe('offline note')
  })

  it('device B picks up notes added by device A via write-through', async () => {
    // Device A: connect, add a note (persisted to shared backend)
    const backend = fakeBackend()
    const storeA = new SyncedNotesStore(new LocalNotesStore())
    await storeA.connect(backend)
    storeA.set(target('shared'), 'hello from A')
    await Promise.resolve() // let write-through settle

    // Device B: fresh store connects to same backend — should see the note
    const storeB = new SyncedNotesStore(new LocalNotesStore())
    await storeB.connect(backend)
    expect(storeB.get('shared')).toBe('hello from A')
    expect(storeB.has('shared')).toBe(true)
  })

  it('device B sees note deletion performed by device A', async () => {
    // A and B both connect, A adds note, B sees it, A deletes it, B polls
    const backend = fakeBackend()
    const storeA = new SyncedNotesStore(new LocalNotesStore())
    const storeB = new SyncedNotesStore(new LocalNotesStore())
    await storeA.connect(backend)
    await storeB.connect(backend)

    storeA.set(target('x'), 'original')
    storeA.set(target('y'), 'stay')
    await Promise.resolve()

    // B should see both via its next reconcile (we'll simulate poll manually)
    // B.disconnect + reconnect is the same as a poll cycle for test purposes
    storeB.disconnect()
    await storeB.connect(backend)
    expect(storeB.get('x')).toBe('original')
    expect(storeB.get('y')).toBe('stay')

    // A deletes 'x'
    storeA.set(target('x'), '') // empty = delete
    await Promise.resolve()
    expect(storeA.has('x')).toBe(false)
    expect(backend.store.has('x')).toBe(false)

    // B polls — should drop 'x' but keep 'y'
    storeB.disconnect()
    await storeB.connect(backend)
    expect(storeB.has('x')).toBe(false)
    expect(storeB.has('y')).toBe(true)
    expect(backend.store.has('x')).toBe(false) // NOT pushed back up
  })
})
