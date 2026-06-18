// Provider-agnostic OpenAI-compatible chat-completions wrapper.
//
// The app pins no AI vendor: base URL, key and model all come from env. Default
// provider is OpenRouter (largest open-model selection behind an OpenAI-style
// API); swap AI_PROVIDER_BASE_URL to e.g. a local Ollama (http://localhost:11434/v1)
// or any other OpenAI-compatible endpoint.

const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1'
const DEFAULT_MODEL = 'meta-llama/llama-3.3-70b-instruct'

export interface ChatMessage {
  readonly role: 'system' | 'user' | 'assistant'
  readonly content: string
}

export interface ChatOptions {
  readonly maxTokens?: number
  readonly temperature?: number
  /** Ask the provider for a strict JSON object response (Phase 2 chat intents). */
  readonly jsonObject?: boolean
}

/** True when a provider key is configured — callers degrade gracefully otherwise. */
export function aiConfigured(): boolean {
  return (Deno.env.get('AI_PROVIDER_KEY') ?? '').trim().length > 0
}

/** The configured model name (or the default), used e.g. in cache keys. */
export function aiModel(): string {
  return (Deno.env.get('AI_MODEL') ?? '').trim() || DEFAULT_MODEL
}

/**
 * Calls the configured /chat/completions endpoint and returns the assistant
 * message text (trimmed). Throws on transport error or non-2xx so the caller
 * can decide how to map it; returns '' if the response shape is unexpected.
 */
export async function chatCompletion(
  messages: readonly ChatMessage[],
  opts: ChatOptions = {},
): Promise<string> {
  const baseUrl = ((Deno.env.get('AI_PROVIDER_BASE_URL') ?? '').trim() || DEFAULT_BASE_URL).replace(/\/+$/, '')
  const key = (Deno.env.get('AI_PROVIDER_KEY') ?? '').trim()

  const body: Record<string, unknown> = {
    model: aiModel(),
    messages,
    temperature: opts.temperature ?? 0.2,
    max_tokens: opts.maxTokens ?? 400,
  }
  if (opts.jsonObject) body.response_format = { type: 'json_object' }

  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
      // OpenRouter attribution headers — harmlessly ignored by other providers.
      'HTTP-Referer': 'https://fenta23.github.io/stellplatz-maps-finder/',
      'X-Title': 'Stellplatz Maps Finder',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  })

  if (!resp.ok) {
    const detail = await resp.text().catch(() => '')
    throw new Error(`AI provider ${resp.status}: ${detail.slice(0, 200)}`)
  }

  const data = await resp.json() as { choices?: Array<{ message?: { content?: string } }> }
  return data.choices?.[0]?.message?.content?.trim() ?? ''
}
