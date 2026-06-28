import type { Auth } from '@/features/auth/auth.js'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { SyncedFavoritesStore } from '@/features/favorites/RemoteFavoritesStore.js'
import type { SyncedNotesStore } from '@/features/notes/RemoteNotesStore.js'
import type { SyncedFilterStore } from '@/features/filters/RemoteFilterStore.js'
import { createSupabaseFavoritesBackend } from '@/features/favorites/RemoteFavoritesStore.js'
import { createSupabaseNotesBackend } from '@/features/notes/RemoteNotesStore.js'
import { createSupabaseFilterBackend } from '@/features/filters/RemoteFilterStore.js'
import { createSupabaseCustomPoiBackend, type CustomPoiBackend } from '@/features/custom-pois/RemoteCustomPoiStore.js'
import type { HelpSeenStore } from '@/features/help/HelpSeenStore.js'

export interface AuthSyncDeps {
  readonly auth: Auth
  readonly supabase: SupabaseClient
  readonly favorites: SyncedFavoritesStore
  readonly notes: SyncedNotesStore
  readonly filterStore: SyncedFilterStore
  readonly connectCustomPois: (backend: CustomPoiBackend) => Promise<void>
  readonly disconnectCustomPois: () => void
  readonly onFavoritesSynced: () => void
  readonly onCustomPoisSynced: () => void
  readonly helpSeenStore: HelpSeenStore
  readonly onHelpSeenFromServer: () => void
}

export async function initAuthSync(deps: AuthSyncDeps): Promise<void> {
  const { auth, supabase, favorites, notes, filterStore, connectCustomPois, disconnectCustomPois, onFavoritesSynced, onCustomPoisSynced, helpSeenStore, onHelpSeenFromServer } = deps

  auth.onChange(user => {
    if (user) {
      void favorites
        .connect(createSupabaseFavoritesBackend(supabase, user.id))
        .then(() => onFavoritesSynced())
      void notes.connect(createSupabaseNotesBackend(supabase, user.id))
      void connectCustomPois(createSupabaseCustomPoiBackend(supabase, user.id))
        .then(() => onCustomPoisSynced())
      void filterStore.connect(createSupabaseFilterBackend(supabase, user.id))
      if (user.helpSeen) {
        helpSeenStore.markSeen()
        onHelpSeenFromServer()
      }
    } else {
      favorites.disconnect()
      notes.disconnect()
      disconnectCustomPois()
      filterStore.disconnect()
    }
  })

  // Session recovery: wenn der Magic-Link im Browser geöffnet wurde, während
  // die PWA/App noch läuft. recoverSession() triggert über setSession() den
  // onAuthStateChange-Callback, der die Stores initial verbindet. Wiederholte
  // Aufrufe sind harmlos – connect() in den Stores ist idempotent (Guard).
  const recover = async () => {
    try {
      await auth.recoverSession()
    } catch { /* ignore */ }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void recover()
  })
}
