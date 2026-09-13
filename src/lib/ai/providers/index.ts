import { AIProvider } from './types'
import { KobProvider } from './kob'

let providerInstance: AIProvider | null = null

export function getAIProvider(): AIProvider {
  if (!providerInstance) {
    providerInstance = new KobProvider()
  }
  return providerInstance
}

export function setAIProvider(provider: AIProvider) {
  providerInstance = provider
}

export { AIProviderError } from './types'
export type { AIMessage, ChatOptions, ChatResponse, StreamChunk, AIModel } from './types'