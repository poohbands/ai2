import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/auth/session'
import { providerCreateSchema } from '@/lib/validation/schemas'
import { encryptApiKey, keyHint } from '@/lib/security/encryption'

export const runtime = 'nodejs'

function mask(row: Record<string, unknown>) {
  const { api_key_encrypted: _key, ...rest } = row
  void _key // never sent to client
  return rest
}

// GET /api/admin/providers - list (keys never leave server)
export async function GET() {
  try {
    await requireAdmin()
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('providers')
      .select('id, name, type, base_url, key_hint, enabled, created_at, updated_at')
      .order('created_at', { ascending: true })
    if (error) return NextResponse.json({ error: 'Failed to fetch providers' }, { status: 500 })
    return NextResponse.json({ providers: (data || []).map(mask) })
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (err instanceof Error && (err.message === 'Unauthorized' || err.message === 'Profile not found')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/admin/providers - add new provider key
export async function POST(request: NextRequest) {
  try {
    await requireAdmin()
    const body = await request.json()
    const parsed = providerCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
    }

    let encrypted: string
    try {
      encrypted = encryptApiKey(parsed.data.api_key)
    } catch {
      return NextResponse.json(
        { error: 'APP_ENCRYPTION_KEY is not configured on the server. Add it in Vercel env first.' },
        { status: 500 }
      )
    }

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('providers')
      .insert({
        name: parsed.data.name,
        type: parsed.data.type,
        base_url: parsed.data.base_url.replace(/\/$/, ''),
        api_key_encrypted: encrypted,
        key_hint: keyHint(parsed.data.api_key),
        enabled: true,
      })
      .select('id, name, type, base_url, key_hint, enabled, created_at, updated_at')
      .single()

    if (error) return NextResponse.json({ error: 'Failed to save provider' }, { status: 500 })
    return NextResponse.json({ provider: mask(data) })
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (err instanceof Error && (err.message === 'Unauthorized' || err.message === 'Profile not found')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
