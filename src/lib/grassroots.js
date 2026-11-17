// Shared helpers for the Grassroots Spearo area (migration 045).
import { supabase, adminToken } from './supabase'

export const NZ_REGIONS = [
  'Northland', 'Auckland', 'Waikato', 'Bay of Plenty', 'Gisborne', "Hawke's Bay", 'Taranaki',
  'Manawatū-Whanganui', 'Wellington', 'Tasman', 'Nelson', 'Marlborough', 'West Coast',
  'Canterbury', 'Otago', 'Southland', 'Chatham Islands',
]

export const NZ_CENTER = [-41.0, 173.5]

// OSM tile policy: use the single tile host (no a/b/c subdomains) and send a
// Referer. The site sets Referrer-Policy: no-referrer (netlify.toml), which OSM
// blocks with a 403 "Access blocked" tile — so every TileLayer must pass
// referrerPolicy="strict-origin-when-cross-origin" (sends only our origin).
export const OSM_TILES = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

// Bare 11-char ID or any common YouTube URL shape → video ID (or null).
export function youtubeId(input) {
  const s = String(input || '').trim()
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s
  const m = s.match(/(?:youtu\.be\/|v=|\/embed\/|\/shorts\/|\/live\/)([A-Za-z0-9_-]{11})/)
  return m ? m[1] : null
}

export const youtubeThumb = (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
export const youtubeEmbed = (id) => `https://www.youtube-nocookie.com/embed/${id}?rel=0`

const PUBLIC_CLUB_COLS =
  'id, name, slug, is_affiliated, active, contact_email, region, town, latitude, longitude, about, website, facebook_url, instagram_url, logo_url, show_on_map, episode_coming_soon'

// Public data for the map: active clubs flagged for the map, plus published episodes.
export async function loadGrassrootsPublic() {
  const [clubs, episodes] = await Promise.all([
    supabase.from('clubs').select(PUBLIC_CLUB_COLS).eq('active', true).eq('show_on_map', true).order('name'),
    supabase.from('grassroots_episodes')
      .select('id, club_id, youtube_video_id, title, summary, trip_leg, published_at')
      .order('published_at', { ascending: false, nullsFirst: false }),
  ])
  if (clubs.error) throw clubs.error
  if (episodes.error) throw episodes.error
  return { clubs: clubs.data || [], episodes: episodes.data || [] }
}

export async function grassrootsAdmin(action, payload = {}) {
  const res = await fetch('/.netlify/functions/grassroots-admin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminToken: adminToken(), action, ...payload }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
  return data
}

// Town → coordinates via OpenStreetMap Nominatim (admin use only, on demand).
export async function geocodeTown(town, region) {
  const q = [town, region, 'New Zealand'].filter(Boolean).join(', ')
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=nz&q=${encodeURIComponent(q)}`,
    { headers: { Accept: 'application/json' } }
  )
  if (!res.ok) throw new Error('Lookup failed')
  const [hit] = await res.json()
  if (!hit) return null
  return { latitude: Number(Number(hit.lat).toFixed(5)), longitude: Number(Number(hit.lon).toFixed(5)) }
}
