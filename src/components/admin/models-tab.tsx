'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2, Eye } from 'lucide-react'
import { AdminModel, ProviderItem } from '@/types'

export function ModelsTab() {
  const [models, setModels] = useState<AdminModel[]>([])
  const [providers, setProviders] = useState<ProviderItem[]>([])
  const [loading, setLoading] = useState(true)
  const [names, setNames] = useState<Record<string, string>>({})

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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  return (
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
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
