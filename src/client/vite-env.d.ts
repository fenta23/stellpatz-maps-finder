/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** DSGVO-Verantwortlicher (Klarname), per Build-Env injiziert — siehe InfoPanel. */
  readonly VITE_DSGVO_VERANTWORTLICHER?: string
}
