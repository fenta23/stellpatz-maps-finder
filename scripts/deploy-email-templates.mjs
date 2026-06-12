// Pusht die gebrandeten Auth-E-Mail-Templates aus supabase/templates/ ins
// gehostete Supabase-Projekt — macht die HTML-Dateien zur echten Source of Truth
// (statt sie manuell ins Dashboard zu kopieren).
//
//   npm run deploy:email     (Token aus Env / .env / ~/.config/supabase/access-token)
//   SUPABASE_ACCESS_TOKEN=<pat> npm run deploy:email
//
// Nutzt denselben Token wie `supabase login` / deploy:edge — wer eingeloggt ist,
// braucht nichts weiter zu setzen.
// Management-API: PATCH /v1/projects/{ref}/config/auth

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'

const PROJECT_REF = 'hhonilnfkmqppcsrwzbk'
const here = dirname(fileURLToPath(import.meta.url))
const tpl = (name) => join(here, '..', 'supabase', 'templates', name)

/**
 * Token-Suche in Reihenfolge:
 *   1. SUPABASE_ACCESS_TOKEN aus der Umgebung (explizit, gewinnt immer)
 *   2. SUPABASE_ACCESS_TOKEN in .env
 *   3. ~/.config/supabase/access-token — dieselbe Datei, die `supabase login`
 *      anlegt und die deploy:edge nutzt (XDG_CONFIG_HOME respektiert)
 */
async function readToken() {
  if (process.env.SUPABASE_ACCESS_TOKEN) return process.env.SUPABASE_ACCESS_TOKEN.trim()

  try {
    const env = await readFile(join(here, '..', '.env'), 'utf8')
    const m = env.match(/^\s*SUPABASE_ACCESS_TOKEN\s*=\s*(.+?)\s*$/m)
    const fromEnv = m?.[1]?.replace(/^["']|["']$/g, '').trim()
    if (fromEnv) return fromEnv
  } catch { /* keine .env — egal */ }

  try {
    const cfg = process.env.XDG_CONFIG_HOME || join(homedir(), '.config')
    return (await readFile(join(cfg, 'supabase', 'access-token'), 'utf8')).trim()
  } catch {
    return ''
  }
}

// Welche Datei + Betreff auf welche Management-API-Felder gemappt wird.
const TEMPLATES = [
  {
    file: 'magic-link.html',
    subject: 'Dein Login-Code – Stellplatz Finder',
    contentField: 'mailer_templates_magic_link_content',
    subjectField: 'mailer_subjects_magic_link',
  },
  {
    file: 'confirm-signup.html',
    subject: 'Willkommen bei Stellplatz Finder – E-Mail bestätigen',
    contentField: 'mailer_templates_confirmation_content',
    subjectField: 'mailer_subjects_confirmation',
  },
]

async function main() {
  const token = await readToken()
  if (!token) {
    console.error('✗ Kein Access-Token gefunden (Env, .env, ~/.config/supabase/access-token).')
    console.error('  Einloggen: npm run supabase:login   — oder Token erstellen:')
    console.error('  https://supabase.com/dashboard/account/tokens')
    process.exit(1)
  }

  const body = {}
  for (const t of TEMPLATES) {
    body[t.contentField] = await readFile(tpl(t.file), 'utf8')
    body[t.subjectField] = t.subject
  }

  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/config/auth`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    console.error(`✗ Update fehlgeschlagen (${res.status}): ${await res.text()}`)
    process.exit(1)
  }
  console.log(`✓ E-Mail-Templates aktualisiert: ${TEMPLATES.map((t) => t.file).join(', ')}`)
}

main().catch((err) => {
  console.error('✗ Unerwarteter Fehler:', err)
  process.exit(1)
})
