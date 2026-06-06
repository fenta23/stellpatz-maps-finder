import { describe, it, expect } from 'vitest'
import {
  arrayConcat, arrayEach, arrayEvery, arrayExtractDistinctValuesOfKey,
  arrayFilter, arrayFilterNotEmpty, arrayFind, arrayFlat,
  arrayIncludes, arrayJoin, arrayMap, arrayReduce, arrayRemove,
  arrayReverse, arraySome, arraySort, arraySortByKey, arrayUnique, arrayWrap,
} from './array.js'

describe('arrayConcat', () => {
  it('concatenates two arrays', () => expect(arrayConcat([1, 2])([3, 4])).toStrictEqual([1, 2, 3, 4]))
})

describe('arrayEach', () => {
  it('iterates all items with index', () => {
    let result = ''
    arrayEach((ii: string, index, all) => { result += `#${ii}-${index}-${all.length}` })(['a', 'b'])
    expect(result).toBe('#a-0-2#b-1-2')
  })
})

describe('arrayEvery', () => {
  it('returns true when all match', () => expect(arrayEvery((ii: string) => ii === 'a' || ii === 'b')(['a', 'b'])).toBe(true))
  it('returns false when some do not match', () => expect(arrayEvery((ii: string) => ii === 'a')(['a', 'b'])).toBe(false))
  it('returns false for empty array', () => expect(arrayEvery(() => true)([])).toBe(false))
})

describe('arrayExtractDistinctValuesOfKey', () => {
  it('extracts distinct values', () =>
    expect(arrayExtractDistinctValuesOfKey<{ key: number }, 'key'>('key')([{ key: 1 }, { key: 2 }, { key: 1 }]))
      .toStrictEqual([1, 2]))
})

describe('arrayFind', () => {
  it('finds first matching element', () => expect(arrayFind<number>(ii => ii > 2)([1, 2, 3, 4])).toBe(3))
  it('returns undefined when not found', () => expect(arrayFind<number>(ii => ii > 10)([1, 2, 3])).toBeUndefined())
})

describe('arrayFlat', () => {
  it('flattens one level', () => expect(arrayFlat([[1], [2]])).toStrictEqual([1, 2]))
})

describe('arrayFilter', () => {
  it('filters elements', () => expect(arrayFilter<number>(ii => ii < 3)([1, 2, 3, 4])).toStrictEqual([1, 2]))
})

describe('arrayFilterNotEmpty', () => {
  it('removes null, undefined, and empty string', () =>
    expect(arrayFilterNotEmpty([1, undefined, 2, null, 3, ''])).toStrictEqual([1, 2, 3]))
})

describe('arrayIncludes', () => {
  it('returns true when value present', () => expect(arrayIncludes('#')(['a', 'b', '#'])).toBe(true))
  it('returns false when value absent', () => expect(arrayIncludes('#')(['a', 'b'])).toBe(false))
})

describe('arrayJoin', () => {
  it('joins with separator', () => expect(arrayJoin('#')(['a', 'b'])).toBe('a#b'))
})

describe('arrayMap', () => {
  it('maps with index and length', () =>
    expect(arrayMap((ii: string, i, all) => `${ii}-${i}-${all.length}`)(['a', 'b']))
      .toStrictEqual(['a-0-2', 'b-1-2']))
})

describe('arrayReduce', () => {
  it('reduces with accumulator', () =>
    expect(
      arrayReduce(() => ':')((acc, ii: string, i, all) => acc + `#${ii}-${i}-${all.length}`)(['a', 'b'])
    ).toBe(':#a-0-2#b-1-2'))

  it('does not share accumulator reference between calls', () => {
    const partial = arrayReduce(() => ({}))
    const r1 = partial<string>((acc, ii, i) => Object.assign(acc, { [ii]: i }))(['a', 'b'])
    const r2 = partial<string>((acc, ii, i) => Object.assign(acc, { [ii]: i + 2 }))(['c', 'd'])
    expect(r1).toStrictEqual({ a: 0, b: 1 })
    expect(r2).toStrictEqual({ c: 2, d: 3 })
    expect(r1).not.toBe(r2)
  })
})

describe('arrayRemove', () => {
  it('removes existing value', () => expect(arrayRemove(2)([1, 2, 3])).toStrictEqual([1, 3]))
  it('returns same reference when value not present', () => {
    const arr = [1, 2, 3]
    expect(arrayRemove(4)(arr)).toBe(arr)
  })
})

describe('arrayReverse', () => {
  it('reverses without mutating original', () => {
    const arr = [1, 2, 3]
    const rev = arrayReverse(arr)
    expect(rev).toStrictEqual([3, 2, 1])
    expect(rev).not.toBe(arr)
    expect(arr).toStrictEqual([1, 2, 3])
  })
})

describe('arraySome', () => {
  it('returns true when at least one matches', () => expect(arraySome((ii: string) => ii === 'a')(['a', 'b'])).toBe(true))
  it('returns false when none match', () => expect(arraySome((ii: string) => ii === 'x')(['a', 'b'])).toBe(false))
  it('returns false for empty array', () => expect(arraySome(() => true)([])).toBe(false))
})

describe('arraySort', () => {
  it('sorts with comparator', () =>
    expect(arraySort<string>((a, b) => a.localeCompare(b))(['b', 'a'])).toStrictEqual(['a', 'b']))
  it('sorts without comparator', () => expect(arraySort()([2, 1])).toStrictEqual([1, 2]))
})

describe('arraySortByKey', () => {
  it('sorts by string key', () =>
    expect(arraySortByKey<{ key: string }>('key')([{ key: 'b' }, { key: 'a' }]))
      .toStrictEqual([{ key: 'a' }, { key: 'b' }]))
  it('sorts by numeric key (alphanumeric)', () =>
    expect(arraySortByKey<{ key: number }>('key')([{ key: 10 }, { key: 1 }]))
      .toStrictEqual([{ key: 1 }, { key: 10 }]))
  it('sorts by multiple keys', () =>
    expect(
      arraySortByKey<{ first: string; last: string }>('first', 'last')([
        { first: 'b', last: 'c' },
        { first: 'a', last: 'b' },
        { first: 'a', last: 'a' },
      ])
    ).toStrictEqual([{ first: 'a', last: 'a' }, { first: 'a', last: 'b' }, { first: 'b', last: 'c' }]))
})

describe('arrayUnique', () => {
  it('removes duplicates preserving order', () =>
    expect(arrayUnique([1, 2, 1, 3, 2])).toStrictEqual([1, 2, 3]))
})

describe('arrayWrap', () => {
  it('passes arrays through unchanged (same reference)', () => {
    const arr = [1]
    expect(arrayWrap(arr)).toBe(arr)
  })
  it('wraps non-array values', () => expect(arrayWrap(1)).toStrictEqual([1]))
})
