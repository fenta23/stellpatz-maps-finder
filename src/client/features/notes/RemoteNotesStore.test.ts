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
