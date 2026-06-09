import { describe, it, expect } from 'vitest'
import { typeIcon, typeLabel } from './poiMeta.js'

describe('poiMeta', () => {
  it('maps each POI type to an icon + label', () => {
    expect(typeIcon('parking')).toBe('🅿️')
    expect(typeIcon('camper')).toBe('🚐')
    expect(typeLabel('campsite')).toBe('Campingplatz')
    expect(typeLabel('dump')).toBe('Entsorgung')
    expect(typeLabel('water')).toBe('Wasser')
  })
})
