import { describe, it, expect, beforeEach } from 'vitest'
import { LocalFavoritesStore, type FavoritePoi } from './FavoritesStore.js'

const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v },
    removeItem: (k: string) => { delete store[k] },
    clear: () => { store = {} },
    raw: () => store,
  }
})()

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

beforeEach(() => localStorageMock.clear())

const poi = (id: string, over: Partial<FavoritePoi> = {}): FavoritePoi => ({
  id, type: 'parking', name: `POI ${id}`, lat: 50 + Number(id) / 100, lon: 8, ...over,
})

describe('LocalFavoritesStore', () => {
  it('starts empty', () => {
    expect(new LocalFavoritesStore().getAll().size).toBe(0)
  })

  it('toggle adds a snapshot and returns true', () => {
    const store = new LocalFavoritesStore()
    expect(store.toggle(poi('42'))).toBe(true)
    expect(store.has('42')).toBe(true)
    expect(store.list()).toHaveLength(1)
    expect(store.list()[0]?.name).toBe('POI 42')
  })

  it('toggle removes an existing favorite and returns false', () => {
    const store = new LocalFavoritesStore()
    store.toggle(poi('42'))
    expect(store.toggle(poi('42'))).toBe(false)
    expect(store.has('42')).toBe(false)
  })

  it('persists snapshots and restores them on a new instance', () => {
    const a = new LocalFavoritesStore()
    a.toggle(poi('7'))
    a.toggle(poi('99', { name: 'Schöner Platz' }))
    const b = new LocalFavoritesStore()
    expect(b.has('7')).toBe(true)
    expect(b.list().find(p => p.id === '99')?.name).toBe('Schöner Platz')
  })

  it('getAll returns the set of ids for the marker layer', () => {
    const store = new LocalFavoritesStore()
    store.toggle(poi('1'))
    store.toggle(poi('2'))
    expect([...store.getAll()].sort()).toEqual(['1', '2'])
  })

  it('addMany adds without removing and notifies once', () => {
    const store = new LocalFavoritesStore()
    store.toggle(poi('1'))
    let count = 0
    store.onChange(() => count++)
    store.addMany([poi('1'), poi('2'), poi('3')]) // '1' already present
    expect([...store.getAll()].sort()).toEqual(['1', '2', '3'])
    expect(count).toBe(1)
  })

  it('addMany does not notify when nothing changes', () => {
    const store = new LocalFavoritesStore()
    store.toggle(poi('1'))
    let count = 0
    store.onChange(() => count++)
    store.addMany([poi('1')])
    expect(count).toBe(0)
  })

  it('onChange fires on each toggle and unsubscribe stops it', () => {
    const store = new LocalFavoritesStore()
    let count = 0
    const unsub = store.onChange(() => count++)
    store.toggle(poi('1'))
    store.toggle(poi('1'))
    expect(count).toBe(2)
    unsub()
    store.toggle(poi('1'))
    expect(count).toBe(2)
  })

  it('migrates legacy id-only entries: heart stays, but they are not listed', () => {
    localStorageMock.setItem('stellpatz-favorites', JSON.stringify(['123', '456']))
    const store = new LocalFavoritesStore()
    expect(store.has('123')).toBe(true) // marker heart still works
    expect(store.list()).toHaveLength(0) // no coordinates → not navigable
  })

  it('list excludes entries without coordinates', () => {
    const store = new LocalFavoritesStore()
    store.toggle(poi('1', { lat: 0, lon: 0 }))
    store.toggle(poi('2'))
    expect(store.list().map(p => p.id)).toEqual(['2'])
  })
})
