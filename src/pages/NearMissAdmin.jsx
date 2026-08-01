import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { toCSV, downloadCSV } from '../lib/csvExport'

const SNZ_BLUE = '#2B6CB0'
const SNZ_DARK = '#1e3a5f'

const STATUSES = ['pending', 'approved', 'flagged', 'removed']
const STATUS_COLORS = {
  pending: 'bg-gray-100 text-gray-600',
  approved: 'bg-green-100 text-green-700',
  flagged: 'bg-amber-100 text-amber-700',
  removed: 'bg-red-100 text-red-700',
}

// Matches the pattern used across CompAdmin.jsx / NationalsAdmin.jsx —
// nothing in this app currently sets snz_admin_session, so this always
// falls through to the client-bundled VITE_ADMIN_PASSWORD, same as
// everywhere else. Access itself is already gated by <ProtectedRoute> in
// App.jsx before this page ever renders.
const adminPassword = () => sessionStorage.getItem('snz_admin_session') || import.meta.env.VITE_ADMIN_PASSWORD

const EXPORT_COLUMNS = [
  { label: 'ID', key: 'id' },
  { label: 'Submitted', key: 'created_at' },
  { label: 'Time band', key: 'time_band' },
  { label: 'Region', key: 'region' },
  { label: 'Location', key: 'location_name' },
  { label: 'Distance from shore', key: 'distance_from_shore' },
  { label: 'Outcome', key: 'outcome' },
  { label: 'Closest distance', key: 'closest_distance' },
  { label: 'Vessel speed', key: 'vessel_speed' },
  { label: 'Diver position', key: 'diver_position' },
  { label: 'Visibility gear', value: r => (r.visibility_gear || []).join('; ') },
  { label: 'Vessel saw you', key: 'vessel_saw_you' },
  { label: 'Vessel type', key: 'vessel_type' },
  { label: 'Reported to', value: r => (r.reported_to || []).join('; ') },
  { label: 'Not-reported reasons', value: r => (r.not_reported_reasons || []).join('; ') },
  { label: 'Report outcome', key: 'report_outcome' },
  { label: 'Injury level', key: 'injury_level' },
  { label: 'Years experience', key: 'years_experience' },
  { label: 'Days per year', key: 'days_per_year' },
  { label: 'Club member', key: 'club_member' },
  { label: 'Contact consent', key: 'contact_consent' },
  { label: 'Contact email', key: 'contact_email' },
  { label: 'Status', key: 'status' },
]

function ReportRow({ report, onUpdate }) {
  const [expanded, setExpanded] = useState(false)
  const [note, setNote] = useState(report.moderation_note || '')
  const [saving, setSaving] = useState(false)

  const setStatus = async (status) => {
    setSaving(true)
    await onUpdate(report.id, status, note)
    setSaving(false)
  }

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button type="button" onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50">
        <div className="min-w-0">
          <p className="font-bold text-gray-900 text-sm truncate">{report.location_name} · {report.region}</p>
          <p className="text-xs text-gray-400">{new Date(report.created_at).toLocaleDateString('en-NZ')} · {report.outcome}</p>
        </div>
        <span className={`text-xs font-bold px-2 py-1 rounded-lg flex-shrink-0 ${STATUS_COLORS[report.status] || ''}`}>{report.status}</span>
      </button>
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-4 bg-gray-50 space-y-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-gray-700">
            <div><strong>Time band:</strong> {report.time_band}</div>
            <div><strong>Distance from shore:</strong> {report.distance_from_shore}</div>
            <div><strong>Closest distance:</strong> {report.closest_distance}</div>
            <div><strong>Vessel speed:</strong> {report.vessel_speed}</div>
            <div><strong>Diver position:</strong> {report.diver_position}</div>
            <div><strong>Vessel saw you:</strong> {report.vessel_saw_you}</div>
            <div><strong>Vessel type:</strong> {report.vessel_type}</div>
            <div><strong>Injury:</strong> {report.injury_level}</div>
            <div><strong>Visibility gear:</strong> {(report.visibility_gear || []).join(', ')}</div>
            <div><strong>Reported to:</strong> {(report.reported_to || []).join(', ')}</div>
            {report.not_reported_reasons?.length > 0 && <div className="col-span-2"><strong>Not-reported reasons:</strong> {report.not_reported_reasons.join(', ')}</div>}
            <div><strong>Contact consent:</strong> {report.contact_consent}</div>
            {report.contact_email && <div><strong>Contact email:</strong> {report.contact_email}</div>}
          </div>
          {report.free_text && (
            <div className="text-xs text-gray-700 bg-white border border-gray-200 rounded-lg p-3">{report.free_text}</div>
          )}
          <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Moderation note (optional)"
            rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300" />
          <div className="flex gap-2 flex-wrap">
            {STATUSES.map(s => (
              <button key={s} type="button" disabled={saving} onClick={() => setStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition disabled:opacity-40 ${
                  report.status === s ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function NearMissAdmin() {
  const navigate = useNavigate()
  const [reports, setReports] = useState(null)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({ region: '', outcome: '', time_band: '', status: '' })
  const [summary, setSummary] = useState(null)

  const load = useCallback(async () => {
    setError('')
    const res = await fetch('/.netlify/functions/near-miss-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminPassword: adminPassword(), action: 'list', filters }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Failed to load reports'); return }
    setReports(data.reports)
  }, [filters])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    fetch('/.netlify/functions/near-miss-aggregates').then(r => r.json()).then(setSummary).catch(() => {})
  }, [])

  const updateStatus = async (id, status, moderation_note) => {
    const res = await fetch('/.netlify/functions/near-miss-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminPassword: adminPassword(), action: 'updateStatus', id, status, moderation_note }),
    })
    if (res.ok) load()
  }

  const exportCSV = async (mode) => {
    const res = await fetch('/.netlify/functions/near-miss-admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminPassword: adminPassword(), action: 'export', mode, filters }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Export failed'); return }
    downloadCSV(`near-miss-${mode}-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(data.rows, EXPORT_COLUMNS))
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div style={{ background: SNZ_DARK }} className="px-6 py-3 flex items-center justify-between border-b border-blue-900">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/admin')}
            className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
            ← Admin
          </button>
          <span className="text-white font-bold text-sm">Near-Miss Survey</span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8 space-y-5">
        {summary && (
          <div className="bg-white border border-gray-200 rounded-2xl p-5 grid grid-cols-3 gap-4 text-center">
            <div><p className="text-2xl font-black text-gray-900">{summary.total}</p><p className="text-xs text-gray-400">Total reports</p></div>
            <div><p className="text-2xl font-black" style={{ color: SNZ_BLUE }}>{summary.underReporting?.pct ?? '—'}%</p><p className="text-xs text-gray-400">Under-reported</p></div>
            <div><p className="text-2xl font-black text-red-600">{summary.rule91_6BreachRate?.pct ?? '—'}%</p><p className="text-xs text-gray-400">Rule 91.6 breach</p></div>
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <h2 className="font-black text-gray-900 text-sm uppercase tracking-widest mb-3" style={{ color: SNZ_BLUE }}>Filters</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <input placeholder="Region" value={filters.region} onChange={e => setFilters(f => ({ ...f, region: e.target.value }))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-xs" />
            <input placeholder="Outcome" value={filters.outcome} onChange={e => setFilters(f => ({ ...f, outcome: e.target.value }))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-xs" />
            <input placeholder="Time band" value={filters.time_band} onChange={e => setFilters(f => ({ ...f, time_band: e.target.value }))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-xs" />
            <select value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-xs">
              <option value="">Any status</option>
              {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={() => exportCSV('standard')}
            className="flex-1 py-2.5 rounded-xl font-bold text-sm border-2 border-gray-200 text-gray-600 hover:border-gray-300 transition">
            Export CSV (consent-aware)
          </button>
          <button onClick={() => exportCSV('for_submission')}
            className="flex-1 py-2.5 rounded-xl font-bold text-sm border-2 border-gray-200 text-gray-600 hover:border-gray-300 transition">
            Export for submission (fully stripped)
          </button>
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>}

        <div className="space-y-2">
          {reports === null && <p className="text-gray-400 text-sm">Loading…</p>}
          {reports?.length === 0 && <p className="text-gray-400 text-sm">No reports match these filters.</p>}
          {reports?.map(r => <ReportRow key={r.id} report={r} onUpdate={updateStatus} />)}
        </div>
      </div>
    </div>
  )
}
