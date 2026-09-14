import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/session'
import { getMaintenanceSettings, updateMaintenanceSettings } from '@/lib/settings/maintenance'

export const runtime = 'nodejs'

export async function GET() {
  try {
    await requireAdmin()
    const settings = await getMaintenanceSettings()
    return NextResponse.json({ settings })
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (err instanceof Error && (err.message === 'Unauthorized' || err.message === 'Profile not found')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireAdmin()
    const body = await request.json()
    const updates = body?.settings || body || {}
    const settings = await updateMaintenanceSettings(updates, admin.email)
    return NextResponse.json({ success: true, settings })
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Forbidden')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    if (err instanceof Error && (err.message === 'Unauthorized' || err.message === 'Profile not found')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
