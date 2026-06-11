import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FilterPanel } from './FilterPanel.js'

function makeContainer(): HTMLElement {
  return document.createElement('div')
}

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

describe('FilterPanel', () => {
  it('renders 5 toggle buttons', () => {
    const el = makeContainer()
    new FilterPanel(el)
    expect(el.querySelectorAll('.filter-btn')).toHaveLength(5)
  })

  it('all buttons active by default', () => {
    const el = makeContainer()
    const panel = new FilterPanel(el)
    expect(panel.getActiveTypes().size).toBe(5)
  })

  it('renders icon-only buttons with label in title + aria-label', () => {
    const el = makeContainer()
    new FilterPanel(el)
    const btn = el.querySelector<HTMLButtonElement>('[data-type="parking"]')!
    expect(btn.querySelector('svg')).toBeTruthy() // SVG icon, no text
    expect(btn.title).toBe('Parkplatz')
    expect(btn.getAttribute('aria-label')).toBe('Parkplatz')
  })

  it('toggles a type off on click', () => {
    const el = makeContainer()
    const panel = new FilterPanel(el)
    const btn = el.querySelector<HTMLButtonElement>('[data-type="parking"]')!
    btn.click()
    expect(panel.isActive('parking')).toBe(false)
    expect(btn.classList.contains('active')).toBe(false)
    expect(btn.getAttribute('aria-pressed')).toBe('false')
  })

  it('fires onChange listener on toggle', () => {
    const el = makeContainer()
    const panel = new FilterPanel(el)
    const cb = vi.fn()
    panel.onChange(cb)
    el.querySelector<HTMLButtonElement>('[data-type="campsite"]')!.click()
    expect(cb).toHaveBeenCalledWith({ type: 'campsite', active: false })
  })

  it('onChange returns unsubscribe function', () => {
    const el = makeContainer()
    const panel = new FilterPanel(el)
    const cb = vi.fn()
    const unsub = panel.onChange(cb)
    unsub()
    el.querySelector<HTMLButtonElement>('[data-type="parking"]')!.click()
    expect(cb).not.toHaveBeenCalled()
  })

  it('persists state to localStorage', () => {
    const el = makeContainer()
    const panel = new FilterPanel(el)
    el.querySelector<HTMLButtonElement>('[data-type="camper"]')!.click()
    // recreate panel — should read from storage
    const el2 = makeContainer()
    const panel2 = new FilterPanel(el2)
    expect(panel2.isActive('camper')).toBe(false)
    expect(panel2.isActive('parking')).toBe(true)
  })

  it('getActiveTypes excludes toggled-off types', () => {
    const el = makeContainer()
    const panel = new FilterPanel(el)
    el.querySelector<HTMLButtonElement>('[data-type="parking"]')!.click()
    const active = panel.getActiveTypes()
    expect(active.has('parking')).toBe(false)
    expect(active.has('camper')).toBe(true)
    expect(active.has('campsite')).toBe(true)
    expect(active.has('dump')).toBe(true)
    expect(active.has('water')).toBe(true)
  })
})
