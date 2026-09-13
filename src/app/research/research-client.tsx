'use client'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Loader2 } from 'lucide-react'
import { Model } from '@/types'

export function ResearchClient() {
  const [query, setQuery] = useState('')
  const [models, setModels] = useState<Model[]>([])
  const [model, setModel] = useState('')
  const [depth, setDepth] = useState('standard')
  const [status, setStatus] = useState('')
  const [report, setReport] = useState('')
  const [sources, setSources] = useState<Array<{ title: string; url: string }>>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/models').then((r) => r.json()).then((d) => {
      if (d.models) {
        setModels(d.models)
        setModel(d.models[0]?.id || '')
      }
    })
  }, [])

  const run = async () => {
    if (!query.trim() || !model) return
    setLoading(true)
    setReport('')
    setSources([])
    setStatus('เริ่มค้นคว้า...')
    try {
      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, model, depth, stream: true }),
      })
      const reader = res.body?.getReader()
      if (!reader) throw new Error('No stream')
      const decoder = new TextDecoder()
      let buf = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() || ''
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const e = JSON.parse(line.slice(6))
            if (e.step === 'token') setReport((p) => p + e.content)
            else if (e.step === 'done') {
              if (e.content) setReport(e.content)
              if (e.sources) setSources(e.sources)
              setStatus('เสร็จสิ้น')
            } else setStatus(e.content || e.step)
          } catch { /* ignore */ }
        }
      }
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Deep Research</h1>
      <Card>
        <CardHeader><CardTitle>คำถามวิจัย</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="เช่น เปรียบเทียบรถ EV 2026..." />
          <div className="flex gap-2">
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger className="flex-1"><SelectValue placeholder="Model" /></SelectTrigger>
              <SelectContent>{models.map((m) => <SelectItem key={m.id} value={m.id}>{m.display_name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={depth} onValueChange={setDepth}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="quick">Quick</SelectItem>
                <SelectItem value="standard">Standard</SelectItem>
                <SelectItem value="deep">Deep</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={run} disabled={loading || !query.trim()}>{loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}ค้นคว้า</Button>
          </div>
          {status && <p className="text-sm text-muted-foreground">{status}</p>}
        </CardContent>
      </Card>
      {report && (
        <Card>
          <CardHeader><CardTitle>รายงาน</CardTitle></CardHeader>
          <CardContent>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{report}</ReactMarkdown>
            {!!sources.length && (
              <div className="mt-4">
                <h3 className="font-semibold">แหล่งอ้างอิง</h3>
                <ul className="list-disc ml-5 text-sm">{sources.map((s, i) => <li key={i}><a className="underline" href={s.url} target="_blank" rel="noreferrer">{s.title}</a></li>)}</ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
