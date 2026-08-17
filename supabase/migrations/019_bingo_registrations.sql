-- ─────────────────────────────────────────────────────────────────────────────
-- Fish Bingo competition registration — SNZ app
-- One row per member per season. Members must register (home region, spearo
-- experience, rules acceptance) before they can submit claims.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists bingo_registrations (
  id                uuid        primary key default gen_random_uuid(),
  user_id           uuid        not null references auth.users(id) on delete cascade,
  comp_season       text        not null,
  region            text        not null,
  experience        text        not null,
  rules_accepted_at timestamptz not null default now(),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (user_id, comp_season)
);

create index if not exists bingo_registrations_user_season on bingo_registrations (user_id, comp_season);

-- Reuses bingo_set_updated_at() defined in 002_bingo_tables.sql
create or replace trigger bingo_registrations_updated_at
  before update on bingo_registrations
  for each row execute function bingo_set_updated_at();

alter table bingo_registrations enable row level security;

-- Members can only read/write their own registration row.
create policy "bingo_registrations_read_own"
  on bingo_registrations for select
  using (auth.uid() = user_id);

create policy "bingo_registrations_insert_own"
  on bingo_registrations for insert
  with check (auth.uid() = user_id);

create policy "bingo_registrations_update_own"
  on bingo_registrations for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
