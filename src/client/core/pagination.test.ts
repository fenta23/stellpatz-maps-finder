import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderPagination } from './pagination.js'

let footer: HTMLElement
beforeEach(() => { footer = document.createElement('div') })

describe('renderPagination', () => {
  it('stays empty for a single page', () => {
    renderPagination(footer, 1, 1, 5, vi.fn())
    expect(footer.children).toHaveLength(0)
  })

  it('renders prev / status / next with the right text', () => {
    renderPagination(footer, 2, 3, 23, vi.fn())
    expect(footer.querySelectorAll('.fav-page-btn')).toHaveLength(2)
    expect(footer.querySelector('.fav-page-status')?.textContent).toBe('Seite 2 / 3 · 23')
  })

  it('disables prev on the first page and next on the last', () => {
    renderPagination(footer, 1, 3, 23, vi.fn())
    const [prev, next] = footer.querySelectorAll<HTMLButtonElement>('.fav-page-btn')
    expect(prev!.disabled).toBe(true)
    expect(next!.disabled).toBe(false)

    renderPagination(footer, 3, 3, 23, vi.fn())
    const [prev2, next2] = footer.querySelectorAll<HTMLButtonElement>('.fav-page-btn')
    expect(prev2!.disabled).toBe(false)
    expect(next2!.disabled).toBe(true)
  })

  it('calls onGo with the neighbouring page', () => {
    const onGo = vi.fn()
    renderPagination(footer, 2, 3, 23, onGo)
    const [prev, next] = footer.querySelectorAll<HTMLButtonElement>('.fav-page-btn')
    prev!.click()
    next!.click()
    expect(onGo).toHaveBeenNthCalledWith(1, 1)
    expect(onGo).toHaveBeenNthCalledWith(2, 3)
  })

  it('clears previous content on re-render', () => {
    renderPagination(footer, 2, 3, 23, vi.fn())
    renderPagination(footer, 1, 1, 1, vi.fn()) // single page → empty
    expect(footer.children).toHaveLength(0)
  })
})
