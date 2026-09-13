import {
  AIProvider,
  AIMessage,
  ChatOptions,
  ChatResponse,
  StreamChunk,
  AIProviderError,
} from './types'

export class KobProvider implements AIProvider {
  private baseUrl: string
  private apiKey: string

  constructor() {
    this.baseUrl = process.env.KOB_BASE_URL || 'https://api.kob.ai/v1'
    this.apiKey = process.env.KOB_API_KEY || ''

    if (!this.apiKey) {
      throw new AIProviderError(
        'Kob AI API key not configured',
        'MISSING_API_KEY',
        500,
        'kob'
      )
    }
  }

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    }
  }

  private handleError(error: unknown, context: string): never {
    if (error instanceof AIProviderError) throw error

    if (error instanceof Response) {
      switch (error.status) {
        case 401:
          throw new AIProviderError(
            'Invalid API key',
            'INVALID_API_KEY',
            401,
            'kob'
          )
        case 403:
          throw new AIProviderError(
            'Access forbidden',
            'FORBIDDEN',
            403,
            'kob'
          )
        case 429:
          throw new AIProviderError(
            'Rate limit exceeded',
            'RATE_LIMIT',
            429,
            'kob'
          )
        case 500:
        case 502:
        case 503:
          throw new AIProviderError(
            'AI provider temporarily unavailable',
            'PROVIDER_UNAVAILABLE',
            503,
            'kob'
          )
        default:
          throw new AIProviderError(
            `AI provider error: ${error.statusText}`,
            'PROVIDER_ERROR',
            error.status,
            'kob'
          )
      }
    }

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new AIProviderError(
          'Request cancelled',
          'REQUEST_CANCELLED',
          499,
          'kob'
        )
      }
      if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
        throw new AIProviderError(
          'Request timeout',
          'TIMEOUT',
          504,
          'kob'
        )
      }
    }

    throw new AIProviderError(
      `Failed to ${context}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      'UNKNOWN_ERROR',
      500,
      'kob'
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
      throw new AIProviderError('No response stream', 'NO_STREAM', 500, 'kob')
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

  async listModels(): Promise<Array<{ id: string; name: string; provider: string; supportsVision: boolean }>> {
    const response = await fetch(`${this.baseUrl}/models`, {
      headers: this.getHeaders(),
    }).catch((err) => this.handleError(err, 'list models'))

    if (!response.ok) {
      await this.handleError(response, 'list models')
    }

    const data = await response.json().catch((err) =>
      this.handleError(err, 'parse models response')
    )

    return (data.data || []).map((model: { id: string; object: string }) => ({
      id: model.id,
      name: model.id,
      provider: 'kob',
      supportsVision: model.id.includes('vision') || model.id.includes('vl') || model.id.includes('gpt-4o') || model.id.includes('claude-3') || model.id.includes('gemini-1.5'),
    }))
  }
}