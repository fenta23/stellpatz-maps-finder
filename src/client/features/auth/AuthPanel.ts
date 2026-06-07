import type { User } from '@supabase/supabase-js'
import type { Auth } from './auth.js'
import { isValidEmail } from './isValidEmail.js'

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  node.className = cls
  return node
}

/** Modal for passwordless login (magic-link) and logout. Re-renders on auth change. */
export class AuthPanel {
  private readonly backdrop: HTMLElement
  private readonly panel: HTMLElement
  private readonly body: HTMLElement
  private user: User | null = null

  constructor(container: HTMLElement, private readonly auth: Auth) {
    this.backdrop = el('div', 'auth-backdrop')
    this.backdrop.addEventListener('click', () => this.close())

    this.panel = el('div', 'auth-panel')
    this.panel.setAttribute('role', 'dialog')
    this.panel.setAttribute('aria-label', 'Konto')
    this.body = el('div', 'auth-body')
    this.panel.appendChild(this.body)

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
    this.body.appendChild(this.closeButton())
    if (this.user) this.renderLoggedIn(this.user)
    else this.renderLoggedOut()
  }

  private renderLoggedIn(user: User): void {
    const title = el('h2', 'auth-title'); title.textContent = 'Konto'
    const info = el('p', 'auth-info'); info.textContent = `Angemeldet als ${user.email ?? 'unbekannt'}`
    const out = el('button', 'auth-btn'); out.type = 'button'; out.textContent = 'Abmelden'
    out.addEventListener('click', () => void this.auth.signOut())
    this.body.append(title, info, out)
  }

  private renderLoggedOut(): void {
    const title = el('h2', 'auth-title'); title.textContent = 'Anmelden'
    const hint = el('p', 'auth-info')
    hint.textContent = 'Wir senden dir einen Magic-Link per E-Mail — kein Passwort nötig.'

    const input = el('input', 'auth-input')
    input.type = 'email'
    input.placeholder = 'deine@email.de'
    input.autocomplete = 'email'

    const msg = el('p', 'auth-msg')
    const send = el('button', 'auth-btn auth-btn-primary')
    send.type = 'button'
    send.textContent = 'Magic-Link senden'

    send.addEventListener('click', async () => {
      const email = input.value.trim()
      if (!isValidEmail(email)) {
        msg.textContent = 'Bitte eine gültige E-Mail eingeben.'
        msg.className = 'auth-msg auth-msg-error'
        return
      }
      send.disabled = true
      msg.textContent = 'Wird gesendet…'
      msg.className = 'auth-msg'
      const res = await this.auth.sendMagicLink(email)
      send.disabled = false
      if (res.ok) {
        msg.textContent = `E-Mail an ${email} gesendet — Link zum Anmelden klicken.`
        msg.className = 'auth-msg auth-msg-ok'
      } else {
        msg.textContent = res.error
        msg.className = 'auth-msg auth-msg-error'
      }
    })

    this.body.append(title, hint, input, send, msg)
  }

  private closeButton(): HTMLButtonElement {
    const c = el('button', 'auth-close')
    c.type = 'button'
    c.textContent = '✕'
    c.setAttribute('aria-label', 'Schließen')
    c.addEventListener('click', () => this.close())
    return c
  }
}
