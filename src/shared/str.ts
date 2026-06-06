import { isNullUndefined } from './common.js'
import { coalesce, compose, flip } from './fp.js'

export const emDash = '—'

/** Converts any value to `string | null`. Returns `null` for null/undefined. */
export const str = (val: unknown): string | null =>
  isNullUndefined(val) ? null : typeof val === 'string' ? val : String(val)

/** Like `str` but always returns a string — falls back to `''`. */
export const strNonNull: (val: unknown) => string = compose(coalesce(''), str)

export function strCompare(aa: string | null | undefined, bb: string | null | undefined): number {
  return (aa ?? '').localeCompare(bb ?? '')
}

export function strCompareAlphanumeric(aa: string | null | undefined, bb: string | null | undefined): number {
  return (aa ?? '').localeCompare(bb ?? '', 'en-US', { numeric: true })
}

export const strIncludes = (token: string) => (text: string): boolean => text.includes(token)
export const strForIncludes = flip(strIncludes)

export const strSplit = (separator: string) => (val: string): string[] => val.split(separator)
export const strForSplit = flip(strSplit)

export const strTrim = (val: string): string => val.trim()
export const strLower = (val: string): string => val.toLowerCase()
export const strUpper = (val: string): string => val.toUpperCase()
export const strLowerLocale = (val: string): string => val.toLocaleLowerCase()
export const strUpperLocale = (val: string): string => val.toLocaleUpperCase()

/** Truncates `text` to `len` characters and appends `…` if longer. */
export const strEllipsisLen =
  (len: number) =>
  (text: string | null | undefined): string | null | undefined =>
    text && text.length > len ? text.slice(0, len) + '…' : text

export const strPadLeft =
  (padWith: string) =>
  (max: number) =>
  (val: unknown): string =>
    strNonNull(val).padStart(max, padWith)

export const strPadLeftWithZero = strPadLeft('0')
export const strPadLeftWithZero2 = strPadLeftWithZero(2)
export const strPadLeftWithZero3 = strPadLeftWithZero(3)
export const strPadLeftWithZero4 = strPadLeftWithZero(4)

export const strRepeatTokenTimes = (token: string) => (times: number): string =>
  new Array(times + 1).join(token)
