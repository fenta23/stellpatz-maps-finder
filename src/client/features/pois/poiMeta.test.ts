import { describe, it, expect } from 'vitest'
import { typeIcon, typeLabel } from './poiMeta.js'

describe('poiMeta', () => {
  it('returns SVG string for each POI type', () => {
    expect(typeIcon('parking')).toMatch(/^<svg /)
    expect(typeIcon('camper')).toContain('stroke="currentColor"')
    expect(typeIcon('campsite')).toContain('<path')
    expect(typeIcon('dump')).toContain('<path')
    expect(typeIcon('water')).toContain('<path')
    expect(typeIcon('climbing')).toMatch(/^<svg /)
    expect(typeIcon('climbing')).toContain('<path')
  })

  it('returns label for each POI type', () => {
    expect(typeLabel('campsite')).toBe('Campingplatz')
    expect(typeLabel('dump')).toBe('Entsorgung')
    expect(typeLabel('water')).toBe('Wasser')
    expect(typeLabel('climbing')).toBe('Klettergebiet')
  })
})
