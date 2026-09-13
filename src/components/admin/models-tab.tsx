'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2, Eye, Plus, Trash2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { AdminModel, ProviderItem } from '@/types'

interface LiveProvider {
  provider: { id: string; name: string; type: string; base_url: string }
  models: Array<{ id: string; supportsVision: boolean }>
  error: string | null
}

const RENDER_LIMIT = 100

export function ModelsTab() {
  const [models, setModels] = useState<AdminModel[]>([])
  const [providers, setProviders] = useState<ProviderItem[]>([])
  const [live, setLive] = useState<LiveProvider[]>([])
  const [liveLoading, setLiveLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [names, setNames] = useState<Record<string, string>>({})
  const [filterProvider, setFilterProvider] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [newId, setNewId] = useState('')
  const [newName, setNewName] = useState('')
  const [newCategory, setNewCategory] = useState('Custom')
  const [newProvider, setNewProvider] = useState('env')
  const [newVision, setNewVision] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const [m, p] = await Promise.all([
        fetch('/api/admin/models').then((r) => r.json()),
        fetch('/api/admin/providers').then((r) => r.json()),
      ])
      setModels(m.models || [])
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

  const loadLive = async () => {
    setLiveLoading(true)
    try {
      const d = await fetch('/api/admin/providers/models').then((r) => r.json())
      setLive(d.providers || [])
    } finally {
      setLiveLoading(false)
    }
  }

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

  const add = async (preset?: { provider_model_id: string; display_name: string; provider_id: string | null; supportsVision?: boolean }) => {
    const pid = preset?.provider_model_id || newId.trim()
    const dname = preset?.display_name || newName.trim()
    setError('')
    if (!pid || !dname) {
      setError('กรอก Model ID และชื่อที่แสดงให้ครบ')
      return
    }
    const key = preset ? `add-${preset.provider_id}-${pid}` : 'add-form'
    setBusyId(key)
    setSaving(true)
    try {
      const res = await fetch('/api/admin/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider_model_id: pid,
          display_name: dname,
          category: preset ? undefined : newCategory.trim() || 'Custom',
          supports_vision: preset ? !!preset.supportsVision : newVision,
          provider_id: preset ? preset.provider_id : newProvider === 'env' ? null : newProvider,
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
      setBusyId(null)
    }
  }

  const remove = async (m: AdminModel) => {
    if (!confirm(`ลบโมเดล "${m.display_name}"? ประวัติแชตเก่ายังเก็บชื่อโมเดลเป็นข้อความไว้`)) return
    await fetch(`/api/admin/models?id=${m.id}`, { method: 'DELETE' })
    load()
  }

  const dbByProviderModelId = useMemo(() => {
    const map = new Map<string, AdminModel[]>()
    for (const m of models) {
      const arr = map.get(m.provider_model_id) || []
      arr.push(m)
      map.set(m.provider_model_id, arr)
    }
    return map
  }, [models])

  const q = search.trim().toLowerCase()
  const visibleLive = live
    .filter((g) => filterProvider === 'all' || g.provider.id === filterProvider)
    .map((g) => ({
      ...g,
      models: g.models.filter((m) => !q || m.id.toLowerCase().includes(q)).slice(0, RENDER_LIMIT),
      total: g.models.filter((m) => !q || m.id.toLowerCase().includes(q)).length,
    }))

  const visibleModels = [...models]
    .filter((m) => {
      if (filterProvider !== 'all' && (m.provider_id || 'env') !== filterProvider) return false
      if (q && !`${m.display_name} ${m.provider_model_id}`.toLowerCase().includes(q)) return false
      return true
    })
    .sort((a, b) => {
      if (a.enabled !== b.enabled) return a.enabled ? -1 : 1
      const pa = a.providers?.name || 'Default'
      const pb = b.providers?.name || 'Default'
      if (pa !== pb) return pa.localeCompare(pb)
      return (a.sort_order ?? 0) - (b.sort_order ?? 0)
    })

  const providerName = (id: string | null) =>
    id ? providers.find((p) => p.id === id)?.name || 'Unknown' : 'Default (env)'

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
          <CardTitle>ตัวกรอง</CardTitle>
          <CardDescription>กรองทั้งรายการสดจาก provider และตารางโมเดลในฐาน</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <div className="space-y-2">
            <Label>Provider</Label>
            <Select value={filterProvider} onValueChange={setFilterProvider}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">ทุก provider</SelectItem>
                <SelectItem value="env">Default (env)</SelectItem>
                {providers.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 flex-1 min-w-[200px]">
            <Label>ค้นชื่อโมเดล</Label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="เช่น deepseek, gpt-4o..." />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>โมเดลสดจาก Providers</CardTitle>
              <CardDescription>ดึงรายการจริงจาก API ของแต่ละค่าย กดเพิ่มเพื่อใช้งานได้ทันที</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadLive} disabled={liveLoading}>
              {liveLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              ดึงรายการ
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {live.length === 0 && !liveLoading && (
            <p className="text-sm text-muted-foreground">กด “ดึงรายการ” เพื่อดูโมเดลที่มีในแต่ละ provider</p>
          )}
          {visibleLive.map((g) => (
            <div key={g.provider.id}>
              <p className="font-medium text-sm mb-2">
                {g.provider.name} <span className="text-muted-foreground font-normal">({g.total} โมเดล)</span>
              </p>
              {g.error ? (
                <p className="text-sm text-destructive">ดึงไม่ได้: {g.error}</p>
              ) : (
                <div className="space-y-1">
                  {g.models.map((m) => {
                    const existing = dbByProviderModelId.get(m.id) || []
                    const bound = existing.find((e) => e.provider_id === g.provider.id)
                    const anyEnabled = existing.some((e) => e.enabled)
                    return (
                      <div key={m.id} className="flex items-center gap-2 text-sm py-1 border-b border-border/50 last:border-0">
                        {m.supportsVision && <Eye className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
                        <span className="font-mono text-xs flex-1 truncate">{m.id}</span>
                        {bound ? (
                          <span className={`text-xs ${bound.enabled ? 'text-green-600' : 'text-muted-foreground'}`}>
                            {bound.enabled ? 'ใช้งานอยู่' : 'เพิ่มแล้ว (ปิดอยู่)'}
                          </span>
                        ) : existing.length > 0 ? (
                          <span className="text-xs text-muted-foreground">มีในฐาน ({providerName(existing[0].provider_id)})</span>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            disabled={busyId === `add-${g.provider.id}-${m.id}`}
                            onClick={() => add({ provider_model_id: m.id, display_name: m.id, provider_id: g.provider.id, supportsVision: m.supportsVision })}
                          >
                            {busyId === `add-${g.provider.id}-${m.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
                            เพิ่ม
                          </Button>
                        )}
                        {bound && !bound.enabled && (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => patch(bound.id, { enabled: true })}>
                            เปิดใช้
                          </Button>
                        )}
                      </div>
                    )
                  })}
                  {g.total > RENDER_LIMIT && (
                    <p className="text-xs text-muted-foreground">แสดง {RENDER_LIMIT} จาก {g.total} — พิมพ์ค้นเพื่อหาโมเดลที่ต้องการ</p>
                  )}
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>เพิ่มโมเดลเอง</CardTitle>
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
          <Button onClick={() => add()} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            <Plus className="h-4 w-4 mr-2" />
            เพิ่มโมเดล
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Models ในฐาน ({visibleModels.length})</CardTitle>
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
              {visibleModels.map((m) => (
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
