import { describe, it, expect, beforeEach } from 'vitest'
import { LocalNotesStore, toNoteTarget, noteToPoi, type NoteTarget } from './NotesStore.js'
import type { OsmPoi } from '@/features/pois/OverpassClient.js'

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

describe('LocalNotesStore', () => {
  it('starts empty', () => {
    const s = new LocalNotesStore()
    expect(s.list()).toHaveLength(0)
    expect(s.get('1')).toBe('')
    expect(s.has('1')).toBe(false)
  })

  it('set stores a trimmed note and get returns it', () => {
    const s = new LocalNotesStore()
    expect(s.set(target('1'), '  schöner Platz  ')).toBe('schöner Platz')
    expect(s.get('1')).toBe('schöner Platz')
    expect(s.has('1')).toBe(true)
    expect(s.list()).toHaveLength(1)
  })

  it('set with empty/whitespace text removes the note', () => {
    const s = new LocalNotesStore()
    s.set(target('1'), 'hi')
    expect(s.set(target('1'), '   ')).toBe('')
    expect(s.has('1')).toBe(false)
  })

  it('updating a note overwrites the text', () => {
    const s = new LocalNotesStore()
    s.set(target('1'), 'first')
    s.set(target('1'), 'second')
    expect(s.get('1')).toBe('second')
    expect(s.list()).toHaveLength(1)
  })

  it('persists and restores across instances', () => {
    const a = new LocalNotesStore()
    a.set(target('7'), 'merken: Tor links')
    const b = new LocalNotesStore()
    expect(b.get('7')).toBe('merken: Tor links')
    expect(b.list()[0]?.name).toBe('POI 7')
  })

  it('remove deletes and notifies; addMany merges without overwriting', () => {
    const s = new LocalNotesStore()
    s.set(target('1'), 'keep')
    let count = 0
    s.onChange(() => count++)
    s.addMany([
      { ...target('1'), text: 'SHOULD NOT OVERWRITE' },
      { ...target('2'), text: 'new' },
    ])
    expect(s.get('1')).toBe('keep')
    expect(s.get('2')).toBe('new')
    expect(count).toBe(1)
    s.remove('1')
    expect(s.has('1')).toBe(false)
    expect(count).toBe(2)
  })

  it('toNoteTarget / noteToPoi round-trip', () => {
    const poi: OsmPoi = { id: 42, type: 'camper', lat: 50.1, lon: 8.2, tags: { name: 'Hafen' } }
    const t = toNoteTarget(poi)
    expect(t).toEqual({ id: '42', type: 'camper', name: 'Hafen', lat: 50.1, lon: 8.2 })
    expect(noteToPoi({ ...t, text: 'x' })).toEqual({ id: 42, type: 'camper', lat: 50.1, lon: 8.2, tags: { name: 'Hafen' } })
  })
})
