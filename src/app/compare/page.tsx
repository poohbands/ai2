import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { CompareClient } from './compare-client'

export default async function ComparePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?callbackUrl=/compare')
  return <CompareClient />
}
