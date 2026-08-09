// bingo-claim.mjs
// POST  — create a claim in bingo_claims
// DELETE — remove a claim from bingo_claims
// Auth: SNZ Supabase JWT (session.access_token from client)
// Requires plain SUPABASE_URL + SUPABASE_ANON_KEY Netlify env vars (not the
// VITE_-prefixed client ones) — uses the anon key + the caller's own JWT so
// inserts/deletes still go through bingo_claims' auth.uid() = user_id RLS
// policy, rather than a service-role key that would bypass it.

import { createClient } from '@supabase/supabase-js'

const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
}
const ok  = (b) => ({ statusCode: 200, headers: { 'Content-Type': 'application/json', ...CORS }, body: JSON.stringify(b) })
const bad = (c, b) => ({ statusCode: c,   headers: { 'Content-Type': 'application/json', ...CORS }, body: JSON.stringify(b) })

const isBonusSlug = (slug) => typeof slug === 'string' && slug.startsWith('bonus-')

function asUserClient(jwt) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return ok({ ok: true })
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return bad(500, { error: 'Missing Supabase env vars' })

  const auth = event.headers?.authorization || event.headers?.Authorization
  if (!auth?.startsWith('Bearer ')) return bad(401, { error: 'Missing Authorization bearer token' })
  const jwt = auth.slice(7)

  let body = {}
  try { body = event.body ? JSON.parse(event.body) : {} } catch {}

  const qp = event.queryStringParameters || {}
  const species_slug = (
    qp.species_slug || qp.speciesSlug ||
    body.species_slug || body.speciesSlug || ''
  ).trim()

  if (!species_slug) return bad(400, { error: 'species_slug is required' })

  try {
    const client = asUserClient(jwt)
    const { data: u, error: uErr } = await client.auth.getUser()
    if (uErr || !u?.user?.id) return bad(401, { error: 'Invalid token', details: uErr?.message })
    const user_id = u.user.id

    if (event.httpMethod === 'DELETE') {
      const { data: rows, error: qErr } = await client
        .from('bingo_claims')
        .select('id')
        .eq('user_id', user_id)
        .eq('species_slug', species_slug)
        .order('created_at', { ascending: false })
        .limit(1)
      if (qErr) return bad(500, { error: 'Failed to find claim', details: qErr.message })
      if (!rows?.length) return ok({ ok: true, deleted: false })
      const { error: dErr } = await client.from('bingo_claims').delete().eq('id', rows[0].id)
      if (dErr) return bad(500, { error: 'Failed to delete claim', details: dErr.message })
      return ok({ ok: true, deleted: true })
    }

    if (event.httpMethod === 'POST') {
      const comp_season = (body.comp_season || '').trim()
      if (!comp_season) return bad(400, { error: 'comp_season is required' })

      const first_time = isBonusSlug(species_slug)
        ? false
        : !!(body.first_time ?? body.firstTime)

      // Check already claimed this season
      const { data: existing } = await client
        .from('bingo_claims')
        .select('id, first_time, photo_url')
        .eq('user_id', user_id)
        .eq('species_slug', species_slug)
        .eq('comp_season', comp_season)
        .limit(1)

      if (existing?.length) return ok({ ok: true, already_claimed: true, claim: existing[0] })

      const { data: inserted, error: insErr } = await client
        .from('bingo_claims')
        .insert({ user_id, species_slug, first_time, comp_season })
        .select('id, user_id, species_slug, first_time, comp_season, created_at, photo_url')
        .single()

      if (insErr) return bad(409, { error: 'Failed to insert claim', details: insErr.message })
      return ok({ ok: true, claim: inserted })
    }

    return bad(405, { error: 'Method not allowed' })
  } catch (e) {
    return bad(500, { error: 'Unhandled error', details: e?.message || e })
  }
}
