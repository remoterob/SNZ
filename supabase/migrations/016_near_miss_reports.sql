-- Vessel Near-Miss Survey — see snz-near-miss-brief.md for full context.
--
-- near_miss_reports is deliberately locked down harder than most tables in
-- this app: RLS allows INSERT for anyone (anon included — this is a public
-- survey, no login required) and SELECT only for a submitter's own rows.
-- There is NO admin-exception policy, because this app has no real
-- Supabase-level admin/committee role anywhere (every other "admin" screen
-- is a shared client-side password checked server-side in a Netlify
-- function using the service-role key — see refund-payment.js). Admin
-- moderation and the public aggregates figure both go through new
-- service-role Netlify functions instead of a relaxed RLS policy.
--
-- near_miss_rate_limit is a separate, fully-locked-down (no client
-- policies at all) table purely for the submit function's IP rate limit,
-- kept out of the sensitive report table so that table never stores IPs
-- and matches the brief's schema exactly.
--
-- Apply live via: npx supabase db query --linked -f supabase/migrations/016_near_miss_reports.sql

create table public.near_miss_reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  -- association (nullable: anonymous and non-member submissions are valid)
  user_id uuid references auth.users(id) on delete set null,
  submitted_as_member boolean not null default false,

  -- section 1: when & where
  time_band text not null,              -- enum below
  approx_month_year text,               -- free text, optional
  region text not null,
  location_name text not null,
  distance_from_shore text not null,
  latitude numeric(9,6),                -- optional, from map picker
  longitude numeric(9,6),

  -- section 2: what happened
  outcome text not null,                -- severity ladder
  closest_distance text not null,
  vessel_speed text not null,
  diver_position text not null,

  -- section 3: visibility
  visibility_gear text[] not null default '{}',
  vessel_saw_you text not null,
  vessel_type text not null,

  -- section 4: reporting (the critical section)
  reported_to text[] not null default '{}',
  not_reported_reasons text[] not null default '{}',
  report_outcome text,
  injury_level text not null,

  -- section 5: about the respondent
  years_experience text,
  days_per_year text,
  club_member text,
  free_text text,

  -- consent & contact
  contact_consent text not null,        -- 'named' | 'confidential' | 'anonymous'
  contact_email text,
  data_use_consent boolean not null default false,

  -- moderation
  status text not null default 'pending',  -- 'pending' | 'approved' | 'flagged' | 'removed'
  moderation_note text,

  -- anti-spam / integrity
  submission_source text default 'web'
);

create index near_miss_reports_region_idx on public.near_miss_reports (region);
create index near_miss_reports_location_idx on public.near_miss_reports (lower(location_name));
create index near_miss_reports_created_idx on public.near_miss_reports (created_at desc);
create index near_miss_reports_status_idx on public.near_miss_reports (status);

alter table public.near_miss_reports enable row level security;

create policy "Anyone can submit a near-miss report"
  on public.near_miss_reports for insert
  to anon, authenticated
  with check (true);

create policy "Submitters can read their own reports"
  on public.near_miss_reports for select
  using (auth.uid() = user_id);

-- Note on testing this policy: `INSERT ... RETURNING` (what PostgREST does
-- for `Prefer: return=representation`) requires the inserted row to ALSO
-- pass the SELECT policy's USING clause for the RETURNING projection to
-- succeed — an anonymous insert has user_id = NULL, and auth.uid() is also
-- NULL for an anon caller, so `NULL = NULL` isn't true and RETURNING fails
-- with the same generic "violates row-level security policy" error, even
-- though the INSERT itself succeeded. This is expected Postgres RLS
-- behaviour, not a broken policy — confirmed by testing with
-- `Prefer: return=minimal` (no error) vs `return=representation` (this
-- error) against the exact same payload. The real app never hits this: it
-- submits via near-miss-submit.js using the service-role key, which
-- bypasses RLS (including for RETURNING) entirely.

-- Deliberately no UPDATE/DELETE policy and no other SELECT policy — nobody
-- can read someone else's row, moderate, or delete via the client. Admin
-- moderation goes through netlify/functions/near-miss-admin.js (service role).

-- ── Rate limiting (internal only, near-miss-submit.js) ──────────────────

create table public.near_miss_rate_limit (
  id bigserial primary key,
  ip text not null,
  submitted_at timestamptz not null default now()
);

create index near_miss_rate_limit_ip_time_idx on public.near_miss_rate_limit (ip, submitted_at);

alter table public.near_miss_rate_limit enable row level security;
-- No policies at all — service role only, bypasses RLS entirely.
