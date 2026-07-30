// Verifies the calling browser's Supabase session from the Authorization
// header. None of create-checkout-session / verify-checkout-session /
// invite-member had ANY caller identity check before this — any memberId or
// teamId in the request body was trusted at face value. This lets an
// endpoint confirm who is *actually* calling, so it can then check that
// identity against the memberId/teamId claimed in the body.
const { createClient } = require('@supabase/supabase-js')

// Returns the authenticated user's id, or null if the request has no valid
// Supabase access token. Never throws — callers decide how to respond.
async function getAuthenticatedUserId(event) {
  const authHeader = event.headers?.authorization || event.headers?.Authorization
  const token = authHeader?.replace(/^Bearer\s+/i, '').trim()
  if (!token) return null

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anonKey) return null

  const client = createClient(url, anonKey)
  const { data, error } = await client.auth.getUser(token)
  if (error || !data?.user) return null
  return data.user.id
}

module.exports = { getAuthenticatedUserId }
