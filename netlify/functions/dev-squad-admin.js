// Netlify Function: panel access for NZ Diver Development Squad applications.
//
// dev_squad_applications has no admin-exception RLS policy (see migration
// 037) — this function is the only way to list, update or export them. Gated
// the same way every other privileged action in this app is: a shared password
// compared server-side against VITE_ADMIN_PASSWORD (see refund-payment.js and
// near-miss-admin.js), then the service-role key bypasses RLS.
//
// Actions (all POST, dispatched via `action`):
//   list         — applications for the panel table. Omits health_disclosure:
//                  it is sensitive and not needed to triage a list.
//   updateStatus — move an application through the panel workflow.
//   export       — full rows for CSV, health_disclosure included. The admin
//                  page turns these into a CSV with src/lib/csvExport.js.
//   setConfig    — flips the area between live / closed / hidden. Reads are
//                  public (see migration 038); only writes come through here.

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

const STATUSES = ['submitted', 'shortlisted', 'interviewed', 'trialling', 'selected', 'declined']
const AREA_STATUSES = ['live', 'closed', 'hidden']

// Everything except the sensitive health field.
const LIST_COLUMNS = `
  id, created_at, status, panel_notes,
  full_name, dob, email, phone, suburb_city,
  submitted_as_member, user_id,
  max_depth_m, comfortable_depth_m, max_breath_hold_sec, comfortable_breath_hold_sec,
  competitions, has_commercial_experience, commercial_details,
  nz_locations, overseas_experience, species_shot,
  commitment_level, commitment_notes, medically_fit
`

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' }

  let body
  try { body = JSON.parse(event.body || '{}') } catch { return json(400, { error: 'Bad request' }) }

  if (!body.adminPassword || body.adminPassword !== process.env.VITE_ADMIN_PASSWORD) {
    return json(401, { error: 'Unauthorised' })
  }

  try {
    if (body.action === 'list') {
      let q = supabase
        .from('dev_squad_applications')
        .select(LIST_COLUMNS)
        .order('created_at', { ascending: false })
      if (body.status) q = q.eq('status', body.status)
      const { data, error } = await q
      if (error) throw error
      return json(200, { rows: data || [] })
    }

    if (body.action === 'updateStatus') {
      const { id, status, panel_notes } = body
      if (!id) return json(400, { error: 'id is required' })
      if (status && !STATUSES.includes(status)) return json(400, { error: 'Invalid status' })
      const updates = {}
      if (status !== undefined) updates.status = status
      if (panel_notes !== undefined) updates.panel_notes = panel_notes
      if (!Object.keys(updates).length) return json(400, { error: 'Nothing to update' })
      const { error } = await supabase.from('dev_squad_applications').update(updates).eq('id', id)
      if (error) throw error
      return json(200, { success: true })
    }

    if (body.action === 'export') {
      // Full detail including health_disclosure — this is the only path that
      // returns it, and it needs the admin password like everything else here.
      const { data, error } = await supabase
        .from('dev_squad_applications')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return json(200, { rows: data || [] })
    }

    if (body.action === 'setConfig') {
      const { status, closed_message } = body
      if (status !== undefined && !AREA_STATUSES.includes(status)) {
        return json(400, { error: 'Invalid area status' })
      }
      const updates = {}
      if (status !== undefined) updates.status = status
      if (closed_message !== undefined) updates.closed_message = closed_message || null
      if (!Object.keys(updates).length) return json(400, { error: 'Nothing to update' })
      const { data, error } = await supabase
        .from('dev_squad_config').update(updates).eq('id', 1).select('*').single()
      if (error) throw error
      return json(200, { config: data })
    }

    return json(400, { error: 'Unknown action' })
  } catch (err) {
    console.error('dev-squad-admin error:', err)
    return json(500, { error: err.message })
  }
}
