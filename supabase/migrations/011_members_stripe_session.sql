-- Add stripe_session_id to members for payment reconciliation.
--
-- Context: stripe-webhook.js has always tried to write this column, but it
-- never existed — PostgREST rejected the whole update, the error was never
-- checked, and Stripe got a 200 so it never retried. Membership payments were
-- only landing via the client-side ?payment=success fallback (June 2026).
--
-- Apply in the Supabase SQL editor (project zodqgekuackcrqyzluoo).
-- The webhook tolerates this column being absent, and starts recording
-- session ids automatically once it exists.

ALTER TABLE members ADD COLUMN IF NOT EXISTS stripe_session_id text;
