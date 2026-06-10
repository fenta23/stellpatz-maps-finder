import { describe, it, expect, vi } from 'vitest'
import type { Request, Response, NextFunction } from 'express'
import { originGuard } from './originGuard.js'

function run(headers: Record<string, string>, extra: string[] = []) {
  const req = { headers } as unknown as Request
  const status = vi.fn().mockReturnThis()
  const json = vi.fn()
  const res = { status, json } as unknown as Response
  const next = vi.fn() as unknown as NextFunction
  originGuard(extra)(req, res, next)
  return { next, status }
}

describe('originGuard', () => {
  it('allows header-less requests (curl, old browsers)', () => {
    const { next, status } = run({})
    expect(next).toHaveBeenCalledOnce()
    expect(status).not.toHaveBeenCalled()
  })

  it('allows a same-host Origin (POSTs from the app)', () => {
    const { next } = run({ origin: 'https://app.example.com', host: 'app.example.com' })
    expect(next).toHaveBeenCalledOnce()
  })

  it('blocks a foreign Origin', () => {
    const { next, status } = run({ origin: 'https://evil.example', host: 'app.example.com' })
    expect(next).not.toHaveBeenCalled()
    expect(status).toHaveBeenCalledWith(403)
  })

  it('blocks an unparseable Origin', () => {
    const { status } = run({ origin: 'not a url', host: 'app.example.com' })
    expect(status).toHaveBeenCalledWith(403)
  })

  it('allows an extra allowlisted origin (e.g. Capacitor)', () => {
    const { next } = run(
      { origin: 'capacitor://localhost', host: 'app.example.com' },
      ['capacitor://localhost'],
    )
    expect(next).toHaveBeenCalledOnce()
  })

  it('allows Sec-Fetch-Site same-origin and none', () => {
    expect(run({ 'sec-fetch-site': 'same-origin' }).next).toHaveBeenCalledOnce()
    expect(run({ 'sec-fetch-site': 'none' }).next).toHaveBeenCalledOnce()
  })

  it('blocks Sec-Fetch-Site cross-site and same-site (no Origin header)', () => {
    expect(run({ 'sec-fetch-site': 'cross-site' }).status).toHaveBeenCalledWith(403)
    expect(run({ 'sec-fetch-site': 'same-site' }).status).toHaveBeenCalledWith(403)
  })

  it('prefers Origin over Sec-Fetch-Site when both are present', () => {
    const { next } = run({
      origin: 'https://app.example.com',
      host: 'app.example.com',
      'sec-fetch-site': 'cross-site', // contradictory — Origin wins
    })
    expect(next).toHaveBeenCalledOnce()
  })
})
