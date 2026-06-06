import { describe, it, expect } from 'vitest'
import { isNullUndefined, jsonCopy, jsonDiff, jsonEqual, notNullUndefined } from './common.js'

describe('notNullUndefined', () => {
  it('returns false for null', () => expect(notNullUndefined(null)).toBe(false))
  it('returns false for undefined', () => expect(notNullUndefined(undefined)).toBe(false))
  it('returns true for empty string', () => expect(notNullUndefined('')).toBe(true))
  it('returns true for 0', () => expect(notNullUndefined(0)).toBe(true))
  it('narrows type correctly', () => {
    const val: string | null = 'hello'
    if (notNullUndefined(val)) {
      expect(val.toUpperCase()).toBe('HELLO')
    }
  })
})

describe('isNullUndefined', () => {
  it('returns true for null', () => expect(isNullUndefined(null)).toBe(true))
  it('returns true for undefined', () => expect(isNullUndefined(undefined)).toBe(true))
  it('returns false for empty string', () => expect(isNullUndefined('')).toBe(false))
})

describe('jsonCopy', () => {
  it('copies a number', () => expect(jsonCopy(12)).toBe(12))
  it('copies a boolean', () => expect(jsonCopy(true)).toBe(true))
  it('copies a string', () => expect(jsonCopy('hi')).toBe('hi'))
  it('deep-copies an array', () => expect(jsonCopy([1, 'a', true])).toStrictEqual([1, 'a', true]))
  it('deep-copies an object', () => expect(jsonCopy({ a: 12 })).toStrictEqual({ a: 12 }))
  it('returns a new reference for objects', () => {
    const obj = { a: 1 }
    expect(jsonCopy(obj)).not.toBe(obj)
  })
})

describe('jsonEqual', () => {
  it('compares numbers', () => expect(jsonEqual(12, 12)).toBe(true))
  it('compares booleans', () => expect(jsonEqual(true, true)).toBe(true))
  it('compares strings', () => expect(jsonEqual('hi', 'hi')).toBe(true))
  it('compares arrays', () => expect(jsonEqual([1, 'a', true], [1, 'a', true])).toBe(true))
  it('compares objects', () => expect(jsonEqual({ a: 12 }, { a: 12 })).toBe(true))
  it('returns false for different values', () => expect(jsonEqual(1, 2)).toBe(false))
})

describe('jsonDiff', () => {
  it('returns empty object for equal values', () =>
    expect(jsonDiff({ a: 12 }, { a: 12 })).toStrictEqual({}))
  it('detects changed values', () =>
    expect(jsonDiff({ a: 12 }, { a: 13 })).toStrictEqual({ a: { oldValue: 12, newValue: 13 } }))
})
