'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { cn, formatRelativeTime } from '@/lib/utils'
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Power,
  Wrench,
  Loader2,
  Eye,
  RefreshCw,
  Info,
  Server,
  Lock,
  Radio,
  Bell,
  Sparkles,
  Check,
} from 'lucide-react'
import { MaintenanceSettings, DEFAULT_MAINTENANCE_SETTINGS } from '@/types'

export function MaintenanceTab() {
  const [settings, setSettings] = useState<MaintenanceSettings>(DEFAULT_MAINTENANCE_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [previewTab, setPreviewTab] = useState<'banner' | 'lockdown'>('banner')

  const fetchSettings = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/maintenance')
      if (res.ok) {
        const data = await res.json()
        if (data?.settings) {
          setSettings(data.settings)
        }
      }
    } catch (err) {
      console.error('Failed to load maintenance settings:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSettings()
  }, [])

  const handleSave = async (updates?: Partial<MaintenanceSettings>) => {
    const toSave = updates ? { ...settings, ...updates } : settings
    try {
      setSaving(true)
      setSaveStatus('idle')
      const res = await fetch('/api/admin/maintenance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(toSave),
      })
      if (!res.ok) throw new Error('Failed to update maintenance settings')
      const data = await res.json()
      if (data?.settings) {
        setSettings(data.settings)
      }
      setSaveStatus('success')
      setTimeout(() => setSaveStatus('idle'), 3000)
    } catch (err) {
      console.error('Error saving maintenance settings:', err)
      setSaveStatus('error')
    } finally {
      setSaving(false)
    }
  }

  const handleQuickToggle = async (enabled: boolean) => {
    const updated = { ...settings, enabled }
    setSettings(updated)
    await handleSave(updated)
  }

  const handleSetPresetTime = (minutes: number) => {
    const now = new Date()
    const target = new Date(now.getTime() + minutes * 60000)
    const hours = String(target.getHours()).padStart(2, '0')
    const mins = String(target.getMinutes()).padStart(2, '0')
    const timeString = `${hours}:${mins} น.`
    setSettings((prev) => ({ ...prev, estimated_end_time: timeString }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    )
  }

  const isMaintenanceActive = settings.enabled

  return (
    <div className="space-y-6">
      {/* Top Banner Status Card */}
      <Card
        className={cn(
          'border-2 transition-all',
          isMaintenanceActive
            ? settings.mode === 'full'
              ? 'border-rose-500/60 bg-rose-500/5'
              : 'border-amber-500/60 bg-amber-500/5'
            : 'border-emerald-500/30 bg-emerald-500/5'
        )}
      >
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div
                className={cn(
                  'p-3 rounded-2xl border',
                  isMaintenanceActive
                    ? settings.mode === 'full'
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-600'
                      : 'bg-amber-500/10 border-amber-500/30 text-amber-600'
                    : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600'
                )}
              >
                {isMaintenanceActive ? (
                  settings.mode === 'full' ? (
                    <Lock className="h-6 w-6" />
                  ) : (
                    <AlertTriangle className="h-6 w-6" />
                  )
                ) : (
                  <CheckCircle2 className="h-6 w-6" />
                )}
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <h3 className="text-lg font-bold">
                    {isMaintenanceActive
                      ? settings.mode === 'full'
                        ? 'กำลังเปิดโหมดปิดปรับปรุงระบบเต็มรูปแบบ (Full Lockdown)'
                        : 'กำลังเปิดโหมดแจ้งเตือนล่วงหน้า (Notice Banner)'
                      : 'สถานะระบบ: เปิดให้บริการตามปกติ (Normal Operation)'}
                  </h3>
                  <span
                    className={cn(
                      'text-xs px-2.5 py-0.5 rounded-full font-semibold border',
                      isMaintenanceActive
                        ? settings.mode === 'full'
                          ? 'bg-rose-500 text-white border-rose-600'
                          : 'bg-amber-500 text-white border-amber-600'
                        : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30'
                    )}
                  >
                    {isMaintenanceActive ? 'Active' : 'Standby'}
                  </span>
                </div>

                <p className="text-sm text-muted-foreground">
                  {isMaintenanceActive
                    ? settings.mode === 'full'
                      ? 'ผู้ใช้ทั่วไปไม่สามารถส่งข้อความได้ และจะเห็นหน้าปิดปรับปรุงระบบ (แอดมินยังสามารถเข้าใช้งานได้ตามปกติ)'
                      : 'ผู้ใช้สามารถใช้งานระบบได้ปกติ แต่จะมีแถบประกาศแจ้งเตือนแสดงด้านบนหน้าแชต'
                    : 'ระบบ AI และฐานข้อมูลเปิดให้ผู้ใช้งานทุกคนเข้าใช้งานได้ตามปกติ'}
                </p>

                {settings.updated_at && (
                  <p className="text-xs text-muted-foreground pt-1 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    อัปเดตล่าสุด: {formatRelativeTime(settings.updated_at)}
                    {settings.updated_by && ` โดย ${settings.updated_by}`}
                  </p>
                )}
              </div>
            </div>

            {/* Quick Action Button */}
            <div className="flex items-center gap-3">
              <Button
                variant={isMaintenanceActive ? 'destructive' : 'default'}
                size="sm"
                className="gap-2 font-medium"
                disabled={saving}
                onClick={() => handleQuickToggle(!isMaintenanceActive)}
              >
                <Power className="h-4 w-4" />
                {isMaintenanceActive ? 'ปิดโหมดซ่อมบำรุงทันที' : 'เปิดโหมดซ่อมบำรุงทันที'}
              </Button>

              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9"
                title="รีเฟรชข้อมูล"
                disabled={loading}
                onClick={fetchSettings}
              >
                <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Settings Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Card 1: Mode Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Wrench className="h-5 w-5 text-primary" />
              <CardTitle className="text-base font-semibold">การกำหนดรูปแบบการบำรุงรักษา</CardTitle>
            </div>
            <CardDescription>
              เลือกรูปแบบการทำงานว่าจะแจ้งเตือนผู้ใช้หรือปิดการใช้งานระบบทั้งหมด
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Master Switch */}
            <div className="flex items-center justify-between p-3.5 rounded-xl border bg-muted/30">
              <div className="space-y-0.5">
                <Label className="text-sm font-semibold">เปิดใช้งานโหมดซ่อมบำรุง (Maintenance Mode)</Label>
                <p className="text-xs text-muted-foreground">
                  เมื่อเปิด ระบบจะทำงานตามโหมดที่เลือกด้านล่าง
                </p>
              </div>
              <Switch
                checked={settings.enabled}
                onCheckedChange={(checked) => setSettings((s) => ({ ...s, enabled: checked }))}
              />
            </div>

            {/* Mode Selection */}
            <div className="space-y-3">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                ระดับการบำรุงรักษา (Maintenance Mode Type)
              </Label>

              <div
                onClick={() => {
                  setSettings((s) => ({ ...s, mode: 'notice' }))
                  setPreviewTab('banner')
                }}
                className={cn(
                  'p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3',
                  settings.mode === 'notice'
                    ? 'border-amber-500 bg-amber-500/10 shadow-sm ring-1 ring-amber-500/50'
                    : 'hover:bg-muted/50 border-border opacity-80'
                )}
              >
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 mt-0.5">
                  <Bell className="h-4 w-4" />
                </div>
                <div className="space-y-1 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">1. แถบประกาศแจ้งเตือน (Notice Banner)</span>
                    {settings.mode === 'notice' && (
                      <span className="text-[11px] font-medium text-amber-600 bg-amber-500/15 px-2 py-0.5 rounded-full">
                        เลือกอยู่
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    แสดงแถบประกาศเตือนสีส้มที่ด้านบนหน้าต่างแชต เพื่อแจ้งกำหนดการให้ผู้ใช้ทราบล่วงหน้า โดยผู้ใช้ยังคงส่งแชตและใช้งานฟังก์ชันอื่นๆ ได้ตามปกติ
                  </p>
                </div>
              </div>

              <div
                onClick={() => {
                  setSettings((s) => ({ ...s, mode: 'full' }))
                  setPreviewTab('lockdown')
                }}
                className={cn(
                  'p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3',
                  settings.mode === 'full'
                    ? 'border-rose-500 bg-rose-500/10 shadow-sm ring-1 ring-rose-500/50'
                    : 'hover:bg-muted/50 border-border opacity-80'
                )}
              >
                <div className="p-2 rounded-lg bg-rose-500/10 text-rose-600 mt-0.5">
                  <Lock className="h-4 w-4" />
                </div>
                <div className="space-y-1 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">2. ปิดระบบเต็มรูปแบบ (Full Maintenance Screen)</span>
                    {settings.mode === 'full' && (
                      <span className="text-[11px] font-medium text-rose-600 bg-rose-500/15 px-2 py-0.5 rounded-full">
                        เลือกอยู่
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    บล็อกไม่ให้ผู้ใช้ทั่วไปส่งข้อความแชตใหม่ และแสดงหน้าจอ Maintenance พร้อมข้อความชี้แจง (เหมาะสำหรับช่วงอัปเกรดฐานข้อมูลหรือแก้ไขข้อผิดพลาดสำคัญ)
                  </p>
                </div>
              </div>
            </div>

            {/* Admin Bypass Toggle */}
            <div className="flex items-center justify-between p-3.5 rounded-xl border bg-muted/20">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4 text-primary" />
                  ยกเว้นแอดมิน (Admin Bypass)
                </Label>
                <p className="text-xs text-muted-foreground">
                  อนุญาตให้บัญชีผู้ดูแลระบบ (Admin) เข้าใช้งานและทดสอบระบบได้ แม้อยู่ในโหมดปิดปรับปรุง
                </p>
              </div>
              <Switch
                checked={settings.allow_admins}
                onCheckedChange={(checked) => setSettings((s) => ({ ...s, allow_admins: checked }))}
              />
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Notice & Message Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" />
              <CardTitle className="text-base font-semibold">ข้อความและรายละเอียดประกาศ</CardTitle>
            </div>
            <CardDescription>
              ปรับแต่งข้อความแจ้งเตือนและกำหนดเวลาที่คาดว่าจะแล้วเสร็จ
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Title */}
            <div className="space-y-1.5">
              <Label htmlFor="maint-title" className="text-xs font-semibold">
                หัวข้อประกาศ (Title)
              </Label>
              <Input
                id="maint-title"
                value={settings.title}
                onChange={(e) => setSettings((s) => ({ ...s, title: e.target.value }))}
                placeholder="เช่น ระบบกำลังปิดปรับปรุงชั่วคราว"
              />
            </div>

            {/* Message Description */}
            <div className="space-y-1.5">
              <Label htmlFor="maint-message" className="text-xs font-semibold">
                ข้อความชี้แจง (Notice Message)
              </Label>
              <Textarea
                id="maint-message"
                rows={3}
                value={settings.message}
                onChange={(e) => setSettings((s) => ({ ...s, message: e.target.value }))}
                placeholder="อธิบายเหตุผล หรือแจ้งข้อมูลการอัปเกรดให้ผู้ใช้ทราบ..."
              />
            </div>

            {/* Estimated Completion Time */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="maint-time" className="text-xs font-semibold flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  เวลาที่คาดว่าจะแล้วเสร็จ (Estimated Completion Time)
                </Label>
                {settings.estimated_end_time && (
                  <button
                    type="button"
                    onClick={() => setSettings((s) => ({ ...s, estimated_end_time: '' }))}
                    className="text-[11px] text-muted-foreground hover:text-foreground underline"
                  >
                    ล้างเวลา
                  </button>
                )}
              </div>
              <Input
                id="maint-time"
                value={settings.estimated_end_time || ''}
                onChange={(e) => setSettings((s) => ({ ...s, estimated_end_time: e.target.value }))}
                placeholder="เช่น 14:30 น. หรือ วันนี้ เวลา 16:00 น."
              />

              {/* Quick Presets */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                <span className="text-[11px] text-muted-foreground mr-1">กำหนดด่วน:</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-[11px]"
                  onClick={() => handleSetPresetTime(30)}
                >
                  +30 นาที
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-[11px]"
                  onClick={() => handleSetPresetTime(60)}
                >
                  +1 ชั่วโมง
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-[11px]"
                  onClick={() => handleSetPresetTime(120)}
                >
                  +2 ชั่วโมง
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-[11px]"
                  onClick={() => setSettings((s) => ({ ...s, estimated_end_time: 'เร็วๆ นี้ (Soon)' }))}
                >
                  เร็วๆ นี้
                </Button>
              </div>
            </div>

            {/* Save Buttons */}
            <div className="pt-3 flex items-center justify-between border-t border-border">
              <div className="flex items-center gap-2">
                {saveStatus === 'success' && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-500/10 px-2.5 py-1 rounded-md">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    บันทึกการตั้งค่าเรียบร้อย
                  </span>
                )}
                {saveStatus === 'error' && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 bg-rose-500/10 px-2.5 py-1 rounded-md">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    บันทึกไม่สำเร็จ ลองอีกครั้ง
                  </span>
                )}
              </div>

              <Button
                onClick={() => handleSave()}
                disabled={saving}
                className="gap-2 font-medium"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    กำลังบันทึก...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    บันทึกการตั้งค่า
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Live Preview Card */}
      <Card className="border-dashed bg-muted/20">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-semibold">ตัวอย่างการแสดงผลฝั่งผู้ใช้ (Live Preview)</CardTitle>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant={previewTab === 'banner' ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setPreviewTab('banner')}
              >
                แบบแถบประกาศ (Banner)
              </Button>
              <Button
                variant={previewTab === 'lockdown' ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setPreviewTab('lockdown')}
              >
                แบบหน้าปิดปรับปรุง (Lockdown)
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {previewTab === 'banner' ? (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                ตัวอย่างแถบประกาศที่จะแสดงผลที่ส่วนบนของหน้าต่างแชต:
              </p>
              <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3.5 text-amber-900 dark:text-amber-200">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold">{settings.title || 'ระบบกำลังปิดปรับปรุงชั่วคราว'}</h4>
                      {settings.estimated_end_time && (
                        <span className="text-[11px] font-medium bg-amber-500/20 px-2 py-0.5 rounded-full">
                          คาดว่าจะเสร็จสิ้น: {settings.estimated_end_time}
                        </span>
                      )}
                    </div>
                    <p className="text-xs opacity-90 leading-relaxed">
                      {settings.message || 'ขออภัยในความไม่สะดวก ระบบกำลังดำเนินการปรับปรุงประสิทธิภาพ'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                ตัวอย่างหน้าจอที่ผู้ใช้ทั่วไปจะพบเมื่อเข้าห้องแชตระหว่างปิดปรับปรุงระบบเต็มรูปแบบ:
              </p>
              <div className="rounded-2xl border border-rose-500/30 bg-card p-8 text-center max-w-lg mx-auto shadow-sm space-y-4">
                <div className="mx-auto w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-600">
                  <Wrench className="h-8 w-8 animate-pulse" />
                </div>
                <div className="space-y-1.5">
                  <h3 className="text-lg font-bold">{settings.title || 'ระบบกำลังปิดปรับปรุงชั่วคราว'}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {settings.message || 'ขออภัยในความไม่สะดวก ระบบกำลังดำเนินการบำรุงรักษาและอัปเกรดเพื่อเพิ่มประสิทธิภาพ'}
                  </p>
                </div>
                {settings.estimated_end_time && (
                  <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted border text-xs font-medium text-muted-foreground">
                    <Clock className="h-3.5 w-3.5 text-primary" />
                    คาดว่าจะเปิดให้บริการเวลา: <span className="text-foreground font-semibold">{settings.estimated_end_time}</span>
                  </div>
                )}
                <div className="pt-2">
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs pointer-events-none">
                    <RefreshCw className="h-3.5 w-3.5" />
                    ลองใหม่อีกครั้ง (Refresh)
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
