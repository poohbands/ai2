import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { imageGenSchema } from '@/lib/validation/schemas'
import { rateLimitEndpoint } from '@/lib/rate-limit/rate-limit'
import { recordUsage } from '@/lib/usage/usage'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const service = createServiceClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const rl = await rateLimitEndpoint(user.id, 'image')
    if (!rl.allowed) return NextResponse.json({ error: 'Image rate limit exceeded' }, { status: 429 })

    const body = await request.json()
    const parsed = imageGenSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

    const baseUrl = process.env.KOB_BASE_URL
    const apiKey = process.env.KOB_API_KEY
    if (!baseUrl || !apiKey) return NextResponse.json({ error: 'AI provider not configured' }, { status: 500 })

    const model = parsed.data.model || process.env.IMAGE_GEN_MODEL || 'flux-schnell'
    const res = await fetch(`${baseUrl}/images/generations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, prompt: parsed.data.prompt, size: parsed.data.size, n: 1 }),
    })
    if (!res.ok) {
      const t = await res.text()
      return NextResponse.json({ error: `Image generation failed: ${res.status} ${t.slice(0, 200)}` }, { status: 502 })
    }
    const data = await res.json()
    const imageUrl = data.data?.[0]?.url || data.data?.[0]?.b64_json
      ? data.data[0].url || `data:image/png;base64,${data.data[0].b64_json}`
      : null
    if (!imageUrl) return NextResponse.json({ error: 'No image returned' }, { status: 502 })

    await service.from('generated_images').insert({
      user_id: user.id,
      conversation_id: parsed.data.conversationId || null,
      prompt: parsed.data.prompt,
      model,
      image_url: imageUrl.startsWith('data:') ? null : imageUrl,
    })

    await recordUsage({
      user_id: user.id, conversation_id: parsed.data.conversationId || null,
      model, request_type: 'image', input_tokens: 0, output_tokens: 0,
      estimated_cost: 0.02, provider_request_id: null, is_estimate: true,
    })

    return NextResponse.json({ imageUrl, model })
  } catch (err) {
    console.error('[api/images]', err)
    return NextResponse.json({ error: 'Image generation failed' }, { status: 500 })
  }
}
