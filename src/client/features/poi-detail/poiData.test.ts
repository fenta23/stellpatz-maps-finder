import { describe, it, expect, afterEach, vi } from 'vitest'
import { wikimediaTitle, wikimediaApiUrl, resolveWikimediaImage, collectTagImages } from './poiData.js'

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

describe('collectTagImages', () => {
  type POI = Parameters<typeof collectTagImages>[0]
  const base: POI = { id: 1, type: 'campsite', lat: 0, lon: 0, tags: {} }

  it('finds the image tag', async () => {
    const r = await collectTagImages({ ...base, tags: { image: 'https://example.com/photo.jpg' } })
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ src: 'https://example.com/photo.jpg', caption: 'OSM' })
  })

  it('collects numbered image:0, image:1 … tags', async () => {
    const r = await collectTagImages({
      ...base,
      tags: { 'image:0': 'https://example.com/a.jpg', 'image:1': 'https://example.com/b.jpg' },
    })
    expect(r).toHaveLength(2)
  })

  it('collects named variants (panorama, 360, aerial, photo)', async () => {
    const r = await collectTagImages({
      ...base,
      tags: { 'image:panorama': 'https://pano', 'image:aerial': 'https://drone', photo: 'https://pic' },
    })
    expect(r).toHaveLength(3)
    expect(r[0].caption).toBe('Panorama')
    expect(r[1].caption).toBe('Luftbild')
  })

  it('does not break on missing tags', async () => {
    const r = await collectTagImages(base)
    expect(r).toHaveLength(0)
  })
})
