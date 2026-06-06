import { describe, it, expect } from 'vitest'
import { compose, coalesce, curry, findOrDefault, flip, not } from './fp.js'

// ── compose ───────────────────────────────────────────────────────────────────

describe('compose', () => {
  const returnSelf = <T>(arg: T) => arg
  const plusOne = (n: number) => n + 1
  const stringify = (arg: unknown) => String(arg)

  it('returns a function', () => expect(typeof compose(returnSelf)).toBe('function'))
  it('throws on undefined', () =>
    expect(() => compose(returnSelf, undefined as never, returnSelf)(1)).toThrow(
      new Error('Found a non-function (undefined: undefined) at 1.'),
    ))
  it('throws on null', () =>
    expect(() => compose(returnSelf, null as never, returnSelf)(1)).toThrow(
      new Error('Found a non-function (object: null) at 1.'),
    ))
  it('applies 1 fn', () => expect(compose(plusOne)(1)).toBe(2))
  it('applies 2 fns', () => expect(compose(stringify, plusOne)(1)).toBe('2'))
  it('applies 3 fns', () => expect(compose(stringify, plusOne, plusOne)(1)).toBe('3'))
})

// ── coalesce ──────────────────────────────────────────────────────────────────

describe('coalesce', () => {
  it('passes through non-null value', () => expect(coalesce(3)(1)).toBe(1))
  it('returns fallback for undefined', () => expect(coalesce(3)(undefined)).toBe(3))
  it('returns fallback for null', () => expect(coalesce(3)(null)).toBe(3))
})

// ── curry ─────────────────────────────────────────────────────────────────────

describe('curry', () => {
  it('transforms 2-arg fn to curried form', () =>
    expect(curry((a: number, b: number) => a / b)(6)(3)).toBe(2))
})

// ── findOrDefault ─────────────────────────────────────────────────────────────

describe('findOrDefault', () => {
  const nrToStr = (n: number) => `#${n}`
  const evenToStr = (n: number) => (n % 2 === 0 ? 'even' : null)
  const oddToStr = (n: number) => (n % 2 !== 0 ? 'odd' : null)
  const find = findOrDefault(nrToStr)

  it('uses fallback when checks array is empty', () => expect(find([])(3)).toBe('#3'))
  it('uses fallback when no handler matches', () => expect(find([evenToStr])(3)).toBe('#3'))
  it('finds first matching handler', () => expect(find([evenToStr, oddToStr])(3)).toBe('odd'))
})

// ── flip ──────────────────────────────────────────────────────────────────────

describe('flip', () => {
  it('flips curried 2-arg function', () =>
    expect(flip((a: number) => (b: number) => a - b)(2)(6)).toBe(4))
})

// ── not ───────────────────────────────────────────────────────────────────────

describe('not', () => {
  it('negates false', () => expect(not(false)).toBe(true))
  it('negates true', () => expect(not(true)).toBe(false))
})
