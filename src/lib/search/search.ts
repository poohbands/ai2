export interface SearchResult {
  title: string
  url: string
  snippet: string
  source?: string
}

export interface SearchProvider {
  name: string
  search(query: string, maxResults?: number): Promise<SearchResult[]>
}

class TavilyProvider implements SearchProvider {
  name = 'tavily'
  async search(query: string, maxResults = 5): Promise<SearchResult[]> {
    const key = process.env.TAVILY_API_KEY!
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: key, query, max_results: maxResults, search_depth: 'basic' }),
    })
    if (!res.ok) throw new Error(`Tavily ${res.status}`)
    const data = await res.json()
    return (data.results || []).map((r: { title?: string; url?: string; content?: string }) => ({
      title: r.title || r.url || '',
      url: r.url || '',
      snippet: r.content || '',
      source: 'tavily',
    }))
  }
}

class BraveProvider implements SearchProvider {
  name = 'brave'
  async search(query: string, maxResults = 5): Promise<SearchResult[]> {
    const key = process.env.BRAVE_API_KEY!
    const res = await fetch(
      `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${maxResults}`,
      { headers: { 'X-Subscription-Token': key, Accept: 'application/json' } }
    )
    if (!res.ok) throw new Error(`Brave ${res.status}`)
    const data = await res.json()
    const items = data.web?.results || []
    return items.map((r: { title?: string; url?: string; description?: string }) => ({
      title: r.title || '',
      url: r.url || '',
      snippet: r.description || '',
      source: 'brave',
    }))
  }
}

class DuckDuckGoProvider implements SearchProvider {
  name = 'duckduckgo'
  async search(query: string, maxResults = 5): Promise<SearchResult[]> {
    // No key required - best-effort fallback
    const res = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`, {
      headers: { 'User-Agent': 'FamilyAI/1.0' },
    })
    if (!res.ok) throw new Error(`DuckDuckGo ${res.status}`)
    const data = await res.json()
    const out: SearchResult[] = []
    for (const t of data.RelatedTopics || []) {
      if (t.Text && t.FirstURL) {
        out.push({ title: t.Text.slice(0, 120), url: t.FirstURL, snippet: t.Text, source: 'duckduckgo' })
        if (out.length >= maxResults) break
      }
      if (t.Topics) {
        for (const s of t.Topics) {
          if (s.Text && s.FirstURL) {
            out.push({ title: s.Text.slice(0, 120), url: s.FirstURL, snippet: s.Text, source: 'duckduckgo' })
            if (out.length >= maxResults) break
          }
        }
      }
      if (out.length >= maxResults) break
    }
    if (data.AbstractText && data.AbstractURL) {
      out.unshift({ title: data.Heading || query, url: data.AbstractURL, snippet: data.AbstractText, source: 'duckduckgo' })
    }
    return out.slice(0, maxResults)
  }
}

export function getSearchProvider(): SearchProvider {
  if (process.env.TAVILY_API_KEY) return new TavilyProvider()
  if (process.env.BRAVE_API_KEY) return new BraveProvider()
  return new DuckDuckGoProvider()
}

export function getSearchProviderName(): string {
  if (process.env.TAVILY_API_KEY) return 'tavily'
  if (process.env.BRAVE_API_KEY) return 'brave'
  return 'duckduckgo (fallback, limited)'
}

export async function webSearch(query: string, maxResults = 5): Promise<{ results: SearchResult[]; provider: string }> {
  const provider = getSearchProvider()
  try {
    const results = await provider.search(query, maxResults)
    return { results, provider: provider.name }
  } catch (err) {
    console.error('[search] provider failed, trying fallback:', err instanceof Error ? err.message : err)
    if (provider.name !== 'duckduckgo') {
      const fallback = new DuckDuckGoProvider()
      const results = await fallback.search(query, maxResults).catch(() => [] as SearchResult[])
      return { results, provider: 'duckduckgo-fallback' }
    }
    return { results: [], provider: provider.name }
  }
}

export function formatSearchContext(results: SearchResult[]): string {
  if (!results.length) return ''
  return results
    .map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\n${r.snippet}`)
    .join('\n\n')
}
