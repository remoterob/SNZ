-- Add per-category point overrides to comp_fish.
-- Used by 'fish_bingo' scoring mode in Other Competitions.
-- Stored as JSON: {"Open": 100, "Junior": 200, "Womens": 150}
-- null means "use the single points value for all categories".

alter table comp_fish
  add column if not exists category_points jsonb default null;
