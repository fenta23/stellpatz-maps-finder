import { describe, it, expect, afterEach, vi } from 'vitest'
import { wikimediaTitle, wikimediaApiUrl, resolveWikimediaImage } from './poiData.js'

afterEach(() => vi.unstubAllGlobals())

describe('wikimediaTitle', () => {
  it('prefixes a bare filename with File:', () => expect(wikimediaTitle('Foo.jpg')).toBe('File:Foo.jpg'))
  it('keeps an existing File: prefix', () => expect(wikimediaTitle('File:Foo.jpg')).toBe('File:Foo.jpg'))
  it('keeps a Category: prefix', () => expect(wikimediaTitle('Category:Bar')).toBe('Category:Bar'))
})

describe('wikimediaApiUrl', () => {
  it('targets the commons API and encodes the title', () => {
    const url = wikimediaApiUrl('File:Schöne Hütte.jpg')
    expect(url).toContain('commons.wikimedia.org/w/api.php')
    expect(url).toContain(encodeURIComponent('File:Schöne Hütte.jpg'))
  })
})

describe('resolveWikimediaImage', () => {
  it('maps an imageinfo thumbnail to a PoiImage', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ query: { pages: { '1': { imageinfo: [{ url: 'u', thumburl: 'https://thumb/x.jpg' }] } } } }),
    }))
    const img = await resolveWikimediaImage('Foo.jpg')
    expect(img).toMatchObject({ src: 'https://thumb/x.jpg', caption: 'Wikimedia Commons' })
    expect(img?.link).toContain('commons.wikimedia.org/wiki/')
  })

  it('returns null when there is no thumbnail', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: () => Promise.resolve({ query: { pages: {} } }) }))
    expect(await resolveWikimediaImage('Foo.jpg')).toBeNull()
  })

  it('returns null on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    expect(await resolveWikimediaImage('Foo.jpg')).toBeNull()
  })
})
