import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/auth/session'
import { adminUserUpdateSchema } from '@/lib/validation/schemas'

export const runtime = 'nodejs'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin()
    const supabase = createServiceClient()
    const { id } = await params

    // 1. Fetch user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    // 2. Query usage logs for this user (up to 300 for aggregates)
    const { data: logs } = await supabase
      .from('usage_logs')
      .select('*')
      .eq('user_id', id)
      .order('created_at', { ascending: false })
      .limit(300)

    // 3. Query models to map model IDs to readable display names
    const { data: dbModels } = await supabase
      .from('models')
      .select('id, provider_model_id, display_name')

    const modelNameMap: Record<string, string> = {}
    if (dbModels) {
      for (const m of dbModels) {
        modelNameMap[m.id] = m.display_name
        modelNameMap[m.provider_model_id] = m.display_name
      }
    }

    // 4. Calculate aggregates
    let currentMonthCost = 0
    let currentMonthRequests = 0
    let currentMonthTokens = 0
    let allTimeCost = 0
    const allTimeRequests = (logs || []).length
    let allTimeInputTokens = 0
    let allTimeOutputTokens = 0
    let lastActive: string | null = null

    const modelStats: Record<
      string,
      { model: string; modelName: string; requestCount: number; inputTokens: number; outputTokens: number; totalCost: number }
    > = {}
    const typeStats: Record<string, { requestType: string; count: number; totalCost: number }> = {}

    if (logs && logs.length > 0) {
      lastActive = logs[0].created_at

      for (const log of logs) {
        const cost = Number(log.estimated_cost) || 0
        const inTokens = Number(log.input_tokens) || 0
        const outTokens = Number(log.output_tokens) || 0
        const createdAt = new Date(log.created_at)

        allTimeCost += cost
        allTimeInputTokens += inTokens
        allTimeOutputTokens += outTokens

        if (createdAt >= startOfMonth) {
          currentMonthCost += cost
          currentMonthRequests += 1
          currentMonthTokens += inTokens + outTokens
        }

        // Model breakdown
        const mid = log.model || 'unknown'
        if (!modelStats[mid]) {
          modelStats[mid] = {
            model: mid,
            modelName: modelNameMap[mid] || mid,
            requestCount: 0,
            inputTokens: 0,
            outputTokens: 0,
            totalCost: 0,
          }
        }
        modelStats[mid].requestCount += 1
        modelStats[mid].inputTokens += inTokens
        modelStats[mid].outputTokens += outTokens
        modelStats[mid].totalCost += cost

        // Type breakdown
        const rType = log.request_type || 'chat'
        if (!typeStats[rType]) {
          typeStats[rType] = { requestType: rType, count: 0, totalCost: 0 }
        }
        typeStats[rType].count += 1
        typeStats[rType].totalCost += cost
      }
    }

    // 5. Query user conversations (latest 20) with message counts
    const { data: conversations } = await supabase
      .from('conversations')
      .select('id, title, model, created_at, updated_at')
      .eq('user_id', id)
      .order('updated_at', { ascending: false })
      .limit(20)

    const convList = []
    if (conversations) {
      for (const conv of conversations) {
        const { count: msgCount } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', conv.id)

        convList.push({
          id: conv.id,
          title: conv.title,
          model: modelNameMap[conv.model] || conv.model,
          messageCount: msgCount || 0,
          createdAt: conv.created_at,
          updatedAt: conv.updated_at,
        })
      }
    }

    const result = {
      user: {
        id: profile.id,
        email: profile.email,
        display_name: profile.display_name,
        role: profile.role,
        is_active: profile.is_active,
        is_approved: profile.is_approved,
        monthly_budget: Number(profile.monthly_budget) || 0,
        current_usage: Number(profile.usage_current_month) || currentMonthCost,
        request_count: allTimeRequests,
        last_active: lastActive,
        createdAt: profile.created_at,
        updatedAt: profile.updated_at,
        avatarUrl: profile.avatar_url,
        approvedAt: profile.approved_at,
        approvedBy: profile.approved_by,
      },
      summary: {
        currentMonthCost,
        currentMonthRequests,
        currentMonthTokens,
        allTimeCost,
        allTimeRequests,
        allTimeInputTokens,
        allTimeOutputTokens,
      },
      modelBreakdown: Object.values(modelStats).sort((a, b) => b.totalCost - a.totalCost),
      typeBreakdown: Object.values(typeStats).sort((a, b) => b.count - a.count),
      recentLogs: (logs || []).slice(0, 100),
      conversations: convList,
    }

    return NextResponse.json({ data: result })
  } catch (error) {
    console.error('Admin user get details error:', error)
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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const adminProfile = await requireAdmin()
    const supabase = createServiceClient()
    const { id } = await params

    if (id === adminProfile.id) {
      return NextResponse.json({ error: 'Cannot delete your own admin account' }, { status: 400 })
    }

    // Delete user related records
    await supabase.from('usage_logs').delete().eq('user_id', id)
    await supabase.from('messages').delete().eq('user_id', id)
    await supabase.from('conversations').delete().eq('user_id', id)
    await supabase.from('knowledge_bases').delete().eq('user_id', id)
    await supabase.from('prompts').delete().eq('user_id', id)
    await supabase.from('memories').delete().eq('user_id', id)
    const { error } = await supabase.from('profiles').delete().eq('id', id)

    if (error) {
      return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Admin delete user error:', error)
    if (error instanceof Error && error.message === 'Forbidden: Admin access required') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}