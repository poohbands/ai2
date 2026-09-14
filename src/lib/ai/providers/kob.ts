import {
  AIProvider,
  ChatOptions,
  ChatResponse,
  StreamChunk,
  AIProviderError,
} from './types'

/**
 * Generic OpenAI-compatible chat provider.
 * Covers Kob AI, DeepSeek, OpenRouter and any /v1-style endpoint.
 */
export class OpenAICompatibleProvider implements AIProvider {
  protected baseUrl: string
  protected apiKey: string
  protected label: string
  protected extraHeaders: Record<string, string>

  constructor(baseUrl: string, apiKey: string, label = 'provider', extraHeaders: Record<string, string> = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.apiKey = apiKey
    this.label = label
    this.extraHeaders = extraHeaders

    if (!this.apiKey) {
      throw new AIProviderError(`${label} API key not configured`, 'MISSING_API_KEY', 500, label)
    }
  }

  protected getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      ...this.extraHeaders,
    }
  }

  protected handleError(error: unknown, context: string): never {
    if (error instanceof AIProviderError) throw error

    if (error instanceof Response) {
      switch (error.status) {
        case 401:
          throw new AIProviderError('Invalid API key', 'INVALID_API_KEY', 401, this.label)
        case 403:
          throw new AIProviderError('Access forbidden', 'FORBIDDEN', 403, this.label)
        case 429:
          throw new AIProviderError('Rate limit exceeded', 'RATE_LIMIT', 429, this.label)
        case 500:
        case 502:
        case 503:
          throw new AIProviderError('AI provider temporarily unavailable', 'PROVIDER_UNAVAILABLE', 503, this.label)
        default:
          throw new AIProviderError(`AI provider error: ${error.statusText}`, 'PROVIDER_ERROR', error.status, this.label)
      }
    }

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new AIProviderError('Request cancelled', 'REQUEST_CANCELLED', 499, this.label)
      }
      if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
        throw new AIProviderError('Request timeout', 'TIMEOUT', 504, this.label)
      }
    }

    throw new AIProviderError(
      `Failed to ${context}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'UNKNOWN_ERROR',
      500,
      this.label
    )
  }

  async *streamChat(options: ChatOptions): AsyncIterable<StreamChunk> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        model: options.model,
        messages: options.messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens,
        stream: true,
      }),
      signal: options.signal,
    }).catch((err) => this.handleError(err, 'stream chat'))

    if (!response.ok) {
      await this.handleError(response, 'stream chat')
    }

    const reader = response.body?.getReader()
    if (!reader) {
      throw new AIProviderError('No response stream', 'NO_STREAM', 500, this.label)
    }

    const decoder = new TextDecoder()
    let buffer = ''
    let usage: ChatResponse['usage'] | undefined

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue

            try {
              const parsed = JSON.parse(data)
              const delta = parsed.choices?.[0]?.delta?.content
              if (delta) {
                yield { content: delta, done: false }
              }
              if (parsed.usage) {
                usage = {
                  inputTokens: parsed.usage.prompt_tokens,
                  outputTokens: parsed.usage.completion_tokens,
                  totalTokens: parsed.usage.total_tokens,
                }
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }

      yield { content: '', done: true, usage }
    } finally {
      reader.releaseLock()
    }
  }

  async chat(options: ChatOptions): Promise<ChatResponse> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({
        model: options.model,
        messages: options.messages,
        temperature: options.temperature ?? 0.7,
        max_tokens: options.maxTokens,
        stream: false,
      }),
      signal: options.signal,
    }).catch((err) => this.handleError(err, 'chat'))

    if (!response.ok) {
      await this.handleError(response, 'chat')
    }

    const data = await response.json().catch((err) =>
      this.handleError(err, 'parse chat response')
    )

    const content = data.choices?.[0]?.message?.content || ''
    const usage = data.usage
      ? {
          inputTokens: data.usage.prompt_tokens,
          outputTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        }
      : undefined

    return {
      content,
      usage,
      model: data.model || options.model,
      providerRequestId: data.id,
    }
  }

  async listModels(): Promise<Array<{ id: string; name: string; provider: string; supportsVision: boolean; supportsImage: boolean; pricing: { input: number; output: number } | null }>> {
    const response = await fetch(`${this.baseUrl}/models`, {
      headers: this.getHeaders(),
    }).catch((err) => this.handleError(err, 'list models'))

    if (!response.ok) {
      await this.handleError(response, 'list models')
    }

    const data = await response.json().catch((err) =>
      this.handleError(err, 'parse models response')
    )

    return (data.data || []).map((model: { id: string; object: string; pricing?: Record<string, string>; architecture?: { modality?: string } }) => ({
      id: model.id,
      name: model.id,
      provider: this.label,
      supportsVision: model.id.includes('vision') || model.id.includes('vl') || model.id.includes('gpt-4o') || model.id.includes('claude-3') || model.id.includes('gemini-1.5'),
      supportsImage: isImageModel(model.id, model.architecture?.modality),
      pricing: parsePricing(model.pricing),
    }))
  }

  async createEmbedding(input: string, model: string): Promise<number[]> {
    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ model, input: input.slice(0, 8000) }),
    }).catch((err) => this.handleError(err, 'create embedding'))

    if (!response.ok) {
      await this.handleError(response, 'create embedding')
    }

    const data = await response.json().catch((err) =>
      this.handleError(err, 'parse embedding response')
    )
    const vec = data.data?.[0]?.embedding
    if (!vec) throw new AIProviderError('No embedding returned', 'NO_EMBEDDING', 502, this.label)
    return vec as number[]
  }

  async createImage(prompt: string, model: string, size: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/images/generations`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ model, prompt, size, n: 1 }),
    }).catch((err) => this.handleError(err, 'create image'))

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new AIProviderError(
        `Image generation failed: ${response.status} ${text.slice(0, 200)}`,
        'IMAGE_FAILED',
        502,
        this.label
      )
    }

    const data = await response.json().catch((err) =>
      this.handleError(err, 'parse image response')
    )
    const url = data.data?.[0]?.url
    const b64 = data.data?.[0]?.b64_json
    if (!url && !b64) throw new AIProviderError('No image returned', 'NO_IMAGE', 502, this.label)
    return url || `data:image/png;base64,${b64}`
  }
}

/** Parse per-token pricing from provider metadata (OpenRouter style). Returns null when absent. */
function parsePricing(pricing?: Record<string, string>): { input: number; output: number } | null {
  if (!pricing) return null
  const rawIn = pricing.prompt ?? pricing.input ?? pricing.input_tokens
  const rawOut = pricing.completion ?? pricing.output ?? pricing.output_tokens
  const input = Number(rawIn)
  const output = Number(rawOut)
  if (!Number.isFinite(input) || !Number.isFinite(output)) return null
  return { input, output }
}

/** Detect image-generation models from id patterns or OpenRouter modality (e.g. "text->image"). */
function isImageModel(id: string, modality?: string): boolean {
  const out = modality?.split('->')[1] || ''
  if (out.includes('image')) return true
  const lower = id.toLowerCase()
  return lower.includes('dall-e') || lower.includes('stable-diffusion') || lower.includes('/flux') ||
    lower.includes(':flux') || lower.includes('flux-') || lower.includes('sdxl') ||
    lower.includes('midjourney') || lower.includes('imagen') || lower.includes('ideogram') ||
    lower.includes('recraft') || lower.includes('gpt-image-1');
}

/** Format per-token cost as $/1M tokens, e.g. $0.55/1M. Exported for admin UI. */
export function formatPerMillion(costPerToken: number): string {
  const per1M = costPerToken * 1_000_000
  if (per1M === 0) return 'free'
  if (per1M < 0.01) return `$${per1M.toFixed(4)}/1M`
  if (per1M < 10) return `$${per1M.toFixed(2)}/1M`
  return `$${per1M.toFixed(1)}/1M`
}

/** Backwards-compatible Kob provider driven by env (used when model has no DB provider). */
export class KobProvider extends OpenAICompatibleProvider {
  constructor() {
    super(
      process.env.KOB_BASE_URL || 'https://api.kob.ai/v1',
      process.env.KOB_API_KEY || '',
      'kob'
    )
  }
}
