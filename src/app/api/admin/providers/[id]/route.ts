import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/auth/session'
import { providerUpdateSchema } from '@/lib/validation/schemas'
import { encryptApiKey, keyHint, decryptApiKey } from '@/lib/security/encryption'
import { OpenAICompatibleProvider } from '@/lib/ai/providers/kob'

export const runtime = 'nodejs'

function mask(row: Record<string, unknown>) {
  const { api_key_encrypted: _key, ...rest } = row
  void _key // never sent to client
  return rest
}

// PATCH /api/admin/providers/[id] - update / rotate key / enable-disable
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const body = await request.json()
    const parsed = providerUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
    }

    const updates: Record<string, unknown> = {}
    if (parsed.data.name !== undefined) updates.name = parsed.data.name
    if (parsed.data.base_url !== undefined) updates.base_url = parsed.data.base_url.replace(/\/$/, '')
    if (parsed.data.enabled !== undefined) updates.enabled = parsed.data.enabled
    if (parsed.data.api_key !== undefined) {
      try {
        updates.api_key_encrypted = encryptApiKey(parsed.data.api_key)
        updates.key_hint = keyHint(parsed.data.api_key)
      } catch {
        return NextResponse.json(
          { error: 'APP_ENCRYPTION_KEY is not configured on the server.' },
          { status: 500 }
        )
      }
    }

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('providers')
      .update(updates)
      .eq('id', id)
      .select('id, name, type, base_url, key_hint, enabled, created_at, updated_at')
      .single()

    if (error) return NextResponse.json({ error: 'Failed to update provider' }, { status: 500 })
    return NextResponse.json({ provider: mask(data) })
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

// DELETE /api/admin/providers/[id]
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { id } = await params
    const supabase = createServiceClient()

    // Unlink models first (provider_id SET NULL also handles it, be explicit)
    await supabase.from('models').update({ provider_id: null }).eq('provider_id', id)
    const { error } = await supabase.from('providers').delete().eq('id', id)
    if (error) return NextResponse.json({ error: 'Failed to delete provider' }, { status: 500 })
    return NextResponse.json({ success: true })
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

// POST /api/admin/providers/[id]/test - verify key with a tiny request
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin()
    const { action } = await request.json().catch(() => ({ action: 'test' }))
    if (action !== 'test') return NextResponse.json({ error: 'Unknown action' }, { status: 400 })

    const { id } = await params
    const supabase = createServiceClient()
    const { data: provider } = await supabase.from('providers').select('*').eq('id', id).single()
    if (!provider) return NextResponse.json({ error: 'Provider not found' }, { status: 404 })

    const client = new OpenAICompatibleProvider(
      provider.base_url,
      decryptApiKey(provider.api_key_encrypted),
      provider.name
    )
    const models = await client.listModels()
    return NextResponse.json({ success: true, modelCount: models.length, sample: models.slice(0, 5).map((m) => m.id) })
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Test failed' },
      { status: 502 }
    )
  }
}
