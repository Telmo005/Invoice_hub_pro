import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

let client: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient {
  if (typeof window === 'undefined') {
    throw new Error('Supabase client can only be used in browser environment')
  }
  
  // Reuse global instance when available to avoid multiple GoTrueClient warnings
  if ((window as any).__supabase_client) {
    client = (window as any).__supabase_client as SupabaseClient
  } else if (!client) {
    client = createBrowserClient(SUPABASE_URL, SUPABASE_KEY) as SupabaseClient
    ;(window as any).__supabase_client = client
  }
  
  return client
}

export default getSupabaseClient