export interface AIMessage {
  role: 'user' | 'assistant' | 'system'
  content: string | AIMessageContent[]
}

export interface AIMessageContent {
  type: 'text' | 'image_url'
  text?: string
  image_url?: {
    url: string
  }
}

export interface AIModel {
  id: string
  name: string
  provider: string
  supportsVision: boolean
  pricing?: { input: number; output: number } | null
}

export interface ChatOptions {
  model: string
  messages: AIMessage[]
  temperature?: number
  maxTokens?: number
  stream?: boolean
  signal?: AbortSignal
}

export interface ChatResponse {
  content: string
  usage?: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
  }
  model: string
  providerRequestId?: string
}

export interface StreamChunk {
  content: string
  done: boolean
  usage?: {
    inputTokens: number
    outputTokens: number
    totalTokens: number
  }
  error?: string
}

export interface AIProvider {
  streamChat(options: ChatOptions): AsyncIterable<StreamChunk>
  chat(options: ChatOptions): Promise<ChatResponse>
  listModels(): Promise<AIModel[]>
}

export class AIProviderError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public provider?: string
  ) {
    super(message)
    this.name = 'AIProviderError'
  }
}