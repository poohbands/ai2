import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { kbCreateSchema, kbDocumentSchema } from '@/lib/validation/schemas'
import { ingestDocument, retrieveContext } from '@/lib/rag/rag'

export const runtime = 'nodejs'

// List KBs
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const kbId = searchParams.get('kbId')
  const query = searchParams.get('query')

  const service = createServiceClient()
  if (kbId && query) {
    const ctx = await retrieveContext(kbId, user.id, query, 5)
    return NextResponse.json({ context: ctx })
  }
  if (kbId) {
    const { data: docs } = await service.from('kb_documents').select('*').eq('kb_id', kbId).eq('user_id', user.id).order('created_at', { ascending: false })
    return NextResponse.json({ documents: docs })
  }
  const { data: kbs } = await service.from('knowledge_bases').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
  return NextResponse.json({ knowledgeBases: kbs })
}

// Create KB
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  // ingest document?
  if (body.kbId && body.content) {
    const parsed = kbDocumentSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: 'Invalid document' }, { status: 400 })
    try {
      const doc = await ingestDocument(parsed.data.kbId, user.id, parsed.data.fileName, parsed.data.mimeType, parsed.data.content)
      return NextResponse.json({ document: doc })
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Ingest failed' }, { status: 500 })
    }
  }

  const parsed = kbCreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  const service = createServiceClient()
  const { data, error } = await service.from('knowledge_bases').insert({ user_id: user.id, name: parsed.data.name, description: parsed.data.description }).select().single()
  if (error) return NextResponse.json({ error: 'Create failed' }, { status: 500 })
  return NextResponse.json({ knowledgeBase: data })
}

// Delete KB
export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(request.url)
  const kbId = searchParams.get('kbId')
  if (!kbId) return NextResponse.json({ error: 'kbId required' }, { status: 400 })
  const service = createServiceClient()
  await service.from('knowledge_bases').delete().eq('id', kbId).eq('user_id', user.id)
  return NextResponse.json({ success: true })
}
