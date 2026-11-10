-- Revert 043. Multi-category records collapse back to their first division.
alter table public.record_applications drop column if exists published_record_id;
drop trigger if exists nz_records_sync_division on public.nz_records;
drop function if exists public.nz_records_sync_division();
drop index if exists public.nz_records_divisions_idx;
alter table public.nz_records drop column if exists divisions;
