import { describe, it, expect } from 'vitest'
import { renderNotes, renderNoteText } from './noteRenderer.js'

describe('renderNotes', () => {
  it('returns empty string for no notes', () => {
    expect(renderNotes([])).toBe('')
  })

  it('renders notes with date and text', () => {
    const html = renderNotes([{ id: 1, date: '2026-06-12', text: 'Wasser vorhanden' }])
    expect(html).toContain('Community-Hinweise')
    expect(html).toContain('Wasser vorhanden')
    expect(html).toContain('2026-06-12')
  })
})

describe('renderNoteText', () => {
  it('escapes plain text', () => {
    const r = renderNoteText('<script>xss</script>')
    expect(r).not.toContain('<script>')
    expect(r).toContain('&lt;script&gt;')
  })

  it('renders URLs as clickable links', () => {
    const r = renderNoteText('Siehe https://example.com für Details')
    expect(r).toContain('href="https://example.com"')
    expect(r).toContain('target="_blank"')
  })

  it('renders image URLs as lightbox img tags', () => {
    const r = renderNoteText('Foto: https://example.com/pic.jpg')
    expect(r).toContain('data-lightbox')
    expect(r).toContain('<img')
    expect(r).not.toContain('target="_blank"')
  })

  it('handles mixed text, URLs, and images', () => {
    const r = renderNoteText('Text https://example.com und Bild https://pic.jpg Ende')
    expect(r).toContain('Text')
    expect(r).toContain('target="_blank"')
    expect(r).toContain('data-lightbox')
    expect(r).toContain('Ende')
  })

  it('strips trailing punctuation from URLs', () => {
    const r = renderNoteText('Besuche https://example.com. Danke')
    expect(r).toContain('href="https://example.com"')
  })

  it('handles webp extensions', () => {
    const r = renderNoteText('https://example.com/photo.webp')
    expect(r).toContain('data-lightbox')
  })
})
