// Netlify Function: admin moderation for the Vessel Near-Miss Survey.
//
// near_miss_reports has no admin-exception RLS policy (see migration 016)
// — this function is the ONLY way to list, moderate, or export raw
// submissions. Gated the same way every other privileged action in this
// app is: a shared password compared server-side against
// VITE_ADMIN_PASSWORD (see refund-payment.js), then the service-role key
// bypasses RLS. There's no real per-user admin role anywhere in this app
// to check instead — see the plan notes for why.
//
// Actions (all POST, dispatched via `action` in the body):
//   list         — filtered submissions for the admin table (full detail)
//   updateStatus — approve / flag / remove, with a moderation note
//   export       — consent-aware, redacted rows for CSV download. The
//                  actual column-stripping happens here, not client-side,
//                  so it can't be bypassed by editing frontend code — the
//                  admin page just turns the already-redacted rows into a
//                  CSV with the existing src/lib/csvExport.js helper.

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

function applyFilters(query, filters) {
  const { region, outcome, time_band, status } = filters || {}
  if (region) query = query.eq('region', region)
  if (outcome) query = query.eq('outcome', outcome)
  if (time_band) query = query.eq('time_band', time_band)
  if (status) query = query.eq('status', status)
  return query
}

// mode: 'standard' — anonymous-consent rows lose contact_email/user_id.
// mode: 'for_submission' — every row loses contact_email/user_id/free_text,
// regardless of consent — this is the file that goes to a harbourmaster.
function redact(row, mode) {
  const stripContact = mode === 'for_submission' || row.contact_consent === 'anonymous'
  return {
    ...row,
    contact_email: stripContact ? null : row.contact_email,
    user_id: stripContact ? null : row.user_id,
    free_text: mode === 'for_submission' ? null : row.free_text,
  }
}

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

  if (body.adminPassword !== process.env.VITE_ADMIN_PASSWORD) {
    return json(401, { error: 'Unauthorised' })
  }

  const { action } = body

  try {
    if (action === 'list') {
      let query = supabase.from('near_miss_reports').select('*').order('created_at', { ascending: false })
      query = applyFilters(query, body.filters)
      const { data, error } = await query
      if (error) throw error
      return json(200, { reports: data })
    }

    if (action === 'updateStatus') {
      const { id, status, moderation_note } = body
      if (!id || !status) return json(400, { error: 'id and status are required' })
      if (!['pending', 'approved', 'flagged', 'removed'].includes(status)) {
        return json(400, { error: 'Invalid status' })
      }
      const { error } = await supabase.from('near_miss_reports')
        .update({ status, moderation_note: moderation_note ?? null })
        .eq('id', id)
      if (error) throw error
      return json(200, { success: true })
    }

    if (action === 'export') {
      const mode = body.mode === 'for_submission' ? 'for_submission' : 'standard'
      let query = supabase.from('near_miss_reports').select('*').order('created_at', { ascending: false })
      query = applyFilters(query, body.filters)
      const { data, error } = await query
      if (error) throw error
      return json(200, { rows: data.map(row => redact(row, mode)) })
    }

    return json(400, { error: `Unknown action: ${action}` })
  } catch (err) {
    console.error('near-miss-admin error:', err)
    return json(500, { error: err.message })
  }
}
