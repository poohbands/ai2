import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { imageGenSchema } from '@/lib/validation/schemas'
import { rateLimitEndpoint } from '@/lib/rate-limit/rate-limit'
import { recordUsage } from '@/lib/usage/usage'
import { getDefaultProvider } from '@/lib/ai/provider-factory'

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

    const model = parsed.data.model || process.env.IMAGE_GEN_MODEL || 'flux-schnell'
    const { provider } = await getDefaultProvider().catch(() => {
      throw new Error('No AI provider configured. Add a provider key in Admin → Providers.')
    })
    if (!('createImage' in provider) || typeof (provider as { createImage?: unknown }).createImage !== 'function') {
      return NextResponse.json({ error: 'Provider does not support image generation' }, { status: 502 })
    }
    const imageUrl = await (provider as unknown as { createImage: (p: string, m: string, s: string) => Promise<string> }).createImage(
      parsed.data.prompt,
      model,
      parsed.data.size
    )

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
