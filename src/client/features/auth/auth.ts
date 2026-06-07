import type { SupabaseClient, User } from '@supabase/supabase-js'

export type MagicLinkResult = { ok: true } | { ok: false; error: string }

export interface Auth {
  /** Sends a passwordless magic-link to the given email. */
  sendMagicLink(email: string): Promise<MagicLinkResult>
  signOut(): Promise<void>
  currentUser(): Promise<User | null>
  /** Subscribe to login/logout; returns an unsubscribe fn. */
  onChange(cb: (user: User | null) => void): () => void
}

/** Thin, testable wrapper over Supabase Auth (client injected for tests). */
export function createAuth(client: SupabaseClient): Auth {
  return {
    async sendMagicLink(email) {
      const { error } = await client.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.origin },
      })
      return error ? { ok: false, error: error.message } : { ok: true }
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
  }
}
