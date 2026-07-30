/**
 * Seeds the local Supabase instance for Playwright E2E tests.
 *
 * Run standalone with `npm run test:e2e:seed`, or imported by
 * tests/e2e/global-setup.js before the suite runs.
 *
 * Run from the SNZ App root — loads .env.test the same way
 * scripts/sync-womens-date.mjs loads .env.migrate.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..', '..')

const envFile = join(ROOT, '.env.test')
if (existsSync(envFile)) {
  readFileSync(envFile, 'utf8').split('\n').forEach(line => {
    if (!line.trim() || line.trim().startsWith('#')) return
    const [key, ...rest] = line.split('=')
    if (key?.trim() && rest.length) process.env[key.trim()] = rest.join('=').trim()
  })
}

const URL = process.env.SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — check .env.test and that `npx supabase start` has run')
  process.exit(1)
}

const SCHEMA_SNAPSHOT = join(__dirname, 'schema-snapshot.sql')

// competitions.id is a GENERATED ALWAYS identity column on the real schema —
// it rejects an explicit inserted value outright, so these aren't fixed
// constants; seed() assigns the real generated ids and returns them.
//
// IMPORTANT: Playwright's globalSetup runs in a different Node process from
// the actual test workers, so a module-level `export let` mutated here is
// NOT visible to spec files — each worker process gets its own fresh,
// null-valued copy of this module (confirmed the hard way: specs were
// requesting /competitions/null/register). global-setup.js writes seed()'s
// return value to fixtures/seeded.json instead; specs import the ids from
// ./fixtures/seeded.js, which reads that file.
const EXISTING_MEMBER_EMAIL = 'e2e.existing.member@example.test'
const EXISTING_MEMBER_PASSWORD = 'e2e-test-password-123'

// PostgREST reports a missing table as a schema-cache miss (PGRST205), or
// occasionally the raw Postgres "undefined_table" code (42P01) — anything
// else (auth/network/permission errors) is a real failure, not "not seeded
// yet", so it should surface rather than trigger a (unsafe, non-idempotent)
// re-apply of the schema snapshot.
const MISSING_TABLE_CODES = new Set(['PGRST205', '42P01'])

async function schemaApplied(sb) {
  const { error } = await sb.from('members').select('id').limit(1)
  if (!error) return true
  if (MISSING_TABLE_CODES.has(error.code)) return false
  throw new Error(`Unexpected error checking local schema: ${error.message} (code: ${error.code})`)
}

async function applySchemaSnapshot() {
  if (!existsSync(SCHEMA_SNAPSHOT)) {
    console.error(
      `Missing ${SCHEMA_SNAPSHOT}\n` +
      'Generate it once with: npm run test:e2e:sync-schema (requires Docker + the linked prod project)'
    )
    process.exit(1)
  }
  console.log('Applying schema snapshot to local Supabase...')
  // `supabase db query -f` executes via a prepared statement, which Postgres
  // refuses for a file with multiple commands ("cannot insert multiple
  // commands into a prepared statement") — confirmed by actually running it
  // against this ~2600-line pg_dump. psql uses the simple query protocol and
  // has no such restriction, so pipe the file into psql running inside the
  // local db container instead. Container name is fixed by
  // supabase/config.toml's project_id ("SNZ_App" -> supabase_db_SNZ_App).
  execSync('docker exec -i supabase_db_SNZ_App psql -U postgres -d postgres -v ON_ERROR_STOP=1', {
    cwd: ROOT, stdio: ['pipe', 'inherit', 'inherit'], input: readFileSync(SCHEMA_SNAPSHOT),
  })
}

async function seed() {
  const sb = createClient(URL, SERVICE_ROLE_KEY)

  if (!(await schemaApplied(sb))) {
    await applySchemaSnapshot()
  }

  // Idempotent reset of just the tables these tests touch — safe, this is
  // always a disposable local DB, never production. `.not('id', 'is', null)`
  // works as an always-true filter regardless of whether id is uuid or int.
  for (const table of ['comp_team_members', 'comp_teams', 'competitions', 'member_whitelist', 'members']) {
    const { error } = await sb.from(table).delete().not('id', 'is', null)
    if (error) throw new Error(`Failed to clear ${table}: ${error.message}`)
  }

  // members rows are keyed to real auth.users — clear those out too so
  // re-running the seed doesn't collide with a stale auth user by email.
  const { data: existingUsers } = await sb.auth.admin.listUsers()
  for (const u of existingUsers?.users || []) {
    if (u.email === EXISTING_MEMBER_EMAIL) await sb.auth.admin.deleteUser(u.id)
  }

  const { data: comps, error: compErr } = await sb.from('competitions').insert([
    {
      name: 'E2E Free Solo Test Comp',
      club_name: 'SNZ Test Club',
      location: 'Test Bay',
      date_start: '2027-06-01',
      date_end: '2027-06-01',
      status: 'active',
      scoring_mode: 'fish_bingo_individual', // isIndividual=true — skips Diver 2 / partner lookup
      categories: ['Open'],
      entry_fee_cents: 0,
    },
    {
      name: 'E2E Paid Fee Calculation Comp',
      club_name: 'SNZ Test Club',
      location: 'Test Bay',
      date_start: '2027-06-01',
      date_end: '2027-06-01',
      status: 'active',
      scoring_mode: 'fish_bingo_individual',
      categories: ['Open'],
      entry_fee_cents: 5000,
      category_fees: { Open: { standard: 5000, early_bird: 4000 } },
      early_bird_cutoff: '2099-01-01', // always in the future — early-bird tier is always active for this fixture
    },
  ]).select('id, name')
  if (compErr) throw compErr
  const FREE_COMP_ID = comps.find(c => c.name === 'E2E Free Solo Test Comp').id
  const PAID_COMP_ID = comps.find(c => c.name === 'E2E Paid Fee Calculation Comp').id

  // Pre-existing active+paid member for the login spec. Created via
  // admin API (not the signup form) so it has a confirmed auth user.
  const { data: authUser, error: authErr } = await sb.auth.admin.createUser({
    email: EXISTING_MEMBER_EMAIL,
    password: EXISTING_MEMBER_PASSWORD,
    email_confirm: true,
  })
  if (authErr) throw authErr

  const { error: memberErr } = await sb.from('members').insert({
    id: authUser.user.id,
    email: EXISTING_MEMBER_EMAIL,
    name: 'E2E Existing Member',
    phone: '+64211234567',
    gender: 'Prefer not to say',
    dob: '1990-01-01',
    emergency_contact: 'E2E Emergency Contact',
    emergency_phone: '+64217654321',
    fit_to_dive: true,
    membership_year: 2026,
    membership_expires: '2027-03-31',
    membership_status: 'active',
    membership_fee_cents: 1000,
    payment_status: 'paid',
    paid_at: new Date().toISOString(),
  })
  if (memberErr) throw memberErr

  const ids = { FREE_COMP_ID, PAID_COMP_ID, EXISTING_MEMBER_EMAIL, EXISTING_MEMBER_PASSWORD }
  console.log('Seed complete:', ids)
  return ids
}

// Allow `node tests/e2e/fixtures/seed.js` standalone, as well as being
// imported by global-setup.js.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  seed().catch(err => { console.error('Seed failed:', err); process.exit(1) })
}

export default seed
