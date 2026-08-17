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
// Scoped password: unlocks Fish Bingo admin only, not the rest of /admin/*.
export const BINGO_ADMIN_PASSWORD = import.meta.env.VITE_BINGO_ADMIN_PASSWORD || null
// Scoped password: unlocks Nationals admin only, not the rest of /admin/*.
export const NATIONALS_ADMIN_PASSWORD = import.meta.env.VITE_NATIONALS_ADMIN_PASSWORD || null
// Scoped password: unlocks the Catfish Cull's competition admin only. Comp
// admin is per-competition (/competitions/:id/admin), so this is checked
// against the catfish comp alone — it must not open other clubs' comps.
export const CATFISH_ADMIN_PASSWORD = import.meta.env.VITE_CATFISH_ADMIN_PASSWORD || null

export const isAdmin = () => {
  return sessionStorage.getItem('isAdmin') === 'true'
}

// Full sys admin also has Bingo access; the scoped password only grants this.
export const isBingoAdmin = () => {
  return isAdmin() || sessionStorage.getItem('isBingoAdmin') === 'true'
}

// Same deal for Nationals — full sys admin, or the scoped Nationals password.
export const isNationalsAdmin = () => {
  return isAdmin() || sessionStorage.getItem('isNationalsAdmin') === 'true'
}

export const setAdminSession = (password) => {
  if (password === ADMIN_PASSWORD) {
    sessionStorage.setItem('isAdmin', 'true')
    return true
  }
  if (BINGO_ADMIN_PASSWORD && password === BINGO_ADMIN_PASSWORD) {
    sessionStorage.setItem('isBingoAdmin', 'true')
    return true
  }
  if (NATIONALS_ADMIN_PASSWORD && password === NATIONALS_ADMIN_PASSWORD) {
    sessionStorage.setItem('isNationalsAdmin', 'true')
    return true
  }
  return false
}

export const clearAdminSession = () => {
  sessionStorage.removeItem('isAdmin')
  sessionStorage.removeItem('isBingoAdmin')
  sessionStorage.removeItem('isNationalsAdmin')
}
