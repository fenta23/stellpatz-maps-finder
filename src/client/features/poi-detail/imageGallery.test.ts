import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderImages, getLightbox, showLightbox, hideLightbox } from './imageGallery.js'

afterEach(() => {
  const lb = document.getElementById('poi-lightbox')
  if (lb) lb.remove()
})

describe('renderImages', () => {
  it('renders an image strip with thumbnails', () => {
    const html = renderImages([{ src: 'https://example.com/pic.jpg', caption: 'Test' }])
    expect(html).toContain('poi-img-strip')
    expect(html).toContain('poi-img-thumb')
    expect(html).toContain('Test')
  })

  it('renders a link when PoiImage has a link', () => {
    const html = renderImages([{ src: 'https://example.com/pic.jpg', link: 'https://wikimedia.org/wiki/File', caption: 'WMC' }])
    expect(html).toContain('target="_blank"')
    expect(html).toContain('wikimedia.org')
  })

  it('renders without a link when no link present', () => {
    const html = renderImages([{ src: 'https://example.com/pic.jpg' }])
    expect(html).not.toContain('target="_blank"')
  })

  it('escapes HTML in src and caption', () => {
    const html = renderImages([{ src: 'https://x.com/a&b.jpg', caption: '<tag>' }])
    expect(html).toContain('a&amp;b.jpg')
    expect(html).toContain('&lt;tag&gt;')
    expect(html).not.toContain('<tag>')
  })
})

describe('getLightbox', () => {
  it('creates and returns the lightbox element', () => {
    const lb = getLightbox()
    expect(lb.id).toBe('poi-lightbox')
    expect(lb.classList.contains('hidden')).toBe(true)
  })

  it('returns the same element on subsequent calls', () => {
    const a = getLightbox()
    const b = getLightbox()
    expect(a).toBe(b)
  })
})

describe('showLightbox / hideLightbox', () => {
  it('shows and hides the lightbox', () => {
    showLightbox('https://example.com/img.jpg')
    const lb = document.getElementById('poi-lightbox')!
    expect(lb.classList.contains('hidden')).toBe(false)
    expect(lb.querySelector<HTMLImageElement>('.lightbox-img')!.src).toBe('https://example.com/img.jpg')

    hideLightbox()
    expect(lb.classList.contains('hidden')).toBe(true)
  })

  it('hideLightbox is a no-op when no lightbox exists', () => {
    expect(() => hideLightbox()).not.toThrow()
  })
})
