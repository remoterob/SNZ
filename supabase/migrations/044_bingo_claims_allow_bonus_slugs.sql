-- 041_bingo_claims_allow_bonus_slugs.sql
-- Bonus claims are stored in bingo_claims with species_slug = a bingo_bonuses
-- slug (e.g. 'bonus-evergreen-big3'), but the original FK only allowed
-- bingo_species slugs, so every bonus claim failed with
-- "violates foreign key constraint bingo_claims_species_slug_fkey".
-- A FK can't reference two tables, so swap it for a trigger that accepts a
-- slug from either bingo_species or bingo_bonuses.

alter table bingo_claims drop constraint if exists bingo_claims_species_slug_fkey;

create or replace function bingo_claims_check_slug()
returns trigger
language plpgsql
as $$
begin
  if exists (select 1 from bingo_species where slug = new.species_slug)
     or exists (select 1 from bingo_bonuses where slug = new.species_slug) then
    return new;
  end if;
  raise exception 'Unknown species/bonus slug: %', new.species_slug
    using errcode = '23503';
end;
$$;

drop trigger if exists bingo_claims_check_slug on bingo_claims;
create trigger bingo_claims_check_slug
  before insert or update of species_slug on bingo_claims
  for each row execute function bingo_claims_check_slug();
