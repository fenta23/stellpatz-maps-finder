import { describe, it, expect } from 'vitest'
import { nearbyRouteMessage } from './nearbyMessage.js'
import type { NearbyItem } from './PoiDetailPanel.js'
import type { RouteResult } from '@/features/routing/DirectionsService.js'

const item: NearbyItem = { kind: 'fuel', name: 'Esso', distance: 545, lat: 48.1, lon: 11.5 }
const route = {
  distanceText: '540 m', durationText: '7 min',
  distanceMeters: 540, durationSeconds: 420, straightLineMeters: 500, detourFactor: 1.1,
} as RouteResult

describe('nearbyRouteMessage', () => {
  it('shows name · distance · duration zu Fuß', () => {
    expect(nearbyRouteMessage(item, route)).toBe('Esso · 540 m · 7 min zu Fuß')
  })

  it('never contains "undefined" (regression: the old item.icon bug)', () => {
    expect(nearbyRouteMessage(item, route)).not.toContain('undefined')
  })
})
