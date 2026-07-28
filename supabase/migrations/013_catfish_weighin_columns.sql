-- Add weigh-in/results columns to comp_teams for count-based scoring
-- (Rosemergy Catfish Cull 2027, scoring_mode='catfish_count'), generic
-- enough for any future weigh-in-based competition of this shape.
--
-- Apply in the Supabase SQL editor (project zodqgekuackcrqyzluoo).
-- comp_teams already exists; these are purely additive nullable columns.

ALTER TABLE comp_teams ADD COLUMN IF NOT EXISTS catfish_count integer;
ALTER TABLE comp_teams ADD COLUMN IF NOT EXISTS heaviest_fish_grams integer;
ALTER TABLE comp_teams ADD COLUMN IF NOT EXISTS lightest_fish_grams integer;
ALTER TABLE comp_teams ADD COLUMN IF NOT EXISTS result_status text DEFAULT 'provisional';

-- competitions.scoring_mode has a CHECK constraint limiting it to the 4
-- modes CompAdmin.jsx's Setup tab already offers. Widen it (existing rows
-- are unaffected — this only adds a new allowed value) so the Catfish Cull
-- 2027 competition can use scoring_mode='catfish_count'.
ALTER TABLE competitions DROP CONSTRAINT IF EXISTS competitions_scoring_mode_check;
ALTER TABLE competitions ADD CONSTRAINT competitions_scoring_mode_check
  CHECK (scoring_mode IN ('standard', 'standard_self_submit', 'fish_bingo', 'fish_bingo_individual', 'catfish_count'));
