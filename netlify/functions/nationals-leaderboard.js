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

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=30' },
  body: JSON.stringify(body),
})

exports.handler = async () => {
  try {
    const { data: comp } = await supabase
      .from('competitions')
      .select('id, name, status, event_dates')
      .ilike('name', '%nationals%2027%')
      .maybeSingle()
    if (!comp) return json(404, { error: 'Nationals competition not found' })

    const { data: teamRows, error: teamErr } = await supabase
      .from('comp_teams')
      .select('id, team_name, nationals_event, status, diver1_member_id, diver2_member_id')
      .eq('competition_id', comp.id)
    if (teamErr) throw teamErr
    const teams = (teamRows || []).filter(t => t.status !== 'withdrawn')

    const ids = [...new Set(teams.flatMap(t => [t.diver1_member_id, t.diver2_member_id]).filter(Boolean))]
    const { data: members } = ids.length
      ? await supabase.from('members').select('id, name').in('id', ids)
      : { data: [] }
    const nameById = new Map((members || []).map(m => [m.id, m.name]))

    const teamsOut = teams.map(t => ({
      id: t.id,
      team_name: t.team_name,
      nationals_event: t.nationals_event || {},
      _d1: { name: nameById.get(t.diver1_member_id) || null },
      _d2: t.diver2_member_id ? { name: nameById.get(t.diver2_member_id) || null } : null,
    }))

    const { data: weighins, error: wErr } = await supabase
      .from('comp_weighins')
      .select('team_id, division, fish_name, weight_kg, points_awarded, instance, is_bulk')
      .eq('competition_id', comp.id)
      .not('division', 'is', null)
    if (wErr) throw wErr

    return json(200, {
      comp: { name: comp.name, status: comp.status, event_dates: comp.event_dates || {} },
      teams: teamsOut,
      weighins: weighins || [],
    })
  } catch (err) {
    console.error('nationals-leaderboard error:', err)
    return json(500, { error: err.message })
  }
}
