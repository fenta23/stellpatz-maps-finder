import type { Request, Response, NextFunction } from 'express'

// Blocks cross-site browser traffic to the API.
//
// Browsers attach `Origin` (on all POSTs + cross-origin requests) and
// `Sec-Fetch-Site` (on every fetch in modern browsers). Same-origin app
// requests carry `Sec-Fetch-Site: same-origin` and, for POSTs, an Origin
// matching the request host. A foreign website cannot strip or fake either
// header from a visitor's browser, so this stops third-party pages from
// burning our upstream quotas (e.g. no-cors request spray against the
// Mapillary proxy). Header-less clients (curl, very old browsers) pass —
// outside a browser headers are trivially fakeable anyway; the rate limiter
// is the backstop there.
export function originGuard(extraAllowedOrigins: readonly string[] = []) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.headers.origin
    if (typeof origin === 'string') {
      const sameHost = (() => {
        try { return new URL(origin).host === req.headers.host } catch { return false }
      })()
      if (!sameHost && !extraAllowedOrigins.includes(origin)) {
        res.status(403).json({ error: 'Forbidden origin' })
        return
      }
    } else {
      // 'none' = direct navigation (URL bar) — harmless, keep health checks usable.
      const site = req.headers['sec-fetch-site']
      if (typeof site === 'string' && site !== 'same-origin' && site !== 'none') {
        res.status(403).json({ error: 'Forbidden origin' })
        return
      }
    }
    next()
  }
}
