import { describe, it, expect, vi } from 'vitest'
import type { User } from '@supabase/supabase-js'
import { AuthPanel } from './AuthPanel.js'
import type { Auth, MagicLinkResult } from './auth.js'

function fakeAuth(initialUser: User | null = null) {
  let changeCb: ((u: User | null) => void) | undefined
  const auth: Auth = {
    sendMagicLink: vi.fn<(e: string) => Promise<MagicLinkResult>>().mockResolvedValue({ ok: true }),
    signOut: vi.fn().mockResolvedValue(undefined),
    currentUser: vi.fn().mockResolvedValue(initialUser),
    onChange: vi.fn((cb: (u: User | null) => void) => { changeCb = cb; return () => {} }),
  }
  return { auth, emitChange: (u: User | null) => changeCb?.(u) }
}

const flush = () => new Promise(r => setTimeout(r, 0))

describe('AuthPanel — logged out', () => {
  it('renders the email form', async () => {
    const c = document.createElement('div')
    const { auth } = fakeAuth(null)
    new AuthPanel(c, auth)
    await flush()
    expect(c.querySelector<HTMLInputElement>('.auth-input')).not.toBeNull()
    expect(c.querySelector('.auth-btn-primary')?.textContent).toBe('Magic-Link senden')
  })

  it('rejects an invalid email without calling the backend', async () => {
    const c = document.createElement('div')
    const { auth } = fakeAuth(null)
    new AuthPanel(c, auth)
    await flush()
    c.querySelector<HTMLInputElement>('.auth-input')!.value = 'nope'
    c.querySelector<HTMLButtonElement>('.auth-btn-primary')!.click()
    expect(auth.sendMagicLink).not.toHaveBeenCalled()
    expect(c.querySelector('.auth-msg-error')?.textContent).toContain('gültige E-Mail')
  })

  it('sends a magic link for a valid email', async () => {
    const c = document.createElement('div')
    const { auth } = fakeAuth(null)
    new AuthPanel(c, auth)
    await flush()
    c.querySelector<HTMLInputElement>('.auth-input')!.value = 'me@example.com'
    c.querySelector<HTMLButtonElement>('.auth-btn-primary')!.click()
    await flush()
    expect(auth.sendMagicLink).toHaveBeenCalledWith('me@example.com')
    expect(c.querySelector('.auth-msg-ok')?.textContent).toContain('gesendet')
  })
})

describe('AuthPanel — logged in', () => {
  it('shows the email and a logout button on auth change', async () => {
    const c = document.createElement('div')
    const { auth, emitChange } = fakeAuth(null)
    new AuthPanel(c, auth)
    await flush()
    emitChange({ email: 'max@example.com' } as User)
    expect(c.querySelector('.auth-info')?.textContent).toContain('max@example.com')
    const logout = c.querySelector<HTMLButtonElement>('.auth-btn')!
    expect(logout.textContent).toBe('Abmelden')
    logout.click()
    expect(auth.signOut).toHaveBeenCalledOnce()
  })
})
