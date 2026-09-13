import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/auth/session'

export async function GET() {
  try {
    await requireAdmin()
    const supabase = createServiceClient()

    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const { data: users, error } = await supabase
      .from('profiles')
      .select('id, email, display_name, role, is_active, is_approved, monthly_budget, usage_current_month, updated_at')
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
    }

    const userIds = users?.map((u) => u.id) || []
    const requestCounts: Record<string, number> = {}
    const lastActive: Record<string, string> = {}

    if (userIds.length > 0) {
      const { data: usageLogs } = await supabase
        .from('usage_logs')
        .select('user_id, created_at')
        .in('user_id', userIds)
        .gte('created_at', startOfMonth.toISOString())
        .order('created_at', { ascending: false })

      if (usageLogs) {
        for (const log of usageLogs) {
          requestCounts[log.user_id] = (requestCounts[log.user_id] || 0) + 1
          if (!lastActive[log.user_id]) {
            lastActive[log.user_id] = log.created_at
          }
        }
      }
    }

    const usersWithStats = users?.map((user) => ({
      ...user,
      current_usage: Number(user.usage_current_month),
      request_count: requestCounts[user.id] || 0,
      last_active: lastActive[user.id] || null,
    })) || []

    return NextResponse.json({ users: usersWithStats })
  } catch (error) {
    console.error('Admin users error:', error)
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