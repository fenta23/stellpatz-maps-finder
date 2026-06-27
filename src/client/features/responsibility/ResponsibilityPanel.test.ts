import { describe, it, expect } from 'vitest'
import { ResponsibilityPanel } from './ResponsibilityPanel.js'

const flush = () => new Promise(r => setTimeout(r, 0))

describe('ResponsibilityPanel', () => {
  it('renders motto, kodex and the local rules section', async () => {
    const c = document.createElement('div')
    new ResponsibilityPanel(c)
    await flush()
    expect(c.textContent).toContain('Besser gehen')
    expect(c.textContent).toContain('Kodex')
    expect(c.textContent).toContain('lokale Regeln haben immer Vorrang')
  })

  it('starts hidden and toggles via open()/close()', async () => {
    const c = document.createElement('div')
    const panel = new ResponsibilityPanel(c)
    await flush()
    expect(panel.isOpen()).toBe(false)
    panel.open()
    expect(panel.isOpen()).toBe(true)
    panel.close()
    expect(panel.isOpen()).toBe(false)
  })

  it('closes when the close pill is clicked', async () => {
    const c = document.createElement('div')
    const panel = new ResponsibilityPanel(c)
    await flush()
    panel.open()
    c.querySelector<HTMLButtonElement>('.resp-close')!.click()
    expect(panel.isOpen()).toBe(false)
  })

  it('closes when the CTA button is clicked', async () => {
    const c = document.createElement('div')
    const panel = new ResponsibilityPanel(c)
    await flush()
    panel.open()
    c.querySelector<HTMLButtonElement>('.resp-cta-btn')!.click()
    expect(panel.isOpen()).toBe(false)
  })

  it('closes when the backdrop (overlay) is clicked, not the dialog', async () => {
    const c = document.createElement('div')
    const panel = new ResponsibilityPanel(c)
    await flush()
    panel.open()
    // Klick auf den Dialog-Inhalt schließt NICHT
    c.querySelector<HTMLElement>('.resp-dialog')!.click()
    expect(panel.isOpen()).toBe(true)
    // Klick auf den Overlay/Backdrop schließt
    c.querySelector<HTMLElement>('.resp-panel')!.click()
    expect(panel.isOpen()).toBe(false)
  })

  it('closes on Escape only when open', async () => {
    const c = document.createElement('div')
    const panel = new ResponsibilityPanel(c)
    await flush()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(panel.isOpen()).toBe(false)
    panel.open()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(panel.isOpen()).toBe(false)
  })
})
