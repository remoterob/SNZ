-- 043: NZ records can count for several categories at once, and record
-- applications can be published straight into nz_records.
--
-- * nz_records.divisions text[] — every category the record stands in
--   (e.g. {Open,Women's,Junior U18}). Backfilled from the old single
--   `division` column, which is kept (= divisions[1]) so older queries such
--   as `division = 'Meritorious'` keep working. A trigger keeps them in sync.
-- * record_applications.published_record_id — the nz_records row created by
--   "Publish" in Records Admin (cleared automatically if that row is deleted).

alter table public.nz_records add column if not exists divisions text[];
update public.nz_records set divisions = array[division] where divisions is null or cardinality(divisions) = 0;
alter table public.nz_records alter column divisions set default '{}';

create or replace function public.nz_records_sync_division()
returns trigger language plpgsql as $$
begin
  if new.divisions is null or cardinality(new.divisions) = 0 then
    new.divisions := array[new.division];
  else
    new.division := new.divisions[1];
  end if;
  return new;
end $$;

drop trigger if exists nz_records_sync_division on public.nz_records;
create trigger nz_records_sync_division
  before insert or update on public.nz_records
  for each row execute function public.nz_records_sync_division();

create index if not exists nz_records_divisions_idx on public.nz_records using gin (divisions);

alter table public.record_applications
  add column if not exists published_record_id bigint
  references public.nz_records(id) on delete set null;
