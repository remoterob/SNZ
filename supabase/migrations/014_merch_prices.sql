-- Add merch_prices column to competitions.
-- The merch feature (merch_enabled, merch_types, merch_sizes, merch_cutoff)
-- already exists on the live DB, but merch_prices (per-type price in cents,
-- keyed by merch type e.g. {"tshirt": 3000, "jacket": 5000}) was never added,
-- causing CompAdmin.jsx save to fail with "Could not find the 'merch_prices'
-- column of 'competitions' in the schema cache".
--
-- Apply in the Supabase SQL editor (project zodqgekuackcrqyzluoo).

ALTER TABLE competitions ADD COLUMN IF NOT EXISTS merch_prices jsonb DEFAULT '{}'::jsonb;
