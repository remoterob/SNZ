-- Boats for competitions
create table if not exists comp_boats (
  id uuid primary key default gen_random_uuid(),
  competition_id bigint not null references competitions(id) on delete cascade,
  boat_name text not null,
  skipper_name text,
  created_at timestamptz default now()
);

-- Link teams to boats and add check-in fields
alter table comp_teams
  add column if not exists boat_id uuid references comp_boats(id) on delete set null,
  add column if not exists checked_in boolean not null default false,
  add column if not exists checked_in_at timestamptz;
