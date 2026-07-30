-- Prevent duplicate team registrations at the database level.
--
-- The application already checks for an existing team before inserting
-- (see NationalsRegister.jsx handleSubmit), but that's a SELECT-then-INSERT
-- check with a time-of-check-to-time-of-use race — two near-simultaneous
-- submissions (two tabs, a very fast double-click) could still both pass it.
-- A partial unique index makes duplicates structurally impossible instead of
-- just unlikely. Withdrawn teams are excluded so a member can re-register
-- after withdrawing.
--
-- Apply in the Supabase SQL editor (project zodqgekuackcrqyzluoo), or via
-- `npx supabase db query --linked -f supabase/migrations/015_comp_teams_one_per_diver1.sql`.
-- Verified against live data first — no existing rows violate this.

CREATE UNIQUE INDEX IF NOT EXISTS comp_teams_one_per_diver1_per_comp
  ON comp_teams (competition_id, diver1_member_id)
  WHERE withdrawn_at IS NULL AND diver1_member_id IS NOT NULL;
