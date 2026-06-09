import { describe, it, expect, beforeEach, vi } from 'vitest'
import { FavoritesListPanel } from './FavoritesListPanel.js'
import type { FavoritePoi } from './FavoritesStore.js'

const poi = (id: string): FavoritePoi => ({ id, type: 'parking', name: `Platz ${id}`, lat: 50, lon: 8 })

beforeEach(() => { document.body.innerHTML = '' })

function mount(favs: FavoritePoi[]) {
  let items = favs
  const onSelect = vi.fn()
  const onRemove = vi.fn((f: FavoritePoi) => { items = items.filter(p => p.id !== f.id) })
  const panel = new FavoritesListPanel(document.body, {
    getFavorites: () => items,
    onSelect,
    onRemove,
  })
  return { panel, onSelect, onRemove, setItems: (v: FavoritePoi[]) => { items = v } }
}

describe('FavoritesListPanel', () => {
  it('is hidden until opened', () => {
    const { panel } = mount([poi('1')])
    expect(panel.isOpen()).toBe(false)
    expect(document.querySelector('.fav-panel.open')).toBeNull()
    panel.open()
    expect(panel.isOpen()).toBe(true)
  })

  it('renders one row per favorite', () => {
    const { panel } = mount([poi('1'), poi('2'), poi('3')])
    panel.open()
    expect(document.querySelectorAll('.fav-item')).toHaveLength(3)
    expect(document.querySelector('.fav-item-name')?.textContent).toBe('Platz 1')
  })

  it('shows the type label as subtitle when there is no note', () => {
    const { panel } = mount([poi('1')])
    panel.open()
    expect(document.querySelector('.fav-item-sub')?.textContent).toBe('Parkplatz')
  })

  it('shows the note (prefixed) as subtitle when getNote returns one', () => {
    let items = [poi('1'), poi('2')]
    const panel = new FavoritesListPanel(document.body, {
      getFavorites: () => items,
      getNote: id => (id === '1' ? '  Tor links  ' : ''),
      onSelect: vi.fn(),
      onRemove: vi.fn(),
    })
    panel.open()
    const subs = [...document.querySelectorAll('.fav-item-sub')].map(s => s.textContent)
    expect(subs[0]).toBe('📝 Tor links') // note wins, trimmed
    expect(subs[1]).toBe('Parkplatz')    // falls back to type label
  })

  it('shows an empty state when there are no favorites', () => {
    const { panel } = mount([])
    panel.open()
    expect(document.querySelector('.fav-empty')).not.toBeNull()
    expect(document.querySelectorAll('.fav-item')).toHaveLength(0)
  })

  it('clicking a row calls onSelect and closes the panel', () => {
    const { panel, onSelect } = mount([poi('1')])
    panel.open()
    document.querySelector<HTMLButtonElement>('.fav-item-main')!.click()
    expect(onSelect).toHaveBeenCalledWith(poi('1'))
    expect(panel.isOpen()).toBe(false)
  })

  it('clicking remove calls onRemove and re-renders', () => {
    const { panel, onRemove } = mount([poi('1'), poi('2')])
    panel.open()
    document.querySelector<HTMLButtonElement>('.fav-item-remove')!.click()
    expect(onRemove).toHaveBeenCalledWith(poi('1'))
    expect(document.querySelectorAll('.fav-item')).toHaveLength(1)
  })

  it('paginates beyond the page size and advances with next', () => {
    const many = Array.from({ length: 10 }, (_, i) => poi(String(i)))
    const { panel } = mount(many)
    panel.open()
    expect(document.querySelectorAll('.fav-item')).toHaveLength(8) // PAGE_SIZE
    expect(document.querySelector('.fav-page-status')?.textContent).toContain('Seite 1 / 2')
    const [, next] = document.querySelectorAll<HTMLButtonElement>('.fav-page-btn')
    next!.click()
    expect(document.querySelectorAll('.fav-item')).toHaveLength(2)
    expect(document.querySelector('.fav-page-status')?.textContent).toContain('Seite 2 / 2')
  })

  it('has no pagination footer for a single page', () => {
    const { panel } = mount([poi('1')])
    panel.open()
    expect(document.querySelectorAll('.fav-page-btn')).toHaveLength(0)
  })
})
