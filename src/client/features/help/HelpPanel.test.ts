import { describe, it, expect, vi } from 'vitest'
import { HelpPanel } from './HelpPanel.js'

const flush = () => new Promise(r => setTimeout(r, 0))

describe('HelpPanel', () => {
  it('starts hidden', async () => {
    const c = document.createElement('div')
    new HelpPanel(c, vi.fn())
    await flush()
    expect(c.querySelector('.help-panel')!.classList.contains('open')).toBe(false)
  })

  it('open() and close() toggle visibility', async () => {
    const c = document.createElement('div')
    const panel = new HelpPanel(c, vi.fn())
    await flush()
    expect(panel.isOpen()).toBe(false)
    panel.open()
    expect(panel.isOpen()).toBe(true)
    panel.close()
    expect(panel.isOpen()).toBe(false)
  })

  it('programmatic close() does NOT call onDismiss', async () => {
    const c = document.createElement('div')
    const onDismiss = vi.fn()
    const panel = new HelpPanel(c, onDismiss)
    await flush()
    panel.open()
    panel.close()
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('CTA button calls onDismiss and closes the panel', async () => {
    const c = document.createElement('div')
    const onDismiss = vi.fn()
    const panel = new HelpPanel(c, onDismiss)
    await flush()
    panel.open()
    c.querySelector<HTMLButtonElement>('[data-ref="start"]')!.click()
    expect(onDismiss).toHaveBeenCalledOnce()
    expect(panel.isOpen()).toBe(false)
  })

  it('X button calls onDismiss and closes the panel', async () => {
    const c = document.createElement('div')
    const onDismiss = vi.fn()
    const panel = new HelpPanel(c, onDismiss)
    await flush()
    panel.open()
    c.querySelector<HTMLButtonElement>('.help-skip')!.click()
    expect(onDismiss).toHaveBeenCalledOnce()
    expect(panel.isOpen()).toBe(false)
  })

  it('Escape key calls onDismiss and closes the panel', async () => {
    const c = document.createElement('div')
    const onDismiss = vi.fn()
    const panel = new HelpPanel(c, onDismiss)
    await flush()
    panel.open()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(onDismiss).toHaveBeenCalledOnce()
    expect(panel.isOpen()).toBe(false)
  })

  it('Escape does nothing when panel is closed', async () => {
    const c = document.createElement('div')
    const onDismiss = vi.fn()
    new HelpPanel(c, onDismiss)
    await flush()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(onDismiss).not.toHaveBeenCalled()
  })
})
