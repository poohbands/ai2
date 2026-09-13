import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/auth/session'

export async function GET() {
  try {
    await requireAdmin()
    const supabase = createServiceClient()

    const now = new Date()
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const [
      { count: totalUsers },
      { count: activeUsers },
      { data: requestsToday },
      { data: requestsThisMonth },
      { data: costData },
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('usage_logs').select('estimated_cost').gte('created_at', startOfDay.toISOString()),
      supabase.from('usage_logs').select('estimated_cost').gte('created_at', startOfMonth.toISOString()),
      supabase.from('usage_logs').select('estimated_cost').gte('created_at', startOfMonth.toISOString()),
    ])

    const estimatedCostThisMonth = costData?.reduce((sum, log) => sum + Number(log.estimated_cost), 0) || 0

    return NextResponse.json({
      totalUsers: totalUsers || 0,
      activeUsers: activeUsers || 0,
      requestsToday: requestsToday?.length || 0,
      requestsThisMonth: requestsThisMonth?.length || 0,
      estimatedCostThisMonth,
    })
  } catch (error) {
    console.error('Admin stats error:', error)
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