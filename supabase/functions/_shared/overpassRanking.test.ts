import { describe, it, expect } from 'vitest'
import {
  rankEndpoints,
  recordSuccess,
  recordFailure,
  endpointCost,
  type StatStore,
} from './overpassRanking.ts'

const A = 'https://a.example/api/interpreter'
const B = 'https://b.example/api/interpreter'
const C = 'https://c.example/api/interpreter'
const ENDPOINTS = [A, B, C] as const
const NOW = 1_000_000

describe('rankEndpoints', () => {
  it('keeps the configured order when there are no stats', () => {
    expect(rankEndpoints(ENDPOINTS, new Map(), NOW)).toEqual([A, B, C])
  })

  it('ranks a faster endpoint ahead of a slower one', () => {
    const store: StatStore = new Map()
    recordSuccess(store, B, 300)
    recordSuccess(store, A, 4_000)
    // B is fast, A is slow; C is unknown (neutral baseline between them).
    expect(rankEndpoints(ENDPOINTS, store, NOW)).toEqual([B, C, A])
  })

  it('demotes a recently failed endpoint to the back', () => {
    const store: StatStore = new Map()
    recordSuccess(store, A, 800)
    recordFailure(store, B, NOW) // B just failed → big penalty
    recordSuccess(store, C, 1_200)
    expect(rankEndpoints(ENDPOINTS, store, NOW)).toEqual([A, C, B])
  })

  it('demotes harder the longer the failure streak', () => {
    const store: StatStore = new Map()
    recordSuccess(store, A, 5_000) // slow but alive
    recordFailure(store, B, NOW)
    recordFailure(store, B, NOW) // two consecutive failures
    // Even though A is slow, two fresh failures push B behind it.
    const ranked = rankEndpoints([A, B], store, NOW)
    expect(ranked).toEqual([A, B])
    expect(endpointCost(store.get(B), NOW)).toBeGreaterThan(endpointCost(store.get(A), NOW))
  })

  it('lets a failed endpoint recover after the cooldown elapses', () => {
    const store: StatStore = new Map()
    recordSuccess(store, A, 2_000)
    recordFailure(store, B, NOW)
    recordSuccess(store, B, 200) // recovered: fast success clears the streak
    expect(rankEndpoints([A, B], store, NOW)).toEqual([B, A])
  })

  it('stops counting failures once they age past the cooldown window', () => {
    const store: StatStore = new Map()
    recordFailure(store, B, NOW)
    const muchLater = NOW + 120_000 // > FAIL_COOLDOWN_MS
    // The stale failure no longer adds a penalty, so B falls back to the
    // unknown baseline rather than staying demoted forever.
    expect(endpointCost(store.get(B), muchLater)).toBe(endpointCost(undefined, muchLater))
  })
})

describe('recordSuccess EWMA', () => {
  it('uses the first sample verbatim, then smooths subsequent ones', () => {
    const store: StatStore = new Map()
    recordSuccess(store, A, 1_000)
    expect(store.get(A)?.ewmaMs).toBe(1_000)
    recordSuccess(store, A, 2_000)
    // 0.7*1000 + 0.3*2000 = 1300
    expect(store.get(A)?.ewmaMs).toBe(1_300)
  })

  it('caps the failure streak so a dead endpoint cannot climb forever', () => {
    const store: StatStore = new Map()
    for (let i = 0; i < 50; i++) recordFailure(store, A, NOW)
    expect(store.get(A)?.failStreak).toBe(5) // MAX_FAIL_STREAK
  })

  it('resets the failure streak on success', () => {
    const store: StatStore = new Map()
    recordFailure(store, A, NOW)
    recordFailure(store, A, NOW)
    recordSuccess(store, A, 500)
    expect(store.get(A)?.failStreak).toBe(0)
  })
})
