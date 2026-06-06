import { describe, it, expect } from 'vitest'
import {
  str, strNonNull, strCompare, strCompareAlphanumeric,
  strIncludes, strSplit, strTrim,
  strLower, strUpper, strLowerLocale, strUpperLocale,
  strPadLeft, strPadLeftWithZero, strPadLeftWithZero2, strPadLeftWithZero3, strPadLeftWithZero4,
  strEllipsisLen,
} from './str.js'

describe('str', () => {
  it('returns null for null', () => expect(str(null)).toBeNull())
  it('returns null for undefined', () => expect(str(undefined)).toBeNull())
  it('passes empty string through', () => expect(str('')).toBe(''))
  it('passes string through', () => expect(str('hi')).toBe('hi'))
  it('stringifies number', () => expect(str(3)).toBe('3'))
  it('stringifies boolean', () => expect(str(true)).toBe('true'))
})

describe('strNonNull', () => {
  it('returns empty string for null', () => expect(strNonNull(null)).toBe(''))
  it('returns value for string', () => expect(strNonNull('hi')).toBe('hi'))
})

describe('strCompare / strCompareAlphanumeric', () => {
  it('compares lexicographically', () => expect(strCompare('a11', 'a100')).toBe(1))
  it('compares numerically (alphanumeric)', () => expect(strCompareAlphanumeric('a11', 'a100')).toBe(-1))
})

describe('strIncludes', () => {
  it('returns true when token present', () => expect(strIncludes('the')('hi#there')).toBe(true))
  it('returns false when token absent', () => expect(strIncludes('nope')('hi#there')).toBe(false))
})

describe('strSplit', () => {
  it('splits on separator', () => expect(strSplit('#')('hi#there')).toStrictEqual(['hi', 'there']))
})

describe('strTrim', () => {
  it('trims whitespace', () => expect(strTrim(' hi there ')).toBe('hi there'))
})

describe('strLower / strUpper', () => {
  it('lowercases', () => expect(strLower('HELLO')).toBe('hello'))
  it('uppercases', () => expect(strUpper('hello')).toBe('HELLO'))
  it('lowercases locale', () => expect(strLowerLocale('HELLO')).toBe('hello'))
  it('uppercases locale', () => expect(strUpperLocale('hello')).toBe('HELLO'))
})

describe('strPadLeft', () => {
  it('pads with custom char', () => expect(strPadLeft('.')(5)('1')).toBe('....1'))
  it('pads with zero', () => expect(strPadLeftWithZero(5)('1')).toBe('00001'))
  it('pads to 2 with zero', () => expect(strPadLeftWithZero2('1')).toBe('01'))
  it('pads to 3 with zero', () => expect(strPadLeftWithZero3('1')).toBe('001'))
  it('pads to 4 with zero', () => expect(strPadLeftWithZero4('1')).toBe('0001'))
})

describe('strEllipsisLen', () => {
  it('truncates long strings', () => expect(strEllipsisLen(5)('hello world')).toBe('hello...'))
  it('passes short strings through', () => expect(strEllipsisLen(20)('hello')).toBe('hello'))
})
