import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getAIProvider } from '@/lib/ai/providers'
import { compareRequestSchema } from '@/lib/validation/schemas'
import { recordUsage } from '@/lib/usage/usage'
import { calculateEstimatedCost } from '@/lib/usage/cost'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const service = createServiceClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const parsed = compareRequestSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

    const { data: models } = await service.from('models').select('*').in('id', parsed.data.models).eq('enabled', true)
    if (!models || models.length < 2) return NextResponse.json({ error: 'Select at least 2 enabled models' }, { status: 400 })

    const provider = getAIProvider()
    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          await Promise.all(
            models.map(async (m) => {
              let full = ''
              let inT = 0
              let outT = 0
              for await (const chunk of provider.streamChat({
                model: m.provider_model_id,
                messages: parsed.data.messages.map((msg) => ({ role: msg.role, content: msg.content })),
                stream: true,
              })) {
                if (chunk.content) {
                  full += chunk.content
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ modelId: m.id, content: chunk.content, done: false })}\n\n`))
                }
                if (chunk.done && chunk.usage) {
                  inT = chunk.usage.inputTokens
                  outT = chunk.usage.outputTokens
                }
              }
              const cost = await calculateEstimatedCost(m.id, inT, outT).catch(() => 0)
              await recordUsage({
                user_id: user.id, conversation_id: null, model: m.id,
                request_type: 'compare', input_tokens: inT, output_tokens: outT,
                estimated_cost: cost, provider_request_id: null, is_estimate: true,
              })
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ modelId: m.id, done: true, usage: { inT, outT, cost } })}\n\n`))
            })
          )
          controller.close()
        } catch (err) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: String(err) })}\n\n`))
          controller.close()
        }
      },
    })
    return new NextResponse(readable, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } })
  } catch (err) {
    console.error('[api/compare]', err)
    return NextResponse.json({ error: 'Compare failed' }, { status: 500 })
  }
}
