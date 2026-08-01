// Netlify Function: submit a Vessel Near-Miss Survey report.
//
// Submission goes through this function (not a direct anon-key client
// insert) specifically so the anti-spam checks below are actually
// enforceable server-side — a client-side-only honeypot/timer is trivial
// to bypass. near_miss_reports' own RLS already permits an anon INSERT
// (see migration 016) as a defence-in-depth invariant, but this is the
// real, intended path.

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

const REQUIRED_FIELDS = [
  'time_band', 'region', 'location_name', 'distance_from_shore',
  'outcome', 'closest_distance', 'vessel_speed', 'diver_position',
  'vessel_saw_you', 'vessel_type', 'injury_level', 'contact_consent',
]

const MIN_FORM_SECONDS = 3
const RATE_LIMIT_PER_HOUR = 10

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

  const {
    honeypot, form_started_at,
    user_id, submitted_as_member,
    time_band, approx_month_year, region, location_name, distance_from_shore,
    latitude, longitude,
    outcome, closest_distance, vessel_speed, diver_position,
    visibility_gear, vessel_saw_you, vessel_type,
    reported_to, not_reported_reasons, report_outcome, injury_level,
    years_experience, days_per_year, club_member, free_text,
    contact_consent, contact_email, data_use_consent,
  } = body

  // ── Validation (mirrors the brief's required-field list) ──────────────
  const missing = REQUIRED_FIELDS.filter(f => !body[f])
  if (missing.length) {
    return json(400, { error: `Missing required field(s): ${missing.join(', ')}` })
  }
  if (!Array.isArray(visibility_gear) || visibility_gear.length === 0) {
    return json(400, { error: 'Select at least one visibility option' })
  }
  if (!Array.isArray(reported_to) || reported_to.length === 0) {
    return json(400, { error: 'Select at least one reporting option' })
  }
  if (data_use_consent !== true) {
    return json(400, { error: 'Data use consent is required' })
  }
  if ((contact_consent === 'named' || contact_consent === 'confidential') && !contact_email) {
    return json(400, { error: 'Contact email is required for that consent choice' })
  }

  // ── Anti-spam: honeypot + minimum time-on-form ─────────────────────────
  // Neither of these should tip a bot off — pretend success without
  // actually writing a row, rather than returning a visible error.
  const tooFast = !form_started_at || (Date.now() - Number(form_started_at)) < MIN_FORM_SECONDS * 1000
  if (honeypot || tooFast) {
    console.warn(`near-miss-submit: discarded (honeypot=${!!honeypot}, tooFast=${tooFast})`)
    return json(200, { id: null })
  }

  // ── Anti-spam: generous IP rate limit ──────────────────────────────────
  const ip = event.headers['x-nf-client-connection-ip'] || event.headers['client-ip'] || 'unknown'
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count, error: countErr } = await supabase
    .from('near_miss_rate_limit')
    .select('id', { count: 'exact', head: true })
    .eq('ip', ip)
    .gte('submitted_at', oneHourAgo)
  if (countErr) {
    console.error('near-miss-submit: rate limit check failed:', countErr.message)
    // Fail open — don't block a genuine submission over a rate-limit read error.
  } else if (count >= RATE_LIMIT_PER_HOUR) {
    return json(429, { error: 'Too many submissions from this connection — please try again later' })
  }

  try {
    const { data, error } = await supabase.from('near_miss_reports').insert({
      user_id: user_id || null,
      submitted_as_member: !!submitted_as_member,
      time_band, approx_month_year: approx_month_year || null, region, location_name, distance_from_shore,
      latitude: latitude ?? null, longitude: longitude ?? null,
      outcome, closest_distance, vessel_speed, diver_position,
      visibility_gear, vessel_saw_you, vessel_type,
      reported_to, not_reported_reasons: not_reported_reasons || [], report_outcome: report_outcome || null, injury_level,
      years_experience: years_experience || null, days_per_year: days_per_year || null, club_member: club_member || null, free_text: free_text || null,
      contact_consent, contact_email: contact_email || null, data_use_consent,
      submission_source: 'web',
    }).select('id').single()
    if (error) throw error

    // Best-effort — a failed rate-limit log shouldn't fail the submission itself.
    const { error: logErr } = await supabase.from('near_miss_rate_limit').insert({ ip })
    if (logErr) console.error('near-miss-submit: rate limit log failed:', logErr.message)

    return json(200, { id: data.id })
  } catch (err) {
    console.error('near-miss-submit error:', err)
    return json(500, { error: err.message })
  }
}
