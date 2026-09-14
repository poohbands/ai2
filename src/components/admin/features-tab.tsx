'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import {
  Globe,
  Microscope,
  BookOpen,
  Columns2,
  ImageIcon,
  ScrollText,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Eye,
  SlidersHorizontal,
  RefreshCw,
} from 'lucide-react'
import { MenuFeatures, DEFAULT_MENU_FEATURES } from '@/types'

interface FeatureConfig {
  key: keyof MenuFeatures
  name: string
  shortLabel: string
  description: string
  icon: React.ComponentType<{ className?: string }>
}

const FEATURE_CONFIGS: FeatureConfig[] = [
  {
    key: 'web',
    name: 'ค้นหาเว็บ (Web Search)',
    shortLabel: 'Web',
    description: 'เปิดให้ผู้ใช้สามารถกดค้นหาข้อมูลล่าสุดจากอินเทอร์เน็ตเพื่อนำมาอ้างอิงตอบคำถาม',
    icon: Globe,
  },
  {
    key: 'research',
    name: 'ค้นคว้าเชิงลึก (Deep Research)',
    shortLabel: 'Research',
    description: 'โหมดรายงานค้นคว้าวิเคราะห์ข้อมูลเชิงลึกแบบหลายรอบ พร้อมอ้างอิงแหล่งที่มา',
    icon: Microscope,
  },
  {
    key: 'kb',
    name: 'คลังความรู้ (Knowledge Base / RAG)',
    shortLabel: 'KB',
    description: 'เปิดให้เลือกดึงความรู้จากเอกสารและไฟล์ที่อัปโหลดไว้ในคลังความรู้มาตอบคำถาม',
    icon: BookOpen,
  },
  {
    key: 'compare',
    name: 'เปรียบเทียบโมเดล (Model Compare)',
    shortLabel: 'Compare',
    description: 'เปิดให้เทียบคำตอบของ 2 โมเดลพร้อมกันแบบ side-by-side ในหน้าแชต',
    icon: Columns2,
  },
  {
    key: 'image',
    name: 'สร้างรูปภาพ (Image Generation)',
    shortLabel: 'Image',
    description: 'เปิดให้สามารถสั่งสร้างภาพ AI ตามคำอธิบายข้อความในหน้าแชตได้โดยตรง',
    icon: ImageIcon,
  },
  {
    key: 'prompts',
    name: 'พร้อมท์เสริม (Prompt Library)',
    shortLabel: 'Prompts',
    description: 'เมนูดรอปดาวน์สำหรับเลือก System Prompt สำเร็จรูปมาใช้ในการสนทนา',
    icon: ScrollText,
  },
]

export function FeaturesTab() {
  const [features, setFeatures] = useState<MenuFeatures>({ ...DEFAULT_MENU_FEATURES })
  const [loading, setLoading] = useState(true)
  const [updatingKey, setUpdatingKey] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')

  const loadFeatures = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/features')
      if (res.ok) {
        const data = await res.json()
        if (data.features) {
          setFeatures(data.features)
        }
      }
    } catch (e) {
      console.error('Failed to load features:', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFeatures()
  }, [])

  const handleToggle = async (key: keyof MenuFeatures, nextValue: boolean) => {
    setUpdatingKey(key)
    setSaveStatus('idle')

    const updated = { ...features, [key]: nextValue }
    setFeatures(updated)

    try {
      const res = await fetch('/api/admin/features', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ features: { [key]: nextValue } }),
      })

      if (!res.ok) {
        throw new Error('Failed to update')
      }
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2500)
    } catch (e) {
      console.error('Failed to update feature:', e)
      // Rollback on error
      setFeatures(features)
      setSaveStatus('error')
      setTimeout(() => setSaveStatus('idle'), 3500)
    } finally {
      setUpdatingKey(null)
    }
  }

  const handleToggleAll = async (enabled: boolean) => {
    setUpdatingKey('all')
    const next: MenuFeatures = {
      web: enabled,
      research: enabled,
      kb: enabled,
      compare: enabled,
      image: enabled,
      prompts: enabled,
    }
    setFeatures(next)

    try {
      const res = await fetch('/api/admin/features', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ features: next }),
      })
      if (!res.ok) throw new Error('Failed to update all')
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2500)
    } catch {
      setSaveStatus('error')
    } finally {
      setUpdatingKey(null)
    }
  }

  if (loading) {
    return (
      <div className= flex items-center justify-center py-16 text-muted-foreground>
        <Loader2 className=h-6 w-6 animate-spin mr-2 />
        <span>กำลังโหลดการตั้งค่าเมนู...</span>
      </div>
    )
  }

  return (
    <div className=space-y-6>
      {/* Header Description & Save Status */}
      <div className=flex flex-col sm:flex-row sm:items-center justify-between gap-4>
        <div>
          <h2 className=text-xl font-semibold flex items-center gap-2>
            <SlidersHorizontal className=h-5 w-5 text-primary />
            เปิด-ปิดเมนูปุ่มลัดบนแถบแชต
          </h2>
          <p className=text-sm text-muted-foreground mt-0.5>
            เลือกเปิดหรือปิดการแสดงผลของเมนูฟังก์ชันต่างๆ บนแถบด้านบนของห้องแชต (มีผลกับผู้ใช้งานทุกคนทันที)
          </p>
        </div>

        <div className=flex items-center gap-2>
          {saveStatus === 'saved' && (
            <span className=inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 bg-emerald-500/10 px-2.5 py-1 rounded-md>
              <CheckCircle2 className=h-3.5 w-3.5 />
              บันทึกเรียบร้อย
            </span>
          )}
          {saveStatus === 'error' && (
            <span className=inline-flex items-center gap-1.5 text-xs font-medium text-rose-600 bg-rose-500/10 px-2.5 py-1 rounded-md>
              <AlertCircle className=h-3.5 w-3.5 />
              บันทึกไม่สำเร็จ ลองอีกครั้ง
            </span>
          )}
          <Button variant=outline size=sm onClick={() => handleToggleAll(true)} disabled={updatingKey !== null}>
            เปิดทั้งหมด
          </Button>
          <Button variant=outline size=sm onClick={() => handleToggleAll(false)} disabled={updatingKey !== null}>
            ปิดทั้งหมด
          </Button>
        </div>
      </div>

      {/* Live Preview */}
      <Card className=border-dashed bg-muted/20>
        <CardHeader className=pb-2>
          <div className=flex items-center justify-between>
            <CardTitle className=text-sm font-medium flex items-center gap-2 text-muted-foreground>
              <Eye className=h-4 w-4 />
              ตัวอย่างการแสดงผลบนแถบด้านบนห้องแชต (Live Preview)
            </CardTitle>
            <span className=text-xs text-muted-foreground>
              เปิดอยู่ {Object.values(features).filter(Boolean).length} จาก {FEATURE_CONFIGS.length} เมนู
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className=p-3 bg-card border rounded-xl flex flex-wrap items-center gap-1.5 min-h-[52px]>
            <div className=h-8 px-3 rounded-md bg-muted/60 border text-xs text-muted-foreground flex items-center>
              เลือกโมเดล AI
            </div>

            {FEATURE_CONFIGS.map((item) => {
              const isEnabled = features[item.key]
              const Icon = item.icon
              if (!isEnabled) return null
              return (
                <Button key={item.key} variant=outline size=sm className=h-8 text-xs pointer-events-none>
                  <Icon className=h-3.5 w-3.5 mr-1 />
                  {item.shortLabel}
                </Button>
              )
            })}

            {Object.values(features).every((v) => !v) && (
              <span className=text-xs text-muted-foreground italic px-2>
                (เมนูปุ่มลัดถูกปิดใช้งานทั้งหมด จะแสดงเฉพาะแถบเลือกโมเดล)
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Toggle Cards List */}
      <div className=grid gap-3 sm:grid-cols-2>
        {FEATURE_CONFIGS.map((item) => {
          const isEnabled = features[item.key]
          const isUpdating = updatingKey === item.key || updatingKey === 'all'
          const Icon = item.icon

          return (
            <Card
              key={item.key}
              className={	ransition-colors border }
            >
              <CardContent className=p-4>
                <div className=flex items-start justify-between gap-3>
                  <div className=flex items-start gap-3>
                    <div
                      className={p-2.5 rounded-xl border transition-colors }
                    >
                      <Icon className=h-5 w-5 />
                    </div>

                    <div className=space-y-1>
                      <div className=flex items-center gap-2>
                        <span className=font-semibold text-sm>{item.name}</span>
                        <span
                          className={	ext-[11px] px-2 py-0.5 rounded-full font-medium }
                        >
                          {isEnabled ? 'เปิดใช้งาน' : 'ปิดอยู่'}
                        </span>
                      </div>
                      <p className=text-xs text-muted-foreground leading-relaxed>{item.description}</p>
                    </div>
                  </div>

                  <div className=flex items-center pt-1>
                    {isUpdating ? (
                      <Loader2 className=h-4 w-4 animate-spin text-primary />
                    ) : (
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={(checked) => handleToggle(item.key, checked)}
                        title={เปิด/ปิด }
                      />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
