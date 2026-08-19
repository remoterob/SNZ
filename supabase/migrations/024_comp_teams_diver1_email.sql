-- ─────────────────────────────────────────────────────────────────────────────
-- diver1_email on comp_teams
--
-- Diver 2 and 3 have always stored an email alongside their member id, which is
-- what lets a non-member be entered and then linked back to the team when they
-- sign up. Diver 1 only ever had diver1_member_id, so an admin entering a team
-- for someone who hasn't joined yet had nowhere to record the lead diver — the
-- team saved with a null member id and nothing could ever reconnect them.
--
-- Additive and nullable; existing teams are untouched.
-- ─────────────────────────────────────────────────────────────────────────────

alter table comp_teams
  add column if not exists diver1_email text;

create index if not exists comp_teams_diver1_email on comp_teams (diver1_email);

-- Backfill from the linked member so existing teams get the column populated.
update comp_teams t
   set diver1_email = m.email
  from members m
 where t.diver1_member_id = m.id
   and t.diver1_email is null;

-- Keep diver1_email in step on a login-email change, as 020/021 already do for
-- diver 2 and diver 3.
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
  update public.comp_teams set diver1_email = new.email where diver1_member_id = new.id;
  update public.comp_teams set diver2_email = new.email where diver2_member_id = new.id;
  update public.comp_teams set diver3_email = new.email where diver3_member_id = new.id;

  return new;
end;
$$;
