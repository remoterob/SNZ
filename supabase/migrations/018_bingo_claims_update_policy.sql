-- bingo_claims had insert/delete/public-read policies but no update policy
-- (see migration 002_bingo_tables.sql), so attaching a photo to an existing
-- claim (src/pages/bingo/BingoPlayPage.jsx's uploadPhoto) was silently
-- rejected by RLS — the file uploaded to storage fine, but the
-- photo_url/thumb_url update to the claim row itself affected 0 rows.

create policy "bingo_claims_update_own"
  on bingo_claims for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
