import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    // Return a mock client during build
    return {
      auth: {
        signUp: async () => ({ data: null, error: new Error('Supabase not configured') }),
        signInWithPassword: async () => ({ data: null, error: new Error('Supabase not configured') }),
        resetPasswordForEmail: async () => ({ data: null, error: new Error('Supabase not configured') }),
        updateUser: async () => ({ data: null, error: new Error('Supabase not configured') }),
        exchangeCodeForSession: async () => ({ data: null, error: new Error('Supabase not configured') }),
        signOut: async () => ({ error: new Error('Supabase not configured') }),
        getSession: async () => ({ data: { session: null } }),
        getUser: async () => ({ data: { user: null } }),
      },
    } as ReturnType<typeof createBrowserClient>
  }

  return createBrowserClient(url, key)
}