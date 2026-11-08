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

// ── Admin session ────────────────────────────────────────────────────────────
// Admin passwords are checked server-side only (netlify/functions/admin-login.js)
// and never shipped in this bundle. A successful login returns a signed,
// 12-hour token listing the scopes that password unlocks; it is kept in
// sessionStorage and sent to admin functions as `adminToken`.
//
// Scopes: admin (full), bingo, nationals, catfish, mudgeway, wfsc.
// 'admin' implies every other scope except wfsc.
const TOKEN_KEY = 'snz_admin_token'

function readToken(key = TOKEN_KEY) {
  try {
    const token = sessionStorage.getItem(key)
    if (!token) return null
    const payload = JSON.parse(atob(token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/')))
    if (!Array.isArray(payload.s) || payload.exp < Date.now()) {
      sessionStorage.removeItem(key)
      return null
    }
    return { token, scopes: payload.s }
  } catch {
    return null
  }
}

// The current admin token, or null if not logged in / expired.
export const adminToken = () => readToken()?.token || null

const hasScope = (scope) => {
  const t = readToken()
  return !!t && (t.scopes.includes(scope) || (scope !== 'wfsc' && t.scopes.includes('admin')))
}

export const isAdmin          = () => hasScope('admin')
export const isBingoAdmin     = () => hasScope('bingo')
export const isNationalsAdmin = () => hasScope('nationals')
export const isCatfishAdmin   = () => hasScope('catfish')
export const isMudgewayAdmin  = () => hasScope('mudgeway')

// Exchange a password for a token. Returns the scopes it unlocked ([] if wrong).
// Pass storageKey to keep a separate session (the WFSC app does).
export async function adminLogin(password, { storageKey = TOKEN_KEY } = {}) {
  const res = await fetch('/.netlify/functions/admin-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  })
  if (!res.ok) return []
  const { token, scopes } = await res.json()
  sessionStorage.setItem(storageKey, token)
  return scopes || []
}

export const hasStoredScope = (scope, storageKey) => {
  const t = readToken(storageKey)
  return !!t && t.scopes.includes(scope)
}

export const clearAdminSession = () => {
  sessionStorage.removeItem(TOKEN_KEY)
  // Flags from the old client-side password check.
  ;['isAdmin', 'isBingoAdmin', 'isNationalsAdmin', 'isMudgewayAdmin'].forEach(k => sessionStorage.removeItem(k))
}
