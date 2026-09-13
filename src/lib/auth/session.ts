import { createClient } from '@/lib/supabase/server'
import { Profile } from '@/types'

export async function getSession() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return session
}

export async function getUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return profile
}

export async function requireAuth() {
  const user = await getUser()
  if (!user) {
    throw new Error('Unauthorized')
  }
  return user
}

export async function requireProfile() {
  const profile = await getProfile()
  if (!profile) {
    throw new Error('Profile not found')
  }
  if (!profile.is_active) {
    throw new Error('Account disabled')
  }
  return profile
}

export async function requireAdmin() {
  const profile = await requireProfile()
  if (profile.role !== 'admin') {
    throw new Error('Forbidden: Admin access required')
  }
  return profile
}