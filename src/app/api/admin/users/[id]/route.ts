import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/auth/session'
import { adminUserUpdateSchema } from '@/lib/validation/schemas'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminProfile = await requireAdmin()
    const supabase = createServiceClient()
    const { id } = await params

    const body = await request.json()
    const validation = adminUserUpdateSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid request', details: validation.error.flatten() }, { status: 400 })
    }

    const { data: targetUser } = await supabase.from('profiles').select('id, role').eq('id', id).single()
    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const { data: { user: admin } } = await supabase.auth.getUser()
    if (targetUser.id === admin?.id && validation.data.role === 'user') {
      return NextResponse.json({ error: 'Cannot demote yourself' }, { status: 400 })
    }

    const updates: Record<string, unknown> = {}
    if (validation.data.monthly_budget !== undefined) updates.monthly_budget = validation.data.monthly_budget
    if (validation.data.is_active !== undefined) updates.is_active = validation.data.is_active
    if (validation.data.role !== undefined) updates.role = validation.data.role
    if (validation.data.is_approved !== undefined) {
      updates.is_approved = validation.data.is_approved
      if (validation.data.is_approved) {
        // Approving also activates the account
        updates.is_active = true
        updates.approved_at = new Date().toISOString()
        updates.approved_by = adminProfile.id
      }
    }

    const { error } = await supabase.from('profiles').update(updates).eq('id', id)
    if (error) {
      return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Admin user update error:', error)
    if (error instanceof Error && error.message === 'Forbidden: Admin access required') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (error instanceof Error && error.message === 'Account pending approval') {
      return NextResponse.json({ error: 'Account pending approval' }, { status: 403 })
    }
    if (error instanceof Error && (error.message === 'Unauthorized' || error.message === 'Profile not found')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}