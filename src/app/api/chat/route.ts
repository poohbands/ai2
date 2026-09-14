import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { AIProviderError } from '@/lib/ai/providers'
import { getProviderForModel } from '@/lib/ai/provider-factory'
import { chatRequestSchema } from '@/lib/validation/schemas'
import { extractTextWithMeta, estimateTokens, truncateContext, chunkText } from '@/lib/files/extraction'
import { recordUsage, checkBudget } from '@/lib/usage/usage'
import { calculateEstimatedCost } from '@/lib/usage/cost'
import { rateLimitEndpoint } from '@/lib/rate-limit/rate-limit'
import { getFileUrl } from '@/lib/files/files'
import { webSearch, formatSearchContext } from '@/lib/search/search'
import { retrieveContext, retrieveAcrossKbs } from '@/lib/rag/rag'
import { createEmbedding } from '@/lib/rag/embeddings'
import { getMaintenanceSettings } from '@/lib/settings/maintenance'
import { Model } from '@/types'

export const runtime = 'nodejs'
export const maxDuration = 60

async function getConversationContext(
  supabase: ReturnType<typeof createServiceClient>,
  conversationId: string,
  userId: string,
  maxTokens = 8000
): Promise<Array<{ role: 'user' | 'assistant' | 'system'; content: string }>> {
  const { data: messages } = await supabase
    .from('messages')
    .select('role, content')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(50)

  if (!messages) return []

  let totalTokens = 0
  const context: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = []

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    const tokens = estimateTokens(msg.content)
    if (totalTokens + tokens > maxTokens) break
    totalTokens += tokens
    context.unshift({ role: msg.role, content: msg.content })
  }

  return context
}

async function getAttachmentContext(
  supabase: ReturnType<typeof createServiceClient>,
  attachmentIds: string[],
  userId: string,
  maxTokens = 4000
): Promise<string> {
  if (attachmentIds.length === 0) return ''

  const { data: attachments } = await supabase
    .from('attachments')
    .select('*')
    .in('id', attachmentIds)
    .eq('user_id', userId)

  if (!attachments || attachments.length === 0) return ''

  const contexts: string[] = []
  let totalTokens = 0

  for (const attachment of attachments) {
    try {
      const url = await getFileUrl(attachment.storage_path)
      const response = await fetch(url)
      const buffer = Buffer.from(await response.arrayBuffer())

      const extracted = await extractTextWithMeta(buffer, attachment.file_type, attachment.file_name)
      const text = extracted.text
      const tokens = estimateTokens(text)

      if (totalTokens + tokens > maxTokens) {
        const { text: truncated, truncated: isTruncated } = truncateContext(text, maxTokens - totalTokens)
        contexts.push(`[File: ${attachment.file_name}]\n${truncated}`)
        if (isTruncated) break
      } else {
        contexts.push(`[File: ${attachment.file_name}]\n${text}`)
        totalTokens += tokens
      }
    } catch (error) {
      console.error('Failed to extract attachment:', error)
      contexts.push(`[File: ${attachment.file_name}] - Failed to extract content`)
    }
  }

  return contexts.join('\n\n---\n\n')
}

async function getModelInfo(supabase: ReturnType<typeof createServiceClient>, modelId: string): Promise<Model | null> {
  const { data } = await supabase.from('models').select('*').eq('id', modelId).eq('enabled', true).single()
  return data
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const serviceClient = createServiceClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await serviceClient
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (!profile || !profile.is_active) {
      const reason = profile && !profile.is_approved ? 'Account pending admin approval' : 'Account disabled'
      return NextResponse.json({ error: reason }, { status: 403 })
    }

    const maintenance = await getMaintenanceSettings()
    if (maintenance.enabled && maintenance.mode === 'full') {
      const isAdmin = profile.role === 'admin'
      if (!isAdmin || !maintenance.allow_admins) {
        const timeMsg = maintenance.estimated_end_time ? ` (คาดว่าจะเปิดให้บริการเวลา: ${maintenance.estimated_end_time})` : ''
        return NextResponse.json(
          {
            error: `${maintenance.title || 'ระบบกำลังปิดปรับปรุงชั่วคราว'}: ${maintenance.message || 'ขออภัยในความไม่สะดวก'}${timeMsg}`,
          },
          { status: 503 }
        )
      }
    }


    const rateLimitResult = await rateLimitEndpoint(user.id, 'chat')
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please wait before sending more messages.' },
        { status: 429, headers: { 'Retry-After': Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000).toString() } }
      )
    }

    const body = await request.json()
    const validation = chatRequestSchema.safeParse(body)
    if (!validation.success) {
      return NextResponse.json({ error: 'Invalid request', details: validation.error.flatten() }, { status: 400 })
    }

    const { conversationId, model: modelId, messages, attachments: attachmentIds, stream, webSearch: useWebSearch, kbId, kbSearchAll, systemPromptId } = validation.data

    const model = await getModelInfo(serviceClient, modelId)
    if (!model) {
      return NextResponse.json({ error: 'Model not available' }, { status: 400 })
    }

    const hasVisionContent = messages.some((msg) =>
      Array.isArray(msg.content) && msg.content.some((c) => c.type === 'image_url')
    )
    if (hasVisionContent && !model.supports_vision) {
      return NextResponse.json(
        { error: 'This model does not support vision. Please select a vision-capable model.' },
        { status: 400 }
      )
    }

    const budgetCheck = await checkBudget(user.id, profile.monthly_budget)
    if (!budgetCheck.allowed) {
      return NextResponse.json(
        { error: 'Monthly budget exceeded. Please contact administrator.' },
        { status: 403 }
      )
    }

    let conversationIdFinal = conversationId
    let conversationTitle = 'New Chat'

    if (!conversationIdFinal) {
      const { data: newConv, error: convError } = await serviceClient
        .from('conversations')
        .insert({
          user_id: user.id,
          title: 'New Chat',
          model: modelId,
        })
        .select()
        .single()

      if (convError || !newConv) {
        return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 })
      }
      conversationIdFinal = newConv.id
    } else {
      const { data: existingConv } = await serviceClient
        .from('conversations')
        .select('title')
        .eq('id', conversationIdFinal)
        .eq('user_id', user.id)
        .single()

      if (!existingConv) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
      }
      conversationTitle = existingConv.title
    }

    const userMessage = messages[messages.length - 1]
    const userMessageContent = typeof userMessage.content === 'string'
      ? userMessage.content
      : userMessage.content.filter((c) => c.type === 'text').map((c) => c.text).join('')

    const { error: userMsgError } = await serviceClient.from('messages').insert({
      conversation_id: conversationIdFinal,
      user_id: user.id,
      role: 'user',
      content: userMessageContent,
      model: modelId,
    })
    if (userMsgError) {
      console.error('Failed to save user message:', userMsgError)
      return NextResponse.json({ error: 'Failed to save your message. Please try again.' }, { status: 500 })
    }

    const context = await getConversationContext(serviceClient, conversationIdFinal!, user.id)
    const attachmentContext = await getAttachmentContext(serviceClient, attachmentIds || [], user.id)

    // Phase 2: web search context
    let searchContext = ''
    if (useWebSearch) {
      try {
        const { results } = await webSearch(userMessageContent.slice(0, 400), 5)
        if (results.length) searchContext = `Web search results:\n${formatSearchContext(results)}`
      } catch (e) {
        console.error('[chat] websearch failed', e)
      }
    }

    // Phase 2: RAG knowledge base context (single KB or all KBs)
    let kbContext = ''
    if (kbId) {
      try {
        kbContext = await retrieveContext(kbId, user.id, userMessageContent.slice(0, 500), 5)
      } catch (e) {
        console.error('[chat] rag failed', e)
      }
    } else if (kbSearchAll) {
      try {
        kbContext = await retrieveAcrossKbs(user.id, userMessageContent.slice(0, 500), 5)
      } catch (e) {
        console.error('[chat] rag-all failed', e)
      }
    }

    // Phase 2: long-term memory (best-effort semantic recall)
    let memoryContext = ''
    try {
      const emb = await createEmbedding(userMessageContent.slice(0, 500)).catch(() => null)
      if (emb) {
        const { data: mems } = await serviceClient.rpc('match_memories', {
          p_user_id: user.id,
          p_embedding: JSON.stringify(emb),
          p_top_k: 3,
        })
        if (mems && mems.length) {
          memoryContext = (mems as Array<{ content: string }>).map((m) => m.content).join('\n- ')
        }
      }
    } catch { /* memory optional */ }

    // Phase 2: custom system prompt from library
    let customSystem = ''
    if (systemPromptId) {
      const { data: prompt } = await serviceClient.from('prompts').select('content').eq('id', systemPromptId).single()
      if (prompt) customSystem = prompt.content
    }

    const aiMessages = [
      ...(customSystem ? [{ role: 'system' as const, content: customSystem }] : []),
      ...context,
      ...(memoryContext ? [{ role: 'system' as const, content: `Relevant memories about user:\n- ${memoryContext}` }] : []),
      ...(kbContext ? [{ role: 'system' as const, content: `Knowledge base context:\n${kbContext}` }] : []),
      ...(searchContext ? [{ role: 'system' as const, content: searchContext }] : []),
      ...(attachmentContext ? [{ role: 'system' as const, content: `Context from attached files:\n${attachmentContext}` }] : []),
      ...messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
    ]

    const provider = await getProviderForModel(model)

    if (stream) {
      const encoder = new TextEncoder()
      let fullContent = ''
      let inputTokens = 0
      let outputTokens = 0
      let providerRequestId: string | undefined

      const readable = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of provider.streamChat({
              model: model.provider_model_id,
              messages: aiMessages,
              stream: true,
            })) {
              if (chunk.error) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: chunk.error })}\n\n`))
                break
              }

              if (chunk.content) {
                fullContent += chunk.content
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk.content, done: false })}\n\n`))
              }

              if (chunk.done && chunk.usage) {
                inputTokens = chunk.usage.inputTokens
                outputTokens = chunk.usage.outputTokens
              }
            }

            const estimatedCost = await calculateEstimatedCost(modelId, inputTokens, outputTokens)

            await serviceClient.from('messages').insert({
              conversation_id: conversationIdFinal,
              user_id: user.id,
              role: 'assistant',
              content: fullContent,
              model: modelId,
              input_tokens: inputTokens,
              output_tokens: outputTokens,
              estimated_cost: estimatedCost,
            })

            await serviceClient
              .from('conversations')
              .update({ updated_at: new Date().toISOString(), model: modelId })
              .eq('id', conversationIdFinal)

            if (conversationTitle === 'New Chat') {
              const newTitle = userMessageContent.slice(0, 60).trim() + (userMessageContent.length > 60 ? '...' : '')
              await serviceClient
                .from('conversations')
                .update({ title: newTitle })
                .eq('id', conversationIdFinal)
            }

            await recordUsage({
              user_id: user.id,
              conversation_id: conversationIdFinal,
              model: modelId,
              request_type: hasVisionContent ? 'vision' : attachmentIds && attachmentIds.length > 0 ? 'file_analysis' : 'chat',
              input_tokens: inputTokens,
              output_tokens: outputTokens,
              estimated_cost: estimatedCost,
              provider_request_id: null,
              is_estimate: true,
            })

            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ done: true, conversationId: conversationIdFinal, usage: { inputTokens, outputTokens, estimatedCost } })}\n\n`
              )
            )
            controller.close()
          } catch (error) {
            console.error('Stream error:', error)
            const errorMessage = error instanceof AIProviderError ? error.message : 'Failed to generate response'
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errorMessage })}\n\n`))
            controller.close()
          }
        },
      })

      return new NextResponse(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })
    } else {
      const response = await provider.chat({
        model: model.provider_model_id,
        messages: aiMessages,
        stream: false,
      })

      const estimatedCost = await calculateEstimatedCost(modelId, response.usage?.inputTokens || 0, response.usage?.outputTokens || 0)

      await serviceClient.from('messages').insert({
        conversation_id: conversationIdFinal,
        user_id: user.id,
        role: 'assistant',
        content: response.content,
        model: modelId,
        input_tokens: response.usage?.inputTokens,
        output_tokens: response.usage?.outputTokens,
        estimated_cost: estimatedCost,
      })

      await serviceClient
        .from('conversations')
        .update({ updated_at: new Date().toISOString(), model: modelId })
        .eq('id', conversationIdFinal)

      if (conversationTitle === 'New Chat') {
        const newTitle = userMessageContent.slice(0, 60).trim() + (userMessageContent.length > 60 ? '...' : '')
        await serviceClient
          .from('conversations')
          .update({ title: newTitle })
          .eq('id', conversationIdFinal)
      }

      await recordUsage({
        user_id: user.id,
        conversation_id: conversationIdFinal,
        model: modelId,
        request_type: hasVisionContent ? 'vision' : attachmentIds && attachmentIds.length > 0 ? 'file_analysis' : 'chat',
        input_tokens: response.usage?.inputTokens || 0,
        output_tokens: response.usage?.outputTokens || 0,
        estimated_cost: estimatedCost,
        provider_request_id: null,
        is_estimate: true,
      })

      return NextResponse.json({
        id: crypto.randomUUID(),
        conversationId: conversationIdFinal,
        message: {
          role: 'assistant',
          content: response.content,
        },
        usage: {
          inputTokens: response.usage?.inputTokens || 0,
          outputTokens: response.usage?.outputTokens || 0,
          estimatedCost,
        },
      })
    }
  } catch (error) {
    console.error('Chat API error:', error)
    if (error instanceof AIProviderError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode || 500 })
    }
    if (error instanceof Error && error.message.startsWith('Model provider')) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}