import { describe, it, expect, vi } from 'vitest'
import { PoiDetailPanel } from './PoiDetailPanel.js'
import type { OsmPoi } from '@/features/pois/OverpassClient.js'

const poi: OsmPoi = {
  id: 1,
  type: 'campsite',
  lat: 48.1,
  lon: 11.2,
  tags: {
    name: 'Testcamp',
    opening_hours: 'Mo-Su 08:00-22:00',
    fee: 'yes',
    website: 'https://example.com',
  },
}

describe('PoiDetailPanel', () => {
  it('renders name from tags', () => {
    const container = document.createElement('div')
    const panel = new PoiDetailPanel(container)
    panel.show(poi)
    expect(container.querySelector('h2')?.textContent).toBe('Testcamp')
  })

  it('is hidden initially', () => {
    const container = document.createElement('div')
    new PoiDetailPanel(container)
    expect(container.querySelector('.poi-detail-panel')?.classList.contains('hidden')).toBe(true)
  })

  it('becomes visible on show()', () => {
    const container = document.createElement('div')
    const panel = new PoiDetailPanel(container)
    panel.show(poi)
    expect(container.querySelector('.poi-detail-panel')?.classList.contains('hidden')).toBe(false)
  })

  it('hides on close button click', () => {
    const container = document.createElement('div')
    const panel = new PoiDetailPanel(container)
    panel.show(poi)
    container.querySelector<HTMLButtonElement>('.btn-close')?.click()
    expect(container.querySelector('.poi-detail-panel')?.classList.contains('hidden')).toBe(true)
  })

  it('fires onNavigate listener on navigate button click', () => {
    const container = document.createElement('div')
    const panel = new PoiDetailPanel(container)
    const cb = vi.fn()
    panel.onNavigate(cb)
    panel.show(poi)
    container.querySelector<HTMLButtonElement>('.btn-navigate')?.click()
    expect(cb).toHaveBeenCalledWith({ poi })
  })

  it('shows route summary when route provided', () => {
    const container = document.createElement('div')
    const panel = new PoiDetailPanel(container)
    panel.show(poi, {
      distanceMeters: 15_000,
      durationSeconds: 900,
      distanceText: '15,0 km',
      durationText: '15 min',
      straightLineMeters: 12_000,
      detourFactor: 1.25,
    })
    expect(container.querySelector('.route-summary')).not.toBeNull()
    expect(container.querySelector('.route-summary')?.textContent).toContain('15 min')
  })

  it('hides on Escape key when panel is open', () => {
    const container = document.createElement('div')
    const panel = new PoiDetailPanel(container)
    panel.show(poi)
    expect(container.querySelector('.poi-detail-panel')?.classList.contains('hidden')).toBe(false)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(container.querySelector('.poi-detail-panel')?.classList.contains('hidden')).toBe(true)
  })

  it('does not hide on Escape when panel is already closed', () => {
    const container = document.createElement('div')
    const panel = new PoiDetailPanel(container)
    const cb = vi.fn()
    panel.onClose(cb)
    // panel never shown — ESC should be a no-op
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(cb).not.toHaveBeenCalled()
  })

  it('fires onClose listener when Escape is pressed', () => {
    const container = document.createElement('div')
    const panel = new PoiDetailPanel(container)
    const cb = vi.fn()
    panel.onClose(cb)
    panel.show(poi)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(cb).toHaveBeenCalledOnce()
  })

  it('does not close panel when lightbox is open', () => {
    const container = document.createElement('div')
    const panel = new PoiDetailPanel(container)
    panel.show(poi)

    // Simulate an open lightbox
    const lb = document.createElement('div')
    lb.id = 'poi-lightbox'
    document.body.appendChild(lb) // no 'hidden' class → lightbox is open

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(container.querySelector('.poi-detail-panel')?.classList.contains('hidden')).toBe(false)

    document.body.removeChild(lb)
  })

  it('renders tag rows into the table', () => {
    const container = document.createElement('div')
    new PoiDetailPanel(container).show(poi)
    const rows = container.querySelectorAll('.poi-tags tr')
    const text = [...rows].map(r => r.textContent?.replace(/\s+/g, ' ').trim())
    expect(text).toContain('Typ Campingplatz')
    expect(text.some(t => t?.startsWith('Gebühr'))).toBe(true)
  })

  it('renders a website tag as a safe anchor', () => {
    const container = document.createElement('div')
    new PoiDetailPanel(container).show(poi)
    const a = container.querySelector<HTMLAnchorElement>('.poi-tags a')
    expect(a?.getAttribute('href')).toBe('https://example.com')
    expect(a?.textContent).toContain('Öffnen')
    expect(a?.target).toBe('_blank')
  })

  it('neutralises a javascript: URL in a website tag', () => {
    const container = document.createElement('div')
    new PoiDetailPanel(container).show({ ...poi, tags: { ...poi.tags, website: 'javascript:alert(1)' } })
    expect(container.querySelector<HTMLAnchorElement>('.poi-tags a')?.getAttribute('href')).toBe('#')
  })

  it('prefills the personal note textarea', () => {
    const container = document.createElement('div')
    new PoiDetailPanel(container).show(poi, undefined, undefined, false, 'Tor links')
    expect(container.querySelector<HTMLTextAreaElement>('.mynote-input')?.value).toBe('Tor links')
  })

  it('renders nearby items as clickable rows and fires onNearbySelect', () => {
    const container = document.createElement('div')
    const panel = new PoiDetailPanel(container)
    const cb = vi.fn()
    panel.onNearbySelect(cb)
    panel.show(poi)
    const item = { kind: 'bakery', icon: '🥐', name: 'Bäcker', distance: 300, lat: 48.2, lon: 11.3 }
    panel.updateNearby([item])
    const row = container.querySelector<HTMLButtonElement>('.nearby-item')
    expect(row).not.toBeNull()
    row!.click()
    expect(cb).toHaveBeenCalledWith(item)
    expect(row!.classList.contains('active')).toBe(true)
  })

  it('escapes HTML in tag values', () => {
    const container = document.createElement('div')
    const panel = new PoiDetailPanel(container)
    panel.show({ ...poi, tags: { ...poi.tags, operator: '<script>xss</script>' } })
    expect(container.innerHTML).not.toContain('<script>')
    expect(container.innerHTML).toContain('&lt;script&gt;')
  })
})
