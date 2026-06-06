import { flip } from './fp.js'
import { strCompareAlphanumeric } from './str.js'

export const arrayConcat =
  <T>(left: T[]) =>
  (right: T[]): T[] =>
    [...left, ...right]

export const arrayEach =
  <T, R>(fnEach: (item: T, index: number, all: T[]) => R) =>
  (val: T[]): void => {
    val.forEach(fnEach)
  }
export const arrayForEach = flip(arrayEach)

export const arrayEvery =
  <T>(fnEvery: (item: T, index: number, all: T[]) => boolean) =>
  (val: T[]): boolean =>
    val.length > 0 && val.every(fnEvery)
export const arrayForEvery = flip(arrayEvery)

export const arrayFind =
  <T>(fnFind: (item: T, index: number, all: T[]) => boolean) =>
  (val: T[]): T | undefined =>
    val.find(fnFind)
export const arrayForFind = flip(arrayFind)

/** Flattens one level. */
export const arrayFlat = <T>(val: T[][]): T[] => val.flat()

export const arrayFilter =
  <T>(fnFilter: (item: T, index: number, all: T[]) => boolean) =>
  (val: T[]): T[] =>
    val.filter(fnFilter)
export const arrayForFilter = flip(arrayFilter)

export const arrayIncludes =
  <T>(search: T) =>
  (val: T[]): boolean =>
    val.includes(search)
export const arrayForInclude = flip(arrayIncludes)

export const arrayJoin =
  (separator: string) =>
  <T>(val: T[]): string =>
    val.join(separator)
export const arrayForJoin = flip(arrayJoin)

export const arrayMap =
  <T, R>(fnMap: (item: T, index: number, all: T[]) => R) =>
  (val: T[]): R[] =>
    val.map(fnMap)
export const arrayForMap = flip(arrayMap)

/**
 * `init` is a factory to avoid shared-reference bugs between calls.
 * @example arrayReduce(() => 0)((acc, n) => acc + n)([1,2,3]) → 6
 */
export const arrayReduce =
  <R>(init: () => R) =>
  <T>(fnReduce: (acc: R, item: T, index: number, all: T[]) => R) =>
  (val: T[]): R =>
    val.reduce(fnReduce, init())

/** Removes `value` from array if present; returns same reference if not found. */
export const arrayRemove =
  <T>(value: T) =>
  (val: T[]): T[] =>
    val.includes(value) ? val.filter(ii => ii !== value) : val
export const arrayForRemove = flip(arrayRemove)

/** Returns a reversed copy (does not mutate the original). */
export const arrayReverse = <T>(val: T[]): T[] => [...val].reverse()

export const arraySome =
  <T>(fnSome: (item: T, index: number, all: T[]) => boolean) =>
  (val: T[]): boolean =>
    val.some(fnSome)
export const arrayForSome = flip(arraySome)

/** Returns a sorted copy (does not mutate the original). */
export const arraySort =
  <T>(fnCompare?: (aa: T, bb: T) => number) =>
  (val: T[]): T[] =>
    [...val].sort(fnCompare)
export const arrayForSort = flip(arraySort)

/** Removes null, undefined, and empty-string entries. */
export const arrayFilterNotEmpty = <T>(items: (T | null | undefined | '')[]) =>
  items.filter((ii): ii is T => ii !== null && ii !== undefined && ii !== '') as T[]

/** Extracts one key from every object and returns distinct values. */
export const arrayExtractDistinctValuesOfKey =
  <T, K extends keyof T>(key: K) =>
  (items: T[]): T[K][] =>
    items.reduce<T[K][]>((acc, ii) => (acc.includes(ii[key]) ? acc : [...acc, ii[key]]), [])

/** Removes duplicates (uses Set, preserves order). */
export const arrayUnique = <T>(items: T[]): T[] => Array.from(new Set(items))

/** Sorts by one or more keys, alphanumeric (handles numbers in strings). */
export const arraySortByKey =
  <T>(...keys: (keyof T)[]) =>
  (vals: T[]): T[] =>
    !vals.length
      ? vals
      : [...vals].sort((aa, bb) =>
          keys.reduce(
            (acc, key) => acc !== 0 ? acc : strCompareAlphanumeric('' + aa?.[key], '' + bb?.[key]),
            0,
          ),
        )

/** Wraps a non-array value in an array; passes arrays through unchanged. */
export const arrayWrap = <T>(value: T | T[]): T[] =>
  Array.isArray(value) ? value : [value]
