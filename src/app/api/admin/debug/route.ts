import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { requireAdmin } from '@/lib/auth/session'

export const runtime = 'nodejs'

// GET /api/admin/debug - connectivity overview (admin only, no secrets returned)
export async function GET() {
  try {
    await requireAdmin()
    let supabaseHost = 'missing'
    try {
      if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
        supabaseHost = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
      }
    } catch {
      supabaseHost = 'invalid-url'
    }

    const supabase = createServiceClient()
    const [{ count: models }, { data: providers }] = await Promise.all([
      supabase.from('models').select('*', { count: 'exact', head: true }),
      supabase.from('providers').select('id').limit(1),
    ])

    return NextResponse.json({
      serverSupabaseHost: supabaseHost,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasKobKey: !!process.env.KOB_API_KEY,
      kobBaseUrl: process.env.KOB_BASE_URL || 'default (https://api.kob.ai/v1)',
      appEncryptionKeySet: !!process.env.APP_ENCRYPTION_KEY,
      upstashSet: !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN),
      tavilySet: !!process.env.TAVILY_API_KEY,
      braveSet: !!process.env.BRAVE_API_KEY,
      mistralSet: !!process.env.MISTRAL_API_KEY,
      modelCount: models ?? 0,
      providerCount: providers?.length ?? 0,
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'local',
    })
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
