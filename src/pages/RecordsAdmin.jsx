import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, clearAdminSession } from '../lib/supabase'
import { recordAppsAdmin } from '../lib/recordApplicationsAdmin'
import { DIVISIONS, COMBINABLE, SOLO, divsOf, inDivision, toggleDivision, appTypeToDivisions, divBadgeClass as divBadge, toRecordDate } from '../lib/recordDivisions'

const SNZ_BLUE = '#2B6CB0'
const BUCKET = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/snz-media/records`

const empty = {
  species: '', weight_kg: '', diver: '', club: '',
  date_caught: '', location: '', divisions: ['Open'],
  verified: true, provisional: false, provisional_since: null, photo_url: ''
}

function Input({ label, value, onChange, type = 'text', placeholder, required, hint }) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
        {label}{required && <span className="text-red-400 ml-1">*</span>}
      </label>
      {hint && <p className="text-xs text-gray-400 mb-1">{hint}</p>}
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
      />
    </div>
  )
}

function Select({ label, value, onChange, options }) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
      >
        {options.map(o => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}
      </select>
    </div>
  )
}

// Category picker: Open / Women's / Junior U18 can be combined; Meritorious and
// Natural History are single-category.
function DivisionPicker({ value, onChange }) {
  const chip = (d) => {
    const on = value.includes(d)
    return (
      <button key={d} type="button" onClick={() => onChange(toggleDivision(value, d))}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition ${on ? '' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300'}`}
        style={on ? { background: '#eff6ff', color: SNZ_BLUE, borderColor: SNZ_BLUE } : undefined}
      >
        <span className="w-3.5 h-3.5 rounded border-2 flex items-center justify-center text-[9px] leading-none"
          style={on ? { background: SNZ_BLUE, borderColor: SNZ_BLUE, color: '#fff' } : { borderColor: '#d1d5db' }}>{on ? '✓' : ''}</span>
        {d}
      </button>
    )
  }
  return (
    <div>
      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Categories<span className="text-red-400 ml-1">*</span></label>
      <p className="text-xs text-gray-400 mb-2">Tick every record this fish holds, e.g. a junior woman's snapper can be Open + Women's + Junior.</p>
      <div className="flex flex-wrap gap-2">
        {COMBINABLE.map(chip)}
        <span className="text-gray-300 self-center text-xs px-1">or</span>
        {SOLO.map(chip)}
      </div>
    </div>
  )
}

function DivisionBadges({ record }) {
  return (
    <div className="flex flex-wrap gap-1">
      {divsOf(record).map(d => (
        <span key={d} className={`text-xs px-2 py-0.5 rounded-full font-bold whitespace-nowrap ${divBadge(d)}`}>{d}</span>
      ))}
    </div>
  )
}

// Approved application → "Publish to NZ Records" tick box. Ticking opens a
// prefilled form; Publish creates the record (with the "applicant with fish"
// photo) via the admin function. Unticking a published one removes it again.
function PublishPanel({ app, records, onChanged, showToast }) {
  const published = app.published_record_id
  const publishedRec = published ? records.find(r => r.id === published) : null
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState(() => ({
    species: app.common_name || '',
    weight_kg: app.weighmaster_weight_kg ?? app.weight_kg ?? '',
    divisions: appTypeToDivisions(app.app_type),
    diver: app.full_name || '',
    club: '',
    date_caught: toRecordDate(app.date_speared),
    location: app.location || '',
    provisional: false,
  }))
  const set = (k) => (v) => setForm(f => ({ ...f, [k]: v }))
  const approved = app.status === 'approved'

  const publish = async () => {
    setBusy(true)
    try {
      const res = await recordAppsAdmin('publish', { id: app.id, record: form })
      showToast(res.warning || 'Published to NZ Records', res.warning ? 'error' : 'success')
      setOpen(false)
      onChanged()
    } catch (err) { showToast(err.message, 'error') }
    finally { setBusy(false) }
  }

  const unpublish = async () => {
    if (!confirm('Remove this fish from the NZ Records table?\n\nThe application itself is kept.')) return
    setBusy(true)
    try {
      await recordAppsAdmin('unpublish', { id: app.id })
      showToast('Removed from NZ Records')
      onChanged()
    } catch (err) { showToast(err.message, 'error') }
    finally { setBusy(false) }
  }

  // Current holders for this species in each selected category.
  const sp = form.species.trim().toLowerCase()
  const holders = form.divisions.flatMap(d =>
    records.filter(r => r.id !== published && r.species?.trim().toLowerCase() === sp && inDivision(r, d))
      .map(r => ({ d, r })))
  const w = parseFloat(form.weight_kg)

  if (published) {
    return (
      <div className="rounded-xl border-2 border-green-300 bg-green-50 p-4 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm font-bold text-green-800 cursor-pointer">
          <input type="checkbox" checked disabled={busy} onChange={unpublish} className="w-4 h-4 accent-green-600" />
          Published to NZ Records
        </label>
        {publishedRec ? <DivisionBadges record={publishedRec} /> : <span className="text-xs text-green-700">record #{published}</span>}
        <a href={`/records#record-${published}`} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-green-700 hover:underline ml-auto">View on records page ↗</a>
      </div>
    )
  }

  return (
    <div className={`rounded-xl border-2 p-4 ${approved ? 'border-blue-200 bg-blue-50/40' : 'border-gray-200 bg-gray-50'}`}>
      <label className={`flex items-center gap-2 text-sm font-bold ${approved ? 'text-gray-800 cursor-pointer' : 'text-gray-400'}`}>
        <input type="checkbox" checked={open} disabled={!approved || busy} onChange={e => setOpen(e.target.checked)} className="w-4 h-4" />
        Publish to NZ Records
        {!approved && <span className="text-xs font-normal">— approve the application first</span>}
      </label>

      {open && approved && (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2"><Input label="Species (as shown on the records table)" required value={form.species} onChange={set('species')} /></div>
            <Input label="Weight (kg)" required value={form.weight_kg} onChange={set('weight_kg')} hint={app.weighmaster_weight_kg ? 'From the weighmaster' : undefined} />
            <Input label="Diver" value={form.diver} onChange={set('diver')} />
            <Input label="Club" value={form.club} onChange={set('club')} placeholder="Club name" />
            <Input label="Date caught" value={form.date_caught} onChange={set('date_caught')} placeholder="DD.MM.YY" />
            <div className="sm:col-span-2"><Input label="Location" value={form.location} onChange={set('location')} /></div>
          </div>
          <DivisionPicker value={form.divisions} onChange={set('divisions')} />
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={form.provisional} onChange={e => set('provisional')(e.target.checked)} className="w-4 h-4" />
            Provisional <span className="text-xs text-gray-400">(30-day dispute period, shows a badge publicly)</span>
          </label>

          {holders.length > 0 && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 space-y-1">
              <p className="font-bold">Existing records for {form.species}:</p>
              {holders.map(({ d, r }) => (
                <p key={d + r.id}>{d}: {r.weight_kg} kg — {r.diver}{w > 0 && r.weight_kg ? (w > r.weight_kg ? '  (new fish is heavier)' : '  (new fish is NOT heavier)') : ''}</p>
              ))}
              <p className="text-amber-700">These stay on the table. Edit or delete the old record afterwards if it's been beaten.</p>
            </div>
          )}

          <p className="text-xs text-gray-500">The "applicant with fish" photo becomes the record photo.</p>
          <div className="flex gap-2">
            <button type="button" onClick={publish} disabled={busy || !form.divisions.length}
              className="px-4 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-50" style={{ background: SNZ_BLUE }}
            >{busy ? 'Publishing…' : 'Publish record'}</button>
            <button type="button" onClick={() => setOpen(false)} className="px-4 py-2 rounded-lg text-sm font-bold border border-gray-300 text-gray-600 hover:bg-gray-50">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

function AdminNotes({ appId, existing, onSave }) {
  const [notes, setNotes] = useState(existing || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const save = async () => {
    setSaving(true)
    try { await recordAppsAdmin('update', { id: appId, patch: { admin_notes: notes } }) }
    catch (err) { setSaving(false); alert('Could not save notes: ' + err.message); return }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    onSave()
  }

  return (
    <div className="flex gap-2">
      <textarea
        value={notes}
        onChange={e => { setNotes(e.target.value); setSaved(false) }}
        placeholder="Add internal notes about this application..."
        rows={3}
        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-y"
      />
      <button
        onClick={save}
        disabled={saving}
        className="px-3 py-2 rounded-lg text-xs font-bold text-white self-start disabled:opacity-50 transition"
        style={{ background: saved ? '#16a34a' : SNZ_BLUE }}
      >{saving ? '…' : saved ? '✓ Saved' : 'Save'}</button>
    </div>
  )
}

export default function RecordsAdmin() {
  const navigate = useNavigate()
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterDiv, setFilterDiv] = useState('All')
  const [modal, setModal] = useState(null) // null | { mode: 'add'|'edit', record: {} }
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [uploadingFor, setUploadingFor] = useState(null)
  const [toast, setToast] = useState(null)
  const [applications, setApplications] = useState([])
  const [tab, setTab] = useState('records') // 'records' | 'applications'
  const fileRef = useRef()

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  const exportToCSV = () => {
    const cols = ['id','species','weight_kg','divisions','diver','club','date_caught','location','verified','photo_url','created_at']
    const headers = ['ID','Species','Weight (kg)','Categories','Diver','Club','Date Caught','Location','Verified','Photo URL','Created At']

    const escape = (v) => {
      if (v == null) return ''
      const s = String(v)
      if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`
      return s
    }

    const rows = [
      headers.join(','),
      ...records.map(r => cols.map(c => escape(c === 'divisions' ? divsOf(r).join(' + ') : r[c])).join(','))
    ]

    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `snz-records-${new Date().toISOString().slice(0,10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    showToast(`Exported ${records.length} records`)
  }

  const fetchRecords = async () => {
    const { data } = await supabase.from('nz_records').select('*').order('species')
    setRecords(data || [])
    setLoading(false)
  }

  const fetchApplications = async () => {
    try {
      const { rows } = await recordAppsAdmin('list')
      setApplications(rows || [])
    } catch (err) {
      console.error('Could not load applications:', err)
      setApplications([])
    }
  }

  useEffect(() => { fetchRecords(); fetchApplications() }, [])

  const filtered = records.filter(r =>
    (filterDiv === 'All' || inDivision(r, filterDiv)) &&
    (search === '' ||
      r.species.toLowerCase().includes(search.toLowerCase()) ||
      (r.diver || '').toLowerCase().includes(search.toLowerCase()))
  )

  // ── Save (add or edit) ────────────────────────────────────────────────────
  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      // Only send writable columns — never send id or created_at
      const { id, created_at, ...rest } = modal.record
      const divisions = divsOf(rest)
      if (!divisions.length) throw new Error('Pick at least one category')
      const payload = {
        ...rest,
        divisions,
        division: divisions[0],
        weight_kg: parseFloat(rest.weight_kg) || null,
      }
      if (modal.mode === 'add') {
        const { error } = await supabase.from('nz_records').insert(payload)
        if (error) throw error
        showToast('Record added')
      } else {
        const { error } = await supabase.from('nz_records').update(payload).eq('id', id)
        if (error) throw error
        showToast('Record saved')
      }
      setModal(null)
      fetchRecords()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    if (!confirm('Delete this record? This cannot be undone.')) return
    setDeleting(id)
    const { error } = await supabase.from('nz_records').delete().eq('id', id)
    if (error) showToast(error.message, 'error')
    else { showToast('Record deleted'); fetchRecords() }
    setDeleting(null)
  }

  // ── Photo upload ──────────────────────────────────────────────────────────
  const handlePhotoUpload = async (recordId, file) => {
    if (!file) return
    setUploadingFor(recordId)
    try {
      // Normalise extension — always store as jpg/png/gif/webp lowercase
      const rawExt = file.name.split('.').pop().toLowerCase()
      const ext = rawExt === 'heic' || rawExt === 'heif' ? 'jpg' : rawExt
      const path = `records/${recordId}.${ext}`

      // Remove any existing file at this path first (handles replace case)
      // Ignore errors — file may not exist yet
      await supabase.storage.from('snz-media').remove([path])

      // Also remove other common extensions in case they uploaded a different format before
      const otherExts = ['jpg','jpeg','png','webp','gif','heic'].filter(e => e !== ext)
      await Promise.all(
        otherExts.map(e => supabase.storage.from('snz-media').remove([`records/${recordId}.${e}`]))
      )

      // Fresh upload
      const { error: upErr } = await supabase.storage
        .from('snz-media')
        .upload(path, file, { contentType: file.type })
      if (upErr) throw upErr

      const { data: { publicUrl } } = supabase.storage.from('snz-media').getPublicUrl(path)

      // Add cache-busting param so the browser loads the new image immediately
      const bustUrl = `${publicUrl}?t=${Date.now()}`

      const { error: dbErr } = await supabase.from('nz_records').update({ photo_url: bustUrl }).eq('id', recordId)
      if (dbErr) throw dbErr

      showToast('Photo uploaded')
      fetchRecords()
      if (modal?.record?.id === recordId) {
        setModal(m => ({ ...m, record: { ...m.record, photo_url: bustUrl } }))
      }
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setUploadingFor(null)
    }
  }

  // ── Toggle provisional ────────────────────────────────────────────────────
  const toggleProvisional = async (record) => {
    const nowProvisional = !record.provisional
    const { error } = await supabase.from('nz_records').update({
      provisional: nowProvisional,
      provisional_since: nowProvisional ? new Date().toISOString() : null
    }).eq('id', record.id)
    if (error) showToast(error.message, 'error')
    else { showToast(nowProvisional ? 'Marked provisional' : 'Provisional removed'); fetchRecords() }
  }

  // ── Delete application ─────────────────────────────────────────────────────
  const handleDeleteApplication = async (id, name) => {
    if (!confirm(`Delete application from ${name}?\n\nThis will permanently remove the application and all uploaded photos. This cannot be undone.`)) return
    setDeleting(id)
    try {
      // Deletes the row and its uploaded photos server-side
      await recordAppsAdmin('delete', { id })
      showToast('Application deleted')
      fetchApplications()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setDeleting(null)
    }
  }

  // ── Update application status ─────────────────────────────────────────────
  const updateAppStatus = async (id, status) => {
    try {
      await recordAppsAdmin('update', { id, patch: { status } })
      showToast(`Status → ${status}`); fetchApplications()
    } catch (err) {
      showToast(err.message, 'error')
    }
  }

  const setField = (key) => (val) => setModal(m => ({ ...m, record: { ...m.record, [key]: val } }))

  const statusColors = {
    submitted: 'bg-yellow-50 text-yellow-700 border border-yellow-200',
    under_review: 'bg-blue-50 text-blue-700 border border-blue-200',
    provisional: 'bg-purple-50 text-purple-700 border border-purple-200',
    approved: 'bg-green-50 text-green-700 border border-green-200',
    declined: 'bg-red-50 text-red-700 border border-red-200',
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-semibold shadow-lg ${
          toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
        }`}>{toast.msg}</div>
      )}

      {/* Header */}
      <div style={{ background: SNZ_BLUE }} className="px-6 py-3 flex items-center justify-between border-b border-blue-700">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/records')} className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">← Records</button>
          <span className="text-blue-200 text-sm">/ Admin</span>
        </div>
        <button
          onClick={() => { clearAdminSession(); navigate('/records') }}
          className="text-xs text-blue-200 hover:text-white transition"
        >Sign out</button>
      </div>

      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-gray-900">Records Admin</h1>
            <p className="text-xs text-gray-400 mt-0.5">Manage NZ Spearfishing Records</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold border border-gray-300 text-gray-700 hover:bg-gray-50 transition"
            >
              ↓ Export CSV
            </button>
            <button
              onClick={() => setModal({ mode: 'add', record: { ...empty } })}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white"
              style={{ background: SNZ_BLUE }}
            >
              <span className="text-lg leading-none">+</span> Add Record
            </button>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="max-w-6xl mx-auto flex gap-6">
          {[['records', `Records (${records.length})`], ['applications', `Applications (${applications.length})`]].map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`py-3 text-sm font-bold border-b-2 transition ${tab === id ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
            >{label}</button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">

        {/* ── RECORDS TAB ── */}
        {tab === 'records' && (
          <>
            {/* Filters */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-5 flex flex-wrap gap-3 items-center">
              <input
                type="text"
                placeholder="Search species or diver…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="flex-1 min-w-48 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <div className="flex gap-2 flex-wrap">
                {['All', ...DIVISIONS].map(d => (
                  <button key={d} onClick={() => setFilterDiv(d)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold border transition"
                    style={filterDiv === d ? { background: SNZ_BLUE, color: '#fff', borderColor: SNZ_BLUE } : { background: '#fff', color: '#374151', borderColor: '#d1d5db' }}
                  >{d}</button>
                ))}
              </div>
              <span className="text-xs text-gray-400">{filtered.length} records</span>
            </div>

            {loading && <div className="text-center py-16 text-gray-400">Loading…</div>}

            {!loading && (
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[640px]">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="px-3 py-3 w-12 text-left text-xs font-bold tracking-wider text-gray-400 uppercase">Photo</th>
                      <th className="px-4 py-3 text-left text-xs font-bold tracking-wider text-gray-400 uppercase">Species</th>
                      <th className="px-4 py-3 text-left text-xs font-bold tracking-wider text-gray-400 uppercase">Weight</th>
                      <th className="px-4 py-3 text-left text-xs font-bold tracking-wider text-gray-400 uppercase">Categories</th>
                      <th className="px-4 py-3 text-left text-xs font-bold tracking-wider text-gray-400 uppercase">Diver</th>
                      <th className="px-4 py-3 text-left text-xs font-bold tracking-wider text-gray-400 uppercase hidden md:table-cell">Location</th>
                      <th className="px-4 py-3 text-left text-xs font-bold tracking-wider text-gray-400 uppercase hidden md:table-cell">Date</th>
                      <th className="px-4 py-3 w-28"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r, i) => (
                      <tr key={r.id} className={`border-b border-gray-100 hover:bg-blue-50 transition ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                        {/* Photo cell */}
                        <td className="px-3 py-2">
                          <label className="cursor-pointer group relative block w-10 h-10">
                            {r.photo_url
                              ? <img src={r.photo_url} alt="" className="w-10 h-10 object-cover rounded-lg border border-gray-200 group-hover:opacity-70 transition" />
                              : <div className="w-10 h-10 rounded-lg bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 group-hover:border-blue-400 transition text-lg">+</div>
                            }
                            {uploadingFor === r.id && (
                              <div className="absolute inset-0 bg-white/80 rounded-lg flex items-center justify-center">
                                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
                              </div>
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={e => handlePhotoUpload(r.id, e.target.files[0])}
                            />
                          </label>
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-900">
                        <div className="flex items-center gap-2">
                          {r.species}
                          {r.provisional && (() => {
                            const days = r.provisional_since
                              ? Math.max(0, 30 - Math.floor((Date.now() - new Date(r.provisional_since)) / 86400000))
                              : 30
                            return (
                              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 whitespace-nowrap">
                                Provisional{days > 0 ? ` · ${days}d left` : ' · expired'}
                              </span>
                            )
                          })()}
                        </div>
                      </td>
                        <td className="px-4 py-3 font-bold" style={{ color: SNZ_BLUE }}>{r.weight_kg ? `${r.weight_kg} kg` : '—'}</td>
                        <td className="px-4 py-3">
                          <DivisionBadges record={r} />
                        </td>
                        <td className="px-4 py-3 text-gray-700">{r.diver}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs hidden md:table-cell">{r.location}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs hidden md:table-cell">{r.date_caught}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2 justify-end flex-wrap">
                            <button
                              onClick={() => toggleProvisional(r)}
                              className={`px-3 py-1 rounded-lg text-xs font-bold border transition ${
                                r.provisional
                                  ? 'border-amber-400 text-amber-700 bg-amber-50 hover:bg-amber-100'
                                  : 'border-gray-300 text-gray-500 hover:border-amber-400 hover:text-amber-600'
                              }`}
                              title={r.provisional ? 'Remove provisional status' : 'Mark as provisional'}
                            >{r.provisional ? '⚠ Provisional' : 'Set Provisional'}</button>
                            <button
                              onClick={() => setModal({ mode: 'edit', record: { ...r, divisions: divsOf(r) } })}
                              className="px-3 py-1 rounded-lg text-xs font-bold border border-gray-300 hover:border-blue-400 hover:text-blue-600 transition"
                            >Edit</button>
                            <button
                              onClick={() => handleDelete(r.id)}
                              disabled={deleting === r.id}
                              className="px-3 py-1 rounded-lg text-xs font-bold border border-gray-300 hover:border-red-400 hover:text-red-600 transition disabled:opacity-50"
                            >Delete</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">No records match</td></tr>
                    )}
                  </tbody>
                </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── APPLICATIONS TAB ── */}
        {tab === 'applications' && (
          <div className="space-y-6">
            {applications.length === 0 && (
              <div className="text-center py-16 text-gray-400">No applications yet.</div>
            )}
            {applications.map(a => {
              const photoEntries = [
                { key: 'photo_applicant_with_fish',  label: 'Applicant with fish at capture' },
                { key: 'photo_applicant_on_scales',  label: 'Applicant with fish on scales' },
                { key: 'photo_fish_on_scales',       label: 'Fish on scales — weight showing' },
                { key: 'photo_species_diagnostic',   label: 'Species diagnostic' },
                { key: 'photo_length_under',         label: 'Length — tape under fish' },
                { key: 'photo_height',               label: 'Height with tape' },
                { key: 'photo_length_over',          label: 'Length — tape over fish' },
                { key: 'photo_girth',                label: 'Girth with tape' },
                { key: 'photo_scales_sticker',       label: 'Scales certification sticker' },
              ]
              const uploadedPhotos = photoEntries.filter(p => a[p.key])
              return (
                <div key={a.id} className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">

                  {/* Header bar */}
                  <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-start justify-between gap-3"
                    style={{ background: a.status === 'approved' ? '#f0fdf4' : a.status === 'declined' ? '#fef2f2' : '#f8fafc' }}>
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${statusColors[a.status] || 'bg-gray-100 text-gray-600'}`}>
                          {a.status.replace('_', ' ').toUpperCase()}
                        </span>
                        <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700">{a.app_type} Record</span>
                        <span className="text-xs text-gray-400">Submitted {new Date(a.submitted_at).toLocaleDateString('en-NZ', { day:'numeric', month:'short', year:'numeric' })}</span>
                        <span className="text-xs text-gray-400">ID #{a.id}</span>
                      </div>
                      <h3 className="font-black text-gray-900 text-2xl">{a.common_name} — {a.weight_kg} kg</h3>
                    </div>
                    {/* Status buttons */}
                    <div className="flex gap-2 flex-wrap">
                      {['under_review','provisional','approved','declined'].map(s => (
                        <button key={s} onClick={() => updateAppStatus(a.id, s)} disabled={a.status === s}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition disabled:opacity-30 ${
                            s === 'approved'     ? 'border-green-400 text-green-700 hover:bg-green-50' :
                            s === 'declined'     ? 'border-red-400 text-red-700 hover:bg-red-50' :
                            s === 'provisional'  ? 'border-purple-400 text-purple-700 hover:bg-purple-50' :
                                                   'border-gray-300 text-gray-600 hover:bg-gray-50'
                          } ${a.status === s ? 'bg-opacity-20' : ''}`}
                        >{s.replace('_', ' ')}</button>
                      ))}
                    </div>
                  </div>

                  <div className="p-6 space-y-6">

                    {/* Applicant + Species + Measurements in a grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                      {/* Personal */}
                      <div className="bg-gray-50 rounded-xl p-4">
                        <h4 className="text-xs font-black tracking-widest uppercase text-gray-400 mb-3">Applicant</h4>
                        <p className="font-bold text-gray-900">{a.full_name}</p>
                        {a.birth_date && <p className="text-xs text-gray-500 mt-0.5">DOB: {a.birth_date}</p>}
                        {a.email && <a href={`mailto:${a.email}`} className="text-xs text-blue-600 hover:underline block mt-1">{a.email}</a>}
                        {a.cell_phone && <p className="text-xs text-gray-500 mt-0.5">📱 {a.cell_phone}</p>}
                        {a.telephone && <p className="text-xs text-gray-500 mt-0.5">📞 {a.telephone}</p>}
                        {a.postal_address && <p className="text-xs text-gray-500 mt-1 whitespace-pre-line">{a.postal_address}</p>}
                      </div>

                      {/* Species + Measurements */}
                      <div className="bg-gray-50 rounded-xl p-4">
                        <h4 className="text-xs font-black tracking-widest uppercase text-gray-400 mb-3">Species & Measurements</h4>
                        <p className="font-bold text-gray-900">{a.common_name}</p>
                        {a.scientific_name && <p className="text-xs text-gray-500 italic">{a.scientific_name}</p>}
                        <div className="mt-2 space-y-1">
                          <p className="text-sm font-black" style={{ color: SNZ_BLUE }}>{a.weight_kg} kg</p>
                          {a.length_cm && <p className="text-xs text-gray-600">Length: {a.length_cm} cm</p>}
                          {a.girth_cm  && <p className="text-xs text-gray-600">Girth: {a.girth_cm} cm</p>}
                          {a.height_cm && <p className="text-xs text-gray-600">Height: {a.height_cm} cm</p>}
                        </div>
                      </div>

                      {/* Event + Scales */}
                      <div className="bg-gray-50 rounded-xl p-4">
                        <h4 className="text-xs font-black tracking-widest uppercase text-gray-400 mb-3">Event & Scales</h4>
                        <p className="text-xs text-gray-600"><span className="font-semibold">Date:</span> {a.date_speared}</p>
                        <p className="text-xs text-gray-600 mt-1"><span className="font-semibold">Location:</span> {a.location}</p>
                        {a.scales_location && <p className="text-xs text-gray-600 mt-2"><span className="font-semibold">Scales at:</span> {a.scales_location}</p>}
                        {a.scales_manufacturer && <p className="text-xs text-gray-600 mt-0.5"><span className="font-semibold">Make:</span> {a.scales_manufacturer}</p>}
                        {a.scales_certified_date && <p className="text-xs text-gray-600 mt-0.5"><span className="font-semibold">Certified:</span> {a.scales_certified_date}</p>}
                      </div>
                    </div>

                    {/* Hunt description */}
                    {a.hunt_description && (
                      <div>
                        <h4 className="text-xs font-black tracking-widest uppercase text-gray-400 mb-2">Hunt Description</h4>
                        <p className="text-sm text-gray-700 bg-gray-50 rounded-xl p-4 leading-relaxed whitespace-pre-line">{a.hunt_description}</p>
                      </div>
                    )}

                    {/* Weighmaster + Witness — always shown */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-gray-50 rounded-xl p-4">
                        <h4 className="text-xs font-black tracking-widest uppercase text-gray-400 mb-3">Weighmaster</h4>
                        {a.weighmaster_name
                          ? <>
                              <p className="text-sm font-semibold text-gray-900">{a.weighmaster_name}</p>
                              {a.weighmaster_weight_kg && <p className="text-sm font-black mt-1" style={{ color: SNZ_BLUE }}>Recorded weight: {a.weighmaster_weight_kg} kg</p>}
                              {a.weighmaster_email && <a href={`mailto:${a.weighmaster_email}`} className="text-xs text-blue-600 hover:underline block mt-0.5">{a.weighmaster_email}</a>}
                              {a.weighmaster_phone && <p className="text-xs text-gray-500 mt-0.5">{a.weighmaster_phone}</p>}
                              {a.weighmaster_address && <p className="text-xs text-gray-500 mt-1 whitespace-pre-line">{a.weighmaster_address}</p>}
                              <p className="text-xs mt-2 font-semibold">
                                Form signed:{' '}
                                <span className={a.weighmaster_signed ? 'text-green-600' : 'text-red-500'}>
                                  {a.weighmaster_signed ? '✓ Yes' : '✕ No'}
                                </span>
                              </p>
                            </>
                          : <p className="text-xs text-gray-400 italic">Not provided</p>
                        }
                      </div>
                      <div className="bg-gray-50 rounded-xl p-4">
                        <h4 className="text-xs font-black tracking-widest uppercase text-gray-400 mb-3">Witness</h4>
                        {a.witness_name
                          ? <>
                              <p className="text-sm font-semibold text-gray-900">{a.witness_name}</p>
                              {a.witness_email && <a href={`mailto:${a.witness_email}`} className="text-xs text-blue-600 hover:underline block mt-0.5">{a.witness_email}</a>}
                              {a.witness_phone && <p className="text-xs text-gray-500 mt-0.5">{a.witness_phone}</p>}
                              {a.witness_address && <p className="text-xs text-gray-500 mt-1 whitespace-pre-line">{a.witness_address}</p>}
                              <p className="text-xs mt-2 font-semibold">
                                Confirmed rules:{' '}
                                <span className={a.witness_signed ? 'text-green-600' : 'text-red-500'}>
                                  {a.witness_signed ? '✓ Yes' : '✕ No'}
                                </span>
                              </p>
                            </>
                          : <p className="text-xs text-gray-400 italic">Not provided</p>
                        }
                      </div>
                    </div>

                    {/* Declaration */}
                    <div className={`rounded-xl p-4 border-2 flex items-center gap-3 ${a.declaration_agreed ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'}`}>
                      <span className="text-2xl">{a.declaration_agreed ? '✅' : '❌'}</span>
                      <div>
                        <p className="text-sm font-bold text-gray-800">Applicant Declaration</p>
                        <p className="text-xs text-gray-500">{a.declaration_agreed ? 'Applicant agreed that all information is correct and fish was speared according to NZ spearfishing record rules.' : 'Declaration was NOT agreed to — verify before processing.'}</p>
                      </div>
                    </div>

                    {/* Photos */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="text-xs font-black tracking-widest uppercase text-gray-400">Photos</h4>
                        <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                          uploadedPhotos.length === 9 ? 'bg-green-100 text-green-700' :
                          uploadedPhotos.length > 0  ? 'bg-amber-100 text-amber-700' :
                                                       'bg-red-100 text-red-600'
                        }`}>{uploadedPhotos.length}/9 submitted</span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                        {photoEntries.map(({ key, label }) => (
                          <div key={key} className="flex flex-col gap-1.5">
                            {a[key] ? (
                              <a href={a[key]} target="_blank" rel="noopener noreferrer" className="group relative block">
                                <img
                                  src={a[key]}
                                  alt={label}
                                  className="w-full aspect-square object-cover rounded-xl border-2 border-green-400 group-hover:brightness-75 transition"
                                />
                                <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-white text-2xl">🔍</span>
                                <span className="absolute bottom-1 right-1 bg-green-500 rounded-full w-4 h-4 flex items-center justify-center text-white text-xs">✓</span>
                              </a>
                            ) : (
                              <div className="w-full aspect-square rounded-xl border-2 border-dashed border-red-200 bg-red-50 flex flex-col items-center justify-center gap-1">
                                <span className="text-red-300 text-2xl">📷</span>
                                <span className="text-red-400 text-xs font-bold">Missing</span>
                              </div>
                            )}
                            <p className="text-xs text-gray-500 leading-tight text-center">{label}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Admin notes */}
                    <div>
                      <h4 className="text-xs font-black tracking-widest uppercase text-gray-400 mb-2">Admin Notes</h4>
                      <AdminNotes appId={a.id} existing={a.admin_notes} onSave={fetchApplications} />
                    </div>

                    {/* Publish to NZ Records */}
                    <PublishPanel
                      key={`${a.id}-${a.published_record_id || 0}-${a.status}`}
                      app={a}
                      records={records}
                      showToast={showToast}
                      onChanged={() => { fetchApplications(); fetchRecords() }}
                    />

                    {/* Action footer */}
                    <div className="pt-3 border-t border-gray-100 flex flex-wrap gap-3 items-center">
                      <a
                        href={`mailto:${a.email}?subject=Your NZ Spearfishing Record Application — ${a.common_name}&body=Kia ora ${a.full_name},%0A%0AThank you for your record application.%0A%0A`}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold border border-gray-300 text-gray-700 hover:bg-gray-50 transition"
                      >✉ Email Applicant</a>
                      <button
                        onClick={() => navigate(`/records/admin/archive/${a.id}`)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold border border-gray-300 text-gray-700 hover:bg-gray-50 transition"
                      >📄 Archive / Export</button>
                      <button
                        onClick={() => handleDeleteApplication(a.id, a.full_name)}
                        disabled={deleting === a.id}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold border border-red-200 text-red-600 hover:bg-red-50 transition disabled:opacity-50"
                      >🗑 Delete</button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Edit/Add Modal ── */}
      {modal && (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center p-4 overflow-y-auto"
          style={{ background: 'rgba(0,0,0,0.6)' }}
          onClick={e => e.target === e.currentTarget && setModal(null)}
        >
          <div className="bg-white rounded-2xl w-full max-w-lg my-8 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-black text-gray-900">{modal.mode === 'add' ? 'Add New Record' : 'Edit Record'}</h2>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              {/* Photo (edit only) */}
              {modal.mode === 'edit' && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Photo</label>
                  <div className="flex items-center gap-4">
                    {modal.record.photo_url
                      ? <img src={modal.record.photo_url} alt="" className="w-20 h-20 object-cover rounded-xl border border-gray-200" />
                      : <div className="w-20 h-20 rounded-xl bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-300 text-3xl">🐟</div>
                    }
                    <div>
                      <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold border-2 border-gray-300 hover:border-blue-400 transition">
                        {uploadingFor === modal.record.id ? (
                          <span className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>Uploading…</span>
                        ) : (
                          <span>📷 {modal.record.photo_url ? 'Replace photo' : 'Upload photo'}</span>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={e => handlePhotoUpload(modal.record.id, e.target.files[0])}
                        />
                      </label>
                      {modal.record.photo_url && (
                        <button
                          type="button"
                          onClick={async () => {
                            await supabase.from('nz_records').update({ photo_url: null }).eq('id', modal.record.id)
                            setModal(m => ({ ...m, record: { ...m.record, photo_url: null } }))
                            fetchRecords()
                          }}
                          className="block mt-2 text-xs text-red-500 hover:underline"
                        >Remove photo</button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Input label="Species" required value={modal.record.species} onChange={setField('species')} placeholder="e.g. Kingfish" />
                </div>
                <Input label="Weight (kg)" required value={modal.record.weight_kg} onChange={setField('weight_kg')} placeholder="e.g. 36.9" hint="Numeric value only" />
                <Input label="Diver" value={modal.record.diver} onChange={setField('diver')} placeholder="Full name" />
                <Input label="Club" value={modal.record.club} onChange={setField('club')} placeholder="Club name" />
                <Input label="Date caught" value={modal.record.date_caught} onChange={setField('date_caught')} placeholder="DD.MM.YY" />
                <div className="col-span-2">
                  <Input label="Location" value={modal.record.location} onChange={setField('location')} placeholder="e.g. Three Kings Islands" />
                </div>
                <div className="col-span-2">
                  <DivisionPicker value={divsOf(modal.record)} onChange={setField('divisions')} />
                </div>
                <div className="col-span-2 flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="verified"
                    checked={modal.record.verified}
                    onChange={e => setField('verified')(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <label htmlFor="verified" className="text-sm font-semibold text-gray-700">Verified record</label>
                </div>
                <div className="col-span-2 flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="provisional"
                    checked={!!modal.record.provisional}
                    onChange={e => {
                      setField('provisional')(e.target.checked)
                      setField('provisional_since')(e.target.checked ? new Date().toISOString() : null)
                    }}
                    className="w-4 h-4"
                  />
                  <div>
                    <label htmlFor="provisional" className="text-sm font-semibold text-gray-700">Provisional record</label>
                    <p className="text-xs text-gray-400">30-day dispute period — displays a provisional badge publicly</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModal(null)}
                  className="flex-1 py-2.5 rounded-xl border border-gray-300 text-sm font-bold text-gray-600 hover:bg-gray-50"
                >Cancel</button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                  style={{ background: SNZ_BLUE }}
                >{saving ? 'Saving…' : modal.mode === 'add' ? 'Add Record' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
