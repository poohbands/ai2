import { NextResponse } from 'next/server'
import { getMenuFeatures } from '@/lib/settings/features'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const features = await getMenuFeatures()
    return NextResponse.json({ features })
  } catch (error) {
    console.error('Failed to get features:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
