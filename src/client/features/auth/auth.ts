import type { SupabaseClient, User, Session } from '@supabase/supabase-js'

export type MagicLinkResult = { ok: true } | { ok: false; error: string }

export interface Auth {
  /** Sends a passwordless magic-link to the given email. */
  sendMagicLink(email: string): Promise<MagicLinkResult>
  /** Starts the Google OAuth flow (full-page redirect; no email involved). */
  signInWithGoogle(): Promise<void>
  signOut(): Promise<void>
  currentUser(): Promise<User | null>
  /** Subscribe to login/logout; returns an unsubscribe fn. */
  onChange(cb: (user: User | null) => void): () => void
  /**
   * Re-read the session from storage (e.g. after a magic-link redirect in the
   * browser while the PWA stayed open). Returns the current user if recovered.
   */
  recoverSession(): Promise<User | null>
}

/** Derive the Supabase localStorage key from the project URL. */
function storageKey(supabaseUrl: string): string {
  const ref = supabaseUrl.match(/https:\/\/(.+)\.supabase\.co/)?.[1]
  return ref ? `sb-${ref}-auth-token` : ''
}

/** Thin, testable wrapper over Supabase Auth (client injected for tests). */
export function createAuth(client: SupabaseClient): Auth {
  const key = storageKey(client.supabaseUrl)

  return {
    async sendMagicLink(email) {
      const { error } = await client.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin + window.location.pathname },
      })
      return error ? { ok: false, error: error.message } : { ok: true }
    },

    async signInWithGoogle() {
      await client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin + window.location.pathname },
      })
    },

    async signOut() {
      await client.auth.signOut()
    },

    async currentUser() {
      const { data } = await client.auth.getUser()
      return data.user ?? null
    },

    onChange(cb) {
      const { data } = client.auth.onAuthStateChange((_event, session) => cb(session?.user ?? null))
      return () => data.subscription.unsubscribe()
    },

    async recoverSession() {
      if (!key) return null
      const raw = localStorage.getItem(key)
      if (!raw) return null
      try {
        const session = JSON.parse(raw) as Session
        const { data } = await client.auth.setSession(session)
        return data.user
      } catch {
        return null
      }
    },
  }
}
