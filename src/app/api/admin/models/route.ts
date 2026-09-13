import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/auth/session'
import { adminModelUpdateSchema, adminModelCreateSchema } from '@/lib/validation/schemas'

export const runtime = 'nodejs'

// GET /api/admin/models - all models (including disabled) with provider name
export async function GET() {
  try {
    await requireAdmin()
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('models')
      .select('*, providers(id, name, enabled)')
      .order('sort_order', { ascending: true })
    if (error) return NextResponse.json({ error: 'Failed to fetch models' }, { status: 500 })
    return NextResponse.json({ models: data })
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

// PATCH /api/admin/models?id=... - toggle enabled, rename, assign provider, edit costs
export async function PATCH(request: NextRequest) {
  try {
    await requireAdmin()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const body = await request.json()
    const parsed = adminModelUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
    }

    const updates: Record<string, unknown> = {}
    if (parsed.data.display_name !== undefined) updates.display_name = parsed.data.display_name
    if (parsed.data.enabled !== undefined) updates.enabled = parsed.data.enabled
    if (parsed.data.provider_id !== undefined) updates.provider_id = parsed.data.provider_id
    if (parsed.data.estimated_input_cost !== undefined) updates.estimated_input_cost = parsed.data.estimated_input_cost
    if (parsed.data.estimated_output_cost !== undefined) updates.estimated_output_cost = parsed.data.estimated_output_cost

    const supabase = createServiceClient()
    const { error } = await supabase.from('models').update(updates).eq('id', id)
    if (error) return NextResponse.json({ error: 'Failed to update model' }, { status: 500 })
    return NextResponse.json({ success: true })
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

// POST /api/admin/models - add new model
export async function POST(request: NextRequest) {
  try {
    await requireAdmin()
    const body = await request.json()
    const parsed = adminModelCreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request', details: parsed.error.flatten() }, { status: 400 })
    }

    const supabase = createServiceClient()
    const { data: maxRow } = await supabase
      .from('models')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()

    const { data, error } = await supabase
      .from('models')
      .insert({
        provider_model_id: parsed.data.provider_model_id.trim(),
        display_name: parsed.data.display_name.trim(),
        provider: 'custom',
        category: parsed.data.category || 'Custom',
        supports_vision: parsed.data.supports_vision ?? false,
        enabled: parsed.data.enabled ?? true,
        provider_id: parsed.data.provider_id || null,
        estimated_input_cost: parsed.data.estimated_input_cost ?? 0.000001,
        estimated_output_cost: parsed.data.estimated_output_cost ?? 0.000002,
        sort_order: (maxRow?.sort_order ?? 150) + 10,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: 'Failed to add model' }, { status: 500 })
    return NextResponse.json({ model: data })
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

// DELETE /api/admin/models?id=... - delete model (history keeps plain text model id)
export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin()
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const supabase = createServiceClient()
    const { error } = await supabase.from('models').delete().eq('id', id)
    if (error) return NextResponse.json({ error: 'Failed to delete model' }, { status: 500 })
    return NextResponse.json({ success: true })
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
