/* eslint-disable @typescript-eslint/no-explicit-any */

/** Type guard: `null | undefined → false`, everything else → `true` */
export function notNullUndefined<T>(val: T | null | undefined): val is T {
  return val !== null && val !== undefined
}

/** Type guard: `null | undefined → true`, everything else → `false` */
export function isNullUndefined<T>(val: T | null | undefined): val is null | undefined {
  return !notNullUndefined(val)
}

/** Deep-clone via JSON round-trip. Strips functions, undefined, symbols. */
export function jsonCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

/** Deep-equality check via JSON serialisation. */
export function jsonEqual<T>(aa: T, bb: T): boolean {
  return aa === bb || JSON.stringify(aa) === JSON.stringify(bb)
}

/** Returns a flat diff of changed keys (shallow-deep: one level of nesting). */
export function jsonDiff<T>(
  oldObj: T,
  newObj: T,
): Record<string, { oldValue: unknown; newValue: unknown }> {
  if (oldObj === newObj) return {}

  const differences: Record<string, { oldValue: unknown; newValue: unknown }> = {}
  const allKeys = new Set([
    ...Object.keys((oldObj as object) ?? {}),
    ...Object.keys((newObj as object) ?? {}),
  ])

  allKeys.forEach(key => {
    const oldValue = (oldObj as any)?.[key]
    const newValue = (newObj as any)?.[key]
    if (typeof oldValue === 'object' && notNullUndefined(oldValue)) {
      const diff = jsonDiff(oldValue, newValue)
      if (Object.keys(diff).length) differences[key] = { oldValue, newValue: diff }
    } else if (!jsonEqual(oldValue, newValue)) {
      differences[key] = { oldValue, newValue }
    }
  })

  return differences
}
