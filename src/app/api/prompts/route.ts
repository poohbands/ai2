import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { promptCreateSchema } from '@/lib/validation/schemas'

export const runtime = 'nodejs'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const service = createServiceClient()
  const { data } = await service.from('prompts').select('*').or(`user_id.eq.${user.id},is_public.eq.true`).order('created_at', { ascending: false }).limit(100)
  return NextResponse.json({ prompts: data })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json()
  const parsed = promptCreateSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  const service = createServiceClient()
  const { data, error } = await service.from('prompts').insert({
    user_id: user.id, title: parsed.data.title, content: parsed.data.content,
    category: parsed.data.category, is_public: parsed.data.isPublic,
  }).select().single()
  if (error) return NextResponse.json({ error: 'Create failed' }, { status: 500 })
  return NextResponse.json({ prompt: data })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const service = createServiceClient()
  await service.from('prompts').delete().eq('id', id).eq('user_id', user.id)
  return NextResponse.json({ success: true })
}
