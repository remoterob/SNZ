// Netlify Function: admin for the Grassroots Spearo area (migration 045).
//
// The club map's public data lives on `clubs` and `grassroots_episodes`
// (public read). Private contacts and club submissions have NO public RLS
// policies, so this function — gated by an admin token (lib/adminAuth.js) and
// using the service-role key — is the only way to read or change them. Club and
// episode writes go through here too so they don't rely on open write policies.
//
// Actions (POST, dispatched on `action`):
//   list              — clubs + private contacts + episodes + submissions
//   saveClub          — insert/update a club's public fields and private contact
//   saveEpisode       — insert/update an episode
//   deleteEpisode     — remove an episode
//   updateSubmission  — status / admin notes / linked club

const { createClient } = require('@supabase/supabase-js')
const { requireAdmin } = require('./lib/adminAuth')

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

const CLUB_FIELDS = [
  'name', 'is_affiliated', 'active', 'contact_email', 'region', 'town', 'latitude', 'longitude',
  'about', 'website', 'facebook_url', 'instagram_url', 'logo_url', 'show_on_map', 'episode_coming_soon',
]
const SUBMISSION_STATUSES = ['new', 'in_review', 'editing', 'published', 'declined']

const blankToNull = (v) => (typeof v === 'string' && v.trim() === '' ? null : v)
const slugify = (s) => String(s || '').toLowerCase().trim()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'club'

// Accepts a bare 11-char ID or any common YouTube URL shape.
function youtubeId(input) {
  const s = String(input || '').trim()
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s
  const m = s.match(/(?:youtu\.be\/|v=|\/embed\/|\/shorts\/|\/live\/)([A-Za-z0-9_-]{11})/)
  return m ? m[1] : null
}

function pick(obj, fields) {
  const out = {}
  for (const f of fields) if (f in (obj || {})) out[f] = blankToNull(obj[f])
  return out
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' }

  let body
  try { body = JSON.parse(event.body || '{}') } catch { return json(400, { error: 'Bad request' }) }
  if (!requireAdmin(event, body)) return json(401, { error: 'Unauthorised' })

  const { action } = body
  try {
    if (action === 'list') {
      const [clubs, contacts, episodes, submissions] = await Promise.all([
        supabase.from('clubs').select('*').order('name'),
        supabase.from('grassroots_club_contacts').select('*'),
        supabase.from('grassroots_episodes').select('*').order('published_at', { ascending: false, nullsFirst: false }),
        supabase.from('grassroots_submissions').select('*').order('created_at', { ascending: false }),
      ])
      for (const r of [clubs, contacts, episodes, submissions]) if (r.error) throw r.error
      return json(200, {
        clubs: clubs.data, contacts: contacts.data, episodes: episodes.data, submissions: submissions.data,
      })
    }

    if (action === 'saveClub') {
      const club = body.club || {}
      const fields = pick(club, CLUB_FIELDS)
      if ('name' in fields && !fields.name) return json(400, { error: 'Club name is required' })
      for (const k of ['latitude', 'longitude']) {
        if (k in fields) fields[k] = fields[k] == null ? null : Number(fields[k])
        if (Number.isNaN(fields[k])) return json(400, { error: `${k} must be a number` })
      }
      fields.updated_at = new Date().toISOString()

      let id = club.id
      if (id) {
        const { error } = await supabase.from('clubs').update(fields).eq('id', id)
        if (error) throw error
      } else {
        if (!fields.name) return json(400, { error: 'Club name is required' })
        const base = slugify(fields.name)
        const { data: taken } = await supabase.from('clubs').select('slug').like('slug', `${base}%`)
        const used = new Set((taken || []).map(r => r.slug))
        let slug = base, n = 2
        while (used.has(slug)) slug = `${base}-${n++}`
        const { data, error } = await supabase.from('clubs')
          .insert({ is_affiliated: false, active: true, ...fields, slug }).select('id').single()
        if (error) throw error
        id = data.id
      }

      if (body.contact) {
        const c = pick(body.contact, ['contact_name', 'contact_email', 'contact_phone', 'notes'])
        const { error } = await supabase.from('grassroots_club_contacts')
          .upsert({ club_id: id, ...c, updated_at: new Date().toISOString() })
        if (error) throw error
      }
      return json(200, { ok: true, id })
    }

    if (action === 'saveEpisode') {
      const ep = body.episode || {}
      const vid = youtubeId(ep.youtube_video_id)
      if (!vid) return json(400, { error: 'Enter a YouTube link or video ID' })
      if (!ep.club_id) return json(400, { error: 'Pick the club this episode is about' })
      if (!String(ep.title || '').trim()) return json(400, { error: 'Episode title is required' })
      const row = {
        club_id: ep.club_id,
        youtube_video_id: vid,
        title: String(ep.title).trim(),
        summary: blankToNull(ep.summary),
        trip_leg: blankToNull(ep.trip_leg),
        published_at: blankToNull(ep.published_at),
        is_published: ep.is_published !== false,
        updated_at: new Date().toISOString(),
      }
      const q = ep.id
        ? supabase.from('grassroots_episodes').update(row).eq('id', ep.id).select('id').single()
        : supabase.from('grassroots_episodes').insert(row).select('id').single()
      const { data, error } = await q
      if (error) throw error
      return json(200, { ok: true, id: data.id })
    }

    if (action === 'deleteEpisode') {
      if (!body.id) return json(400, { error: 'id required' })
      const { error } = await supabase.from('grassroots_episodes').delete().eq('id', body.id)
      if (error) throw error
      return json(200, { ok: true })
    }

    if (action === 'updateSubmission') {
      if (!body.id) return json(400, { error: 'id required' })
      const patch = { updated_at: new Date().toISOString() }
      if ('status' in body) {
        if (!SUBMISSION_STATUSES.includes(body.status)) return json(400, { error: 'Bad status' })
        patch.status = body.status
      }
      if ('admin_notes' in body) patch.admin_notes = blankToNull(body.admin_notes)
      if ('club_id' in body) patch.club_id = body.club_id || null
      const { error } = await supabase.from('grassroots_submissions').update(patch).eq('id', body.id)
      if (error) throw error
      return json(200, { ok: true })
    }

    return json(400, { error: 'Unknown action' })
  } catch (e) {
    console.error('grassroots-admin error', e)
    return json(500, { error: e.message || 'Server error' })
  }
}
