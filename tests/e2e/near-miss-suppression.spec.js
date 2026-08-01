import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { createRequire } from 'module'
import { loadTestEnv } from './fixtures/loadTestEnv.js'

// Playwright's webServer only runs `vite dev`, not `netlify dev` (see
// tests/e2e/README.md — deliberate Phase 1 scope), so
// /.netlify/functions/near-miss-aggregates isn't reachable over HTTP here.
// Load its real handler in-process instead — it's plain CommonJS, exactly
// how Netlify actually runs it, and it reads SUPABASE_URL/
// SUPABASE_SERVICE_ROLE_KEY from process.env at require time, so the test
// env must be loaded first.
loadTestEnv()
const require = createRequire(import.meta.url)
const { handler: aggregatesHandler } = require('../../netlify/functions/near-miss-aggregates.js')

const BASE_ROW = {
  time_band: 'last_month',
  distance_from_shore: 'under_50m',
  outcome: 'close_pass',
  closest_distance: '5_10m',
  vessel_speed: 'planing',
  diver_position: 'surface_resting',
  vessel_saw_you: 'no_reaction',
  vessel_type: 'trailer_under_6m',
  injury_level: 'none',
  contact_consent: 'anonymous',
}

test('locations below the suppression threshold are withheld, at-or-above are shown', async () => {
  const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)

  const belowThreshold = Array.from({ length: 4 }, () => ({
    ...BASE_ROW, region: 'Auckland – Hauraki Gulf', location_name: 'Suppressed Test Cove',
  }))
  const atThreshold = Array.from({ length: 5 }, () => ({
    ...BASE_ROW, region: 'Auckland – Hauraki Gulf', location_name: 'Visible Test Bay',
  }))
  const { error } = await sb.from('near_miss_reports').insert([...belowThreshold, ...atThreshold])
  if (error) throw error

  const response = await aggregatesHandler()
  const data = JSON.parse(response.body)

  const locationNames = data.topLocations.map(l => l.location)
  expect(locationNames).not.toContain('suppressed test cove')
  expect(locationNames).toContain('visible test bay')
  expect(data.topLocations.find(l => l.location === 'visible test bay').count).toBe(5)
})
