// Shared scoring/ranking logic for the SNZ Nationals.
//
// Used by both the admin Results tab (Super Diver) and the public leaderboard
// page so every board ranks identically. The formulas mirror the per-event
// admin components (DivisionLeaderboard / DerivedDivLeaderboard / Photography /
// FinSwim) — keep them in sync.
//
// Data shapes:
//   team    = { id, team_name, nationals_event, _d1:{name}, _d2:{name}|null, ... }
//   weighin = { team_id, division, points_awarded, instance, is_bulk }

export function isInDiv(team, divId) {
  const ev = team.nationals_event || {}
  if (divId === 'under23') return !!(ev.under23_d1 || ev.under23_d2)
  return !!ev[divId]
}

export function teamsInDiv(teams, divId) {
  return teams.filter(t => isInDiv(t, divId))
}

// Individual (per-diver) competitors for an instance-based event
// (photography / finswim / superdiver). Returns one entry per entered diver.
export function individualCompetitors(teams, type) {
  const result = []
  for (const team of teams) {
    const ev = team.nationals_event || {}
    if (ev[`${type}_d1`]) result.push({ team, diver_slot: 1, name: team._d1?.name || 'Diver 1', key: `${team.id}-1` })
    if (ev[`${type}_d2`]) result.push({ team, diver_slot: 2, name: team._d2?.name || 'Diver 2', key: `${team.id}-2` })
  }
  return result
}

// Team/pairs board ranked by total points. `scoreFromDiv` lets derived
// sub-divisions (e.g. Women's) rank off the Open weigh-ins.
export function teamLeaderboard(teams, weighins, divId, scoreFromDiv = null) {
  const scoreDiv = scoreFromDiv || divId
  const rows = teamsInDiv(teams, divId).map(t => {
    const tw = weighins.filter(w => w.team_id === t.id && w.division === scoreDiv)
    const total = tw.reduce((s, w) => s + (w.points_awarded || 0), 0)
    const fishCount = tw.filter(w => !w.is_bulk).length
    return { ...t, total, fishCount, hasEntry: tw.length > 0 }
  }).sort((a, b) => (b.hasEntry - a.hasEntry) || (b.total - a.total))
  let r = 0
  for (const row of rows) row.rank = row.hasEntry ? ++r : null
  return rows
}

// Open — a 2-day event. Each team's score for a day is their points as a
// percentage of that day's top score across the whole Open field, and their
// overall score is the sum of both days' percentages (max 200%). Women's and
// Silver Oldie are entered as part of Open (not a separate weigh-in) — they
// re-rank the exact same day1%+day2% score against a filtered eligible team
// list, benchmarked against the same whole-field top score, so a team's
// number is identical whether viewed on the Open board or their sub-board.
export function openTeamLeaderboard(teams, weighins, filterDivId = 'open') {
  const openWeighins = weighins.filter(w => w.division === 'open')
  const allOpenTeams = teamsInDiv(teams, 'open')

  const dayTotal = (teamId, day) => openWeighins
    .filter(w => w.team_id === teamId && (w.day === day || (day === 1 && w.day == null)))
    .reduce((s, w) => s + (w.points_awarded || 0), 0)

  const top1 = Math.max(0, ...allOpenTeams.map(t => dayTotal(t.id, 1)))
  const top2 = Math.max(0, ...allOpenTeams.map(t => dayTotal(t.id, 2)))

  const eligible = filterDivId === 'open'
    ? allOpenTeams
    : teams.filter(t => t.nationals_event?.[filterDivId])

  const rows = eligible.map(t => {
    const day1Total = dayTotal(t.id, 1)
    const day2Total = dayTotal(t.id, 2)
    const day1Pct = top1 > 0 ? (day1Total / top1) * 100 : 0
    const day2Pct = top2 > 0 ? (day2Total / top2) * 100 : 0
    const fishCount = openWeighins.filter(w => w.team_id === t.id && !w.is_bulk).length
    return {
      ...t, day1Total, day2Total, day1Pct, day2Pct,
      total: day1Pct + day2Pct, fishCount, hasEntry: (day1Total + day2Total) > 0,
    }
  }).sort((a, b) => (b.hasEntry - a.hasEntry) || (b.total - a.total))

  let r = 0
  for (const row of rows) row.rank = row.hasEntry ? ++r : null
  return rows
}

// Photography — ranked by species count (most first).
export function photographyLeaderboard(teams, weighins) {
  const rows = individualCompetitors(teams, 'photography').map(c => {
    const ex = weighins.find(w => w.team_id === c.team.id && w.division === 'photography' && w.instance === c.diver_slot)
    return { ...c, count: ex?.points_awarded || 0, hasResult: !!ex }
  }).sort((a, b) => (b.hasResult - a.hasResult) || (b.count - a.count))
  let r = 0
  for (const row of rows) row.rank = row.hasResult ? ++r : null
  return rows
}

// Fin Swim — manually entered placing (1 = first). No points, just placing.
export function finSwimLeaderboard(teams, weighins) {
  return individualCompetitors(teams, 'finswim').map(c => {
    const ex = weighins.find(w => w.team_id === c.team.id && w.division === 'finswim' && w.instance === c.diver_slot)
    return { ...c, placing: ex?.points_awarded || null, hasResult: !!ex }
  }).sort((a, b) => {
    if (!a.placing && !b.placing) return 0
    if (!a.placing) return 1
    if (!b.placing) return -1
    return a.placing - b.placing
  })
}

// Super Diver — aggregate of placings across Open + Photography + Fin Swim.
// A diver's Open placing is their team's Open rank. Lowest aggregate wins;
// only divers with a result in all three are ranked.
export function superDiverLeaderboard(teams, weighins) {
  const openRankByTeam = new Map(
    openTeamLeaderboard(teams, weighins, 'open').filter(t => t.rank).map(t => [t.id, t.rank])
  )
  const photoRankByKey = new Map(
    photographyLeaderboard(teams, weighins).filter(p => p.rank).map(p => [p.key, p.rank])
  )
  const swimPlacingByKey = new Map(
    finSwimLeaderboard(teams, weighins).filter(s => s.placing).map(s => [s.key, s.placing])
  )

  const rows = individualCompetitors(teams, 'superdiver').map(c => {
    const openPlacing = openRankByTeam.get(c.team.id) ?? null
    const photoPlacing = photoRankByKey.get(c.key) ?? null
    const swimPlacing = swimPlacingByKey.get(c.key) ?? null
    const complete = openPlacing != null && photoPlacing != null && swimPlacing != null
    const aggregate = complete ? openPlacing + photoPlacing + swimPlacing : null
    return { ...c, openPlacing, photoPlacing, swimPlacing, aggregate, complete }
  }).sort((a, b) => {
    if (a.complete && b.complete) return (a.aggregate - b.aggregate) || (a.openPlacing - b.openPlacing)
    return b.complete - a.complete // complete entries first
  })
  let r = 0
  for (const row of rows) row.rank = row.complete ? ++r : null
  return rows
}

export const medalFor = (rank) => rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank ? `#${rank}` : '–'
