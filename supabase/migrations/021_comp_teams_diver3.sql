-- ─────────────────────────────────────────────────────────────────────────────
-- Third diver support on comp_teams
--
-- The Catfish Cull allows teams of 3, but comp_teams only modelled two divers —
-- the third competitor existed solely as a comp_team_members row with no member
-- link, no invite and no confirmation state. Mirrors the diver2_* columns so a
-- trio's third diver goes through the same lookup → invite → confirm flow.
--
-- Purely additive: every column is nullable with no default backfill, so
-- existing pairs (Nationals and past Catfish teams) are unaffected.
-- ─────────────────────────────────────────────────────────────────────────────

alter table comp_teams
  add column if not exists diver3_email          text,
  add column if not exists diver3_member_id      uuid references members(id),
  add column if not exists diver3_accepted_at    timestamptz,
  add column if not exists diver3_payment_status text,
  add column if not exists diver3_invite_sent    boolean default false,
  add column if not exists merch_d3              jsonb;

create index if not exists comp_teams_diver3_member on comp_teams (diver3_member_id);

-- Keep diver3_email in sync on a login-email change, matching the diver2 rule
-- established in 020_sync_member_email.sql.
create or replace function public.sync_member_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.members set email = new.email where id = new.id;

  -- comp_teams diver emails are live state (invite matching + admin lists), and
  -- diverN_member_id gives an unambiguous link back to this user. Other tables
  -- holding an email (comp_team_members, leaderboard, teams, record_applications)
  -- are point-in-time entry snapshots with no member link — deliberately left
  -- untouched so historical records keep the address used at the time.
  update public.comp_teams set diver2_email = new.email where diver2_member_id = new.id;
  update public.comp_teams set diver3_email = new.email where diver3_member_id = new.id;

  return new;
end;
$$;
