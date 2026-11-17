-- Grassroots: flag clubs whose episode is filmed / on the way, shown as an
-- amber "coming soon" pin on the map until a published episode exists.
alter table public.clubs add column if not exists episode_coming_soon boolean not null default false;
