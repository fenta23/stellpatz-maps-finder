export interface Page<T> {
  readonly items: readonly T[]
  readonly page: number
  readonly pages: number
  readonly total: number
}

/**
 * Pure client-side pagination. `page` is 1-based and clamped into range; an
 * empty list yields a single empty page.
 */
export function paginate<T>(items: readonly T[], page: number, size: number): Page<T> {
  const total = items.length
  const pages = Math.max(1, Math.ceil(total / size))
  const clamped = Math.min(Math.max(1, Math.trunc(page)), pages)
  const start = (clamped - 1) * size
  return { items: items.slice(start, start + size), page: clamped, pages, total }
}
