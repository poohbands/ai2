import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'
import { decryptApiKey } from '@/lib/security/encryption'
import { OpenAICompatibleProvider, KobProvider } from './providers/kob'
import type { AIProvider } from './providers/types'

export interface ProviderRow {
  id: string
  name: string
  type: string
  base_url: string
  api_key_encrypted: string
  enabled: boolean
}

export interface ModelRow {
  id: string
  provider_model_id: string
  provider: string
  provider_id: string | null
}

export const PROVIDER_PRESETS: Record<string, { label: string; baseUrl: string }> = {
  kob: { label: 'Kob AI', baseUrl: 'https://api.kob.ai/v1' },
  deepseek: { label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1' },
  openrouter: { label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1' },
}

function extraHeadersFor(type: string): Record<string, string> {
  if (type === 'openrouter') {
    return {
      'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://family-ai.local',
      'X-Title': process.env.NEXT_PUBLIC_APP_NAME || 'Family AI',
    }
  }
  return {}
}

/**
 * Resolve the AI provider for a model row.
 * Priority: DB provider (via models.provider_id) -> legacy env Kob provider.
 */
export async function getProviderForModel(model: ModelRow): Promise<AIProvider> {
  if (model.provider_id) {
    const supabase = createServiceClient()
    const { data: provider } = await supabase
      .from('providers')
      .select('*')
      .eq('id', model.provider_id)
      .eq('enabled', true)
      .single()

    if (!provider) {
      throw new Error('Model provider is disabled or missing. Ask admin to check Providers settings.')
    }

    const p = provider as ProviderRow
    const apiKey = decryptApiKey(p.api_key_encrypted)
    return new OpenAICompatibleProvider(p.base_url, apiKey, p.name, extraHeadersFor(p.type))
  }

  // Legacy path: models seeded in Phase 1 without provider_id use env Kob credentials
  return new KobProvider()
}

/** Default provider for embeddings when no model context (first enabled DB provider, else env). */
export async function getDefaultProvider(): Promise<{ provider: AIProvider; embeddingModel: string }> {
  const supabase = createServiceClient()
  const { data } = await supabase
    .from('providers')
    .select('*')
    .eq('enabled', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (data) {
    const p = data as ProviderRow
    return {
      provider: new OpenAICompatibleProvider(
        p.base_url,
        decryptApiKey(p.api_key_encrypted),
        p.name,
        extraHeadersFor(p.type)
      ),
      embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
    }
  }

  return { provider: new KobProvider(), embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-3-small' }
}
