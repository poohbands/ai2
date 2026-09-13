import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Service role: models list is non-sensitive, and providers table
    // has no public RLS policies (service-only by design)
    const service = createServiceClient()
    const { data: models, error } = await service
      .from('models')
      .select('*, providers(id, name)')
      .eq('enabled', true)
      .order('sort_order', { ascending: true })

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch models' }, { status: 500 })
    }

    return NextResponse.json({ models })
  } catch (error) {
    console.error('Models API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}