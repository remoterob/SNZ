-- ─────────────────────────────────────────────────────────────────────────────
-- Per-event, pre/post team check-ins
--
-- comp_teams.checked_in is a single boolean: one check-in per team, full stop.
-- That can't express "checked in for the Open but not the Golden Oldie", or
-- "went out but hasn't checked back in" — the post-event head count that
-- actually matters for safety.
--
-- One row per (team, event, phase). Single-event comps like the Catfish Cull
-- use event_key = 'main'; Nationals uses the event ids already stored in
-- comp_teams.nationals_event ('open', 'juniors', 'goldenoldie', 'under23',
-- 'photography', 'finswim'). Women's and Silver Oldie are deliberately absent —
-- they're derived sub-divisions of the Open, so they check in with it.
--
-- comp_teams.checked_in is intentionally left in place and backfilled below:
-- CheckInDisplay.jsx and the comp-copilot function still read it.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists comp_checkins (
  id             uuid        primary key default gen_random_uuid(),
  competition_id bigint      not null references competitions(id) on delete cascade,
  team_id        bigint      not null references comp_teams(id)   on delete cascade,
  event_key      text        not null default 'main',
  phase          text        not null check (phase in ('pre', 'post')),
  checked_in_at  timestamptz not null default now(),
  checked_in_by  text,
  note           text,
  unique (team_id, event_key, phase)
);

create index if not exists comp_checkins_comp_event on comp_checkins (competition_id, event_key, phase);
create index if not exists comp_checkins_team       on comp_checkins (team_id);

-- RLS matches comp_boats / comp_teams: the comp admin screens use the anon key
-- behind an app-level password gate, so writes are open at the DB layer.
alter table comp_checkins enable row level security;

create policy "comp_checkins_public_read"
  on comp_checkins for select using (true);

create policy "comp_checkins_all_write"
  on comp_checkins for all using (true) with check (true);

-- Preserve existing check-ins as pre-event 'main' rows so nothing is lost.
insert into comp_checkins (competition_id, team_id, event_key, phase, checked_in_at)
select competition_id, id, 'main', 'pre', coalesce(checked_in_at, now())
from comp_teams
where checked_in = true
on conflict (team_id, event_key, phase) do nothing;
