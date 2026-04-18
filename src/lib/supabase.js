import { createClient } from '@supabase/supabase-js'

// These will come from environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
})

// Admin password check (simple version - in production use Supabase Auth)
export const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || 'admin123'

export const isAdmin = () => {
  return sessionStorage.getItem('isAdmin') === 'true'
}

export const setAdminSession = (password) => {
  if (password === ADMIN_PASSWORD) {
    sessionStorage.setItem('isAdmin', 'true')
    return true
  }
  return false
}

export const clearAdminSession = () => {
  sessionStorage.removeItem('isAdmin')
}
