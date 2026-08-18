-- ─────────────────────────────────────────────────────────────────────────────
-- Mailchimp audience sync
--
-- Members are created in three separate client-side paths (normal signup,
-- login profile recovery, and an invited partner accepting), and more could be
-- added later. Rather than wiring a call into each, this fires on the table
-- itself so every route — including admin edits in the Supabase dashboard — is
-- covered by one integration point that can't drift.
--
-- Delivery is via pg_net, which POSTs asynchronously: the member's signup is
-- never blocked or rolled back by Mailchimp being slow or down. The trade-off
-- is that a failed POST is not retried, so it's fire-and-forget — check the
-- Netlify function logs if a contact goes missing.
--
-- The endpoint URL and shared secret live in Supabase Vault, NOT in this file,
-- so the secret is never committed. Set them once (see below) before enabling.
-- ─────────────────────────────────────────────────────────────────────────────

create extension if not exists pg_net;

-- One-time setup, run separately with real values (kept out of version control):
--
--   select vault.create_secret(
--     'https://<your-site>.netlify.app/.netlify/functions/mailchimp-sync',
--     'mailchimp_sync_url', 'Endpoint for the Mailchimp member sync');
--   select vault.create_secret(
--     '<a long random string>',
--     'mailchimp_sync_secret', 'Shared secret matching MAILCHIMP_WEBHOOK_SECRET');
--
-- To rotate later: select vault.update_secret(id, new_value) for that name.

create or replace function public.sync_member_to_mailchimp()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  endpoint text;
  secret   text;
  payload  jsonb;
begin
  select decrypted_secret into endpoint from vault.decrypted_secrets where name = 'mailchimp_sync_url'    limit 1;
  select decrypted_secret into secret   from vault.decrypted_secrets where name = 'mailchimp_sync_secret' limit 1;

  -- Not configured yet: stay silent rather than breaking member signup.
  if endpoint is null or secret is null then
    return coalesce(new, old);
  end if;

  payload := jsonb_build_object(
    'type',       tg_op,
    'record',     case when tg_op = 'DELETE' then null else to_jsonb(new) end,
    'old_record', case when tg_op = 'INSERT' then null else to_jsonb(old) end
  );

  perform net.http_post(
    url     := endpoint,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', secret),
    body    := payload
  );

  return coalesce(new, old);
end;
$$;

drop trigger if exists on_member_changed_sync_mailchimp on public.members;

-- Column list on UPDATE keeps this from firing on unrelated churn (Stripe ids,
-- paid_at, updated_at), which would otherwise POST on every payment webhook.
create trigger on_member_changed_sync_mailchimp
  after insert or delete or update of
    email, name, club, region, experience, membership_year,
    cancelled_at, data_removal_requested_at
  on public.members
  for each row
  execute function public.sync_member_to_mailchimp();
