import { getDefaultProvider } from '@/lib/ai/provider-factory'

export async function createEmbedding(text: string): Promise<number[]> {
  const { provider, embeddingModel } = await getDefaultProvider().catch(() => {
    throw new Error('No AI provider configured for embeddings. Add a provider key in Admin → Providers.')
  })
  if (!('createEmbedding' in provider) || typeof (provider as { createEmbedding?: unknown }).createEmbedding !== 'function') {
    throw new Error('Provider does not support embeddings')
  }
  return (provider as unknown as { createEmbedding: (t: string, m: string) => Promise<number[]> }).createEmbedding(text, embeddingModel)
}

export async function createEmbeddings(texts: string[]): Promise<number[][]> {
  const out: number[][] = []
  for (const t of texts) {
    out.push(await createEmbedding(t))
  }
  return out
}
