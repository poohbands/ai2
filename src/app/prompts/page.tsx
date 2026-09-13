import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PromptsClient } from './prompts-client'

export const dynamic = 'force-dynamic'

export default async function PromptsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?callbackUrl=/prompts')
  return <PromptsClient />
}
