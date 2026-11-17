-- 045_grassroots.sql
-- Grassroots Spearo area: club map, episodes, and "want your club up here?"
-- submissions. See the Grassroots Spearo Map build brief.
--
-- Decisions baked in here:
-- * One club list — extend the existing `clubs` register (used by Mudgeway and
--   the membership dropdown) rather than creating a second clubs table.
--   Unaffiliated clubs are allowed on the map.
-- * `clubs` is publicly readable (clubs_public_read), so only PUBLIC fields go
--   on it. Personal contact names/phones go in grassroots_club_contacts, which
--   has no policies at all → only the service role (netlify grassroots-admin
--   function) can read or write it.
-- * Episodes get their own table so a club can have more than one.
-- * Club footage arrives as YouTube links, so submissions store URLs, not files.

-- ── clubs: public map fields ────────────────────────────────────────────────
alter table clubs add column if not exists region        text;
alter table clubs add column if not exists town          text;
alter table clubs add column if not exists latitude      double precision;
alter table clubs add column if not exists longitude     double precision;
alter table clubs add column if not exists about         text;
alter table clubs add column if not exists website       text;
alter table clubs add column if not exists facebook_url  text;
alter table clubs add column if not exists instagram_url text;
alter table clubs add column if not exists logo_url      text;
-- Lets admins keep a club in the register (Mudgeway, membership) but off the map.
alter table clubs add column if not exists show_on_map   boolean not null default true;

-- ── private contacts (admin only) ───────────────────────────────────────────
create table if not exists grassroots_club_contacts (
  club_id       bigint primary key references clubs(id) on delete cascade,
  contact_name  text,
  contact_email text,
  contact_phone text,
  notes         text,
  updated_at    timestamptz not null default now()
);
alter table grassroots_club_contacts enable row level security;
-- (no policies: service role only)

-- ── episodes ────────────────────────────────────────────────────────────────
create table if not exists grassroots_episodes (
  id               uuid primary key default gen_random_uuid(),
  club_id          bigint not null references clubs(id) on delete cascade,
  youtube_video_id text   not null,
  title            text   not null,
  summary          text,
  trip_leg         text,
  published_at     date,
  is_published     boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists grassroots_episodes_club on grassroots_episodes (club_id);
create index if not exists grassroots_episodes_pub  on grassroots_episodes (published_at desc);

alter table grassroots_episodes enable row level security;
drop policy if exists grassroots_episodes_public_read on grassroots_episodes;
create policy grassroots_episodes_public_read on grassroots_episodes
  for select using (is_published);
-- writes: service role only (grassroots-admin function)

-- ── submissions ─────────────────────────────────────────────────────────────
create table if not exists grassroots_submissions (
  id             uuid primary key default gen_random_uuid(),
  club_id        bigint references clubs(id) on delete set null,
  club_name      text not null,
  contact_name   text not null,
  contact_email  text not null,
  contact_phone  text,
  region         text,
  town           text,
  video_links    text[] not null default '{}',
  notes          text,
  status         text not null default 'new'
                   check (status in ('new', 'in_review', 'editing', 'published', 'declined')),
  admin_notes    text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index if not exists grassroots_submissions_status on grassroots_submissions (status, created_at desc);

alter table grassroots_submissions enable row level security;
-- No public policies: inserts go through the grassroots-submit function (which
-- also sends the confirmation email); reads/updates through grassroots-admin.
