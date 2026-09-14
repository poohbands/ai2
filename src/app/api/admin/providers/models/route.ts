import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/auth/session'
import { decryptApiKey } from '@/lib/security/encryption'
import { OpenAICompatibleProvider } from '@/lib/ai/providers/kob'

export const runtime = 'nodejs'
export const maxDuration = 60

// GET /api/admin/providers/models - live model list per enabled provider
export async function GET() {
  try {
    await requireAdmin()
    const supabase = createServiceClient()
    const { data: providers, error } = await supabase
      .from('providers')
      .select('id, name, type, base_url, api_key_encrypted')
      .eq('enabled', true)
      .order('created_at', { ascending: true })

    if (error) return NextResponse.json({ error: 'Failed to fetch providers' }, { status: 500 })

    const results = await Promise.all(
      (providers || []).map(async (p) => {
        try {
          const client = new OpenAICompatibleProvider(p.base_url, decryptApiKey(p.api_key_encrypted), p.name)
          const models = await client.listModels()
          return {
            provider: { id: p.id, name: p.name, type: p.type, base_url: p.base_url },
            models: models.map((m) => ({ id: m.id, supportsVision: m.supportsVision, supportsImage: !!m.supportsImage, pricing: m.pricing || null })),
            error: null as string | null,
          }
        } catch (err) {
          return {
            provider: { id: p.id, name: p.name, type: p.type, base_url: p.base_url },
            models: [],
            error: err instanceof Error ? err.message : 'Failed to list models',
          }
        }
      })
    )

    return NextResponse.json({ providers: results })
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (err instanceof Error && err.message === 'Account pending approval') {
      return NextResponse.json({ error: 'Account pending approval' }, { status: 403 })
    }
    if (err instanceof Error && (err.message === 'Unauthorized' || err.message === 'Profile not found')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
