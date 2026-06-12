import { describe, it, expect, vi, beforeEach } from 'vitest'
import { FilterPanel } from './FilterPanel.js'
import { LocalFilterStore } from './FilterStore.js'
import type { FilterDef } from './filterModel.js'

const noop = () => {}
const makeContainer = (): HTMLElement => document.createElement('div')

beforeEach(() => localStorage.clear())

const userFilter = (id = 'u1'): FilterDef => ({
  id, name: 'Tankstelle', iconId: 'fuel', color: '#C62828',
  enabled: true, kind: 'osm', builtin: false, order: 100,
  selectors: [{ elements: ['node'], tags: [{ key: 'amenity', value: 'fuel' }] }],
})

describe('FilterPanel', () => {
  it('renders a chip per configured filter plus add + config buttons', () => {
    const el = makeContainer()
    new FilterPanel(el, new LocalFilterStore(), { onAdd: noop, onOpenConfig: noop })
    expect(el.querySelectorAll('[data-filter-id]')).toHaveLength(7) // 6 OSM + personal
    expect(el.querySelector('[data-filter-id="climbing"]')).toBeTruthy()
    expect(el.querySelector('[data-filter-id="personal"]')).toBeTruthy()
    expect(el.querySelector('.filter-add')).toBeTruthy()
    expect(el.querySelector('.filter-config')).toBeTruthy()
  })

  it('marks enabled chips active and sets icon/title/colour', () => {
    const el = makeContainer()
    new FilterPanel(el, new LocalFilterStore(), { onAdd: noop, onOpenConfig: noop })
    const btn = el.querySelector<HTMLButtonElement>('[data-filter-id="parking"]')!
    expect(btn.querySelector('svg')).toBeTruthy()
    expect(btn.title).toBe('Parkplatz')
    expect(btn.classList.contains('active')).toBe(true)
    expect(btn.style.getPropertyValue('--chip-color')).toBe('#1565C0')
  })

  it('clicking a chip disables it in the store and shows as inactive', () => {
    const el = makeContainer()
    const store = new LocalFilterStore()
    new FilterPanel(el, store, { onAdd: noop, onOpenConfig: noop })
    expect(el.querySelector('[data-filter-id="parking"]')).toBeTruthy()
    el.querySelector<HTMLButtonElement>('[data-filter-id="parking"]')!.click()
    expect(store.get('parking')?.enabled).toBe(false)
    expect(el.querySelector('[data-filter-id="parking"]')!.classList.contains('active')).toBe(false)
  })

  it('shows newly added filters live (re-render on store change)', () => {
    const el = makeContainer()
    const store = new LocalFilterStore()
    new FilterPanel(el, store, { onAdd: noop, onOpenConfig: noop })
    store.put(userFilter())
    expect(el.querySelector('[data-filter-id="u1"]')).toBeTruthy()
    expect(el.querySelectorAll('[data-filter-id]')).toHaveLength(8)
  })

  it('fires onAdd and onOpenConfig', () => {
    const el = makeContainer()
    const onAdd = vi.fn()
    const onOpenConfig = vi.fn()
    new FilterPanel(el, new LocalFilterStore(), { onAdd, onOpenConfig })
    el.querySelector<HTMLButtonElement>('.filter-add')!.click()
    el.querySelector<HTMLButtonElement>('.filter-config')!.click()
    expect(onAdd).toHaveBeenCalledOnce()
    expect(onOpenConfig).toHaveBeenCalledOnce()
  })
})
