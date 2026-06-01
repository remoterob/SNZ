-- Add skill level to comp team members
alter table comp_team_members
  add column if not exists skill_level text;
