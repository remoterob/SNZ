-- ─────────────────────────────────────────────────────────────────────────────
-- Lock down record_applications.
--
-- Previously every policy was `true` for role public, so anyone holding the
-- site's public anon key could read every applicant's name, address, phone and
-- DOB, and update or delete any application.
--
-- Now:
--   * Applicants must be signed in. Each row is owned by user_id (defaults to
--     auth.uid()), and an applicant can only insert, read, and edit their own
--     row — and only edit it while it is still a 'draft'.
--   * Records Admin reads/updates/deletes through
--     netlify/functions/record-applications-admin.js (service role, gated by
--     the server-side admin token), which bypasses RLS.
--   * Nothing is readable or writable by the anon role.
--
-- Deploy the matching app code (RecordApplication.jsx sign-in gate, Records
-- Admin via the function) BEFORE running this.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.record_applications
  add column if not exists user_id uuid default auth.uid();

drop policy if exists "Allow delete record_applications"              on public.record_applications;
drop policy if exists "Allow update record_applications"              on public.record_applications;
drop policy if exists "Anyone can submit record applications"         on public.record_applications;
drop policy if exists "Authenticated can read record applications"    on public.record_applications;
drop policy if exists "Authenticated can update record applications"  on public.record_applications;

alter table public.record_applications enable row level security;

create policy record_applications_insert_own on public.record_applications
  for insert to authenticated
  with check (user_id = auth.uid() and status in ('draft', 'submitted'));

create policy record_applications_select_own on public.record_applications
  for select to authenticated
  using (user_id = auth.uid());

create policy record_applications_update_own_draft on public.record_applications
  for update to authenticated
  using (user_id = auth.uid() and status = 'draft')
  with check (user_id = auth.uid() and status in ('draft', 'submitted'));

-- No delete policy: only Records Admin (service role) can delete.
