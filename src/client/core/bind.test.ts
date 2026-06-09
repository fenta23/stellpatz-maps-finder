import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderList } from './bind.js'
import { clone } from './template.js'

const LIST = `
  <ul data-list>
    <template data-row>
      <li class="row">
        <button class="main" data-on="select">
          <span class="name" data-text="name"></span>
          <span class="sub" data-text="sub"></span>
        </button>
        <button class="del" data-on="remove">x</button>
      </li>
    </template>
    <li class="empty" data-empty>nothing yet</li>
  </ul>`

let ul: HTMLElement
beforeEach(() => { ul = clone(LIST) })

describe('renderList', () => {
  it('clones the row template per item and binds data-text', () => {
    renderList(ul, [{ n: 'A' }, { n: 'B' }], { row: i => ({ name: i.n, sub: 'x' }) })
    const names = [...ul.querySelectorAll('.name')].map(e => e.textContent)
    expect(ul.querySelectorAll('.row')).toHaveLength(2)
    expect(names).toEqual(['A', 'B'])
  })

  it('hides the empty marker when there are items, shows it when none', () => {
    const empty = ul.querySelector<HTMLElement>('[data-empty]')!
    renderList(ul, [{ n: 'A' }], { row: i => ({ name: i.n }) })
    expect(empty.hidden).toBe(true)
    renderList(ul, [], { row: i => ({ name: (i as { n: string }).n }) })
    expect(empty.hidden).toBe(false)
    expect(ul.querySelectorAll('.row')).toHaveLength(0)
  })

  it('wires data-on handlers with the source item', () => {
    const select = vi.fn()
    const remove = vi.fn()
    const items = [{ id: 1 }, { id: 2 }]
    renderList(ul, items, { row: () => ({}), on: { select, remove } })
    ul.querySelectorAll<HTMLButtonElement>('.main')[1]!.click()
    ul.querySelectorAll<HTMLButtonElement>('.del')[0]!.click()
    expect(select).toHaveBeenCalledWith(items[1])
    expect(remove).toHaveBeenCalledWith(items[0])
  })

  it('replaces rows on re-render (keeps template + empty marker)', () => {
    renderList(ul, [{ n: 'A' }, { n: 'B' }], { row: i => ({ name: i.n }) })
    renderList(ul, [{ n: 'C' }], { row: i => ({ name: i.n }) })
    expect([...ul.querySelectorAll('.name')].map(e => e.textContent)).toEqual(['C'])
    expect(ul.querySelector('template[data-row]')).not.toBeNull()
    expect(ul.querySelector('[data-empty]')).not.toBeNull()
  })

  it('runs the decorate hook per row', () => {
    renderList(ul, [{ n: 'A' }], {
      row: i => ({ name: i.n }),
      decorate: (rowEl, item) => rowEl.setAttribute('data-id', String((item as { n: string }).n)),
    })
    expect(ul.querySelector('.row')?.getAttribute('data-id')).toBe('A')
  })

  it('throws when the row template is missing', () => {
    const bare = clone('<ul data-list></ul>')
    expect(() => renderList(bare, [{}], { row: () => ({}) })).toThrow(/template data-row/)
  })
})
