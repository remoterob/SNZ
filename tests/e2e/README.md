# E2E tests (Playwright)

Phase 1 regression coverage for the golden paths that have actually broken
in production: membership signup/login, the auth-gate redirect bug (see
`auth-gate-redirect.spec.js`), free competition registration, and paid-comp
fee calculation.

## One-time setup

1. Install [Docker Desktop](https://docs.docker.com/desktop/) — Supabase's
   local dev stack runs in Docker containers.
2. `npx playwright install chromium` (already run once during initial setup,
   only needed again after a Playwright version bump).

## Running the tests

```
npx supabase start   # spins up local Postgres/Auth — leave running
npm run test:e2e
```

`supabase start` is idempotent — safe to leave running across a whole work
session rather than starting/stopping it per test run. `npm run test:e2e`
seeds the local DB fresh (see `fixtures/seed.js`) before every run via
Playwright's `globalSetup`, so tests are repeatable regardless of what
was left over from a previous run.

`npm run test:e2e:ui` opens Playwright's UI mode for debugging a failing
spec interactively.

## Regenerating the schema fixture

`fixtures/schema-snapshot.sql` is a one-time dump of the *real* production
schema — required because `supabase/migrations/` is known to be incomplete
(the `members` table, for one, was created directly in the Supabase
dashboard and was never captured in a migration). If you add/change columns
in production, refresh the fixture:

```
npm run test:e2e:sync-schema
```

This requires Docker (the Supabase CLI shells out to a Dockerized
`pg_dump`) and the project already being linked (`npx supabase link
--project-ref zodqgekuackcrqyzluoo`).

## Explicit non-goals of this pass

- **No CI** — these run locally only for now.
- **No real Stripe calls** — `useStripeCheckout` does a full-page redirect
  to Stripe's hosted Checkout, and there are no Stripe test-mode keys set up
  anywhere in this repo yet. `fee-calculation.spec.js` intercepts the
  browser's `fetch('/.netlify/functions/create-checkout-session')` call
  instead of letting it reach Stripe, so it verifies fee/early-bird
  calculation logic without needing test keys or `netlify dev`. Full
  Stripe-webhook / `verify-checkout-session` coverage is a natural follow-up
  once test-mode keys exist, not built here.
- **No Vitest / unit tests** — `scripts/test-scoring-synthetic.mjs` (pure
  Nationals scoring logic) is a good candidate to migrate to a proper test
  runner later, but that's a separate, cheaper piece of work than this one.
