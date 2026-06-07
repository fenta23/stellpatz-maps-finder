import { describe, it, expect } from 'vitest'
import { computePan } from './panIntoView.js'

const base = { mapWidth: 1000, mapTop: 160, viewportHeight: 800 }

describe('computePan — mobile (bottom sheet)', () => {
  it('pans a POI hidden behind the sheet upward (dy > 0)', () => {
    const { dx, dy } = computePan({ ...base, isMobile: true, poi: { x: 180, y: 620 } })
    expect(dx).toBe(0)
    expect(dy).toBeGreaterThan(0)
  })

  it('leaves a POI already above the sheet untouched (dy = 0)', () => {
    const { dx, dy } = computePan({ ...base, isMobile: true, poi: { x: 180, y: 30 } })
    expect(dx).toBe(0)
    expect(dy).toBe(0)
  })
})

describe('computePan — desktop (side panel)', () => {
  it('pans a POI behind the right-side panel leftward (dx > 0)', () => {
    const { dx, dy } = computePan({ ...base, isMobile: false, poi: { x: 950, y: 400 } })
    expect(dy).toBe(0)
    expect(dx).toBeGreaterThan(0)
  })

  it('leaves a POI already in the visible left strip untouched (dx = 0)', () => {
    const { dx, dy } = computePan({ ...base, isMobile: false, poi: { x: 100, y: 400 } })
    expect(dx).toBe(0)
    expect(dy).toBe(0)
  })
})
