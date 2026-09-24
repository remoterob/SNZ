import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { clearAdminSession } from '../lib/supabase'
import { toCSV, downloadCSV } from '../lib/csvExport'

const SNZ_BLUE = '#2B6CB0'
const API = '/.netlify/functions/dev-squad-admin'

const STATUSES = [
  { value: 'submitted',   label: 'Submitted',   cls: 'bg-gray-100 text-gray-700 border-gray-200' },
  { value: 'shortlisted', label: 'Shortlisted', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'interviewed', label: 'Interviewed', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { value: 'trialling',   label: 'Trialling',   cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'selected',    label: 'Selected',    cls: 'bg-green-50 text-green-700 border-green-200' },
  { value: 'declined',    label: 'Declined',    cls: 'bg-red-50 text-red-600 border-red-200' },
]
const statusMeta = v => STATUSES.find(s => s.value === v) || STATUSES[0]

const ageFrom = (dob) => {
  if (!dob) return ''
  const d = new Date(dob)
  if (isNaN(d)) return ''
  const now = new Date()
  let a = now.getFullYear() - d.getFullYear()
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) a--
  return a
}

const fmtDate = iso => iso ? new Date(iso).toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' }) : ''
const compsText = list => (list || []).map(c =>
  [c.name, c.year, c.placing && `${c.placing}`, c.partner && `with ${c.partner}`].filter(Boolean).join(' · ')
).join(' | ')
const tripsText = list => (list || []).map(t =>
  [t.location, t.when, t.duration].filter(Boolean).join(' · ')
).join(' | ')

// Flat, Excel-friendly. Nested JSON is collapsed to one readable cell each.
const EXPORT_COLUMNS = [
  { label: 'Submitted',            value: r => fmtDate(r.created_at) },
  { label: 'Status',               value: r => statusMeta(r.status).label },
  { label: 'Name',                 key: 'full_name' },
  { label: 'DOB',                  key: 'dob' },
  { label: 'Age',                  value: r => ageFrom(r.dob) },
  { label: 'Email',                key: 'email' },
  { label: 'Phone',                key: 'phone' },
  { label: 'Suburb & City',        key: 'suburb_city' },
  { label: 'SNZ member',           value: r => r.submitted_as_member ? 'Yes' : 'No' },
  { label: 'Max depth (m)',        key: 'max_depth_m' },
  { label: 'Comfortable depth (m)', key: 'comfortable_depth_m' },
  { label: 'Max breath-hold (s)',  key: 'max_breath_hold_sec' },
  { label: 'Comfortable breath-hold (s)', key: 'comfortable_breath_hold_sec' },
  { label: 'Competitions',         value: r => compsText(r.competitions) },
  { label: 'Competition count',    value: r => (r.competitions || []).length },
  { label: 'Commercial experience', value: r => r.has_commercial_experience ? 'Yes' : 'No' },
  { label: 'Commercial details',   key: 'commercial_details' },
  { label: 'NZ locations',         key: 'nz_locations' },
  { label: 'Overseas experience',  value: r => tripsText(r.overseas_experience) },
  { label: 'Species count',        value: r => (r.species_shot || []).length },
  { label: 'Species shot',         value: r => (r.species_shot || []).join('; ') },
  { label: 'Commitment',           key: 'commitment_level' },
  { label: 'Commitment notes',     key: 'commitment_notes' },
  { label: 'Medically fit',        value: r => r.medically_fit ? 'Yes' : 'No' },
  { label: 'Health disclosure',    key: 'health_disclosure' },
  { label: 'Panel notes',          key: 'panel_notes' },
]

export default function DevSquadAdmin() {
  const navigate = useNavigate()
  const pw = import.meta.env.VITE_ADMIN_PASSWORD

  const [rows, setRows] = useState(null)
  const [filter, setFilter] = useState('')
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(null)      // expanded application id
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState('')

  const call = async (payload) => {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminPassword: pw, ...payload }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
    return data
  }

  const load = async () => {
    setError('')
    try {
      const { rows } = await call({ action: 'list', status: filter || undefined })
      setRows(rows)
    } catch (e) {
      setError(e.message)
      setRows([])
    }
  }

  useEffect(() => { load() }, [filter]) // eslint-disable-line

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows || []
    return (rows || []).filter(r =>
      [r.full_name, r.email, r.suburb_city].filter(Boolean)
        .some(v => v.toLowerCase().includes(q))
    )
  }, [rows, search])

  const counts = useMemo(() => {
    const m = {}
    for (const r of rows || []) m[r.status] = (m[r.status] || 0) + 1
    return m
  }, [rows])

  const setStatus = async (id, status) => {
    setBusy(id)
    try {
      await call({ action: 'updateStatus', id, status })
      setRows(list => list.map(r => r.id === id ? { ...r, status } : r))
    } catch (e) { setError(e.message) } finally { setBusy(null) }
  }

  const saveNotes = async (id, panel_notes) => {
    setBusy(id)
    try {
      await call({ action: 'updateStatus', id, panel_notes })
      setRows(list => list.map(r => r.id === id ? { ...r, panel_notes } : r))
    } catch (e) { setError(e.message) } finally { setBusy(null) }
  }

  // Export pulls fresh full rows — the list view deliberately omits the
  // health disclosure, so it can't be exported from what's already loaded.
  const exportCSV = async () => {
    setBusy('export')
    setError('')
    try {
      const { rows: full } = await call({ action: 'export' })
      if (!full.length) { setError('Nothing to export yet.'); return }
      downloadCSV(
        `nz-dev-squad-applications-${new Date().toISOString().slice(0, 10)}.csv`,
        toCSV(full, EXPORT_COLUMNS)
      )
    } catch (e) { setError(e.message) } finally { setBusy(null) }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div style={{ background: SNZ_BLUE }} className="px-4 sm:px-6 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => navigate('/dev-squad')}
            className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition whitespace-nowrap">
            ← Dev Squad
          </button>
          <span className="text-blue-100 text-sm opacity-75 truncate hidden sm:block">/ Applications</span>
        </div>
        <button onClick={() => { clearAdminSession(); navigate('/') }}
          className="text-xs text-blue-100 hover:text-white transition">Sign out</button>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-5">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-black text-gray-900">Development Squad Applications</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              {rows === null ? 'Loading…' : `${rows.length} application${rows.length !== 1 ? 's' : ''}`}
              {rows?.length > 0 && ` · ${shown.length} shown`}
            </p>
          </div>
          <button onClick={exportCSV} disabled={busy === 'export' || !rows?.length}
            className="px-4 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40"
            style={{ background: SNZ_BLUE }}>
            {busy === 'export' ? 'Preparing…' : '↓ Export to CSV / Excel'}
          </button>
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>}

        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setFilter('')}
            className={`text-xs font-bold px-3 py-1.5 rounded-full border transition ${
              !filter ? 'text-white border-transparent' : 'text-gray-600 border-gray-300 hover:bg-gray-50'}`}
            style={!filter ? { background: SNZ_BLUE } : {}}>
            All
          </button>
          {STATUSES.map(s => (
            <button key={s.value} onClick={() => setFilter(s.value)}
              className={`text-xs font-bold px-3 py-1.5 rounded-full border transition ${
                filter === s.value ? 'text-white border-transparent' : 'text-gray-600 border-gray-300 hover:bg-gray-50'}`}
              style={filter === s.value ? { background: SNZ_BLUE } : {}}>
              {s.label}{counts[s.value] ? ` (${counts[s.value]})` : ''}
            </button>
          ))}
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name, email, city…"
            className="ml-auto border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 min-w-[200px]" />
        </div>

        {rows === null ? (
          <div className="text-center py-16 text-gray-400 text-sm">Loading applications…</div>
        ) : shown.length === 0 ? (
          <div className="text-center py-16 bg-white border border-gray-200 rounded-2xl text-gray-400">
            <p className="font-semibold text-gray-500 mb-1">No applications</p>
            <p className="text-sm">
              {rows.length === 0 ? 'Nothing has been submitted yet.' : 'Nothing matches that filter.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {shown.map(r => {
              const meta = statusMeta(r.status)
              const isOpen = open === r.id
              return (
                <div key={r.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
                  <button onClick={() => setOpen(isOpen ? null : r.id)}
                    className="w-full text-left px-4 sm:px-5 py-3.5 flex items-center gap-3 hover:bg-gray-50 transition">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-gray-900 text-sm">{r.full_name}</span>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${meta.cls}`}>
                          {meta.label}
                        </span>
                        {r.submitted_as_member && (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                            Member
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">
                        Age {ageFrom(r.dob)} · {r.suburb_city} · {(r.competitions || []).length} comps ·{' '}
                        {(r.species_shot || []).length} species · {fmtDate(r.created_at)}
                      </p>
                    </div>
                    <div className="hidden sm:flex items-center gap-3 flex-shrink-0 text-xs text-gray-400 tabular-nums">
                      {r.max_depth_m != null && <span><b className="text-gray-700">{r.max_depth_m}m</b> max</span>}
                      {r.max_breath_hold_sec != null && <span><b className="text-gray-700">{r.max_breath_hold_sec}s</b> BH</span>}
                    </div>
                    <span className="text-gray-300 flex-shrink-0">{isOpen ? '▲' : '▼'}</span>
                  </button>

                  {isOpen && (
                    <div className="px-4 sm:px-5 pb-5 pt-1 border-t border-gray-100 space-y-4">
                      <div className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm pt-3">
                        <Detail label="Email" value={<a href={`mailto:${r.email}`} className="underline" style={{ color: SNZ_BLUE }}>{r.email}</a>} />
                        <Detail label="Phone" value={r.phone} />
                        <Detail label="Date of birth" value={`${r.dob} (age ${ageFrom(r.dob)})`} />
                        <Detail label="Suburb & city" value={r.suburb_city} />
                      </div>

                      <Block title="Diving ability">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <Stat label="Max depth" value={r.max_depth_m != null ? `${r.max_depth_m} m` : '—'} />
                          <Stat label="Comfortable depth" value={r.comfortable_depth_m != null ? `${r.comfortable_depth_m} m` : '—'} />
                          <Stat label="Max breath-hold" value={r.max_breath_hold_sec != null ? `${r.max_breath_hold_sec} s` : '—'} />
                          <Stat label="Comfortable BH" value={r.comfortable_breath_hold_sec != null ? `${r.comfortable_breath_hold_sec} s` : '—'} />
                        </div>
                      </Block>

                      {(r.competitions || []).length > 0 && (
                        <Block title={`Competition experience (${r.competitions.length})`}>
                          <div className="space-y-1.5">
                            {r.competitions.map((c, i) => (
                              <div key={i} className="flex items-baseline gap-2 text-sm">
                                <span className="font-semibold text-gray-900">{c.name || '—'}</span>
                                <span className="text-gray-400 text-xs">
                                  {[c.year, c.placing, c.partner && `with ${c.partner}`].filter(Boolean).join(' · ')}
                                </span>
                              </div>
                            ))}
                          </div>
                        </Block>
                      )}

                      {r.has_commercial_experience && (
                        <Block title="Commercial experience">
                          <p className="text-sm text-gray-600 whitespace-pre-wrap">{r.commercial_details || 'Yes (no detail given)'}</p>
                        </Block>
                      )}

                      {r.nz_locations && (
                        <Block title="NZ locations"><p className="text-sm text-gray-600 whitespace-pre-wrap">{r.nz_locations}</p></Block>
                      )}

                      {(r.overseas_experience || []).length > 0 && (
                        <Block title="Overseas experience">
                          <div className="space-y-1.5">
                            {r.overseas_experience.map((t, i) => (
                              <div key={i} className="text-sm">
                                <span className="font-semibold text-gray-900">{t.location || '—'}</span>
                                <span className="text-gray-400 text-xs ml-2">{[t.when, t.duration].filter(Boolean).join(' · ')}</span>
                              </div>
                            ))}
                          </div>
                        </Block>
                      )}

                      {(r.species_shot || []).length > 0 && (
                        <Block title={`Species shot (${r.species_shot.length})`}>
                          <div className="flex flex-wrap gap-1.5">
                            {r.species_shot.map(s => (
                              <span key={s} className="text-xs bg-gray-50 border border-gray-200 rounded px-2 py-0.5 text-gray-600">{s}</span>
                            ))}
                          </div>
                        </Block>
                      )}

                      <Block title="Commitment">
                        <p className="text-sm text-gray-700 font-semibold capitalize">{r.commitment_level}</p>
                        {r.commitment_notes && <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{r.commitment_notes}</p>}
                        <p className="text-xs text-gray-400 mt-2">
                          Medical fitness declared: {r.medically_fit ? 'Yes' : 'No'} ·
                          {' '}Health disclosure is in the CSV export only.
                        </p>
                      </Block>

                      <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Panel decision</p>
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {STATUSES.map(s => (
                            <button key={s.value} onClick={() => setStatus(r.id, s.value)} disabled={busy === r.id}
                              className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition disabled:opacity-40 ${
                                r.status === s.value ? s.cls : 'border-gray-300 text-gray-500 hover:bg-gray-50'}`}>
                              {s.label}
                            </button>
                          ))}
                        </div>
                        <NotesBox initial={r.panel_notes || ''} disabled={busy === r.id}
                          onSave={notes => saveNotes(r.id, notes)} />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function Detail({ label, value }) {
  return (
    <div>
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{label}</p>
      <p className="text-gray-800">{value}</p>
    </div>
  )
}

function Block({ title, children }) {
  return (
    <div className="bg-gray-50 border border-gray-100 rounded-xl p-3.5">
      <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">{title}</p>
      {children}
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div>
      <p className="text-[11px] text-gray-400">{label}</p>
      <p className="font-black text-gray-900 text-sm tabular-nums">{value}</p>
    </div>
  )
}

function NotesBox({ initial, onSave, disabled }) {
  const [v, setV] = useState(initial)
  const dirty = v !== initial
  return (
    <div>
      <textarea value={v} onChange={e => setV(e.target.value)} disabled={disabled}
        placeholder="Panel notes — visible to admins only"
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm min-h-[70px] resize-y focus:outline-none focus:ring-2 focus:ring-blue-300" />
      {dirty && (
        <button onClick={() => onSave(v)} disabled={disabled}
          className="mt-2 text-xs font-bold px-3 py-1.5 rounded-lg text-white disabled:opacity-40"
          style={{ background: SNZ_BLUE }}>
          Save notes
        </button>
      )}
    </div>
  )
}
