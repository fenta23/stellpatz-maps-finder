import { describe, it, expect } from 'vitest'
import { DatenschutzPanel } from './DatenschutzPanel.js'

describe('DatenschutzPanel', () => {
  it('renders privacy content with controller and processors', () => {
    const c = document.createElement('div')
    new DatenschutzPanel(c)
    expect(c.textContent).toContain('Verantwortlicher')
    expect(c.textContent).toContain('Supabase')
    expect(c.textContent).toContain('GitHub Pages')
    expect(c.textContent).toContain('netcup')
    expect(c.textContent).toContain('Valhalla')
    expect(c.textContent).not.toContain('selbstgehosteten Routing-Dienst')
  })

  it('starts closed and opens/closes', () => {
    const c = document.createElement('div')
    const panel = new DatenschutzPanel(c)
    expect(panel.isOpen()).toBe(false)
    panel.open()
    expect(panel.isOpen()).toBe(true)
    panel.close()
    expect(panel.isOpen()).toBe(false)
  })

  it('closes when the X button is clicked', () => {
    const c = document.createElement('div')
    const panel = new DatenschutzPanel(c)
    panel.open()
    c.querySelector<HTMLButtonElement>('.fav-close')!.click()
    expect(panel.isOpen()).toBe(false)
  })
})
