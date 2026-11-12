// Public Nationals leaderboard data provider.
//
// Returns sanitized teams (diver names only — no emails) + weigh-ins so the
// public /nationals/leaderboard page can compute every event board client-side
// via src/lib/nationalsScoring.js. Uses the service role so it works regardless
// of RLS, while never exposing member PII beyond display names.
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Mirrors ageOn / deriveOpenSubFlags in src/lib/nationalsScoring.js — keep in sync.
const SILVER_OLDIE_AGE = 50
function ageOn(dob, onDate) {
  if (!dob) return null
  const b = new Date(dob), d = onDate ? new Date(onDate) : new Date()
  if (isNaN(b) || isNaN(d)) return null
  let age = d.getUTCFullYear() - b.getUTCFullYear()
  const m = d.getUTCMonth() - b.getUTCMonth()
  if (m < 0 || (m === 0 && d.getUTCDate() < b.getUTCDate())) age--
  return age
}
function deriveOpenSubFlags(nationalsEvent, d1, d2, openStartDate) {
  const ev = { ...(nationalsEvent || {}) }
  if (!ev.open) return ev
  if (d1 && d2 && d1.gender === 'Female' && d2.gender === 'Female') ev.womens = true
  if ([d1, d2].some(d => (ageOn(d?.dob, openStartDate) ?? -1) >= SILVER_OLDIE_AGE)) ev.silveroldie = true
  return ev
}

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=30' },
  body: JSON.stringify(body),
})

exports.handler = async () => {
  try {
    const { data: comp } = await supabase
      .from('competitions')
      .select('id, name, status, event_dates, host_club_name, host_club_logo_url, sponsor1_url, sponsor2_url, sponsor3_url')
      .ilike('name', '%nationals%2027%')
      .maybeSingle()
    if (!comp) return json(404, { error: 'Nationals competition not found' })

    const { data: teamRows, error: teamErr } = await supabase
      .from('comp_teams')
      .select('id, team_name, nationals_event, status, diver1_member_id, diver2_member_id, team_photo_url')
      .eq('competition_id', comp.id)
    if (teamErr) throw teamErr
    const teams = (teamRows || []).filter(t => t.status !== 'withdrawn')

    const ids = [...new Set(teams.flatMap(t => [t.diver1_member_id, t.diver2_member_id]).filter(Boolean))]
    const { data: members } = ids.length
      ? await supabase.from('members').select('id, name, gender, dob').in('id', ids)
      : { data: [] }
    const memberById = new Map((members || []).map(m => [m.id, m]))
    const nameById = new Map((members || []).map(m => [m.id, m.name]))
    const openStart = comp.event_dates?.open?.start || null

    // Women's / Silver Oldie derived from current gender + DOB (never sent to
    // the client — only the resulting flags are).
    const teamsOut = teams.map(t => ({
      id: t.id,
      team_name: t.team_name,
      nationals_event: deriveOpenSubFlags(
        t.nationals_event,
        memberById.get(t.diver1_member_id) || null,
        t.diver2_member_id ? memberById.get(t.diver2_member_id) || null : null,
        openStart,
      ),
      team_photo_url: t.team_photo_url || null,
      _d1: { name: nameById.get(t.diver1_member_id) || null },
      _d2: t.diver2_member_id ? { name: nameById.get(t.diver2_member_id) || null } : null,
    }))

    const { data: weighins, error: wErr } = await supabase
      .from('comp_weighins')
      .select('team_id, division, fish_name, weight_kg, points_awarded, instance, is_bulk, day')
      .eq('competition_id', comp.id)
      .not('division', 'is', null)
    if (wErr) throw wErr

    return json(200, {
      comp: {
        name: comp.name, status: comp.status, event_dates: comp.event_dates || {},
        host_club_name: comp.host_club_name || null,
        host_club_logo_url: comp.host_club_logo_url || null,
        sponsor1_url: comp.sponsor1_url || null,
        sponsor2_url: comp.sponsor2_url || null,
        sponsor3_url: comp.sponsor3_url || null,
      },
      teams: teamsOut,
      weighins: weighins || [],
    })
  } catch (err) {
    console.error('nationals-leaderboard error:', err)
    return json(500, { error: err.message })
  }
}
