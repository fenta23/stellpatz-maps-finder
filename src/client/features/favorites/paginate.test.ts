import { describe, it, expect } from 'vitest'
import { paginate } from './paginate.js'

const nums = Array.from({ length: 23 }, (_, i) => i + 1)

describe('paginate', () => {
  it('returns the first slice with correct meta', () => {
    const p = paginate(nums, 1, 8)
    expect(p.items).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(p).toMatchObject({ page: 1, pages: 3, total: 23 })
  })

  it('returns the last partial page', () => {
    const p = paginate(nums, 3, 8)
    expect(p.items).toEqual([17, 18, 19, 20, 21, 22, 23])
  })

  it('clamps a too-high page to the last page', () => {
    expect(paginate(nums, 99, 8).page).toBe(3)
  })

  it('clamps a too-low page to 1', () => {
    expect(paginate(nums, 0, 8).page).toBe(1)
    expect(paginate(nums, -5, 8).page).toBe(1)
  })

  it('handles an empty list as a single empty page', () => {
    expect(paginate([], 1, 8)).toMatchObject({ items: [], page: 1, pages: 1, total: 0 })
  })
})
