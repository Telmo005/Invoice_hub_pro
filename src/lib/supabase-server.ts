// lib/supabase-server.ts
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export const supabaseServer = async () => {
  const cookieStore = await cookies()
  
  return createServerComponentClient({ 
    cookies: () => cookieStore,
    options: {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    }
  })
}