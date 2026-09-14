import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/session'
import { getMenuFeatures, updateMenuFeatures } from '@/lib/settings/features'

export const runtime = 'nodejs'

export async function GET() {
  try {
    await requireAdmin()
    const features = await getMenuFeatures()
    return NextResponse.json({ features })
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
    await requireAdmin()
    const body = await request.json()
    const updates = body?.features || body || {}
    const features = await updateMenuFeatures(updates)
    return NextResponse.json({ success: true, features })
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
