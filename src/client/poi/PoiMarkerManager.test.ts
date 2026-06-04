import { describe, it, expect, vi } from 'vitest'
import { PoiMarkerManager, svgToDataUrl } from './PoiMarkerManager.js'
import type { MapAdapter, MarkerHandle } from './PoiMarkerManager.js'
import type { OsmPoi } from './OverpassClient.js'

function makeHandle(): MarkerHandle & { visible: boolean; removed: boolean } {
  return {
    visible: true,
    removed: false,
    setVisible(v) { this.visible = v },
    remove() { this.removed = true },
  }
}

function makeAdapter(): MapAdapter & { handles: ReturnType<typeof makeHandle>[] } {
  const handles: ReturnType<typeof makeHandle>[] = []
  return {
    handles,
    createMarker({ onClick }) {
      const handle = makeHandle()
      handles.push(handle)
      // simulate click so the onClick-test works
      void onClick
      return handle
    },
  }
}

const poi = (id: number, type: OsmPoi['type'] = 'parking'): OsmPoi => ({
  id,
  type,
  lat: 48 + id * 0.01,
  lon: 11 + id * 0.01,
  tags: { name: `POI ${id}` },
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
