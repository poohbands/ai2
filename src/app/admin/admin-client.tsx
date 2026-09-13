'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Loader2, Users, Activity, DollarSign, TrendingUp, KeyRound, Boxes, UserCheck, UserX, Shield, ChevronDown, ChevronUp, ChevronLeft } from 'lucide-react'
import { cn, formatCost, formatRelativeTime } from '@/lib/utils'
import { AdminStats, AdminUser } from '@/types'
import { ProvidersTab } from '@/components/admin/providers-tab'
import { ModelsTab } from '@/components/admin/models-tab'

type AdminTab = 'users' | 'models' | 'providers'

export function AdminClient() {
  const router = useRouter()
  const supabase = createClient()

  const [tab, setTab] = useState<AdminTab>('users')
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState<AdminUser | null>(null)

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/admin/stats')
      const data = await response.json()
      setStats(data)
    } catch (error) {
      console.error('Failed to fetch stats:', error)
    }
  }

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/admin/users')
      const data = await response.json()
      setUsers(data.users || [])
    } catch (error) {
      console.error('Failed to fetch users:', error)
    }
  }

  useEffect(() => {
    fetchStats()
    fetchUsers()
    setLoading(false)
  }, [])

  const handleUpdateUser = async (userId: string, updates: Partial<AdminUser>) => {
    setActionLoading(userId)
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (!response.ok) throw new Error('Failed to update user')
      await fetchUsers()
    } catch (error) {
      console.error('Failed to update user:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const handleToggleActive = (user: AdminUser) => {
    handleUpdateUser(user.id, { is_active: !user.is_active })
  }

  const handleRoleChange = (user: AdminUser, role: 'admin' | 'user') => {
    handleUpdateUser(user.id, { role })
  }

  const handleBudgetChange = (user: AdminUser, budget: number) => {
    handleUpdateUser(user.id, { monthly_budget: budget })
  }

  const confirmDelete = (user: AdminUser) => {
    setUserToDelete(user)
    setDeleteDialogOpen(true)
  }

  const handleDelete = async () => {
    if (!userToDelete) return
    setActionLoading(userToDelete.id)
    try {
      const response = await fetch(`/api/admin/users/${userToDelete.id}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Failed to delete user')
      await fetchUsers()
      await fetchStats()
    } catch (error) {
      console.error('Failed to delete user:', error)
    } finally {
      setActionLoading(null)
      setDeleteDialogOpen(false)
      setUserToDelete(null)
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background">
      <aside className="hidden lg:flex lg:w-64 flex-col border-r border-border bg-card">
        <div className="p-4 border-b border-border">
          <h2 className="font-semibold text-lg">Admin</h2>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <Button variant="ghost" className="w-full justify-start gap-2" onClick={() => router.push('/chat')}>
            <Activity className="h-4 w-4" />
            Chat
          </Button>
          <Button variant={tab === 'users' ? 'default' : 'ghost'} className="w-full justify-start gap-2" onClick={() => setTab('users')}>
            <Users className="h-4 w-4" />
            Users
          </Button>
          <Button variant={tab === 'models' ? 'default' : 'ghost'} className="w-full justify-start gap-2" onClick={() => setTab('models')}>
            <Boxes className="h-4 w-4" />
            Models
          </Button>
          <Button variant={tab === 'providers' ? 'default' : 'ghost'} className="w-full justify-start gap-2" onClick={() => setTab('providers')}>
            <KeyRound className="h-4 w-4" />
            Providers
          </Button>
        </nav>
        <div className="p-4 border-t border-border">
          <Button variant="ghost" className="w-full justify-start gap-2" onClick={() => router.push('/chat')}>
            <ChevronLeft className="h-4 w-4" />
            Back to Chat
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-muted-foreground">
              {tab === 'users' && 'Manage users and monitor usage'}
              {tab === 'models' && 'Enable models and assign provider keys'}
              {tab === 'providers' && 'Manage AI provider API keys'}
            </p>
          </div>

          {tab === 'users' && (
          <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.totalUsers || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                <UserCheck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.activeUsers || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Requests Today</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.requestsToday || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Requests This Month</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats?.requestsThisMonth || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Est. Cost This Month</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCost(stats?.estimatedCostThisMonth || 0)}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>
                Users
                {users.some((u) => !u.is_approved) && (
                  <span className="ml-2 text-sm font-normal text-amber-600">
                    ({users.filter((u) => !u.is_approved).length} รออนุมัติ)
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Budget</TableHead>
                      <TableHead className="text-right">Usage</TableHead>
                      <TableHead className="text-right">Requests</TableHead>
                      <TableHead>Last Active</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">
                              {user.display_name || user.email}
                              {!user.is_approved && (
                                <span className="ml-2 inline-block rounded-full bg-amber-100 text-amber-800 text-xs px-2 py-0.5">
                                  รออนุมัติ
                                </span>
                              )}
                            </p>
                            <p className="text-sm text-muted-foreground">{user.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={user.role}
                            onValueChange={(value) => handleRoleChange(user, value as 'admin' | 'user')}
                            disabled={actionLoading === user.id}
                          >
                            <SelectTrigger className="w-[120px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="user">User</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={user.is_active}
                            onCheckedChange={() => handleToggleActive(user)}
                            disabled={actionLoading === user.id}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Input
                            type="number"
                            min="0"
                            max="10000"
                            step="0.01"
                            value={user.monthly_budget}
                            onChange={(e) => handleBudgetChange(user, Number(e.target.value))}
                            disabled={actionLoading === user.id}
                            className="w-[100px] text-right"
                          />
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCost(user.current_usage)}
                        </TableCell>
                        <TableCell className="text-right">
                          {user.request_count}
                        </TableCell>
                        <TableCell>
                          {user.last_active ? formatRelativeTime(user.last_active) : 'Never'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {!user.is_approved && (
                              <Button
                                size="sm"
                                onClick={() => handleUpdateUser(user.id, { is_approved: true } as Partial<AdminUser>)}
                                disabled={actionLoading === user.id}
                              >
                                อนุมัติ
                              </Button>
                            )}
                            <AlertDialog open={deleteDialogOpen && userToDelete?.id === user.id} onOpenChange={setDeleteDialogOpen}>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10" disabled={actionLoading === user.id}>
                                  <UserX className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete User</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete {user.display_name || user.email}? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
          </>
          )}

          {tab === 'models' && <ModelsTab />}
          {tab === 'providers' && <ProvidersTab />}
        </div>
      </main>
    </div>
  )
}