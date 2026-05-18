-- Pre-competition registration for Big Fish
-- Lets members register their intent before the comp opens (submissions gated by comp dates)
create table if not exists bigfish_registrations (
  id            uuid        primary key default gen_random_uuid(),
  comp_id       uuid        not null references bigfish_comps(id) on delete cascade,
  user_id       uuid        not null references auth.users(id) on delete cascade,
  display_name  text        not null,
  registered_at timestamptz not null default now(),
  unique (comp_id, user_id)
);

alter table bigfish_registrations enable row level security;
create policy "bigfish_regs_public_read" on bigfish_registrations for select using (true);
create policy "bigfish_regs_insert"      on bigfish_registrations for insert with check (auth.uid() = user_id);
create policy "bigfish_regs_delete"      on bigfish_registrations for delete using (auth.uid() = user_id);
