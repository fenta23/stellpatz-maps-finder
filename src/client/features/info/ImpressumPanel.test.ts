import { describe, it, expect } from 'vitest'
import { ImpressumPanel } from './ImpressumPanel.js'

describe('ImpressumPanel', () => {
  it('renders imprint content', () => {
    const c = document.createElement('div')
    new ImpressumPanel(c)
    expect(c.textContent).toContain('Verantwortlich')
    expect(c.textContent).toContain('Open-Source-Projekt')
    expect(c.textContent).toContain('GitHub-Issue')
  })

  it('starts closed and opens/closes', () => {
    const c = document.createElement('div')
    const panel = new ImpressumPanel(c)
    expect(panel.isOpen()).toBe(false)
    panel.open()
    expect(panel.isOpen()).toBe(true)
    panel.close()
    expect(panel.isOpen()).toBe(false)
  })

  it('closes when the X button is clicked', () => {
    const c = document.createElement('div')
    const panel = new ImpressumPanel(c)
    panel.open()
    c.querySelector<HTMLButtonElement>('.fav-close')!.click()
    expect(panel.isOpen()).toBe(false)
  })
})
