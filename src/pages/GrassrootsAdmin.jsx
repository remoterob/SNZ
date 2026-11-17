// Grassroots Spearo admin — clubs (map details + private contacts), episodes,
// and "want your club up here?" submissions. Everything goes through the
// grassroots-admin function (admin token), see migration 045.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { NZ_CENTER, NZ_REGIONS, geocodeTown, grassrootsAdmin, youtubeId, youtubeThumb } from '../lib/grassroots'

const SNZ_BLUE = '#2B6CB0'
const SNZ_DARK = '#1e3a5f'
const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300'
const STATUSES = [
  ['new', 'New', 'bg-amber-100 text-amber-800'],
  ['in_review', 'In review', 'bg-blue-100 text-blue-800'],
  ['editing', 'Editing', 'bg-purple-100 text-purple-800'],
  ['published', 'Published', 'bg-green-100 text-green-800'],
  ['declined', 'Declined', 'bg-gray-100 text-gray-600'],
]
const statusMeta = (s) => STATUSES.find(x => x[0] === s) || STATUSES[0]

const pin = L.divIcon({
  className: '',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
  html: `<svg width="28" height="28" viewBox="0 0 32 32"><path d="M16 31s11-10.2 11-17A11 11 0 0 0 5 14c0 6.8 11 17 11 17z" fill="${SNZ_BLUE}" stroke="#fff" stroke-width="2"/><circle cx="16" cy="14" r="4" fill="#fff"/></svg>`,
})

function Field({ label, hint, children, className = '' }) {
  return (
    <div className={className}>
      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

function ClickToPlace({ onPick }) {
  useMapEvents({ click: (e) => onPick(Number(e.latlng.lat.toFixed(5)), Number(e.latlng.lng.toFixed(5))) })
  return null
}

// ── Club editor ────────────────────────────────────────────────────────────────

const BLANK_CLUB = {
  name: '', is_affiliated: false, active: true, show_on_map: true, region: '', town: '',
  latitude: '', longitude: '', about: '', website: '', facebook_url: '', instagram_url: '',
  logo_url: '', contact_email: '',
}
const BLANK_CONTACT = { contact_name: '', contact_email: '', contact_phone: '', notes: '' }

function ClubEditor({ club, contact, onClose, onSaved }) {
  const [c, setC] = useState(() => {
    const base = { ...BLANK_CLUB }
    for (const k of Object.keys(base)) if (club?.[k] != null) base[k] = club[k]
    return { ...base, id: club?.id }
  })
  const [p, setP] = useState(() => ({ ...BLANK_CONTACT, ...Object.fromEntries(Object.entries(contact || {}).filter(([, v]) => v != null)) }))
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  const set = (k) => (e) => setC(x => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  const setPv = (k) => (e) => setP(x => ({ ...x, [k]: e.target.value }))
  const hasPos = c.latitude !== '' && c.longitude !== '' && c.latitude != null && c.longitude != null

  const lookup = async () => {
    if (!c.town) { setMsg('Enter a town first.'); return }
    setMsg('Looking up…')
    try {
      const hit = await geocodeTown(c.town, c.region)
      if (!hit) { setMsg(`Couldn't find "${c.town}". Click the map to place the pin instead.`); return }
      setC(x => ({ ...x, ...hit }))
      setMsg('Found — check the pin, and click the map to move it if needed.')
    } catch { setMsg('Lookup failed. Click the map to place the pin instead.') }
  }

  const save = async () => {
    if (!c.name.trim()) { setMsg('Club name is required.'); return }
    setBusy(true); setMsg(null)
    try {
      const { id: _omit, ...rest } = c
      const { id } = await grassrootsAdmin('saveClub', {
        club: { ...rest, id: c.id, latitude: hasPos ? c.latitude : null, longitude: hasPos ? c.longitude : null },
        contact: p,
      })
      await onSaved(id)
    } catch (e) { setMsg(e.message) } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-[1000] bg-black/40 flex items-start justify-center overflow-y-auto p-3 sm:p-6">
      <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-black text-gray-900">{c.id ? `Edit ${club.name}` : 'Add a club'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Club name"><input value={c.name} onChange={set('name')} className={inputCls} /></Field>
            <Field label="Public club email" hint="Shown on the map as “Contact the club”.">
              <input type="email" value={c.contact_email} onChange={set('contact_email')} className={inputCls} />
            </Field>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-700">
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={!!c.is_affiliated} onChange={set('is_affiliated')} /> SNZ affiliated</label>
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={!!c.active} onChange={set('active')} /> Active</label>
            <label className="flex items-center gap-1.5"><input type="checkbox" checked={!!c.show_on_map} onChange={set('show_on_map')} /> Show on Grassroots map</label>
          </div>
          <p className="text-xs text-gray-400 -mt-3">Affiliated and Active also drive Mudgeway and the membership club list.</p>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Region">
              <select value={c.region || ''} onChange={set('region')} className={inputCls}>
                <option value="">—</option>
                {NZ_REGIONS.map(r => <option key={r}>{r}</option>)}
              </select>
            </Field>
            <Field label="Town">
              <div className="flex gap-2">
                <input value={c.town || ''} onChange={set('town')} className={inputCls} />
                <button type="button" onClick={lookup} className="px-3 rounded-lg text-xs font-bold text-white whitespace-nowrap" style={{ background: SNZ_BLUE }}>
                  Find on map
                </button>
              </div>
            </Field>
          </div>

          <div>
            <div className="h-64 rounded-xl overflow-hidden border border-gray-200">
              <MapContainer
                center={hasPos ? [Number(c.latitude), Number(c.longitude)] : NZ_CENTER}
                zoom={hasPos ? 10 : 5}
                key={hasPos ? `${c.latitude},${c.longitude}` : 'none'}
                className="h-full w-full"
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
                <ClickToPlace onPick={(lat, lng) => setC(x => ({ ...x, latitude: lat, longitude: lng }))} />
                {hasPos && <Marker position={[Number(c.latitude), Number(c.longitude)]} icon={pin} />}
              </MapContainer>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-gray-500">
              <span>Click the map to place the pin.</span>
              <input value={c.latitude ?? ''} onChange={set('latitude')} placeholder="lat" className="border border-gray-300 rounded px-2 py-1 w-24" />
              <input value={c.longitude ?? ''} onChange={set('longitude')} placeholder="lng" className="border border-gray-300 rounded px-2 py-1 w-24" />
              {hasPos && <button type="button" onClick={() => setC(x => ({ ...x, latitude: '', longitude: '' }))} className="text-red-500 font-bold">Clear pin</button>}
            </div>
          </div>

          <Field label="About the club"><textarea rows={4} value={c.about || ''} onChange={set('about')} className={inputCls} /></Field>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Website"><input value={c.website || ''} onChange={set('website')} className={inputCls} /></Field>
            <Field label="Logo image URL"><input value={c.logo_url || ''} onChange={set('logo_url')} className={inputCls} /></Field>
            <Field label="Facebook"><input value={c.facebook_url || ''} onChange={set('facebook_url')} className={inputCls} /></Field>
            <Field label="Instagram"><input value={c.instagram_url || ''} onChange={set('instagram_url')} className={inputCls} /></Field>
          </div>

          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 space-y-3">
            <p className="text-xs font-black uppercase tracking-wider text-amber-800">Private contact — admins only, never shown publicly</p>
            <div className="grid sm:grid-cols-3 gap-3">
              <Field label="Name"><input value={p.contact_name} onChange={setPv('contact_name')} className={inputCls} /></Field>
              <Field label="Email"><input value={p.contact_email} onChange={setPv('contact_email')} className={inputCls} /></Field>
              <Field label="Phone"><input value={p.contact_phone} onChange={setPv('contact_phone')} className={inputCls} /></Field>
            </div>
            <Field label="Notes"><textarea rows={2} value={p.notes} onChange={setPv('notes')} className={inputCls} /></Field>
          </div>

          {msg && <p className="text-sm text-gray-600">{msg}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-bold text-gray-600 border border-gray-300">Cancel</button>
            <button onClick={save} disabled={busy} className="px-5 py-2 rounded-lg text-sm font-black text-white disabled:opacity-60" style={{ background: SNZ_BLUE }}>
              {busy ? 'Saving…' : 'Save club'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Episode editor ─────────────────────────────────────────────────────────────

function EpisodeEditor({ episode, clubs, onClose, onSaved }) {
  const [e, setE] = useState(() => ({
    id: episode?.id, club_id: episode?.club_id || '', youtube_video_id: episode?.youtube_video_id || '',
    title: episode?.title || '', summary: episode?.summary || '', trip_leg: episode?.trip_leg || '',
    published_at: episode?.published_at || '', is_published: episode?.is_published ?? true,
  }))
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const set = (k) => (ev) => setE(x => ({ ...x, [k]: ev.target.type === 'checkbox' ? ev.target.checked : ev.target.value }))
  const vid = youtubeId(e.youtube_video_id)

  const save = async () => {
    setBusy(true); setMsg(null)
    try {
      await grassrootsAdmin('saveEpisode', { episode: { ...e, club_id: Number(e.club_id) || null } })
      onSaved()
    } catch (err) { setMsg(err.message) } finally { setBusy(false) }
  }

  return (
    <div className="fixed inset-0 z-[1000] bg-black/40 flex items-start justify-center overflow-y-auto p-3 sm:p-6">
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-black text-gray-900">{e.id ? 'Edit episode' : 'Add an episode'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
        </div>
        <div className="p-5 space-y-4">
          <Field label="Club">
            <select value={e.club_id} onChange={set('club_id')} className={inputCls}>
              <option value="">Choose…</option>
              {clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="YouTube link or video ID">
            <input value={e.youtube_video_id} onChange={set('youtube_video_id')} className={inputCls} placeholder="https://youtu.be/…" />
          </Field>
          {vid && <img src={youtubeThumb(vid)} alt="" className="w-48 rounded-lg" />}
          <Field label="Title"><input value={e.title} onChange={set('title')} className={inputCls} /></Field>
          <Field label="Summary"><textarea rows={3} value={e.summary} onChange={set('summary')} className={inputCls} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Published on YouTube"><input type="date" value={e.published_at} onChange={set('published_at')} className={inputCls} /></Field>
            <Field label="Trip leg" hint="e.g. 2026 road trip"><input value={e.trip_leg} onChange={set('trip_leg')} className={inputCls} /></Field>
          </div>
          <label className="flex items-center gap-1.5 text-sm text-gray-700">
            <input type="checkbox" checked={e.is_published} onChange={set('is_published')} /> Visible on the hub
          </label>
          {msg && <p className="text-sm text-red-600">{msg}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-bold text-gray-600 border border-gray-300">Cancel</button>
            <button onClick={save} disabled={busy} className="px-5 py-2 rounded-lg text-sm font-black text-white disabled:opacity-60" style={{ background: SNZ_BLUE }}>
              {busy ? 'Saving…' : 'Save episode'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Submission card ────────────────────────────────────────────────────────────

function SubmissionCard({ s, clubs, onChanged, onMakeClub }) {
  const [notes, setNotes] = useState(s.admin_notes || '')
  const [busy, setBusy] = useState(false)
  const [, label, cls] = statusMeta(s.status)
  const linked = clubs.find(c => c.id === s.club_id)

  const patch = async (p) => {
    setBusy(true)
    try { await grassrootsAdmin('updateSubmission', { id: s.id, ...p }); onChanged() }
    catch (e) { alert(e.message) } finally { setBusy(false) }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5">
      <div className="flex flex-wrap items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-black text-gray-900">{s.club_name}</p>
          <p className="text-xs text-gray-500">{[s.town, s.region].filter(Boolean).join(', ')} · {new Date(s.created_at).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
        </div>
        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${cls}`}>{label}</span>
      </div>
      <p className="text-sm text-gray-700 mt-2">
        {s.contact_name} · <a href={`mailto:${s.contact_email}`} className="font-bold" style={{ color: SNZ_BLUE }}>{s.contact_email}</a>
        {s.contact_phone && <> · {s.contact_phone}</>}
      </p>
      {s.notes && <p className="text-sm text-gray-600 mt-2 whitespace-pre-line bg-gray-50 rounded-lg p-2.5">{s.notes}</p>}
      {s.video_links?.length > 0 && (
        <ul className="mt-2 space-y-1">
          {s.video_links.map(l => (
            <li key={l} className="text-sm truncate">▶ <a href={l} target="_blank" rel="noopener noreferrer" style={{ color: SNZ_BLUE }}>{l}</a></li>
          ))}
        </ul>
      )}
      <div className="mt-3 grid sm:grid-cols-2 gap-3">
        <Field label="Status">
          <select value={s.status} disabled={busy} onChange={e => patch({ status: e.target.value })} className={inputCls}>
            {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        <Field label="Club on the map">
          <div className="flex gap-2">
            <select value={s.club_id || ''} disabled={busy} onChange={e => patch({ club_id: Number(e.target.value) || null })} className={inputCls}>
              <option value="">Not linked</option>
              {clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {!linked && (
              <button onClick={() => onMakeClub(s)} className="px-3 rounded-lg text-xs font-bold text-white whitespace-nowrap" style={{ background: SNZ_BLUE }}>
                + New club
              </button>
            )}
          </div>
        </Field>
      </div>
      <Field label="Admin notes" className="mt-3">
        <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} onBlur={() => notes !== (s.admin_notes || '') && patch({ admin_notes: notes })} className={inputCls} />
      </Field>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function GrassrootsAdmin() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('clubs')
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [editClub, setEditClub] = useState(null)       // {club, contact} | null
  const [editEpisode, setEditEpisode] = useState(null) // episode | {} | null
  const [subFilter, setSubFilter] = useState('open')

  const load = useCallback(() => {
    grassrootsAdmin('list').then(setData).catch(e => setError(e.message))
  }, [])
  useEffect(() => { load() }, [load])

  const clubs = data?.clubs || []
  const contactsById = useMemo(() => new Map((data?.contacts || []).map(c => [c.club_id, c])), [data])
  const epCount = useMemo(() => {
    const m = new Map()
    for (const e of data?.episodes || []) m.set(e.club_id, (m.get(e.club_id) || 0) + 1)
    return m
  }, [data])
  const clubName = (id) => clubs.find(c => c.id === id)?.name || '—'

  const subs = (data?.submissions || []).filter(s =>
    subFilter === 'all' ? true : subFilter === 'open' ? !['published', 'declined'].includes(s.status) : s.status === subFilter)
  const newSubs = (data?.submissions || []).filter(s => s.status === 'new').length

  const deleteEpisode = async (ep) => {
    if (!window.confirm(`Delete "${ep.title}"?`)) return
    try { await grassrootsAdmin('deleteEpisode', { id: ep.id }); load() } catch (e) { alert(e.message) }
  }

  const makeClubFromSubmission = (s) => setEditClub({
    fromSubmission: s.id,
    club: { name: s.club_name, region: s.region, town: s.town, active: true, show_on_map: true, is_affiliated: false },
    contact: { contact_name: s.contact_name, contact_email: s.contact_email, contact_phone: s.contact_phone },
  })

  const placed = clubs.filter(c => c.latitude != null).length

  return (
    <div className="min-h-screen bg-gray-50">
      <div style={{ background: SNZ_DARK }} className="px-4 sm:px-6 py-3 flex items-center justify-between gap-2">
        <button onClick={() => navigate('/admin')}
          className="text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg">← Admin</button>
        <span className="text-white font-black text-sm">Grassroots Spearo admin</span>
        <button onClick={() => navigate('/grassroots')}
          className="text-xs font-bold text-white bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg">View page ↗</button>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 w-fit">
          {[['clubs', `Clubs (${clubs.length})`], ['episodes', `Episodes (${data?.episodes?.length || 0})`], ['submissions', `Submissions${newSubs ? ` · ${newSubs} new` : ''}`]].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-3 sm:px-4 py-2 rounded-lg text-sm font-bold ${tab === k ? 'text-white' : 'text-gray-600'}`}
              style={tab === k ? { background: SNZ_BLUE } : undefined}>{l}</button>
          ))}
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}{/nauthor/i.test(error) && ' — sign in again from the admin login.'}</p>}
        {!data && !error && <p className="text-sm text-gray-400">Loading…</p>}

        {data && tab === 'clubs' && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm text-gray-600 mr-auto">{placed} of {clubs.length} clubs have a map position.</p>
              <button onClick={() => setEditClub({ club: null, contact: null })}
                className="px-4 py-2 rounded-lg text-sm font-black text-white" style={{ background: SNZ_BLUE }}>+ Add club</button>
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl divide-y divide-gray-100">
              {clubs.map(c => {
                const onMap = c.active && c.show_on_map && c.latitude != null
                return (
                  <button key={c.id} onClick={() => setEditClub({ club: c, contact: contactsById.get(c.id) })}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 flex flex-wrap items-center gap-2">
                    <span className="flex-1 min-w-[180px]">
                      <span className="block font-bold text-sm text-gray-900">{c.name}</span>
                      <span className="block text-xs text-gray-500">{[c.town, c.region].filter(Boolean).join(', ') || 'No location yet'}</span>
                    </span>
                    {c.is_affiliated && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">Affiliated</span>}
                    {!c.active && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Inactive</span>}
                    {epCount.get(c.id) > 0 && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">▶ {epCount.get(c.id)}</span>}
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${onMap ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                      {onMap ? 'On map' : c.latitude == null ? 'Needs location' : 'Hidden'}
                    </span>
                  </button>
                )
              })}
            </div>
          </>
        )}

        {data && tab === 'episodes' && (
          <>
            <div className="flex justify-end">
              <button onClick={() => setEditEpisode({})}
                className="px-4 py-2 rounded-lg text-sm font-black text-white" style={{ background: SNZ_BLUE }}>+ Add episode</button>
            </div>
            {data.episodes.length === 0 && <p className="text-sm text-gray-400">No episodes yet.</p>}
            <div className="space-y-2">
              {data.episodes.map(ep => (
                <div key={ep.id} className="bg-white border border-gray-200 rounded-2xl p-3 flex items-center gap-3">
                  <img src={youtubeThumb(ep.youtube_video_id)} alt="" className="w-28 aspect-video object-cover rounded-lg shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-gray-900 truncate">{ep.title}</p>
                    <p className="text-xs text-gray-500">{clubName(ep.club_id)}{ep.published_at ? ` · ${ep.published_at}` : ''}{!ep.is_published ? ' · hidden' : ''}</p>
                  </div>
                  <button onClick={() => setEditEpisode(ep)} className="text-sm font-bold px-2" style={{ color: SNZ_BLUE }}>Edit</button>
                  <button onClick={() => deleteEpisode(ep)} className="text-sm font-bold px-2 text-red-500">Delete</button>
                </div>
              ))}
            </div>
          </>
        )}

        {data && tab === 'submissions' && (
          <>
            <select value={subFilter} onChange={e => setSubFilter(e.target.value)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="open">Open (not published or declined)</option>
              <option value="all">All</option>
              {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            {subs.length === 0 && <p className="text-sm text-gray-400">Nothing here.</p>}
            <div className="space-y-3">
              {subs.map(s => <SubmissionCard key={s.id} s={s} clubs={clubs} onChanged={load} onMakeClub={makeClubFromSubmission} />)}
            </div>
          </>
        )}
      </div>

      {editClub && (
        <ClubEditor club={editClub.club} contact={editClub.contact}
          onClose={() => setEditClub(null)}
          onSaved={async (id) => {
            // A club created from a submission gets linked back to it.
            if (editClub.fromSubmission && id) {
              await grassrootsAdmin('updateSubmission', { id: editClub.fromSubmission, club_id: id }).catch(() => {})
            }
            setEditClub(null); load()
          }} />
      )}
      {editEpisode && (
        <EpisodeEditor episode={editEpisode} clubs={clubs}
          onClose={() => setEditEpisode(null)} onSaved={() => { setEditEpisode(null); load() }} />
      )}
    </div>
  )
}
