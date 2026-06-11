import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FilterPanel } from './FilterPanel.js'

const noop = () => {}

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
  it('renders 6 type toggle buttons plus add + custom', () => {
    const el = makeContainer()
    new FilterPanel(el, noop)
    expect(el.querySelectorAll('[data-type]')).toHaveLength(6)
    expect(el.querySelector('[data-type="climbing"]')).toBeTruthy()
    expect(el.querySelector('[data-action="custom"]')).toBeTruthy()
    expect(el.querySelector('.filter-add')).toBeTruthy()
  })

  it('all buttons active by default', () => {
    const el = makeContainer()
    const panel = new FilterPanel(el, noop)
    expect(panel.getActiveTypes().size).toBe(6)
  })

  it('renders icon-only buttons with label in title + aria-label', () => {
    const el = makeContainer()
    new FilterPanel(el, noop)
    const btn = el.querySelector<HTMLButtonElement>('[data-type="parking"]')!
    expect(btn.querySelector('svg')).toBeTruthy()
    expect(btn.title).toBe('Parkplatz')
    expect(btn.getAttribute('aria-label')).toBe('Parkplatz')
  })

  it('toggles a type off on click', () => {
    const el = makeContainer()
    const panel = new FilterPanel(el, noop)
    const btn = el.querySelector<HTMLButtonElement>('[data-type="parking"]')!
    btn.click()
    expect(panel.isActive('parking')).toBe(false)
    expect(btn.classList.contains('active')).toBe(false)
    expect(btn.getAttribute('aria-pressed')).toBe('false')
  })

  it('fires onChange listener on toggle', () => {
    const el = makeContainer()
    const panel = new FilterPanel(el, noop)
    const cb = vi.fn()
    panel.onChange(cb)
    el.querySelector<HTMLButtonElement>('[data-type="campsite"]')!.click()
    expect(cb).toHaveBeenCalledWith({ type: 'campsite', active: false })
  })

  it('onChange returns unsubscribe function', () => {
    const el = makeContainer()
    const panel = new FilterPanel(el, noop)
    const cb = vi.fn()
    const unsub = panel.onChange(cb)
    unsub()
    el.querySelector<HTMLButtonElement>('[data-type="parking"]')!.click()
    expect(cb).not.toHaveBeenCalled()
  })

  it('persists state to localStorage', () => {
    const el = makeContainer()
    const panel = new FilterPanel(el, noop)
    el.querySelector<HTMLButtonElement>('[data-type="camper"]')!.click()
    const el2 = makeContainer()
    const panel2 = new FilterPanel(el2, noop)
    expect(panel2.isActive('camper')).toBe(false)
    expect(panel2.isActive('parking')).toBe(true)
  })

  it('getActiveTypes excludes toggled-off types', () => {
    const el = makeContainer()
    const panel = new FilterPanel(el, noop)
    el.querySelector<HTMLButtonElement>('[data-type="parking"]')!.click()
    const active = panel.getActiveTypes()
    expect(active.has('parking')).toBe(false)
    expect(active.has('camper')).toBe(true)
    expect(active.has('campsite')).toBe(true)
    expect(active.has('dump')).toBe(true)
    expect(active.has('water')).toBe(true)
  })

  it('fires onAddClick when "+" is clicked', () => {
    const el = makeContainer()
    const onAdd = vi.fn()
    new FilterPanel(el, onAdd)
    el.querySelector<HTMLButtonElement>('.filter-add')!.click()
    expect(onAdd).toHaveBeenCalledOnce()
  })

  it('custom toggle starts visible', () => {
    const el = makeContainer()
    const panel = new FilterPanel(el, noop)
    expect(panel.isCustomVisible()).toBe(true)
    expect(el.querySelector('[data-action="custom"]')?.classList.contains('active')).toBe(true)
  })

  it('custom toggle hides custom POI markers on click', () => {
    const el = makeContainer()
    const panel = new FilterPanel(el, noop)
    const cb = vi.fn()
    panel.onCustomToggle(cb)
    el.querySelector<HTMLButtonElement>('[data-action="custom"]')!.click()
    expect(cb).toHaveBeenCalledWith({ active: false })
    expect(panel.isCustomVisible()).toBe(false)
  })

  it('custom toggle shows custom POI markers on second click', () => {
    const el = makeContainer()
    const panel = new FilterPanel(el, noop)
    el.querySelector<HTMLButtonElement>('[data-action="custom"]')!.click()
    const cb = vi.fn()
    panel.onCustomToggle(cb)
    el.querySelector<HTMLButtonElement>('[data-action="custom"]')!.click()
    expect(cb).toHaveBeenCalledWith({ active: true })
    expect(panel.isCustomVisible()).toBe(true)
  })
})
