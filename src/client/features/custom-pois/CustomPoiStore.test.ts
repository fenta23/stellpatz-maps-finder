import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LocalCustomPoiStore } from './CustomPoiStore.js'
import type { CustomPoi } from './CustomPoi.js'

const poi = (id: string, overrides?: Partial<CustomPoi>): CustomPoi => ({
  id,
  iconId: 'parking',
  lat: 48 + Number(id) * 0.01,
  lon: 11 + Number(id) * 0.01,
  name: `POI ${id}`,
  createdAt: 1000,
  updatedAt: 1000,
  ...overrides,
})

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

describe('LocalCustomPoiStore', () => {
  it('starts empty', () => {
    const store = new LocalCustomPoiStore()
    expect(store.getAll()).toHaveLength(0)
  })

  it('put adds a POI', () => {
    const store = new LocalCustomPoiStore()
    store.put(poi('1'))
    expect(store.getAll()).toHaveLength(1)
    expect(store.get('1')?.name).toBe('POI 1')
  })

  it('put updates an existing POI', () => {
    const store = new LocalCustomPoiStore()
    store.put(poi('1', { name: 'old' }))
    store.put(poi('1', { name: 'new' }))
    expect(store.getAll()).toHaveLength(1)
    expect(store.get('1')?.name).toBe('new')
  })

  it('remove deletes a POI', () => {
    const store = new LocalCustomPoiStore()
    store.put(poi('1'))
    store.put(poi('2'))
    store.remove('1')
    expect(store.getAll()).toHaveLength(1)
    expect(store.get('1')).toBeUndefined()
  })

  it('remove is a no-op for missing id', () => {
    const store = new LocalCustomPoiStore()
    store.put(poi('1'))
    store.remove('nonexistent')
    expect(store.getAll()).toHaveLength(1)
  })

  it('fires onChange on put', () => {
    const store = new LocalCustomPoiStore()
    const cb = vi.fn()
    store.onChange(cb)
    store.put(poi('1'))
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('fires onChange on remove', () => {
    const store = new LocalCustomPoiStore()
    store.put(poi('1'))
    const cb = vi.fn()
    store.onChange(cb)
    store.remove('1')
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('does not fire onChange when remove misses', () => {
    const store = new LocalCustomPoiStore()
    store.put(poi('1'))
    const cb = vi.fn()
    store.onChange(cb)
    store.remove('nonexistent')
    expect(cb).not.toHaveBeenCalled()
  })

  it('onChange returns unsubscribe function', () => {
    const store = new LocalCustomPoiStore()
    const cb = vi.fn()
    const unsub = store.onChange(cb)
    unsub()
    store.put(poi('1'))
    expect(cb).not.toHaveBeenCalled()
  })

  it('persists to localStorage and loads back', () => {
    const store1 = new LocalCustomPoiStore()
    store1.put(poi('1', { name: 'Bert', lat: 52.5, lon: 13.4 }))
    store1.put(poi('2', { iconId: 'swimming', name: 'See' }))

    const store2 = new LocalCustomPoiStore()
    const all = store2.getAll()
    expect(all).toHaveLength(2)
    expect(all.find(p => p.id === '1')?.name).toBe('Bert')
    expect(all.find(p => p.id === '1')?.lat).toBe(52.5)
    expect(all.find(p => p.id === '2')?.iconId).toBe('swimming')
    expect(all.find(p => p.id === '2')?.name).toBe('See')
  })

  it('ignores malformed entries in storage', () => {
    localStorage.setItem('stellplatz:custom-pois', JSON.stringify([
      { id: 'valid', iconId: 'parking', lat: 1, lon: 2, name: 'ok', createdAt: 0, updatedAt: 0 },
      { id: 'bad', noicon: true, lat: 1, lon: 2 },
      'string entry',
      null,
    ]))
    const store = new LocalCustomPoiStore()
    expect(store.getAll()).toHaveLength(1)
    expect(store.get('valid')?.name).toBe('ok')
  })

  it('recovers from corrupt JSON', () => {
    localStorage.setItem('stellplatz:custom-pois', 'not json')
    const store = new LocalCustomPoiStore()
    expect(store.getAll()).toHaveLength(0)
  })

  it('get returns undefined for missing id', () => {
    const store = new LocalCustomPoiStore()
    expect(store.get('missing')).toBeUndefined()
  })
})
