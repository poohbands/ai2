'use client'

import React, { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn, formatCost, formatRelativeTime } from '@/lib/utils'
import {
  User,
  Mail,
  DollarSign,
  Activity,
  TrendingUp,
  Clock,
  Cpu,
  Layers,
  MessageSquare,
  Shield,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Search,
  Check,
  Globe,
  Microscope,
  BookOpen,
  Columns2,
  Image as ImageIcon,
  Zap,
} from 'lucide-react'
import { UserDetailData, UsageLog } from '@/types'

interface UserDetailModalProps {
  userId: string | null
  isOpen: boolean
  onClose: () => void
  onUserUpdated?: () => void
}

export function UserDetailModal({
  userId,
  isOpen,
  onClose,
  onUserUpdated,
}: UserDetailModalProps) {
  const [data, setData] = useState<UserDetailData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('overview')

  // Edit states
  const [budgetInput, setBudgetInput] = useState<string>('')
  const [savingAction, setSavingAction] = useState<string | null>(null)

  // Log filter
  const [logTypeFilter, setLogTypeFilter] = useState<string>('all')

  const fetchDetails = async (id: string) => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetch(`/api/admin/users/${id}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Error ${res.status}`)
      }
      const json = await res.json()
      if (json.data) {
        setData(json.data)
        setBudgetInput(String(json.data.user.monthly_budget || 0))
      }
    } catch (e) {
      console.error('Failed to fetch user details:', e)
      setError(e instanceof Error ? e.message : 'Failed to load user details')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen && userId) {
      fetchDetails(userId)
    } else {
      setData(null)
      setError(null)
    }
  }, [isOpen, userId])

  const handleUpdate = async (updates: Record<string, unknown>, actionKey: string) => {
    if (!userId) return
    try {
      setSavingAction(actionKey)
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!res.ok) throw new Error('Failed to update user')
      await fetchDetails(userId)
      if (onUserUpdated) onUserUpdated()
    } catch (e) {
      console.error('Error updating user:', e)
    } finally {
      setSavingAction(null)
    }
  }

  const handleSaveBudget = () => {
    const num = Number(budgetInput)
    if (!isNaN(num) && num >= 0) {
      handleUpdate({ monthly_budget: num }, 'budget')
    }
  }

  const getRequestTypeBadge = (type: string) => {
    switch (type) {
      case 'chat':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 font-medium">
            <MessageSquare className="h-3 w-3" /> Chat
          </span>
        )
      case 'search':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-medium">
            <Globe className="h-3 w-3" /> Search
          </span>
        )
      case 'research':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 font-medium">
            <Microscope className="h-3 w-3" /> Research
          </span>
        )
      case 'kb':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 font-medium">
            <BookOpen className="h-3 w-3" /> KB
          </span>
        )
      case 'compare':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 font-medium">
            <Columns2 className="h-3 w-3" /> Compare
          </span>
        )
      case 'image':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-pink-500/10 text-pink-600 font-medium">
            <ImageIcon className="h-3 w-3" /> Image
          </span>
        )
      case 'vision':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 font-medium">
            <Zap className="h-3 w-3" /> Vision
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
            {type}
          </span>
        )
    }
  }

  const filteredLogs = data?.recentLogs.filter((log) => {
    if (logTypeFilter === 'all') return true
    return log.request_type === logTypeFilter
  }) || []

  const budgetPercentage = data?.user.monthly_budget
    ? Math.min(100, Math.round((data.summary.currentMonthCost / data.user.monthly_budget) * 100))
    : 0

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden sm:rounded-2xl gap-0">
        {/* Modal Header */}
        <div className="p-6 border-b border-border bg-card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-lg shrink-0">
                {data?.user.display_name
                  ? data.user.display_name.slice(0, 2).toUpperCase()
                  : data?.user.email.slice(0, 2).toUpperCase() || 'U'}
              </div>
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <DialogTitle className="text-xl font-bold">
                    {data?.user.display_name || data?.user.email || 'User Details'}
                  </DialogTitle>
                  {data?.user.role === 'admin' ? (
                    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
                      <Shield className="h-3 w-3" /> Admin
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                      User
                    </span>
                  )}
                  {data?.user.is_active ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 font-medium">
                      เปิดใช้งาน
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 font-medium">
                      ปิดการใช้งาน
                    </span>
                  )}
                  {!data?.user.is_approved && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 font-medium">
                      รออนุมัติ
                    </span>
                  )}
                </div>
                <DialogDescription className="text-xs flex items-center gap-1.5 text-muted-foreground">
                  <Mail className="h-3.5 w-3.5" />
                  {data?.user.email}
                  {data?.user.last_active && (
                    <>
                      <span>•</span>
                      <Clock className="h-3.5 w-3.5" />
                      ใช้งานล่าสุด: {formatRelativeTime(data.user.last_active)}
                    </>
                  )}
                </DialogDescription>
              </div>
            </div>

            {/* Quick Actions in Header */}
            {data && (
              <div className="flex items-center gap-2">
                {!data.user.is_approved && (
                  <Button
                    size="sm"
                    className="h-8 text-xs font-medium gap-1"
                    disabled={savingAction === 'approve'}
                    onClick={() => handleUpdate({ is_approved: true }, 'approve')}
                  >
                    {savingAction === 'approve' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                    อนุมัติบัญชี
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  title="รีเฟรชข้อมูล"
                  disabled={loading}
                  onClick={() => userId && fetchDetails(userId)}
                >
                  <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Content Body */}
        {loading && !data ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="p-8 text-center space-y-3">
            <AlertCircle className="h-8 w-8 text-destructive mx-auto" />
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={() => userId && fetchDetails(userId)}>
              ลองใหม่อีกครั้ง
            </Button>
          </div>
        ) : data ? (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Card className="bg-muted/30">
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>ค่าใช้จ่ายเดือนนี้</span>
                    <DollarSign className="h-4 w-4 text-primary" />
                  </div>
                  <div className="text-xl font-bold font-mono">
                    {formatCost(data.summary.currentMonthCost)}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    จากงบ {formatCost(data.user.monthly_budget)}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-muted/30">
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>ยอดใช้จ่ายสะสม</span>
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div className="text-xl font-bold font-mono">
                    {formatCost(data.summary.allTimeCost)}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    ทั้งหมดตั้งแต่สมัคร
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-muted/30">
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Requests ทั้งหมด</span>
                    <Activity className="h-4 w-4 text-blue-500" />
                  </div>
                  <div className="text-xl font-bold font-mono">
                    {data.summary.allTimeRequests.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    เดือนนี้ {data.summary.currentMonthRequests} ครั้ง
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-muted/30">
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Tokens ทั้งหมด</span>
                    <Cpu className="h-4 w-4 text-purple-500" />
                  </div>
                  <div className="text-xl font-bold font-mono">
                    {(data.summary.allTimeInputTokens + data.summary.allTimeOutputTokens).toLocaleString()}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    In: {data.summary.allTimeInputTokens.toLocaleString()} | Out: {data.summary.allTimeOutputTokens.toLocaleString()}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Budget & Quota Bar */}
            <Card className="border">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5 text-primary" />
                    อัตราการใช้งบประมาณเดือนนี้ (Monthly Budget Usage)
                  </span>
                  <span className="font-mono font-medium">
                    {formatCost(data.summary.currentMonthCost)} / {formatCost(data.user.monthly_budget)} ({budgetPercentage}%)
                  </span>
                </div>
                <Progress
                  value={budgetPercentage}
                  className={cn(
                    'h-2',
                    budgetPercentage >= 90
                      ? '[&>div]:bg-rose-500'
                      : budgetPercentage >= 70
                      ? '[&>div]:bg-amber-500'
                      : '[&>div]:bg-primary'
                  )}
                />
              </CardContent>
            </Card>

            {/* Tabs for Details */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="overview" className="text-xs">
                  <Activity className="h-3.5 w-3.5 mr-1.5" /> ภาพรวม & โมเดล
                </TabsTrigger>
                <TabsTrigger value="logs" className="text-xs">
                  <Clock className="h-3.5 w-3.5 mr-1.5" /> ประวัติ Logs ({data.recentLogs.length})
                </TabsTrigger>
                <TabsTrigger value="conversations" className="text-xs">
                  <MessageSquare className="h-3.5 w-3.5 mr-1.5" /> แชต ({data.conversations.length})
                </TabsTrigger>
                <TabsTrigger value="settings" className="text-xs">
                  <Shield className="h-3.5 w-3.5 mr-1.5" /> การจัดการสิทธิ์
                </TabsTrigger>
              </TabsList>

              {/* Tab 1: Overview & Model Breakdown */}
              <TabsContent value="overview" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  {/* Model Usage Breakdown */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Cpu className="h-4 w-4 text-primary" />
                        โมเดลที่ใช้งานมากที่สุด (Model Breakdown)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {data.modelBreakdown.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-4 text-center">
                          ยังไม่มีประวัติการเรียกใช้งานโมเดล
                        </p>
                      ) : (
                        <div className="space-y-2.5">
                          {data.modelBreakdown.map((m) => {
                            const pct = data.summary.allTimeCost > 0
                              ? Math.round((m.totalCost / data.summary.allTimeCost) * 100)
                              : 0
                            return (
                              <div key={m.model} className="p-2.5 rounded-xl border bg-muted/20 space-y-1.5">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-semibold truncate max-w-[200px]" title={m.model}>
                                    {m.modelName}
                                  </span>
                                  <span className="font-mono font-medium text-emerald-600">
                                    {formatCost(m.totalCost)} ({pct}%)
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                  <span>{m.requestCount} requests</span>
                                  <span>{(m.inputTokens + m.outputTokens).toLocaleString()} tokens</span>
                                </div>
                                <Progress value={pct} className="h-1" />
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Request Type Breakdown */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Layers className="h-4 w-4 text-primary" />
                        ประเภทการเรียกใช้งาน (Feature Usage)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {data.typeBreakdown.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-4 text-center">
                          ยังไม่มีการเรียกใช้งานฟีเจอร์
                        </p>
                      ) : (
                        <div className="space-y-2.5">
                          {data.typeBreakdown.map((t) => (
                            <div key={t.requestType} className="flex items-center justify-between p-2.5 rounded-xl border bg-muted/20">
                              <div className="flex items-center gap-2">
                                {getRequestTypeBadge(t.requestType)}
                                <span className="text-xs font-medium">{t.count} ครั้ง</span>
                              </div>
                              <span className="font-mono text-xs font-semibold text-emerald-600">
                                {formatCost(t.totalCost)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              {/* Tab 2: Recent Logs Table */}
              <TabsContent value="logs" className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 overflow-x-auto">
                    {['all', 'chat', 'search', 'research', 'kb', 'compare', 'image'].map((t) => (
                      <Button
                        key={t}
                        variant={logTypeFilter === t ? 'default' : 'outline'}
                        size="sm"
                        className="h-7 text-xs capitalize"
                        onClick={() => setLogTypeFilter(t)}
                      >
                        {t === 'all' ? 'ทั้งหมด' : t}
                      </Button>
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    แสดง {filteredLogs.length} รายการ
                  </span>
                </div>

                <div className="rounded-xl border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="text-xs">เวลา</TableHead>
                        <TableHead className="text-xs">ประเภท</TableHead>
                        <TableHead className="text-xs">โมเดล</TableHead>
                        <TableHead className="text-xs text-right">In Tokens</TableHead>
                        <TableHead className="text-xs text-right">Out Tokens</TableHead>
                        <TableHead className="text-xs text-right">ค่าใช้จ่าย</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLogs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-6 text-xs text-muted-foreground">
                            ไม่พบประวัติการใช้งานตามเงื่อนไข
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredLogs.map((log) => (
                          <TableRow key={log.id} className="text-xs">
                            <TableCell className="font-mono text-muted-foreground whitespace-nowrap">
                              {new Date(log.created_at).toLocaleString('th-TH', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                              })}
                            </TableCell>
                            <TableCell>{getRequestTypeBadge(log.request_type)}</TableCell>
                            <TableCell className="font-medium max-w-[140px] truncate" title={log.model}>
                              {log.model}
                            </TableCell>
                            <TableCell className="text-right font-mono text-muted-foreground">
                              {Number(log.input_tokens || 0).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right font-mono text-muted-foreground">
                              {Number(log.output_tokens || 0).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right font-mono font-medium text-emerald-600">
                              {formatCost(Number(log.estimated_cost || 0))}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </TabsContent>

              {/* Tab 3: Conversations */}
              <TabsContent value="conversations" className="space-y-3">
                {data.conversations.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-8 text-center">
                    ผู้ใช้รายนี้ยังไม่มีบทสนทนาที่บันทึกไว้
                  </p>
                ) : (
                  <div className="space-y-2">
                    {data.conversations.map((c) => (
                      <div key={c.id} className="flex items-center justify-between p-3 rounded-xl border bg-muted/20 hover:bg-muted/40 transition-colors">
                        <div className="space-y-1 overflow-hidden pr-3">
                          <p className="text-sm font-semibold truncate">{c.title || 'ไม่มีชื่อหัวข้อ'}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-medium">{c.model}</span>
                            <span>•</span>
                            <span>{c.messageCount} ข้อความ</span>
                            <span>•</span>
                            <span>อัปเดต {formatRelativeTime(c.updatedAt)}</span>
                          </div>
                        </div>
                        <span className="text-[11px] font-mono text-muted-foreground shrink-0 bg-muted px-2 py-0.5 rounded">
                          {new Date(c.createdAt).toLocaleDateString('th-TH')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Tab 4: User Account Management */}
              <TabsContent value="settings" className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold">การตั้งค่าสิทธิ์และงบประมาณ</CardTitle>
                    <CardDescription>
                      ปรับเปลี่ยนสิทธิ์ บทบาท และโควตารายเดือนของผู้ใช้รายนี้
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Active Switch */}
                    <div className="flex items-center justify-between p-3 rounded-xl border bg-muted/20">
                      <div>
                        <p className="text-sm font-semibold">สถานะเปิดใช้งาน (Active Account)</p>
                        <p className="text-xs text-muted-foreground">เมื่อปิด บัญชีจะไม่สามารถล็อกอินหรือส่งข้อความได้</p>
                      </div>
                      <Switch
                        checked={data.user.is_active}
                        disabled={savingAction === 'toggle-active'}
                        onCheckedChange={(checked) => handleUpdate({ is_active: checked }, 'toggle-active')}
                      />
                    </div>

                    {/* Role Select */}
                    <div className="flex items-center justify-between p-3 rounded-xl border bg-muted/20">
                      <div>
                        <p className="text-sm font-semibold">บทบาทผู้ใช้งาน (User Role)</p>
                        <p className="text-xs text-muted-foreground">Admin สามารถเข้าถึง Dashboard และจัดการระบบได้</p>
                      </div>
                      <Select
                        value={data.user.role}
                        disabled={savingAction === 'role'}
                        onValueChange={(val) => handleUpdate({ role: val }, 'role')}
                      >
                        <SelectTrigger className="w-[120px] text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Monthly Budget Input */}
                    <div className="flex items-center justify-between p-3 rounded-xl border bg-muted/20">
                      <div>
                        <p className="text-sm font-semibold">งบประมาณต่อเดือน (Monthly Budget)</p>
                        <p className="text-xs text-muted-foreground">จำกัดเพดานค่าใช้จ่ายต่อเดือน (หน่วย USD \$)</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="0"
                          max="10000"
                          step="0.1"
                          value={budgetInput}
                          onChange={(e) => setBudgetInput(e.target.value)}
                          className="w-24 text-right text-xs"
                        />
                        <Button
                          size="sm"
                          className="h-9 text-xs"
                          disabled={savingAction === 'budget'}
                          onClick={handleSaveBudget}
                        >
                          {savingAction === 'budget' ? <Loader2 className="h-3 w-3 animate-spin" /> : 'บันทึก'}
                        </Button>
                      </div>
                    </div>

                    {/* Approval Information */}
                    <div className="p-3 rounded-xl border bg-muted/10 text-xs text-muted-foreground space-y-1">
                      <p><strong>User ID:</strong> <span className="font-mono">{data.user.id}</span></p>
                      <p><strong>สมัครสมาชิกเมื่อ:</strong> {new Date(data.user.createdAt).toLocaleString('th-TH')}</p>
                      {data.user.approvedAt && (
                        <p><strong>อนุมัติเมื่อ:</strong> {new Date(data.user.approvedAt).toLocaleString('th-TH')}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
