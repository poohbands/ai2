import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getAIProvider } from '@/lib/ai/providers'
import { webSearch, formatSearchContext } from '@/lib/search/search'
import { researchRequestSchema } from '@/lib/validation/schemas'
import { rateLimitEndpoint } from '@/lib/rate-limit/rate-limit'
import { recordUsage, checkBudget } from '@/lib/usage/usage'
import { calculateEstimatedCost } from '@/lib/usage/cost'

export const runtime = 'nodejs'
export const maxDuration = 120

const DEPTH_CONFIG = {
  quick: { iterations: 1, queriesPerIter: 2, maxResults: 3 },
  standard: { iterations: 2, queriesPerIter: 3, maxResults: 5 },
  deep: { iterations: 3, queriesPerIter: 4, maxResults: 6 },
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const serviceClient = createServiceClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await serviceClient.from('profiles').select('*').eq('id', user.id).single()
    if (!profile || !profile.is_active) return NextResponse.json({ error: 'Account disabled' }, { status: 403 })

    const rl = await rateLimitEndpoint(user.id, 'research')
    if (!rl.allowed) return NextResponse.json({ error: 'Research rate limit (5/min). Please wait.' }, { status: 429 })

    const budget = await checkBudget(user.id, profile.monthly_budget)
    if (!budget.allowed) return NextResponse.json({ error: 'Monthly budget exceeded.' }, { status: 403 })

    const body = await request.json()
    const parsed = researchRequestSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })

    const { query, model: modelId, depth = 'standard', stream = true } = parsed.data
    const cfg = DEPTH_CONFIG[depth]

    const { data: model } = await serviceClient.from('models').select('*').eq('id', modelId).eq('enabled', true).single()
    if (!model) return NextResponse.json({ error: 'Model not available' }, { status: 400 })

    const provider = getAIProvider()

    const runResearch = async function* () {
      const allSources: Array<{ title: string; url: string }> = []
      let context = ''

      // Step 1: decompose into sub-queries via LLM
      yield { step: 'planning', content: 'กำลังวางแผนการค้นคว้า...' }
      let subQueries: string[] = [query]
      try {
        const plan = await provider.chat({
          model: model.provider_model_id,
          messages: [{ role: 'user', content: `แตกคำถามวิจัยนี้เป็น ${cfg.queriesPerIter} คำถามย่อยสำหรับค้นเว็บ (ตอบเป็นบรรทัดละ 1 คำถามเท่านั้น): ${query}` }],
        })
        const lines = plan.content.split('\n').map((l) => l.replace(/^\d+[.)]\s*/, '').trim()).filter(Boolean)
        if (lines.length >= 2) subQueries = lines.slice(0, cfg.queriesPerIter)
      } catch { /* fallback to original query */ }

      for (let iter = 0; iter < cfg.iterations; iter++) {
        yield { step: 'search', content: `รอบที่ ${iter + 1}: กำลังค้นเว็บ ${subQueries.length} คำถาม...` }
        for (const q of subQueries) {
          const { results } = await webSearch(q, cfg.maxResults)
          for (const r of results) {
            if (!allSources.find((s) => s.url === r.url)) allSources.push({ title: r.title, url: r.url })
          }
          context += `\n\n## ค้น: ${q}\n${formatSearchContext(results)}`
        }

        // Synthesize interim + generate follow-up queries (except last iter)
        if (iter < cfg.iterations - 1) {
          try {
            const follow = await provider.chat({
              model: model.provider_model_id,
              messages: [{ role: 'user', content: `จากข้อมูลนี้:\n${context.slice(-6000)}\n\nจงเสนอ ${cfg.queriesPerIter} คำถามเจาะลึกเพิ่มเติม (บรรทัดละ 1 คำถาม): ${query}` }],
            })
            const lines = follow.content.split('\n').map((l) => l.replace(/^\d+[.)]\s*/, '').trim()).filter(Boolean)
            if (lines.length >= 2) subQueries = lines.slice(0, cfg.queriesPerIter)
          } catch { /* keep same queries */ }
        }
      }

      // Final report
      yield { step: 'writing', content: 'กำลังเขียนรายงานสรุป...' }
      const finalPrompt = `เขียนรายงาน Deep Research ภาษาไทย (Markdown) สำหรับคำถาม: ${query}\n\nข้อมูลที่ค้นได้:\n${context.slice(-12000)}\n\nโครงสร้าง: 1) สรุปผู้บริหาร 2) รายละเอียดพร้อมอ้างอิง [1],[2] 3) ตารางเปรียบเทียบถ้าเหมาะสม 4) ข้อสรุป + แหล่งอ้างอิงท้ายรายงาน`
      let full = ''
      let inT = 0
      let outT = 0
      for await (const chunk of provider.streamChat({
        model: model.provider_model_id,
        messages: [{ role: 'user', content: finalPrompt }],
        stream: true,
      })) {
        if (chunk.content) {
          full += chunk.content
          yield { step: 'token', content: chunk.content }
        }
        if (chunk.done && chunk.usage) {
          inT = chunk.usage.inputTokens
          outT = chunk.usage.outputTokens
        }
      }

      const cost = await calculateEstimatedCost(modelId, inT, outT).catch(() => 0)
      await recordUsage({
        user_id: user.id, conversation_id: parsed.data.conversationId || null,
        model: modelId, request_type: 'research',
        input_tokens: inT, output_tokens: outT, estimated_cost: cost,
        provider_request_id: null, is_estimate: true,
      })

      yield { step: 'done', content: full, sources: allSources, usage: { inT, outT, cost } }
    }

    if (!stream) {
      let final = ''
      let sources: Array<{ title: string; url: string }> = []
      for await (const e of runResearch()) {
        if (e.step === 'token') final += e.content
        if (e.step === 'done') {
          final = (e.content as string) || final
          sources = (e.sources as Array<{ title: string; url: string }>) || []
        }
      }
      return NextResponse.json({ report: final, sources })
    }

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const e of runResearch()) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`))
          }
          controller.close()
        } catch (err) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ step: 'error', content: String(err) })}\n\n`))
          controller.close()
        }
      },
    })
    return new NextResponse(readable, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } })
  } catch (err) {
    console.error('[api/research]', err)
    return NextResponse.json({ error: 'Research failed' }, { status: 500 })
  }
}
