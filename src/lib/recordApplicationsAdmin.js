// Records Admin access to record_applications, via the admin-token-gated
// Netlify function (the table is not readable from the browser under RLS).
import { adminToken } from './supabase'

export async function recordAppsAdmin(action, params = {}) {
  const res = await fetch('/.netlify/functions/record-applications-admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminToken: adminToken(), action, ...params }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}
