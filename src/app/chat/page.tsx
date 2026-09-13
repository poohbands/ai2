import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ChatClient } from './chat-client'

export const dynamic = 'force-dynamic'

export default async function ChatPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?callbackUrl=/chat')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile || !profile.is_active) {
    const reason = profile && !profile.is_approved
      ? 'Account pending admin approval'
      : 'Account disabled'
    redirect(`/login?error=${encodeURIComponent(reason)}`)
  }

  return <ChatClient userId={user.id} profile={profile} />
}