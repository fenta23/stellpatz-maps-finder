import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { parseOpenHours } from './poiOpenHours.js'

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('parseOpenHours', () => {
  it('returns null for empty string', () => {
    expect(parseOpenHours('')).toBeNull()
    expect(parseOpenHours('  ')).toBeNull()
  })

  it('returns open for 24/7', () => {
    const r = parseOpenHours('24/7')
    expect(r).toEqual({ open: true, hint: 'Immer geöffnet' })
  })

  it('returns open when within opening hours', () => {
    vi.setSystemTime(new Date('2026-06-12T14:00:00')) // Friday 14:00
    const r = parseOpenHours('Mo-Fr 09:00-18:00')
    expect(r?.open).toBe(true)
    expect(r?.hint).toContain('Geöffnet')
  })

  it('returns closed when outside opening hours', () => {
    vi.setSystemTime(new Date('2026-06-12T20:00:00')) // Friday 20:00
    const r = parseOpenHours('Mo-Fr 09:00-18:00')
    expect(r?.open).toBe(false)
    expect(r?.hint).toContain('Geschlossen')
  })

  it('returns closed on weekend for Mo-Fr rule', () => {
    vi.setSystemTime(new Date('2026-06-13T12:00:00')) // Saturday
    const r = parseOpenHours('Mo-Fr 09:00-18:00')
    expect(r).toBeNull()
  })

  it('handles multiple semicolon-separated rules', () => {
    vi.setSystemTime(new Date('2026-06-13T12:00:00')) // Saturday 12:00
    const r = parseOpenHours('Mo-Fr 09:00-18:00; Sa 10:00-14:00')
    expect(r?.open).toBe(true)
    expect(r?.hint).toContain('Geöffnet')
  })

  it('handles comma-separated day lists', () => {
    vi.setSystemTime(new Date('2026-06-13T12:00:00')) // Saturday
    const r = parseOpenHours('Mo,We,Fr 09:00-12:00')
    expect(r).toBeNull()
  })

  it('uses en-dash (–) as a separator', () => {
    vi.setSystemTime(new Date('2026-06-12T14:00:00')) // Friday
    const r = parseOpenHours('Mo–Fr 09:00–18:00')
    expect(r?.open).toBe(true)
  })
})
