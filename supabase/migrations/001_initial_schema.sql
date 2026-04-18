-- Catfish Cull 2026 Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Teams/Pairs Table
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_number INTEGER UNIQUE NOT NULL,
  division TEXT NOT NULL CHECK (division IN ('Open', 'Women', 'Juniors')),
  competitor1_name TEXT NOT NULL,
  competitor1_email TEXT NOT NULL,
  competitor2_name TEXT NOT NULL,
  competitor2_email TEXT NOT NULL,
  competitor3_name TEXT,
  competitor3_email TEXT,
  club TEXT,
  notes TEXT,
  checked_in BOOLEAN DEFAULT false,
  biosecurity_signed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Catches/Scores Table
CREATE TABLE catches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  catfish_count INTEGER NOT NULL CHECK (catfish_count >= 0),
  heaviest_fish_grams INTEGER CHECK (heaviest_fish_grams > 0),
  lightest_fish_grams INTEGER CHECK (lightest_fish_grams > 0),
  photo_urls TEXT[],
  status TEXT NOT NULL DEFAULT 'provisional' CHECK (status IN ('provisional', 'under_protest', 'confirmed', 'disqualified')),
  protest_notes TEXT,
  weighmaster_id TEXT,
  email_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Event State Table (single row)
CREATE TABLE event_state (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  status TEXT NOT NULL DEFAULT 'registration' CHECK (status IN ('registration', 'briefing', 'weighin', 'provisional', 'final')),
  protest_deadline TIME,
  prizegiving_time TIME,
  competition_date DATE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default event state
INSERT INTO event_state (status, protest_deadline, prizegiving_time, competition_date)
VALUES ('registration', '17:00', '18:30', '2026-02-14');

-- Create indexes for performance
CREATE INDEX idx_teams_division ON teams(division);
CREATE INDEX idx_teams_team_number ON teams(team_number);
CREATE INDEX idx_catches_team_id ON catches(team_id);
CREATE INDEX idx_catches_status ON catches(status);
CREATE INDEX idx_catches_created_at ON catches(created_at);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_catches_updated_at BEFORE UPDATE ON catches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_event_state_updated_at BEFORE UPDATE ON event_state
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE catches ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_state ENABLE ROW LEVEL SECURITY;

-- Public can read everything
CREATE POLICY "Public can read teams" ON teams
  FOR SELECT USING (true);

CREATE POLICY "Public can read catches" ON catches
  FOR SELECT USING (true);

CREATE POLICY "Public can read event_state" ON event_state
  FOR SELECT USING (true);

-- Admin users can do everything (authenticated users with admin role)
-- Note: You'll need to set up auth and user roles in Supabase
-- For now, we'll use a simple API key check in the application layer

-- Create a view for leaderboard with team details
CREATE OR REPLACE VIEW leaderboard AS
SELECT 
  c.id,
  c.team_id,
  t.team_number,
  t.division,
  CASE 
    WHEN t.competitor3_name IS NOT NULL AND t.competitor3_name != '' 
    THEN t.competitor1_name || ', ' || t.competitor2_name || ' & ' || t.competitor3_name
    ELSE t.competitor1_name || ' & ' || t.competitor2_name
  END as team_names,
  CASE 
    WHEN t.competitor3_name IS NOT NULL AND t.competitor3_name != '' THEN false
    ELSE true
  END as eligible,
  c.catfish_count,
  c.heaviest_fish_grams,
  c.lightest_fish_grams,
  c.photo_urls,
  c.status,
  c.created_at as weigh_in_time
FROM catches c
JOIN teams t ON c.team_id = t.id
ORDER BY c.catfish_count DESC;

-- Function to get heaviest fish leader
CREATE OR REPLACE FUNCTION get_heaviest_fish_leader()
RETURNS TABLE (
  team_id UUID,
  team_number INTEGER,
  team_names TEXT,
  weight_grams INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.team_id,
    l.team_number,
    l.team_names,
    l.heaviest_fish_grams
  FROM leaderboard l
  WHERE l.eligible = true 
    AND l.status != 'disqualified'
    AND l.heaviest_fish_grams IS NOT NULL
  ORDER BY l.heaviest_fish_grams DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to get lightest fish leader
CREATE OR REPLACE FUNCTION get_lightest_fish_leader()
RETURNS TABLE (
  team_id UUID,
  team_number INTEGER,
  team_names TEXT,
  weight_grams INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.team_id,
    l.team_number,
    l.team_names,
    l.lightest_fish_grams
  FROM leaderboard l
  WHERE l.eligible = true 
    AND l.status != 'disqualified'
    AND l.lightest_fish_grams IS NOT NULL
  ORDER BY l.lightest_fish_grams ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions on views and functions
GRANT SELECT ON leaderboard TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_heaviest_fish_leader() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_lightest_fish_leader() TO anon, authenticated;
