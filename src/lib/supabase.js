import { createClient } from '@supabase/supabase-js'

export const hasConfig = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || 'http://localhost',
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'missing',
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
)