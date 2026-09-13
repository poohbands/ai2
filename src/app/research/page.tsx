import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ResearchClient } from './research-client'

export const dynamic = 'force-dynamic'

export default async function ResearchPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?callbackUrl=/research')
  return <ResearchClient />
}
