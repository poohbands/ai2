import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ImagesClient } from './images-client'

export const dynamic = 'force-dynamic'

export default async function ImagesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?callbackUrl=/images')
  return <ImagesClient />
}
