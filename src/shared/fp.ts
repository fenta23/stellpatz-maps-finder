// ── Composition ──────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Applies functions right-to-left (mathematical composition).
 *
 * @example
 * const double = (n: number) => n * 2
 * const increment = (n: number) => n + 1
 * const stringify = (v: unknown) => String(v)
 *
 * compose(stringify, double, increment)(1) // => '4'
 */
export function compose<R, T0>(fn0: (arg: T0) => R): (arg: T0) => R
export function compose<R, T0, T1>(fn1: (arg: T1) => R, fn0: (arg: T0) => T1): (arg: T0) => R
export function compose<R, T0, T1, T2>(fn2: (arg: T2) => R, fn1: (arg: T1) => T2, fn0: (arg: T0) => T1): (arg: T0) => R
export function compose<R, T0, T1, T2, T3>(fn3: (arg: T3) => R, fn2: (arg: T2) => T3, fn1: (arg: T1) => T2, fn0: (arg: T0) => T1): (arg: T0) => R
export function compose<R, T0, T1, T2, T3, T4>(fn4: (arg: T4) => R, fn3: (arg: T3) => T4, fn2: (arg: T2) => T3, fn1: (arg: T1) => T2, fn0: (arg: T0) => T1): (arg: T0) => R
export function compose<R, T0, T1, T2, T3, T4, T5>(fn5: (arg: T5) => R, fn4: (arg: T4) => T5, fn3: (arg: T3) => T4, fn2: (arg: T2) => T3, fn1: (arg: T1) => T2, fn0: (arg: T0) => T1): (arg: T0) => R

export function compose(...fns: ((arg: unknown) => unknown)[]) {
  return (arg0: unknown): unknown =>
    fns.reduceRight((acc, fn, index) => {
      if (typeof fn !== 'function') {
        throw new Error(`Found a non-function (${typeof fn}: ${fn as any}) at ${index}.`)
      }
      return fn(acc)
    }, arg0)
}

// ── Common FP helpers ─────────────────────────────────────────────────────────

/** Returns `val` if not null/undefined, otherwise `fallback`.
 *  @example coalesce(3)(undefined) → 3 */
export const coalesce =
  <T>(fallback: T) =>
  (val: T | null | undefined): T =>
    val ?? fallback

/** Curries a 2-argument function: `(a, b) => r` → `(a) => (b) => r` */
export const curry =
  <R, T0, T1>(fn: (arg0: T0, arg1: T1) => R) =>
  (arg0: T0) =>
  (arg1: T1): R =>
    fn(arg0, arg1)

/** Flips the argument order of a curried 2-argument function.
 *  `(a) => (b) => r` → `(b) => (a) => r` */
export const flip =
  <R, T0, T1>(fn: (arg0: T0) => (arg1: T1) => R) =>
  (arg1: T1) =>
  (arg0: T0): R =>
    fn(arg0)(arg1)

/** Finds the first non-null result from `checks`, or falls back to `defaultValueGetter`.
 *  @example findOrDefault(nrToStr)([onEven, onOdd])(3) → 'odd' */
export const findOrDefault =
  <T, R>(defaultValueGetter: (param: T) => R) =>
  (checks: ((param: T) => R | null)[]) =>
  (param: T): R =>
    checks.reduce<R | null>((acc, check) => acc ?? check(param), null) ?? defaultValueGetter(param)

/** Boolean negation as a function: `not(true) → false` */
export const not = <T>(val: T): boolean => !val
