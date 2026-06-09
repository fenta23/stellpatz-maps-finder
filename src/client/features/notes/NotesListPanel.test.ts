import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NotesListPanel } from './NotesListPanel.js'
import type { PoiNote } from './NotesStore.js'

const note = (id: string, text = `Notiz ${id}`): PoiNote =>
  ({ id, type: 'parking', name: `Platz ${id}`, lat: 50, lon: 8, text })

beforeEach(() => { document.body.innerHTML = '' })

function mount(initial: PoiNote[]) {
  let items = initial
  const onSelect = vi.fn()
  const onRemove = vi.fn((n: PoiNote) => { items = items.filter(p => p.id !== n.id) })
  const panel = new NotesListPanel(document.body, { getNotes: () => items, onSelect, onRemove })
  return { panel, onSelect, onRemove }
}

describe('NotesListPanel', () => {
  it('is hidden until opened', () => {
    const { panel } = mount([note('1')])
    expect(panel.isOpen()).toBe(false)
    panel.open()
    expect(panel.isOpen()).toBe(true)
  })

  it('renders a row per note with the note text as subtitle', () => {
    const { panel } = mount([note('1', 'Tor links'), note('2')])
    panel.open()
    expect(document.querySelectorAll('.fav-item')).toHaveLength(2)
    expect(document.querySelector('.fav-item-name')?.textContent).toBe('Platz 1')
    expect(document.querySelector('.fav-item-sub')?.textContent).toBe('Tor links')
  })

  it('shows an empty state when there are no notes', () => {
    const { panel } = mount([])
    panel.open()
    expect(document.querySelector('.fav-empty')).not.toBeNull()
  })

  it('clicking a row calls onSelect and closes', () => {
    const { panel, onSelect } = mount([note('1')])
    panel.open()
    document.querySelector<HTMLButtonElement>('.fav-item-main')!.click()
    expect(onSelect).toHaveBeenCalledWith(note('1'))
    expect(panel.isOpen()).toBe(false)
  })

  it('clicking remove calls onRemove and re-renders', () => {
    const { panel, onRemove } = mount([note('1'), note('2')])
    panel.open()
    document.querySelector<HTMLButtonElement>('.fav-item-remove')!.click()
    expect(onRemove).toHaveBeenCalledWith(note('1'))
    expect(document.querySelectorAll('.fav-item')).toHaveLength(1)
  })

  it('paginates beyond 8 entries', () => {
    const { panel } = mount(Array.from({ length: 10 }, (_, i) => note(String(i))))
    panel.open()
    expect(document.querySelectorAll('.fav-item')).toHaveLength(8)
    expect(document.querySelector('.fav-page-status')?.textContent).toContain('Seite 1 / 2')
  })
})
