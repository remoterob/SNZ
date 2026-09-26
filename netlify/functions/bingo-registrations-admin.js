// Netlify Function: list Fish Bingo competition registrations for admins.
//
// bingo_registrations is read-own under RLS (migration 019) — a diver can only
// see their own row, and there is no admin-exception policy. This function is
// the only way to see the full list. Gated the same way bingo-admin-config.js
// is: the shared sys-admin password, or the scoped Fish Bingo password so a
// bingo-only login can use it without full admin access.
//
// Only the registration rows and the member details behind them need the
// service role. Claims and species are publicly readable, so the admin page
// fetches those itself and scores them with the app's own helpers rather than
// this function duplicating the scoring rules in CommonJS.

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
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' }

  let body
  try { body = JSON.parse(event.body || '{}') } catch { return json(400, { error: 'Bad request' }) }

  const pw = body.adminPassword
  const ok = !!pw && (
    pw === process.env.VITE_ADMIN_PASSWORD ||
    (process.env.VITE_BINGO_ADMIN_PASSWORD && pw === process.env.VITE_BINGO_ADMIN_PASSWORD)
  )
  if (!ok) return json(401, { error: 'Unauthorised' })

  try {
    let q = supabase
      .from('bingo_registrations')
      .select('id, user_id, comp_season, region, experience, rules_accepted_at, created_at')
      .order('created_at', { ascending: false })
    if (body.season) q = q.eq('comp_season', body.season)

    const { data: regs, error } = await q
    if (error) throw error

    // Attach the member record behind each registration. Region/experience on
    // the registration win over the member profile — they're what the diver
    // answered for this season.
    const ids = [...new Set((regs || []).map(r => r.user_id).filter(Boolean))]
    let members = {}
    if (ids.length) {
      const { data: m, error: mErr } = await supabase
        .from('members')
        .select('id, name, email, phone, club, gender, dob, membership_status, member_number')
        .in('id', ids)
      if (mErr) throw mErr
      members = Object.fromEntries((m || []).map(x => [x.id, x]))
    }

    const rows = (regs || []).map(r => {
      const m = members[r.user_id] || {}
      return {
        ...r,
        name: m.name || null,
        email: m.email || null,
        phone: m.phone || null,
        club: m.club || null,
        gender: m.gender || null,
        dob: m.dob || null,
        member_number: m.member_number || null,
        membership_status: m.membership_status || null,
      }
    })

    return json(200, { rows })
  } catch (err) {
    console.error('bingo-registrations-admin error:', err)
    return json(500, { error: err.message })
  }
}
