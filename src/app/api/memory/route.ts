import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { createEmbedding } from '@/lib/rag/embeddings'

export const runtime = 'nodejs'

// GET memories (optionally semantic search via ?query=)
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const service = createServiceClient()
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('query')

  if (query) {
    const emb = await createEmbedding(query).catch(() => null)
    if (emb) {
      const { data } = await service.rpc('match_memories', {
        p_user_id: user.id,
        p_embedding: JSON.stringify(emb),
        p_top_k: 5,
      })
      return NextResponse.json({ memories: data })
    }
  }
  const { data } = await service.from('memories').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50)
  return NextResponse.json({ memories: data })
}

// Save memory
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { content } = await request.json()
  if (!content || typeof content !== 'string') return NextResponse.json({ error: 'content required' }, { status: 400 })
  const service = createServiceClient()
  const emb = await createEmbedding(content).catch(() => null)
  const { data, error } = await service.from('memories').insert({
    user_id: user.id, content,
    embedding: emb ? JSON.stringify(emb) : null,
  }).select().single()
  if (error) return NextResponse.json({ error: 'Save failed' }, { status: 500 })
  return NextResponse.json({ memory: data })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const service = createServiceClient()
  await service.from('memories').delete().eq('id', id).eq('user_id', user.id)
  return NextResponse.json({ success: true })
}
