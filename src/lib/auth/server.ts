// src/lib/auth/server.ts - NOVO
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function getServerUser() {
  try {
    const cookieStore = cookies()
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error) throw error
    return { user, error: null }
  } catch (error) {
    return { user: null, error }
  }
}