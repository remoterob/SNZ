-- Revert 042: restore the previous fully-open policies (NOT recommended —
-- exposes applicants' personal details to anyone with the anon key).
drop policy if exists record_applications_insert_own       on public.record_applications;
drop policy if exists record_applications_select_own       on public.record_applications;
drop policy if exists record_applications_update_own_draft on public.record_applications;

create policy "Anyone can submit record applications"        on public.record_applications for insert with check (true);
create policy "Authenticated can read record applications"   on public.record_applications for select using (true);
create policy "Authenticated can update record applications" on public.record_applications for update using (true);
create policy "Allow update record_applications"             on public.record_applications for update using (true);
create policy "Allow delete record_applications"             on public.record_applications for delete using (true);

-- user_id column is left in place (harmless).
