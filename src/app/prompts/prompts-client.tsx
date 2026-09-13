'use client'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PromptItem } from '@/types'

export function PromptsClient() {
  const [items, setItems] = useState<PromptItem[]>([])
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  const load = async () => {
    const d = await fetch('/api/prompts').then((r) => r.json())
    setItems(d.prompts || [])
  }
  useEffect(() => { load() }, [])

  const save = async () => {
    if (!title.trim() || !content.trim()) return
    await fetch('/api/prompts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, content }) })
    setTitle('')
    setContent('')
    load()
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Prompt Library</h1>
      <Card><CardHeader><CardTitle>เพิ่มพร้อมท์</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="ชื่อ" />
          <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={4} placeholder="เนื้อพร้อมท์..." />
          <Button onClick={save}>บันทึก</Button>
        </CardContent>
      </Card>
      {items.map((p) => (
        <Card key={p.id}>
          <CardHeader><CardTitle className="text-base">{p.title}</CardTitle></CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-sm">{p.content}</pre>
            <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(p.content)}>Copy</Button>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
