import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAuth } from './auth.js'

function fakeClient(over: Record<string, unknown> = {}) {
  const unsubscribe = vi.fn()
  const auth = {
    signInWithOtp: vi.fn().mockResolvedValue({ error: null }),
    verifyOtp: vi.fn().mockResolvedValue({ error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    getUser: vi.fn().mockResolvedValue({ data: { user: null } }),
    getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
    setSession: vi.fn().mockResolvedValue({ data: { user: null } }),
    onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe } } }),
    ...over,
  }
  return { client: { auth, supabaseUrl: 'https://x.supabase.co' } as unknown as SupabaseClient, auth, unsubscribe }
}

describe('createAuth.sendMagicLink', () => {
  it('returns ok and forwards the email + redirect', async () => {
    const { client, auth } = fakeClient()
    const res = await createAuth(client).sendMagicLink('me@example.com')
    expect(res).toEqual({ ok: true })
    expect(auth.signInWithOtp).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'me@example.com' }),
    )
  })

  it('maps a Supabase error to { ok:false, error }', async () => {
    const { client } = fakeClient({ signInWithOtp: vi.fn().mockResolvedValue({ error: { message: 'rate limited' } }) })
    const res = await createAuth(client).sendMagicLink('me@example.com')
    expect(res).toEqual({ ok: false, error: 'rate limited' })
  })
})

describe('createAuth.verifyOtp', () => {
  it('returns ok and forwards email + token with type "email"', async () => {
    const { client, auth } = fakeClient()
    const res = await createAuth(client).verifyOtp('me@example.com', '123456')
    expect(res).toEqual({ ok: true })
    expect(auth.verifyOtp).toHaveBeenCalledWith({ email: 'me@example.com', token: '123456', type: 'email' })
  })

  it('maps a Supabase error to { ok:false, error }', async () => {
    const { client } = fakeClient({ verifyOtp: vi.fn().mockResolvedValue({ error: { message: 'invalid token' } }) })
    const res = await createAuth(client).verifyOtp('me@example.com', '000000')
    expect(res).toEqual({ ok: false, error: 'invalid token' })
  })
})

describe('createAuth.currentUser', () => {
  it('returns the user or null', async () => {
    const withUser = fakeClient({ getUser: vi.fn().mockResolvedValue({ data: { user: { id: '1', email: 'x@y.z' } } }) })
    expect((await createAuth(withUser.client).currentUser())?.email).toBe('x@y.z')
    const none = fakeClient()
    expect(await createAuth(none.client).currentUser()).toBeNull()
  })
})

describe('createAuth.recoverSession', () => {
  it('returns null when no session is in localStorage', async () => {
    const { client } = fakeClient()
    const user = await createAuth(client).recoverSession()
    expect(user).toBeNull()
  })

  it('recovers a session from localStorage and calls setSession', async () => {
    localStorage.setItem('sb-x-auth-token', JSON.stringify({ access_token: 't', refresh_token: 'r' }))
    const setSession = vi.fn().mockResolvedValue({ data: { user: { id: '1', email: 'a@b.c' } } })
    const { client } = fakeClient({ setSession })
    const user = await createAuth(client).recoverSession()
    expect(user?.email).toBe('a@b.c')
    expect(setSession).toHaveBeenCalledWith({ access_token: 't', refresh_token: 'r' })
    localStorage.clear()
  })
})

describe('createAuth.onChange', () => {
  it('subscribes and returns an unsubscribe that calls the subscription', () => {
    const { client, unsubscribe } = fakeClient()
    const off = createAuth(client).onChange(() => {})
    off()
    expect(unsubscribe).toHaveBeenCalledOnce()
  })

  it('forwards the session user to the callback', () => {
    let captured: ((event: string, session: unknown) => void) | undefined
    const { client } = fakeClient({
      onAuthStateChange: vi.fn().mockImplementation((cb) => {
        captured = cb
        return { data: { subscription: { unsubscribe: vi.fn() } } }
      }),
    })
    const seen: Array<string | null> = []
    createAuth(client).onChange(u => seen.push(u?.email ?? null))
    captured!('SIGNED_IN', { user: { email: 'a@b.c' } })
    captured!('SIGNED_OUT', null)
    expect(seen).toEqual(['a@b.c', null])
  })
})
