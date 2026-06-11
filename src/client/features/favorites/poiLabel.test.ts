import { describe, it, expect } from 'vitest'
import { favoriteLabel, typeIcon, typeLabel, toFavoritePoi, favoriteToPoi } from './poiLabel.js'
import type { OsmPoi } from '@/features/pois/OverpassClient.js'

describe('poiLabel helpers', () => {
  it('maps type to icon + label', () => {
    expect(typeIcon('camper')).toMatch(/^<svg /)
    expect(typeLabel('campsite')).toBe('Campingplatz')
  })

  it('favoriteLabel uses the name, falling back to the type label', () => {
    expect(favoriteLabel({ id: '1', type: 'parking', name: 'Marktplatz', lat: 1, lon: 2 })).toBe('Marktplatz')
    expect(favoriteLabel({ id: '1', type: 'water', name: '  ', lat: 1, lon: 2 })).toBe('Wasser')
  })

  it('toFavoritePoi snapshots id/type/name/coords', () => {
    const poi: OsmPoi = { id: 42, type: 'camper', lat: 50.1, lon: 8.2, tags: { name: 'Wohnmobilhafen' } }
    expect(toFavoritePoi(poi)).toEqual({ id: '42', type: 'camper', name: 'Wohnmobilhafen', lat: 50.1, lon: 8.2 })
  })

  it('toFavoritePoi tolerates a missing name', () => {
    const poi: OsmPoi = { id: 7, type: 'parking', lat: 1, lon: 2, tags: {} }
    expect(toFavoritePoi(poi).name).toBe('')
  })

  it('favoriteToPoi round-trips back to a routable OsmPoi', () => {
    const fav = { id: '42', type: 'camper' as const, name: 'Hafen', lat: 50.1, lon: 8.2 }
    expect(favoriteToPoi(fav)).toEqual({ id: 42, type: 'camper', lat: 50.1, lon: 8.2, tags: { name: 'Hafen' } })
  })
})
