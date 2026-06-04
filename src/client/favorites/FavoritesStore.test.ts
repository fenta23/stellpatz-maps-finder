import { describe, it, expect, beforeEach } from 'vitest'
import { LocalFavoritesStore } from './FavoritesStore.js'

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

describe('LocalFavoritesStore', () => {
  it('starts empty', () => {
    const store = new LocalFavoritesStore()
    expect(store.getAll().size).toBe(0)
  })

  it('toggle adds a new id and returns true', () => {
    const store = new LocalFavoritesStore()
    expect(store.toggle('42')).toBe(true)
    expect(store.has('42')).toBe(true)
  })

  it('toggle removes an existing id and returns false', () => {
    const store = new LocalFavoritesStore()
    store.toggle('42')
    expect(store.toggle('42')).toBe(false)
    expect(store.has('42')).toBe(false)
  })

  it('has returns false for unknown id', () => {
    const store = new LocalFavoritesStore()
    expect(store.has('999')).toBe(false)
  })

  it('persists to localStorage and restores on new instance', () => {
    const a = new LocalFavoritesStore()
    a.toggle('7')
    a.toggle('99')
    const b = new LocalFavoritesStore()
    expect(b.has('7')).toBe(true)
    expect(b.has('99')).toBe(true)
  })

  it('removed ids are not persisted', () => {
    const a = new LocalFavoritesStore()
    a.toggle('5')
    a.toggle('5')
    const b = new LocalFavoritesStore()
    expect(b.has('5')).toBe(false)
  })

  it('onChange fires on each toggle', () => {
    const store = new LocalFavoritesStore()
    let count = 0
    store.onChange(() => count++)
    store.toggle('1')
    store.toggle('1')
    expect(count).toBe(2)
  })

  it('onChange unsubscribe stops notifications', () => {
    const store = new LocalFavoritesStore()
    let count = 0
    const unsub = store.onChange(() => count++)
    unsub()
    store.toggle('1')
    expect(count).toBe(0)
  })

  it('getAll reflects current state', () => {
    const store = new LocalFavoritesStore()
    store.toggle('1')
    store.toggle('2')
    store.toggle('3')
    store.toggle('2')
    expect([...store.getAll()].sort()).toEqual(['1', '3'])
  })
})
