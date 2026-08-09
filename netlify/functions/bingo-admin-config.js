// Netlify Function: admin updates to bingo_comp_config (status, dates,
// rules text). bingo_comp_config only allows service_role writes under RLS
// (see migration 002_bingo_tables.sql), so this is the only write path —
// mirrors the shared-password pattern used by every other privileged action
// in this app (see refund-payment.js / near-miss-admin.js), but also accepts
// the Fish-Bingo-scoped VITE_BINGO_ADMIN_PASSWORD so a bingo-only login can
// manage this without full sys admin access.

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  let body
  try {
    body = JSON.parse(event.body || '{}')
  } catch (e) {
    return json(400, { error: 'Bad request' })
  }

  const okPassword = !!body.adminPassword && (
    body.adminPassword === process.env.VITE_ADMIN_PASSWORD ||
    (process.env.VITE_BINGO_ADMIN_PASSWORD && body.adminPassword === process.env.VITE_BINGO_ADMIN_PASSWORD)
  )
  if (!okPassword) return json(401, { error: 'Unauthorised' })

  const { id, season, comp_start, comp_end, status, rules_sections } = body
  if (!id) return json(400, { error: 'id is required' })
  if (status !== undefined && !['upcoming', 'active', 'closed'].includes(status)) {
    return json(400, { error: 'Invalid status' })
  }
  if (rules_sections !== undefined && !Array.isArray(rules_sections)) {
    return json(400, { error: 'rules_sections must be an array' })
  }

  const updates = {}
  if (season !== undefined)      updates.season = season
  if (comp_start !== undefined)  updates.comp_start = comp_start
  if (comp_end !== undefined)    updates.comp_end = comp_end
  if (status !== undefined)      updates.status = status
  if (rules_sections !== undefined) updates.rules_sections = rules_sections

  try {
    const { error } = await supabase.from('bingo_comp_config').update(updates).eq('id', id)
    if (error) throw error
    return json(200, { success: true })
  } catch (err) {
    console.error('bingo-admin-config error:', err)
    return json(500, { error: err.message })
  }
}
