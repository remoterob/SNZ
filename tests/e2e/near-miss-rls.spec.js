import { test, expect } from '@playwright/test'
import { loadTestEnv } from './fixtures/loadTestEnv.js'

loadTestEnv()
const SUPABASE_URL = process.env.SUPABASE_URL
const ANON_KEY = process.env.SUPABASE_ANON_KEY

// API-level tests, not browser UI — Playwright's `request` fixture hits
// the local PostgREST endpoint directly with the anon key, the same way
// any unauthenticated visitor's browser would. Regression coverage for
// migration 016's RLS policies: anyone may insert, nobody may read.
const minimalReport = {
  time_band: 'last_month',
  region: 'Auckland – Hauraki Gulf',
  location_name: 'RLS spec test location',
  distance_from_shore: 'under_50m',
  outcome: 'close_pass',
  closest_distance: '5_10m',
  vessel_speed: 'planing',
  diver_position: 'surface_resting',
  visibility_gear: ['flag_float'],
  vessel_saw_you: 'no_reaction',
  vessel_type: 'trailer_under_6m',
  reported_to: ['not_reported'],
  not_reported_reasons: ['not_serious_enough'],
  injury_level: 'none',
  contact_consent: 'anonymous',
  data_use_consent: true,
}

test.describe('near_miss_reports RLS (migration 016)', () => {
  test('anon can insert a report', async ({ request }) => {
    const res = await request.post(`${SUPABASE_URL}/rest/v1/near_miss_reports`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, Prefer: 'return=minimal' },
      data: minimalReport,
    })
    // return=minimal avoids Postgres's INSERT...RETURNING-requires-a-passing-
    // SELECT-policy behaviour — see the note in migration 016. Real callers
    // (near-miss-submit.js) never hit this since they use the service-role key.
    expect(res.status()).toBe(201)
  })

  test('anon cannot select any reports, including one it just inserted', async ({ request }) => {
    await request.post(`${SUPABASE_URL}/rest/v1/near_miss_reports`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, Prefer: 'return=minimal' },
      data: minimalReport,
    })
    const res = await request.get(`${SUPABASE_URL}/rest/v1/near_miss_reports?select=*`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
    })
    expect(res.status()).toBe(200)
    expect(await res.json()).toEqual([])
  })
})
