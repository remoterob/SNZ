-- Record applications create a 'draft' row on the first photo upload, which can
-- happen before the weight has been entered. weight_kg NOT NULL rejected that
-- draft ("null value in column weight_kg violates not-null constraint").
-- The form still requires weight_kg before an application can be submitted.
alter table public.record_applications alter column weight_kg drop not null;
