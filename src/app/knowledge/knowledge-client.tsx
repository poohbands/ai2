'use client'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { KnowledgeBase, KbDocument } from '@/types'

export function KnowledgeClient() {
  const [kbs, setKbs] = useState<KnowledgeBase[]>([])
  const [name, setName] = useState('')
  const [selected, setSelected] = useState<string>('')
  const [docs, setDocs] = useState<KbDocument[]>([])
  const [fileName, setFileName] = useState('')
  const [content, setContent] = useState('')
  const [query, setQuery] = useState('')
  const [answer, setAnswer] = useState('')

  const load = async () => {
    const r = await fetch('/api/kb').then((x) => x.json())
    if (r.knowledgeBases) {
      setKbs(r.knowledgeBases)
      if (!selected && r.knowledgeBases[0]) setSelected(r.knowledgeBases[0].id)
    }
  }
  useEffect(() => { load() }, [])

  useEffect(() => {
    if (!selected) return
    fetch(`/api/kb?kbId=${selected}`).then((r) => r.json()).then((d) => setDocs(d.documents || []))
  }, [selected])

  const create = async () => {
    if (!name.trim()) return
    await fetch('/api/kb', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) })
    setName('')
    load()
  }

  const ingest = async () => {
    if (!selected || !content.trim()) return
    await fetch('/api/kb', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kbId: selected, fileName: fileName || 'paste.txt', mimeType: 'text/plain', content }) })
    setContent('')
    setFileName('')
    const d = await fetch(`/api/kb?kbId=${selected}`).then((r) => r.json())
    setDocs(d.documents || [])
  }

  const search = async () => {
    if (!selected || !query.trim()) return
    const d = await fetch(`/api/kb?kbId=${selected}&query=${encodeURIComponent(query)}`).then((r) => r.json())
    setAnswer(d.context || '(ไม่พบข้อมูล)')
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Knowledge Base (RAG)</h1>
      <Card><CardHeader><CardTitle>คลังความรู้</CardTitle></CardHeader>
        <CardContent className="flex gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อคลังใหม่" />
          <Button onClick={create}>สร้าง</Button>
        </CardContent>
      </Card>
      <div className="flex gap-2 flex-wrap">{kbs.map((k) => <Button key={k.id} variant={k.id === selected ? 'default' : 'outline'} onClick={() => setSelected(k.id)}>{k.name}</Button>)}</div>
      {selected && (
        <>
          <Card><CardHeader><CardTitle>เพิ่มเอกสาร (paste text)</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Input value={fileName} onChange={(e) => setFileName(e.target.value)} placeholder="ชื่อไฟล์" />
              <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={5} placeholder="วางเนื้อหาเอกสาร..." />
              <Button onClick={ingest}>Ingest + Embed</Button>
              <ul className="text-sm list-disc ml-5">{docs.map((d) => <li key={d.id}>{d.file_name} ({d.chunk_count} chunks)</li>)}</ul>
            </CardContent>
          </Card>
          <Card><CardHeader><CardTitle>ค้นหาในคลัง</CardTitle></CardHeader>
            <CardContent className="flex gap-2">
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="คำถาม..." />
              <Button onClick={search}>ค้น</Button>
            </CardContent>
            {answer && <CardContent><pre className="whitespace-pre-wrap text-sm">{answer}</pre></CardContent>}
          </Card>
        </>
      )}
    </div>
  )
}
