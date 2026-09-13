'use client'

import { useState, useEffect, Fragment } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2, KeyRound, Trash2, FlaskConical, CheckCircle2, XCircle } from 'lucide-react'
import { ProviderItem } from '@/types'

const PRESETS: Record<string, { name: string; type: string; base_url: string }> = {
  kob: { name: 'Kob AI', type: 'kob', base_url: 'https://api.kob.ai/v1' },
  deepseek: { name: 'DeepSeek', type: 'deepseek', base_url: 'https://api.deepseek.com/v1' },
  openrouter: { name: 'OpenRouter', type: 'openrouter', base_url: 'https://openrouter.ai/api/v1' },
  custom: { name: '', type: 'openai-compatible', base_url: '' },
}

export function ProvidersTab() {
  const [providers, setProviders] = useState<ProviderItem[]>([])
  const [loading, setLoading] = useState(true)
  const [preset, setPreset] = useState('kob')
  const [name, setName] = useState(PRESETS.kob.name)
  const [baseUrl, setBaseUrl] = useState(PRESETS.kob.base_url)
  const [apiKey, setApiKey] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [testing, setTesting] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; msg: string }>>({})
  const [rotating, setRotating] = useState<string | null>(null)
  const [newKey, setNewKey] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const d = await fetch('/api/admin/providers').then((r) => r.json())
      setProviders(d.providers || [])
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    load()
  }, [])

  const onPreset = (p: string) => {
    setPreset(p)
    setName(PRESETS[p].name)
    setBaseUrl(PRESETS[p].base_url)
  }

  const add = async () => {
    setError('')
    if (!name.trim() || !baseUrl.trim() || !apiKey.trim()) {
      setError('กรอกชื่อ, Base URL และ API key ให้ครบ')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), type: PRESETS[preset].type, base_url: baseUrl.trim(), api_key: apiKey.trim() }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Save failed')
      setApiKey('')
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (p: ProviderItem) => {
    await fetch(`/api/admin/providers/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !p.enabled }),
    })
    load()
  }

  const remove = async (p: ProviderItem) => {
    if (!confirm(`ลบ provider "${p.name}"? โมเดลที่ผูกไว้จะกลับไปใช้ค่า default`)) return
    await fetch(`/api/admin/providers/${p.id}`, { method: 'DELETE' })
    load()
  }

  const test = async (p: ProviderItem) => {
    setTesting(p.id)
    try {
      const res = await fetch(`/api/admin/providers/${p.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test' }),
      })
      const d = await res.json()
      setTestResult((prev) => ({
        ...prev,
        [p.id]: res.ok
          ? { ok: true, msg: `ต่อได้ — พบ ${d.modelCount} โมเดล` }
          : { ok: false, msg: d.error || 'ต่อไม่ได้' },
      }))
    } finally {
      setTesting(null)
    }
  }

  const rotate = async (p: ProviderItem) => {
    if (!newKey.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/providers/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: newKey.trim() }),
      })
      if (!res.ok) throw new Error('Rotate failed')
      setNewKey('')
      setRotating(null)
      load()
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>เพิ่ม API Key ค่ายใหม่</CardTitle>
          <CardDescription>คีย์ถูกเข้ารหัส (AES-256-GCM) ก่อนเก็บลงฐานข้อมูล และไม่เคยส่งกลับมาแสดง</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>ค่าย (preset)</Label>
              <Select value={preset} onValueChange={onPreset}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="kob">Kob AI</SelectItem>
                  <SelectItem value="deepseek">DeepSeek</SelectItem>
                  <SelectItem value="openrouter">OpenRouter</SelectItem>
                  <SelectItem value="custom">กำหนดเอง (OpenAI-compatible)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>ชื่อ</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น DeepSeek หลัก" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Base URL</Label>
            <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://..." />
          </div>
          <div className="space-y-2">
            <Label>API Key</Label>
            <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="วางคีย์ที่นี่" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button onClick={add} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            <KeyRound className="h-4 w-4 mr-2" />
            บันทึกคีย์
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Providers ({providers.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ชื่อ / ประเภท</TableHead>
                <TableHead>Base URL</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>เปิดใช้</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {providers.map((p) => (
                <Fragment key={p.id}>
                  <TableRow>
                    <TableCell>
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.type}</p>
                    </TableCell>
                    <TableCell className="text-xs font-mono">{p.base_url}</TableCell>
                    <TableCell className="font-mono text-xs">{p.key_hint}</TableCell>
                    <TableCell>
                      <Switch checked={p.enabled} onCheckedChange={() => toggle(p)} />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => test(p)} disabled={testing === p.id}>
                          {testing === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setRotating(rotating === p.id ? null : p.id)}>
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => remove(p)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {testResult[p.id] && (
                    <TableRow key={`${p.id}-test`}>
                      <TableCell colSpan={5}>
                        <p className={`text-xs flex items-center gap-1 ${testResult[p.id].ok ? 'text-green-600' : 'text-destructive'}`}>
                          {testResult[p.id].ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                          {testResult[p.id].msg}
                        </p>
                      </TableCell>
                    </TableRow>
                  )}
                  {rotating === p.id && (
                    <TableRow key={`${p.id}-rotate`}>
                      <TableCell colSpan={5}>
                        <div className="flex gap-2">
                          <Input type="password" value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="คีย์ใหม่" />
                          <Button size="sm" onClick={() => rotate(p)} disabled={saving}>เปลี่ยนคีย์</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
              {providers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    ยังไม่มี provider — เพิ่มด้านบน หรือระบบจะใช้ KOB_* จาก env
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
