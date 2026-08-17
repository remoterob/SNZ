-- ─────────────────────────────────────────────────────────────────────────────
-- Keep members.email in sync with auth.users.email
--
-- Members change their login email via Supabase Auth (supabase.auth.updateUser),
-- which only applies once they click the confirmation link in their inbox —
-- there is no reliable client-side moment to update the app's own copy. Since
-- ~12 lookup paths read members.email (signup dedupe, buddy lookup, comp
-- registration, admin search), a drifted copy silently breaks them.
--
-- This trigger closes that gap for every path at once: the native email-change
-- flow, an admin edit in the Supabase dashboard, or a service-role call.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.sync_member_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.members set email = new.email where id = new.id;

  -- comp_teams.diver2_email is live state (invite matching + admin lists), and
  -- diver2_member_id gives an unambiguous link back to this user. Other tables
  -- holding an email (comp_team_members, leaderboard, teams, record_applications)
  -- are point-in-time entry snapshots with no member link — deliberately left
  -- untouched so historical records keep the address used at the time.
  update public.comp_teams set diver2_email = new.email where diver2_member_id = new.id;

  return new;
end;
$$;

drop trigger if exists on_auth_user_email_changed on auth.users;

create trigger on_auth_user_email_changed
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function public.sync_member_email();
