'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

export function ImagesClient() {
  const [prompt, setPrompt] = useState('')
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const gen = async () => {
    if (!prompt.trim()) return
    setLoading(true)
    setError('')
    try {
      const r = await fetch('/api/images', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Failed')
      setUrl(d.imageUrl)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">Image Generation</h1>
      <Card><CardHeader><CardTitle>สร้างภาพ</CardTitle></CardHeader>
        <CardContent className="flex gap-2">
          <Input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="อธิบายภาพที่ต้องการ..." />
          <Button onClick={gen} disabled={loading}>{loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Generate</Button>
        </CardContent>
      </Card>
      {error && <p className="text-red-500 text-sm">{error}</p>}
      {url && <Card><CardContent className="pt-4"><img src={url} alt={prompt} className="rounded w-full" /></CardContent></Card>}
    </div>
  )
}
