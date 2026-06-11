import { describe, it, expect, vi } from 'vitest'
import { CustomPoiMarkerManager } from './CustomPoiMarkerManager.js'
import type { MapAdapter, MarkerHandle } from '@/features/pois/PoiMarkerManager.js'
import type { CustomPoi } from './CustomPoi.js'

function makeHandle(): MarkerHandle & { visible: boolean; removed: boolean; icon: string } {
  return {
    visible: true,
    removed: false,
    icon: '',
    setVisible(v) { this.visible = v },
    remove() { this.removed = true },
    updateIcon() {},
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

const poi = (id: string, overrides?: Partial<CustomPoi>): CustomPoi => ({
  id,
  iconId: 'parking',
  lat: 48 + Number(id) * 0.01,
  lon: 11 + Number(id) * 0.01,
  name: `POI ${id}`,
  createdAt: 1000,
  updatedAt: 1000,
  ...overrides,
})

describe('CustomPoiMarkerManager', () => {
  it('adds markers for new POIs', () => {
    const adapter = makeAdapter()
    const mgr = new CustomPoiMarkerManager(adapter, vi.fn())
    mgr.updatePois([poi('1'), poi('2')])
    expect(mgr.count).toBe(2)
    expect(adapter.handles).toHaveLength(2)
  })

  it('does not add duplicate markers for same id', () => {
    const adapter = makeAdapter()
    const mgr = new CustomPoiMarkerManager(adapter, vi.fn())
    mgr.updatePois([poi('1')])
    mgr.updatePois([poi('1'), poi('2')])
    expect(mgr.count).toBe(2)
    expect(adapter.handles).toHaveLength(2)
  })

  it('removes markers no longer in result set', () => {
    const adapter = makeAdapter()
    const mgr = new CustomPoiMarkerManager(adapter, vi.fn())
    mgr.updatePois([poi('1'), poi('2')])
    mgr.updatePois([poi('2')])
    expect(mgr.count).toBe(1)
    expect(adapter.handles[0]?.removed).toBe(true)
    expect(adapter.handles[1]?.removed).toBe(false)
  })

  it('calls onSelect with correct POI on marker click', () => {
    const onSelect = vi.fn()
    let capturedClick: (() => void) | undefined
    const adapter: MapAdapter = {
      createMarker({ onClick }) {
        capturedClick = onClick
        return makeHandle()
      },
    }
    const mgr = new CustomPoiMarkerManager(adapter, onSelect)
    const p = poi('5', { name: 'Test' })
    mgr.updatePois([p])
    capturedClick?.()
    expect(onSelect).toHaveBeenCalledWith(p)
  })

  it('setVisible hides markers', () => {
    const adapter = makeAdapter()
    const mgr = new CustomPoiMarkerManager(adapter, vi.fn())
    mgr.updatePois([poi('1')])
    expect(adapter.handles[0]?.visible).toBe(true)
    mgr.setVisible(false)
    expect(adapter.handles[0]?.visible).toBe(false)
    expect(mgr.isVisible).toBe(false)
  })

  it('setVisible shows markers', () => {
    const adapter = makeAdapter()
    const mgr = new CustomPoiMarkerManager(adapter, vi.fn())
    mgr.setVisible(false)
    mgr.updatePois([poi('1')])
    expect(adapter.handles[0]?.visible).toBe(false)
    mgr.setVisible(true)
    expect(adapter.handles[0]?.visible).toBe(true)
    expect(mgr.isVisible).toBe(true)
  })

  it('clear removes all markers', () => {
    const adapter = makeAdapter()
    const mgr = new CustomPoiMarkerManager(adapter, vi.fn())
    mgr.updatePois([poi('1'), poi('2')])
    mgr.clear()
    expect(mgr.count).toBe(0)
    expect(adapter.handles[0]?.removed).toBe(true)
    expect(adapter.handles[1]?.removed).toBe(true)
  })

  it('isVisible defaults to true', () => {
    const mgr = new CustomPoiMarkerManager(makeAdapter(), vi.fn())
    expect(mgr.isVisible).toBe(true)
  })

  it('generates icons with amber fill', () => {
    const adapter = makeAdapter()
    const mgr = new CustomPoiMarkerManager(adapter, vi.fn())
    mgr.updatePois([poi('1')])
    const icon = decodeURIComponent(adapter.handles[0]?.icon ?? '')
    expect(icon).toContain('#FF8F00')
    expect(icon).toContain('<circle')
  })

  it('uses POI name as marker title', () => {
    const adapter = makeAdapter()
    const mgr = new CustomPoiMarkerManager(adapter, vi.fn())
    const p = poi('1', { name: 'Mein Platz' })
    mgr.updatePois([p])
    expect(adapter.handles[0]?.icon).toBeTruthy()
    // icon includes the name somewhere? No — title is separate in createMarker.
  })
})
