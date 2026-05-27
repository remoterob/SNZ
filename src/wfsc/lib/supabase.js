import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_WFSC_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_WFSC_SUPABASE_ANON_KEY

export const wfscConfigured = Boolean(supabaseUrl && supabaseAnonKey)

if (!wfscConfigured) {
  console.error('Missing WFSC Supabase env vars. Add VITE_WFSC_SUPABASE_URL and VITE_WFSC_SUPABASE_ANON_KEY to .env')
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key'
)
