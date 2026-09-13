'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2, Eye, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { AdminModel, ProviderItem } from '@/types'

export function ModelsTab() {
  const [models, setModels] = useState<AdminModel[]>([])
  const [providers, setProviders] = useState<ProviderItem[]>([])
  const [loading, setLoading] = useState(true)
  const [names, setNames] = useState<Record<string, string>>({})
  const [newId, setNewId] = useState('')
  const [newName, setNewName] = useState('')
  const [newCategory, setNewCategory] = useState('Custom')
  const [newProvider, setNewProvider] = useState('env')
  const [newVision, setNewVision] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const [m, p] = await Promise.all([
        fetch('/api/admin/models').then((r) => r.json()),
        fetch('/api/admin/providers').then((r) => r.json()),
      ])
      const sorted = [...(m.models || [])].sort((a: AdminModel, b: AdminModel) => {
        // เปิดใช้ก่อน, แล้วเรียงตาม provider, แล้วตามลำดับเดิม
        if (a.enabled !== b.enabled) return a.enabled ? -1 : 1
        const pa = a.providers?.name || 'Default'
        const pb = b.providers?.name || 'Default'
        if (pa !== pb) return pa.localeCompare(pb)
        return (a.sort_order ?? 0) - (b.sort_order ?? 0)
      })
      setModels(sorted)
      setProviders(p.providers || [])
      const n: Record<string, string> = {}
      for (const mod of m.models || []) n[mod.id] = mod.display_name
      setNames(n)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    load()
  }, [])

  const patch = async (id: string, body: Record<string, unknown>) => {
    await fetch(`/api/admin/models?id=${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    load()
  }

  const saveName = (id: string) => {
    const v = (names[id] || '').trim()
    const orig = models.find((m) => m.id === id)?.display_name
    if (v && v !== orig) patch(id, { display_name: v })
    else setNames((prev) => ({ ...prev, [id]: orig || '' }))
  }

  const add = async () => {
    setError('')
    if (!newId.trim() || !newName.trim()) {
      setError('กรอก Model ID และชื่อที่แสดงให้ครบ')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider_model_id: newId.trim(),
          display_name: newName.trim(),
          category: newCategory.trim() || 'Custom',
          supports_vision: newVision,
          provider_id: newProvider === 'env' ? null : newProvider,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Add failed')
      setNewId('')
      setNewName('')
      setNewCategory('Custom')
      setNewProvider('env')
      setNewVision(false)
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Add failed')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (m: AdminModel) => {
    if (!confirm(`ลบโมเดล "${m.display_name}"? ประวัติแชตเก่ายังเก็บชื่อโมเดลเป็นข้อความไว้`)) return
    await fetch(`/api/admin/models?id=${m.id}`, { method: 'DELETE' })
    load()
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
        <CardTitle>เพิ่มโมเดล</CardTitle>
        <CardDescription>Model ID ต้องตรงกับชื่อโมเดลของ provider (เช่น deepseek-chat)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid md:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Model ID</Label>
            <Input value={newId} onChange={(e) => setNewId(e.target.value)} placeholder="เช่น deepseek-chat" className="font-mono" />
          </div>
          <div className="space-y-2">
            <Label>ชื่อที่แสดง</Label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="เช่น DeepSeek V3" />
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label>หมวด</Label>
            <Input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="Custom" />
          </div>
          <div className="space-y-2">
            <Label>Provider</Label>
            <Select value={newProvider} onValueChange={setNewProvider}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="env">Default (env)</SelectItem>
                {providers.map((p) => (
                  <SelectItem key={p.id} value={p.id} disabled={!p.enabled}>
                    {p.name}{!p.enabled ? ' (ปิด)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>รองรับภาพ (Vision)</Label>
            <div className="h-9 flex items-center">
              <Switch checked={newVision} onCheckedChange={setNewVision} />
            </div>
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button onClick={add} disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          <Plus className="h-4 w-4 mr-2" />
          เพิ่มโมเดล
        </Button>
      </CardContent>
    </Card>

    <Card>
      <CardHeader>
        <CardTitle>Models ({models.length})</CardTitle>
        <CardDescription>เปิด/ปิดโมเดล ผูก provider key และแก้ชื่อที่แสดงในหน้าแชต</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ชื่อที่แสดง</TableHead>
              <TableHead>Model ID</TableHead>
              <TableHead>Provider</TableHead>
              <TableHead>เปิดใช้</TableHead>
              <TableHead className="text-right">ลบ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {models.map((m) => (
              <TableRow key={m.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {m.supports_vision && <Eye className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
                    <Input
                      value={names[m.id] ?? m.display_name}
                      onChange={(e) => setNames((prev) => ({ ...prev, [m.id]: e.target.value }))}
                      onBlur={() => saveName(m.id)}
                      className="h-8 max-w-[220px]"
                    />
                  </div>
                </TableCell>
                <TableCell className="text-xs font-mono">{m.provider_model_id}</TableCell>
                <TableCell>
                  <Select
                    value={m.provider_id || 'env'}
                    onValueChange={(v) => patch(m.id, { provider_id: v === 'env' ? null : v })}
                  >
                    <SelectTrigger className="w-[160px] h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="env">Default (env)</SelectItem>
                      {providers.map((p) => (
                        <SelectItem key={p.id} value={p.id} disabled={!p.enabled}>
                          {p.name}{!p.enabled ? ' (ปิด)' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Switch checked={m.enabled} onCheckedChange={(v) => patch(m.id, { enabled: v })} />
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => remove(m)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
    </div>
  )
}
