import { NextResponse } from 'next/server'
import { getMaintenanceSettings } from '@/lib/settings/maintenance'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const maintenance = await getMaintenanceSettings()
    return NextResponse.json({ maintenance })
  } catch (error) {
    console.error('Failed to get maintenance settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
