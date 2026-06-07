import { describe, it, expect } from 'vitest'
import { isValidEmail } from './isValidEmail.js'

describe('isValidEmail', () => {
  it.each(['a@b.de', 'max.muster@example.com', ' trim@me.io '])('accepts %s', (e) => {
    expect(isValidEmail(e)).toBe(true)
  })
  it.each(['', 'no-at', 'a@b', 'a@@b.de', 'a b@c.de'])('rejects %s', (e) => {
    expect(isValidEmail(e)).toBe(false)
  })
})
