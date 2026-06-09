import type { User } from '@supabase/supabase-js'
import type { Auth } from './auth.js'
import { isValidEmail } from './isValidEmail.js'
import { clone, ref } from '@/core/template.js'
import panelHtml from './authPanel.html?raw'
import loggedInHtml from './authLoggedIn.html?raw'
import loggedOutHtml from './authLoggedOut.html?raw'

/** Modal for passwordless login (magic-link) and logout. Re-renders on auth change. */
export class AuthPanel {
  private readonly backdrop: HTMLElement
  private readonly panel: HTMLElement
  private readonly body: HTMLElement
  private user: User | null = null

  constructor(container: HTMLElement, private readonly auth: Auth) {
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
    this.body.appendChild(this.user ? this.renderLoggedIn(this.user) : this.renderLoggedOut())
  }

  private renderLoggedIn(user: User): HTMLElement {
    const view = clone(loggedInHtml)
    ref(view, 'info').textContent = `Angemeldet als ${user.email ?? 'unbekannt'}`
    ref(view, 'logout').addEventListener('click', () => void this.auth.signOut())
    return view
  }

  private renderLoggedOut(): HTMLElement {
    const view = clone(loggedOutHtml)
    const input = ref<HTMLInputElement>(view, 'input')
    const send = ref<HTMLButtonElement>(view, 'send')
    const msg = ref(view, 'msg')

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

    return view
  }
}
