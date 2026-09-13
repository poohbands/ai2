'use client'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Model } from '@/types'

export function CompareClient() {
  const [models, setModels] = useState<Model[]>([])
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [q, setQ] = useState('')
  const [outA, setOutA] = useState('')
  const [outB, setOutB] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/models').then((r) => r.json()).then((d) => {
      setModels(d.models || [])
      if (d.models?.length >= 2) {
        setA(d.models[0].id)
        setB(d.models[1].id)
      }
    })
  }, [])

  const run = async () => {
    if (!q.trim()) return
    setLoading(true)
    setOutA('')
    setOutB('')
    const res = await fetch('/api/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: q }], models: [a, b] }),
    })
    const reader = res.body?.getReader()
    if (!reader) return
    const dec = new TextDecoder()
    let buf = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += dec.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() || ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        try {
          const e = JSON.parse(line.slice(6))
          if (e.modelId === a && e.content) setOutA((p) => p + e.content)
          if (e.modelId === b && e.content) setOutB((p) => p + e.content)
        } catch { /* ignore */ }
      }
    }
    setLoading(false)
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Model Compare</h1>
      <div className="flex gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="คำถามเดียวกัน..." className="flex-1" />
        <Button onClick={run} disabled={loading}>Compare</Button>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {[{ id: a, set: setA, out: outA }, { id: b, set: setB, out: outB }].map((col, i) => (
          <Card key={i}>
            <CardHeader><CardTitle>
              <select value={col.id} onChange={(e) => col.set(e.target.value)} className="border rounded px-2 py-1 text-sm">
                {models.map((m) => <option key={m.id} value={m.id}>{m.display_name}</option>)}
              </select>
            </CardTitle></CardHeader>
            <CardContent><pre className="whitespace-pre-wrap text-sm min-h-40">{col.out || '...'}</pre></CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
