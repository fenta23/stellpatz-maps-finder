import { describe, it, expect } from 'vitest'
import { InfoPanel } from './InfoPanel.js'

const flush = () => new Promise(r => setTimeout(r, 0))

describe('InfoPanel', () => {
  it('renders app name, version, and changelog', async () => {
    const c = document.createElement('div')
    new InfoPanel(c)
    await flush()
    expect(c.textContent).toContain('Stellplatz Finder')
    expect(c.textContent).toContain('v0.9.')
    expect(c.textContent).toContain('Changelog')
  })

  it('renders the privacy section with controller and processors', async () => {
    const c = document.createElement('div')
    new InfoPanel(c)
    await flush()
    expect(c.textContent).toContain('Verantwortlicher')
    expect(c.textContent).toContain('Supabase')
    expect(c.textContent).toContain('GitHub Pages')
    expect(c.textContent).toContain('netcup')
    // Routing-Korrektur: kein „selbstgehosteter" Dienst, sondern Valhalla
    expect(c.textContent).not.toContain('selbstgehosteten Routing-Dienst')
    expect(c.textContent).toContain('Valhalla')
  })

  it('open and close via class', async () => {
    const c = document.createElement('div')
    const panel = new InfoPanel(c)
    await flush()
    expect(panel.isOpen()).toBe(false)
    panel.open()
    expect(panel.isOpen()).toBe(true)
    panel.close()
    expect(panel.isOpen()).toBe(false)
  })

  it('closes when the X button is clicked', async () => {
    const c = document.createElement('div')
    const panel = new InfoPanel(c)
    await flush()
    panel.open()
    expect(panel.isOpen()).toBe(true)
    c.querySelector<HTMLButtonElement>('.fav-close')!.click()
    expect(panel.isOpen()).toBe(false)
  })
})
