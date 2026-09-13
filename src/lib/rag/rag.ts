import { createServiceClient } from '@/lib/supabase/service'
import { createEmbedding } from './embeddings'
import { chunkText } from '@/lib/files/extraction'

export async function ingestDocument(kbId: string, userId: string, fileName: string, mimeType: string, content: string) {
  const supabase = createServiceClient()
  const chunks = chunkText(content, 500)

  const { data: doc, error: docErr } = await supabase
    .from('kb_documents')
    .insert({ kb_id: kbId, user_id: userId, file_name: fileName, mime_type: mimeType, char_count: content.length, chunk_count: chunks.length })
    .select()
    .single()
  if (docErr || !doc) throw new Error('Failed to create document')

  for (let i = 0; i < chunks.length; i++) {
    const embedding = await createEmbedding(chunks[i]).catch(() => null)
    await supabase.from('kb_chunks').insert({
      kb_id: kbId,
      document_id: doc.id,
      user_id: userId,
      content: chunks[i],
      chunk_index: i,
      embedding: embedding ? JSON.stringify(embedding) : null,
    })
  }
  return doc
}

export async function retrieveContext(kbId: string, userId: string, query: string, topK = 5): Promise<string> {
  const supabase = createServiceClient()
  const embedding = await createEmbedding(query).catch(() => null)

  if (embedding) {
    const { data } = await supabase.rpc('match_kb_chunks', {
      p_kb_id: kbId,
      p_user_id: userId,
      p_embedding: JSON.stringify(embedding),
      p_top_k: topK,
    })
    // Fallback if RPC not installed: keyword search
    if (data && data.length) {
      return (data as Array<{ content: string }>).map((d) => d.content).join('\n\n---\n\n')
    }
  }

  // Keyword fallback
  const { data: chunks } = await supabase
    .from('kb_chunks')
    .select('content')
    .eq('kb_id', kbId)
    .eq('user_id', userId)
    .ilike('content', `%${query.split(' ')[0]}%`)
    .limit(topK)

  return (chunks || []).map((c) => c.content).join('\n\n---\n\n')
}
