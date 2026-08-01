// Netlify Function: public, read-only aggregate figures for the Vessel
// Near-Miss Survey results page (/near-miss/results).
//
// near_miss_reports has NO public SELECT policy at all (see migration
// 016) — this is the only sanctioned way any aggregate figure reaches the
// public. Uses the service-role key to read, computes every figure
// server-side, and returns ONLY the whitelisted summary numbers below —
// raw rows, free text, contact details and lat/lng are never selected,
// let alone returned. Any breakdown cell backed by fewer than 5 reports is
// suppressed (returned as null with insufficient: true) rather than
// disclosing a small, potentially-identifying number.

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const SUPPRESSION_THRESHOLD = 5

// Returns { count, pct, insufficient } — count/pct are null when suppressed.
function cell(count, denominator) {
  if (count < SUPPRESSION_THRESHOLD) return { count: null, pct: null, insufficient: true }
  return { count, pct: denominator > 0 ? Math.round((count / denominator) * 1000) / 10 : 0, insufficient: false }
}

function tally(rows, getKeyOrKeys) {
  const counts = {}
  for (const row of rows) {
    const keys = getKeyOrKeys(row)
    for (const k of Array.isArray(keys) ? keys : [keys]) {
      if (k == null) continue
      counts[k] = (counts[k] || 0) + 1
    }
  }
  return counts
}

exports.handler = async () => {
  try {
    // Only the columns actually needed for aggregation — never free_text,
    // contact_email, latitude/longitude, or user_id.
    const { data: rows, error } = await supabase
      .from('near_miss_reports')
      .select('created_at, region, location_name, outcome, distance_from_shore, vessel_speed, visibility_gear, reported_to, not_reported_reasons')
      .neq('status', 'removed')

    if (error) throw error

    const total = rows.length
    const period = total > 0
      ? {
          start: rows.reduce((min, r) => r.created_at < min ? r.created_at : min, rows[0].created_at),
          end: rows.reduce((max, r) => r.created_at > max ? r.created_at : max, rows[0].created_at),
        }
      : null

    // Under-reporting rate
    const notReportedRows = rows.filter(r => (r.reported_to || []).includes('not_reported'))
    const underReporting = cell(notReportedRows.length, total)

    // Reasons for not reporting — % of the not-reported subgroup, not total
    const reasonCounts = tally(notReportedRows, r => r.not_reported_reasons || [])
    const notReportedReasons = Object.fromEntries(
      Object.entries(reasonCounts).map(([reason, count]) => [reason, cell(count, notReportedRows.length)])
    )

    // Severity ladder distribution
    const outcomeCounts = tally(rows, r => r.outcome)
    const outcomeDistribution = Object.fromEntries(
      Object.entries(outcomeCounts).map(([outcome, count]) => [outcome, cell(count, total)])
    )

    // Visibility gear — flag or float present
    const withFlagOrFloat = rows.filter(r =>
      (r.visibility_gear || []).some(g => g === 'flag_float' || g === 'flag_vessel')
    ).length
    const visibilityFlagRate = cell(withFlagOrFloat, total)

    // Reports by region
    const regionCounts = tally(rows, r => r.region)
    const byRegion = Object.fromEntries(
      Object.entries(regionCounts).map(([region, count]) => [region, cell(count, total)])
    )

    // Top recurring locations — only where count >= 5, top 10
    const locationCounts = tally(rows, r => r.location_name?.trim().toLowerCase())
    const topLocations = Object.entries(locationCounts)
      .filter(([, count]) => count >= SUPPRESSION_THRESHOLD)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([location, count]) => ({ location, count }))

    // Rule 91.6 breach figure — planing + within 200m of shore
    const ruleBreachCount = rows.filter(r =>
      (r.vessel_speed === 'planing' || r.vessel_speed === 'planing_manoeuvring') &&
      (r.distance_from_shore === 'under_50m' || r.distance_from_shore === '50_200m')
    ).length
    const rule91_6BreachRate = cell(ruleBreachCount, total)

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60' },
      body: JSON.stringify({
        total,
        period,
        underReporting,
        notReportedReasons,
        outcomeDistribution,
        visibilityFlagRate,
        byRegion,
        topLocations,
        rule91_6BreachRate,
        suppressionThreshold: SUPPRESSION_THRESHOLD,
      }),
    }
  } catch (err) {
    console.error('near-miss-aggregates error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
