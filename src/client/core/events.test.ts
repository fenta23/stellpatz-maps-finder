import { describe, it, expect, vi } from 'vitest'
import { createEventScope } from './events.js'

describe('createEventScope', () => {
  it('fires registered listeners', () => {
    const scope = createEventScope()
    const handler = vi.fn()
    const el = document.createElement('div')
    scope.on(el, 'click', handler)
    el.click()
    expect(handler).toHaveBeenCalledOnce()
  })

  it('dispose() stops all listeners from firing', () => {
    const scope = createEventScope()
    const handler = vi.fn()
    const el = document.createElement('div')
    scope.on(el, 'click', handler)
    scope.dispose()
    el.click()
    expect(handler).not.toHaveBeenCalled()
  })

  it('dispose() removes listeners across multiple targets', () => {
    const scope = createEventScope()
    const h1 = vi.fn()
    const h2 = vi.fn()
    const el1 = document.createElement('div')
    const el2 = document.createElement('button')
    scope.on(el1, 'click', h1)
    scope.on(el2, 'click', h2)
    scope.dispose()
    el1.click()
    el2.click()
    expect(h1).not.toHaveBeenCalled()
    expect(h2).not.toHaveBeenCalled()
  })

  it('dispose() is idempotent', () => {
    const scope = createEventScope()
    expect(() => { scope.dispose(); scope.dispose() }).not.toThrow()
  })

  it('listeners added to document are removed on dispose()', () => {
    const scope = createEventScope()
    const handler = vi.fn()
    scope.on(document, 'keydown', handler)
    scope.dispose()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(handler).not.toHaveBeenCalled()
  })

  it('provides typed event in handler', () => {
    const scope = createEventScope()
    let capturedKey = ''
    const el = document.createElement('input')
    scope.on(document, 'keydown', (e) => { capturedKey = e.key })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    scope.dispose()
    expect(capturedKey).toBe('Enter')
  })
})
