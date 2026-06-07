import { describe, it, expect, vi } from 'vitest'
import { PoiMarkerManager, svgToDataUrl, buildIcon } from './PoiMarkerManager.js'
import type { MapAdapter, MarkerHandle } from './PoiMarkerManager.js'
import type { OsmPoi } from './OverpassClient.js'

function makeHandle(): MarkerHandle & { visible: boolean; removed: boolean; icon: string } {
  return {
    visible: true,
    removed: false,
    icon: '',
    setVisible(v) { this.visible = v },
    remove() { this.removed = true },
    updateIcon(i) { this.icon = i },
  }
}

function makeAdapter(): MapAdapter & { handles: ReturnType<typeof makeHandle>[] } {
  const handles: ReturnType<typeof makeHandle>[] = []
  return {
    handles,
    createMarker({ onClick, icon }) {
      const handle = makeHandle()
      handle.icon = icon
      handles.push(handle)
      void onClick
      return handle
    },
  }
}

const poi = (id: number, type: OsmPoi['type'] = 'parking', access?: string): OsmPoi => ({
  id,
  type,
  lat: 48 + id * 0.01,
  lon: 11 + id * 0.01,
  tags: access !== undefined ? { name: `POI ${id}`, access } : { name: `POI ${id}` },
})

describe('PoiMarkerManager', () => {
  it('adds markers for new POIs', () => {
    const adapter = makeAdapter()
    const mgr = new PoiMarkerManager(adapter, vi.fn())
    mgr.updatePois([poi(1), poi(2)])
    expect(mgr.count).toBe(2)
    expect(adapter.handles).toHaveLength(2)
  })

  it('does not add duplicate markers for same id', () => {
    const adapter = makeAdapter()
    const mgr = new PoiMarkerManager(adapter, vi.fn())
    mgr.updatePois([poi(1)])
    mgr.updatePois([poi(1), poi(2)])
    expect(mgr.count).toBe(2)
    expect(adapter.handles).toHaveLength(2)
  })

  it('removes markers no longer in result set', () => {
    const adapter = makeAdapter()
    const mgr = new PoiMarkerManager(adapter, vi.fn())
    mgr.updatePois([poi(1), poi(2)])
    mgr.updatePois([poi(2)])
    expect(mgr.count).toBe(1)
    expect(adapter.handles[0]?.removed).toBe(true)
    expect(adapter.handles[1]?.removed).toBe(false)
  })

  it('calls onSelect with correct poi on marker click', () => {
    const onSelect = vi.fn()
    let capturedClick: (() => void) | undefined
    const adapter: MapAdapter = {
      createMarker({ onClick }) {
        capturedClick = onClick
        return makeHandle()
      },
    }
    const mgr = new PoiMarkerManager(adapter, onSelect)
    const p = poi(5)
    mgr.updatePois([p])
    capturedClick?.()
    expect(onSelect).toHaveBeenCalledWith(p)
  })

  it('setTypeVisible hides/shows markers of that type', () => {
    const adapter = makeAdapter()
    const mgr = new PoiMarkerManager(adapter, vi.fn(), new Set(['parking', 'campsite']))
    mgr.updatePois([poi(1, 'parking'), poi(2, 'campsite')])
    // both visible initially (both types active)
    expect(adapter.handles[0]?.visible).toBe(true)
    expect(adapter.handles[1]?.visible).toBe(true)

    mgr.setTypeVisible('parking', false)
    expect(adapter.handles[0]?.visible).toBe(false)
    expect(adapter.handles[1]?.visible).toBe(true)

    mgr.setTypeVisible('parking', true)
    expect(adapter.handles[0]?.visible).toBe(true)
  })

  it('getActiveTypes reflects toggles', () => {
    const mgr = new PoiMarkerManager(makeAdapter(), vi.fn())
    expect(mgr.getActiveTypes().has('parking')).toBe(true)
    mgr.setTypeVisible('parking', false)
    expect(mgr.getActiveTypes().has('parking')).toBe(false)
  })

  it('clear removes all markers', () => {
    const adapter = makeAdapter()
    const mgr = new PoiMarkerManager(adapter, vi.fn())
    mgr.updatePois([poi(1), poi(2), poi(3)])
    mgr.clear()
    expect(mgr.count).toBe(0)
    expect(adapter.handles.every(h => h.removed)).toBe(true)
  })
})

describe('svgToDataUrl', () => {
  it('produces a data URL', () => {
    const url = svgToDataUrl('<svg></svg>')
    expect(url).toMatch(/^data:image\/svg\+xml;charset=utf-8,/)
  })
})

describe('buildIcon', () => {
  it('returns base SVG when not favorited', () => {
    const svg = buildIcon('parking', false)
    expect(svg).not.toContain('♥')
  })

  it('injects heart badge when favorited', () => {
    const svg = buildIcon('parking', true)
    expect(svg).toContain('♥')
    expect(svg).toContain('#E53935')
  })

  it('heart badge works for all poi types', () => {
    for (const type of ['parking', 'camper', 'campsite', 'dump', 'water'] as const) {
      expect(buildIcon(type, true)).toContain('♥')
    }
  })

  it('uses the blue icon for public parking', () => {
    const svg = buildIcon('parking', false, false)
    expect(svg).toContain('#1565C0')
    expect(svg).not.toContain('#616161')
  })

  it('uses the grey icon plus lock badge for private parking', () => {
    const svg = buildIcon('parking', false, true)
    expect(svg).toContain('#616161') // grey fill + lock
    expect(svg).not.toContain('#1565C0')
  })

  it('combines lock and heart badges for a favorited private parking', () => {
    const svg = buildIcon('parking', true, true)
    expect(svg).toContain('♥')
    expect(svg).toContain('#616161')
  })

  it('ignores isPrivate for non-parking types', () => {
    const svg = buildIcon('campsite', false, true)
    expect(svg).toContain('#E65100') // unchanged campsite colour
    expect(svg).not.toContain('#616161')
  })
})

describe('PoiMarkerManager.setFavorites', () => {
  it('updateIcon is called on existing markers when favorites change', () => {
    const adapter = makeAdapter()
    const mgr = new PoiMarkerManager(adapter, vi.fn())
    mgr.updatePois([poi(1), poi(2)])
    mgr.setFavorites(new Set(['1']))
    expect(adapter.handles[0]?.icon).toContain('%E2%99%A5') // ♥ URL-encoded
    expect(adapter.handles[1]?.icon).not.toContain('%E2%99%A5')
  })

  it('new markers pick up existing favorites', () => {
    const adapter = makeAdapter()
    const mgr = new PoiMarkerManager(adapter, vi.fn())
    mgr.setFavorites(new Set(['1']))
    mgr.updatePois([poi(1)])
    expect(adapter.handles[0]?.icon).toContain('%E2%99%A5')
  })

  it('renders private parking with the grey icon and keeps it through favorite toggle', () => {
    const adapter = makeAdapter()
    const mgr = new PoiMarkerManager(adapter, vi.fn())
    mgr.updatePois([poi(1, 'parking', 'private'), poi(2, 'parking', 'yes')])
    expect(adapter.handles[0]?.icon).toContain('%23616161') // #616161 URL-encoded
    expect(adapter.handles[1]?.icon).not.toContain('%23616161')

    // toggling a favorite must not lose the private (grey) styling
    mgr.setFavorites(new Set(['1']))
    expect(adapter.handles[0]?.icon).toContain('%23616161')
    expect(adapter.handles[0]?.icon).toContain('%E2%99%A5')
  })
})
