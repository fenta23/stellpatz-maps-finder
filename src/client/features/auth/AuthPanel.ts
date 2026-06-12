import type { User } from '@supabase/supabase-js'
import type { Auth } from './auth.js'
import { isValidEmail } from './isValidEmail.js'
import { clone, ref } from '@/core/template.js'
import panelHtml from './authPanel.html?raw'
import loggedInHtml from './authLoggedIn.html?raw'
import loggedOutHtml from './authLoggedOut.html?raw'

export interface ProfileStats {
  readonly favorites: number
  readonly notes: number
}

export interface AuthPanelOptions {
  /** Live counts shown in the profile overview (favorites / notes). */
  getStats?: () => ProfileStats
}

const PROVIDER_LABELS: Record<string, string> = {
  email: 'E-Mail',
}

/** Modal for passwordless login (E-Mail-OTP-Code) and a profile overview. */
export class AuthPanel {
  private readonly backdrop: HTMLElement
  private readonly panel: HTMLElement
  private readonly body: HTMLElement
  private user: User | null = null

  constructor(container: HTMLElement, private readonly auth: Auth, private readonly opts: AuthPanelOptions = {}) {
    this.backdrop = clone('<div class="auth-backdrop"></div>')
    this.backdrop.addEventListener('click', () => this.close())

    this.panel = clone(panelHtml)
    this.panel.querySelector('.auth-close')?.addEventListener('click', () => this.close())
    this.body = ref(this.panel, 'body')

    container.append(this.backdrop, this.panel)

    void this.auth.currentUser().then(u => { this.user = u; this.render() })
    this.auth.onChange(u => { this.user = u; this.render() })
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && this.isOpen()) this.close() })
    this.render()
  }

  isOpen(): boolean { return this.panel.classList.contains('open') }
  open(): void { this.render(); this.panel.classList.add('open'); this.backdrop.classList.add('open') }
  close(): void { this.panel.classList.remove('open'); this.backdrop.classList.remove('open') }

  private render(): void {
    this.body.innerHTML = ''
    this.body.appendChild(this.user ? this.renderProfile(this.user) : this.renderLoggedOut())
  }

  private renderProfile(user: User): HTMLElement {
    const view = clone(loggedInHtml)
    ref(view, 'info').textContent = `Angemeldet als ${user.email ?? 'unbekannt'}`
    ref(view, 'method').textContent = providerLabel(user)
    ref(view, 'since').textContent = formatSince(user.created_at)

    const stats = this.opts.getStats?.()
    ref(view, 'favCount').textContent = stats ? String(stats.favorites) : '–'
    ref(view, 'noteCount').textContent = stats ? String(stats.notes) : '–'

    ref(view, 'logout').addEventListener('click', () => void this.auth.signOut())
    return view
  }

  private renderLoggedOut(): HTMLElement {
    const view = clone(loggedOutHtml)

    const stepEmail = ref(view, 'stepEmail')
    const stepCode = ref(view, 'stepCode')
    const input = ref<HTMLInputElement>(view, 'input')
    const send = ref<HTMLButtonElement>(view, 'send')
    const code = ref<HTMLInputElement>(view, 'code')
    const verify = ref<HTMLButtonElement>(view, 'verify')
    const back = ref<HTMLButtonElement>(view, 'back')
    const msg = ref(view, 'msg')

    const setMsg = (text: string, kind: '' | 'ok' | 'error' = '') => {
      msg.textContent = text
      msg.className = kind ? `auth-msg auth-msg-${kind}` : 'auth-msg'
    }
    const showStep = (step: 'email' | 'code') => {
      stepEmail.hidden = step !== 'email'
      stepCode.hidden = step !== 'code'
    }

    send.addEventListener('click', async () => {
      const email = input.value.trim()
      if (!isValidEmail(email)) {
        setMsg('Bitte eine gültige E-Mail eingeben.', 'error')
        return
      }
      send.disabled = true
      setMsg('Wird gesendet…')
      const res = await this.auth.sendMagicLink(email)
      send.disabled = false
      if (res.ok) {
        showStep('code')
        code.focus()
        setMsg(`Code an ${email} gesendet — gib ihn hier ein.`, 'ok')
      } else {
        setMsg(res.error, 'error')
      }
    })

    verify.addEventListener('click', async () => {
      const email = input.value.trim()
      const token = code.value.trim()
      if (!/^\d{6}$/.test(token)) {
        setMsg('Bitte den 6-stelligen Code eingeben.', 'error')
        return
      }
      verify.disabled = true
      setMsg('Wird geprüft…')
      const res = await this.auth.verifyOtp(email, token)
      verify.disabled = false
      if (!res.ok) setMsg(res.error, 'error')
      // On success the onChange handler re-renders into the profile view.
    })

    back.addEventListener('click', () => {
      code.value = ''
      showStep('email')
      setMsg('')
    })

    return view
  }
}

function providerLabel(user: User): string {
  const p = (user.app_metadata?.['provider'] as string | undefined) ?? ''
  return PROVIDER_LABELS[p] ?? (p || 'unbekannt')
}

function formatSince(iso?: string): string {
  if (!iso) return '–'
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? '–'
    : d.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
}
