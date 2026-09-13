'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DebugInfo {
  serverSupabaseHost: string
  hasServiceKey: boolean
  hasKobKey: boolean
  kobBaseUrl: string
  appEncryptionKeySet: boolean
  upstashSet: boolean
  tavilySet: boolean
  braveSet: boolean
  mistralSet: boolean
  modelCount: number
  providerCount: number
  commit: string
}

function hostOf(url: string | undefined): string {
  try {
    return url ? new URL(url).hostname : 'missing'
  } catch {
    return 'invalid-url'
  }
}

function Row({ label, ok, detail }: { label: string; ok: boolean; detail?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2">
        {detail && <span className="font-mono text-xs">{detail}</span>}
        <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', ok ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800')}>
          {ok ? 'OK' : 'ขาด'}
        </span>
      </span>
    </div>
  )
}

export function DebugTab() {
  const [info, setInfo] = useState<DebugInfo | null>(null)
  const browserHost = hostOf(process.env.NEXT_PUBLIC_SUPABASE_URL)

  useEffect(() => {
    fetch('/api/admin/debug')
      .then((r) => r.json())
      .then((d) => setInfo(d))
      .catch(() => {})
  }, [])

  if (!info) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    )
  }

  const match = browserHost !== 'missing' && browserHost === info.serverSupabaseHost

  return (
    <div className="space-y-6">
      <Card className={match ? '' : 'border-destructive'}>
        <CardHeader>
          <CardTitle>Supabase ที่เบราว์เซอร์ vs Server ใช้</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between py-1.5 text-sm">
            <span className="text-muted-foreground">เบราว์เซอร์ (อ่าน + auth)</span>
            <span className="font-mono text-xs">{browserHost}</span>
          </div>
          <div className="flex items-center justify-between py-1.5 text-sm">
            <span className="text-muted-foreground">Server (บันทึก + แอดมิน)</span>
            <span className="font-mono text-xs">{info.serverSupabaseHost}</span>
          </div>
          <p className={cn('mt-2 text-sm font-medium', match ? 'text-green-700' : 'text-destructive')}>
            {match
              ? 'ตรงกัน — การอ่าน/เขียนใช้ฐานเดียวกัน'
              : 'ไม่ตรงกัน! นี่คือสาเหตุที่ข้อความหาย — แก้ NEXT_PUBLIC_SUPABASE_URL (+ ANON KEY ให้ตรง project เดียวกัน) บน Vercel แล้ว Redeploy'}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Environment & เชื่อมต่อ (commit {info.commit})</CardTitle>
        </CardHeader>
        <CardContent className="divide-y divide-border">
          <Row label="Service role key" ok={info.hasServiceKey} />
          <Row label="Kob API key" ok={info.hasKobKey} detail={info.kobBaseUrl} />
          <Row label="APP_ENCRYPTION_KEY" ok={info.appEncryptionKeySet} />
          <Row label="Upstash Redis" ok={info.upstashSet} detail={info.upstashSet ? undefined : 'ใช้ in-memory แทน'} />
          <Row label="Tavily / Brave" ok={info.tavilySet || info.braveSet} detail={info.tavilySet || info.braveSet ? undefined : 'ใช้ DuckDuckGo แทน'} />
          <Row label="Mistral OCR" ok={info.mistralSet} detail={info.mistralSet ? undefined : 'ไม่บังคับ'} />
          <Row label="Models ในฐาน" ok={info.modelCount > 0} detail={String(info.modelCount)} />
          <Row label="Providers ในฐาน" ok={true} detail={String(info.providerCount)} />
        </CardContent>
      </Card>
    </div>
  )
}
