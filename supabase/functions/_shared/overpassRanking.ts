// Health-based ranking of Overpass endpoints.
//
// Pure, Deno-free logic (so it's unit-testable with Vitest): given per-endpoint
// stats gathered from past fetches, order the endpoints best-first. The handler
// then races the top few and falls back through the rest — so a slow or flapping
// mirror is automatically demoted to the back instead of being tried first.
//
// State is best-effort and lives in the Edge Function isolate's memory: it warms
// up over a few requests and resets on a cold start. No DB writes — a soft hint,
// not a source of truth.

export interface EndpointStat {
  /** EWMA of successful-response latency in ms; 0 until the first success. */
  readonly ewmaMs: number
  /** Consecutive failures since the last success. */
  readonly failStreak: number
  /** Timestamp (ms) of the most recent failure, drives cooldown decay. */
  readonly lastFailAt: number
}

export type StatStore = Map<string, EndpointStat>

const EMPTY: EndpointStat = { ewmaMs: 0, failStreak: 0, lastFailAt: 0 }

// ── Tuning ───────────────────────────────────────────────────────────────────
/** Weight of the newest latency sample in the EWMA (0..1). */
const EWMA_ALPHA = 0.3
/** Assumed cost for an endpoint we've never successfully measured. */
const UNKNOWN_COST_MS = 2_500
/** Latency-equivalent penalty added per consecutive failure. */
const FAIL_PENALTY_MS = 8_000
/** Failures older than this stop counting, so a mirror can recover. */
const FAIL_COOLDOWN_MS = 60_000
/**
 * Cap the streak: beyond this the mirror is already "fully demoted", so a higher
 * count adds no ranking signal. Clamping keeps the counter bounded instead of
 * climbing forever on a permanently-dead endpoint.
 */
const MAX_FAIL_STREAK = 5

/** Record a successful fetch and fold its latency into the EWMA. */
export function recordSuccess(store: StatStore, url: string, latencyMs: number): void {
  const prev = store.get(url) ?? EMPTY
  const ewmaMs = prev.ewmaMs === 0
    ? latencyMs
    : Math.round(prev.ewmaMs * (1 - EWMA_ALPHA) + latencyMs * EWMA_ALPHA)
  store.set(url, { ewmaMs, failStreak: 0, lastFailAt: 0 })
}

/** Record a failed/timed-out fetch; bumps the consecutive-failure streak. */
export function recordFailure(store: StatStore, url: string, now: number): void {
  const prev = store.get(url) ?? EMPTY
  const failStreak = Math.min(prev.failStreak + 1, MAX_FAIL_STREAK)
  store.set(url, { ...prev, failStreak, lastFailAt: now })
}

/**
 * Latency-equivalent cost for ranking — lower is better. Combines smoothed
 * latency with a decaying penalty for recent failures. Pure.
 */
export function endpointCost(stat: EndpointStat | undefined, now: number): number {
  if (!stat) return UNKNOWN_COST_MS
  const base = stat.ewmaMs === 0 ? UNKNOWN_COST_MS : stat.ewmaMs
  const failuresStillFresh = now - stat.lastFailAt <= FAIL_COOLDOWN_MS
  const penalty = failuresStillFresh ? stat.failStreak * FAIL_PENALTY_MS : 0
  return base + penalty
}

/**
 * Order endpoints best-first by health cost. Stable: equal costs keep the
 * configured order, so with no stats the result equals the input order.
 */
export function rankEndpoints(
  endpoints: readonly string[],
  store: StatStore,
  now: number,
): string[] {
  return endpoints
    .map((url, i) => ({ url, i, cost: endpointCost(store.get(url), now) }))
    .sort((a, b) => a.cost - b.cost || a.i - b.i)
    .map((e) => e.url)
}
