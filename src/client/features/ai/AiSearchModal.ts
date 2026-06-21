import './ai.css'
import { clone, ref } from '@/core/template.js'
import { sendAiChat, type ChatTurn } from './AiClient.js'
import type { AiIntent } from './intentSchema.js'
import modalHtml from './aiSearchModal.html?raw'

export interface AiSearchModalDeps {
  /** Apply a confirmed intent to the map (filters + place jump). */
  readonly onApply: (intent: AiIntent) => void | Promise<void>
  /** Max user turns before the chat is locked (mirrors backend AI_MAX_TURNS). */
  readonly maxTurns?: number
}

// Small chat modal for the natural-language search. The conversation produces a
// validated intent; "Auf Karte zeigen" hands it to onApply and closes — the map
// itself is the result, so there's no separate result list here.
export class AiSearchModal {
  private readonly overlay: HTMLElement
  private readonly messagesEl: HTMLElement
  private readonly input: HTMLInputElement
  private readonly form: HTMLFormElement
  private readonly maxTurns: number
  private messages: ChatTurn[] = []
  private busy = false

  constructor(container: HTMLElement, private readonly deps: AiSearchModalDeps) {
    this.maxTurns = deps.maxTurns ?? 5
    const root = clone(modalHtml)
    container.appendChild(root)
    this.overlay = root
    this.messagesEl = ref(root, 'messages')
    this.input = ref<HTMLInputElement>(root, 'input')
    this.form = ref<HTMLFormElement>(root, 'form')

    ref(root, 'close').addEventListener('click', () => this.close())
    this.overlay.addEventListener('mousedown', (e) => { if (e.target === this.overlay) this.close() })
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.overlay.classList.contains('hidden')) this.close()
    })
    this.form.addEventListener('submit', (e) => { e.preventDefault(); void this.send() })
  }

  /** Open the modal; if `prefill` is given, it's sent as the first question. */
  open(prefill = ''): void {
    this.messages = []
    this.busy = false
    this.messagesEl.innerHTML = ''
    this.input.value = ''
    this.input.disabled = false
    this.overlay.classList.remove('hidden')
    this.addAssistant('Wonach suchst du? Beschreib z. B. „ruhiger Stellplatz am Bodensee mit Entsorgung".')
    const seed = prefill.trim()
    if (seed) { this.input.value = seed; void this.send() }
    else setTimeout(() => this.input.focus(), 50)
  }

  close(): void {
    this.overlay.classList.add('hidden')
  }

  private async send(): Promise<void> {
    if (this.busy) return
    const text = this.input.value.trim()
    if (!text) return

    this.addUser(text)
    this.messages.push({ role: 'user', content: text })
    this.input.value = ''

    const userTurns = this.messages.filter(m => m.role === 'user').length
    if (userTurns > this.maxTurns) {
      this.addAssistant(`Frage-Limit von ${this.maxTurns} erreicht – bitte schließen und neu starten.`)
      this.lock()
      return
    }

    this.setBusy(true)
    const typing = this.addTyping()
    const res = await sendAiChat(this.messages)
    typing.remove()
    this.setBusy(false)

    this.messages.push({ role: 'assistant', content: res.reply })

    if (res.status === 'ready' && res.intent) {
      this.addAssistant(res.reply)
      this.addResultCard(res.intent)
    } else if (res.status === 'limit') {
      this.addAssistant(res.reply)
      this.lock()
    } else {
      // clarify | offtopic | error → just show the reply, keep chatting
      this.addAssistant(res.reply, res.status === 'offtopic' || res.status === 'error')
    }
  }

  // ── Rendering ───────────────────────────────────────────────────────────────

  private addUser(text: string): void {
    this.bubble('user').textContent = text
  }

  private addAssistant(text: string, muted = false): void {
    const el = this.bubble('assistant')
    if (muted) el.classList.add('ai-bubble--muted')
    el.textContent = text
  }

  private addTyping(): HTMLElement {
    const el = this.bubble('assistant')
    el.classList.add('ai-bubble--typing')
    el.textContent = '…'
    return el
  }

  private bubble(kind: 'user' | 'assistant'): HTMLElement {
    const el = document.createElement('div')
    el.className = `ai-bubble ai-bubble--${kind}`
    this.messagesEl.appendChild(el)
    this.scrollDown()
    return el
  }

  private addResultCard(intent: AiIntent): void {
    const card = document.createElement('div')
    card.className = 'ai-result-card'

    const recap = document.createElement('div')
    recap.className = 'ai-result-recap'
    const bits: string[] = []
    if (intent.place) bits.push(`📍 ${intent.place}`)
    const cats = intent.enableFilters.length + intent.adHocFilters.length
    if (cats) bits.push(`${cats} Kategorie${cats > 1 ? 'n' : ''}`)
    recap.textContent = bits.join(' · ') || 'Auswahl anwenden'
    card.appendChild(recap)

    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'ai-result-apply'
    btn.textContent = 'Auf Karte zeigen'
    btn.addEventListener('click', () => {
      void Promise.resolve(this.deps.onApply(intent))
      this.close()
    })
    card.appendChild(btn)

    this.messagesEl.appendChild(card)
    this.scrollDown()
  }

  private lock(): void {
    this.input.disabled = true
    this.input.placeholder = 'Suche neu starten…'
  }

  private setBusy(busy: boolean): void {
    this.busy = busy
    this.input.disabled = busy
    if (!busy) this.input.focus()
  }

  private scrollDown(): void {
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight
  }
}
