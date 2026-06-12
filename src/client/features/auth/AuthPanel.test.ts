import { describe, it, expect, vi } from 'vitest'
import type { User } from '@supabase/supabase-js'
import { AuthPanel } from './AuthPanel.js'
import type { Auth, MagicLinkResult } from './auth.js'

function fakeAuth(initialUser: User | null = null) {
  let changeCb: ((u: User | null) => void) | undefined
  const auth: Auth = {
    sendMagicLink: vi.fn<(e: string) => Promise<MagicLinkResult>>().mockResolvedValue({ ok: true }),
    signInWithGoogle: vi.fn().mockResolvedValue(undefined),
    signOut: vi.fn().mockResolvedValue(undefined),
    currentUser: vi.fn().mockResolvedValue(initialUser),
    onChange: vi.fn((cb: (u: User | null) => void) => { changeCb = cb; return () => {} }),
  }
  return { auth, emitChange: (u: User | null) => changeCb?.(u) }
}

const flush = () => new Promise(r => setTimeout(r, 0))

describe('AuthPanel — logged out', () => {
  it('renders the Google button and the email form', async () => {
    const c = document.createElement('div')
    new AuthPanel(c, fakeAuth(null).auth)
    await flush()
    expect(c.querySelector('[data-ref="google"]')).not.toBeNull()
    expect(c.querySelector<HTMLInputElement>('.auth-input')).not.toBeNull()
    expect(c.querySelector('.auth-btn-primary')?.textContent).toBe('Magic-Link senden')
  })

  it('starts the Google flow on click', async () => {
    const c = document.createElement('div')
    const { auth } = fakeAuth(null)
    new AuthPanel(c, auth)
    await flush()
    c.querySelector<HTMLButtonElement>('[data-ref="google"]')!.click()
    expect(auth.signInWithGoogle).toHaveBeenCalledOnce()
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

describe('AuthPanel — profile (logged in)', () => {
  const user = {
    email: 'max@example.com',
    app_metadata: { provider: 'google' },
    created_at: '2026-01-15T10:00:00Z',
  } as unknown as User

  it('shows email, provider, member-since and a logout button', async () => {
    const c = document.createElement('div')
    const { auth, emitChange } = fakeAuth(null)
    new AuthPanel(c, auth)
    await flush()
    emitChange(user)
    expect(c.textContent).toContain('max@example.com')
    expect(c.querySelector('[data-ref="method"]')?.textContent).toBe('Google')
    expect(c.querySelector('[data-ref="since"]')?.textContent).toContain('2026')
    const logout = c.querySelector<HTMLButtonElement>('[data-ref="logout"]')!
    expect(logout.textContent).toBe('Abmelden')
    logout.click()
    expect(auth.signOut).toHaveBeenCalledOnce()
  })

  it('shows favorite/note counts from getStats', async () => {
    const c = document.createElement('div')
    const { auth, emitChange } = fakeAuth(null)
    new AuthPanel(c, auth, { getStats: () => ({ favorites: 3, notes: 5 }) })
    await flush()
    emitChange(user)
    expect(c.querySelector('[data-ref="favCount"]')?.textContent).toBe('3')
    expect(c.querySelector('[data-ref="noteCount"]')?.textContent).toBe('5')
  })

  it('shows a dash for counts when no stats provider is given', async () => {
    const c = document.createElement('div')
    const { auth, emitChange } = fakeAuth(null)
    new AuthPanel(c, auth)
    await flush()
    emitChange(user)
    expect(c.querySelector('[data-ref="favCount"]')?.textContent).toBe('–')
  })
})

describe('AuthPanel — close button', () => {
  it('closes the panel when the X button is clicked', async () => {
    const c = document.createElement('div')
    const panel = new AuthPanel(c, fakeAuth(null).auth)
    await flush()
    expect(panel.isOpen()).toBe(false)
    panel.open()
    expect(panel.isOpen()).toBe(true)
    const closeBtn = c.querySelector<HTMLButtonElement>('.auth-close')!
    closeBtn.click()
    expect(panel.isOpen()).toBe(false)
  })
})
