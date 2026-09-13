const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'text-embedding-3-small'

export async function createEmbedding(text: string): Promise<number[]> {
  const baseUrl = process.env.KOB_BASE_URL
  const apiKey = process.env.KOB_API_KEY
  if (!baseUrl || !apiKey) throw new Error('Kob AI not configured')

  const res = await fetch(`${baseUrl}/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: text.slice(0, 8000) }),
  })
  if (!res.ok) throw new Error(`Embedding failed: ${res.status}`)
  const data = await res.json()
  const vec = data.data?.[0]?.embedding
  if (!vec) throw new Error('No embedding returned')
  return vec as number[]
}

export async function createEmbeddings(texts: string[]): Promise<number[][]> {
  const out: number[][] = []
  for (const t of texts) {
    out.push(await createEmbedding(t))
  }
  return out
}
