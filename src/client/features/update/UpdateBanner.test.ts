import { describe, it, expect, beforeEach, vi } from 'vitest'
import { UpdateBanner } from './UpdateBanner.js'

beforeEach(() => {
  document.body.innerHTML = '<header id="topbar"></header>'
})

describe('UpdateBanner', () => {
  it('is hidden until show() and appears right after the topbar', () => {
    const banner = new UpdateBanner()
    expect(document.querySelector('.update-banner')).toBeNull()
    banner.show()
    const el = document.querySelector('.update-banner')!
    expect(el).not.toBeNull()
    expect(el.classList.contains('visible')).toBe(true)
    expect(document.getElementById('topbar')!.nextElementSibling).toBe(el)
  })

  it('the "update now" button runs the wired handler', () => {
    const banner = new UpdateBanner()
    const onUpdate = vi.fn()
    banner.setUpdateHandler(onUpdate)
    banner.show()
    document.querySelector<HTMLButtonElement>('.update-banner-btn')!.click()
    expect(onUpdate).toHaveBeenCalledOnce()
  })

  it('does nothing on click before a handler is wired (no throw)', () => {
    const banner = new UpdateBanner()
    banner.show()
    expect(() => document.querySelector<HTMLButtonElement>('.update-banner-btn')!.click()).not.toThrow()
  })

  it('the close button hides the banner', () => {
    const banner = new UpdateBanner()
    banner.show()
    const el = document.querySelector('.update-banner')!
    expect(el.classList.contains('visible')).toBe(true)
    document.querySelector<HTMLButtonElement>('.update-banner-close')!.click()
    expect(el.classList.contains('visible')).toBe(false)
  })
})
