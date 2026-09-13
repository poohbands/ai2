import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { webSearch, getSearchProviderName } from '@/lib/search/search'
import { searchRequestSchema } from '@/lib/validation/schemas'
import { rateLimitEndpoint } from '@/lib/rate-limit/rate-limit'
import { recordUsage } from '@/lib/usage/usage'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rl = await rateLimitEndpoint(user.id, 'search')
    if (!rl.allowed) return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })

    const body = await request.json()
    const parsed = searchRequestSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

    const { results, provider } = await webSearch(parsed.data.query, parsed.data.maxResults)

    await recordUsage({
      user_id: user.id,
      conversation_id: null,
      model: 'search',
      request_type: 'search',
      input_tokens: 0,
      output_tokens: 0,
      estimated_cost: 0,
      provider_request_id: null,
      is_estimate: true,
    })

    return NextResponse.json({ results, provider: provider || getSearchProviderName() })
  } catch (err) {
    console.error('[api/search]', err)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
