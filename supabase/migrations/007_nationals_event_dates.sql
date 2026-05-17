-- Add per-sub-event date storage to competitions table
ALTER TABLE competitions ADD COLUMN IF NOT EXISTS event_dates JSONB DEFAULT '{}'::jsonb;
