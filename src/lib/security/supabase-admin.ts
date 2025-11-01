// lib/supabase-admin.ts
import { createClient } from '@supabase/supabase-js';

// Verifique apenas no lado do servidor
if (typeof window === 'undefined') {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is required');
  }
  
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY is missing - audit logs will be disabled');
  }
}

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);