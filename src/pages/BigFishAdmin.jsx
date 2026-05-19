import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const SNZ_BLUE = '#2B6CB0'

export default function BigFishAdmin() {
  const navigate  = useNavigate()
  const [comps,   setComps]   = useState([])
  const [species, setSpecies] = useState([])
  const [editing, setEditing] = useState(null)   // null = list, object = form
  const [entries, setEntries] = useState([])
  const [registrations, setRegistrations] = useState([])
  const [viewComp, setViewComp] = useState(null) // viewing entries for this comp
  const [loading, setLoading] = useState(true)

  const loadComps = async () => {
    setLoading(true)
    const { data } = await supabase.from('bigfish_comps').select('*').order('start_date', { ascending: false })
    setComps(data || [])
    setLoading(false)
  }

  const loadSpecies = async () => {
    const { data } = await supabase.from('bingo_species').select('name').eq('is_active', true).order('display_order')
    setSpecies((data || []).map(s => s.name).filter(n => !['Perform a rescue','Take a beginner out','Share 3 dishes'].includes(n)))
  }

  const loadEntries = async (comp) => {
    const [{ data: entriesData }, { data: regsData }] = await Promise.all([
      supabase.from('bigfish_entries').select('*')
        .eq('comp_id', comp.id).order('species').order('weight_kg', { ascending: false }),
      supabase.from('bigfish_registrations').select('*')
        .eq('comp_id', comp.id).order('registered_at'),
    ])
    setEntries(entriesData || [])
    setRegistrations(regsData || [])
    setViewComp(comp)
  }

  useEffect(() => { loadComps(); loadSpecies() }, [])

  const saveComp = async (form) => {
    const payload = {
      name:          form.name.trim(),
      description:   form.description.trim() || null,
      start_date:    form.start_date,
      end_date:      form.end_date,
      is_active:     form.is_active,
      species:       form.species,
      champion_note: form.champion_note.trim() || null,
    }
    if (form.id) {
      await supabase.from('bigfish_comps').update(payload).eq('id', form.id)
    } else {
      await supabase.from('bigfish_comps').insert(payload)
    }
    setEditing(null)
    loadComps()
  }

  const deleteComp = async (c) => {
    if (!window.confirm(`Delete "${c.name}"? All entries will also be deleted.`)) return
    await supabase.from('bigfish_comps').delete().eq('id', c.id)
    loadComps()
  }

  const removeEntry = async (e) => {
    if (!window.confirm(`Remove ${e.display_name}'s ${e.species} entry (${e.weight_kg} kg)?`)) return
    await supabase.from('bigfish_entries').delete().eq('id', e.id)
    loadEntries(viewComp)
  }

  const fmtDate = (d) => new Date(d + 'T00:00:00').toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })

  // ── Entry viewer ─────────────────────────────────────────────────────────────
  if (viewComp) {
    const bySpecies = {}
    for (const e of entries) {
      if (!bySpecies[e.species]) bySpecies[e.species] = []
      bySpecies[e.species].push(e)
    }
    return (
      <div className="min-h-screen bg-gray-50">
        <div style={{ background: SNZ_BLUE }} className="px-6 py-3 flex items-center justify-between border-b border-blue-700">
          <div className="flex items-center gap-3">
            <button onClick={() => { setViewComp(null); setEntries([]) }}
              className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
              ← Competitions
            </button>
            <span className="text-blue-200 text-sm opacity-75">/ {viewComp.name}</span>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-black text-gray-900">{viewComp.name} — Entries</h1>
              <p className="text-sm text-gray-400 mt-0.5">
                {entries.length} entries · {registrations.length} preregistered
              </p>
            </div>
            <button onClick={() => setEditing(viewComp)}
              className="px-4 py-2 rounded-xl font-bold text-sm border-2 border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600 transition">
              Edit comp settings
            </button>
          </div>

          {/* Champion note */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4 mb-6 shadow-sm">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Overall Champion (shown publicly)</label>
            <div className="flex gap-3">
              <input type="text" defaultValue={viewComp.champion_note || ''}
                id="champion-note"
                placeholder="e.g. 🏆 Overall Big Fish Champion 2025-26 — Jane Smith"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              <button
                onClick={async () => {
                  const note = document.getElementById('champion-note').value.trim()
                  await supabase.from('bigfish_comps').update({ champion_note: note || null }).eq('id', viewComp.id)
                  setViewComp({ ...viewComp, champion_note: note || null })
                }}
                className="px-4 py-2 rounded-xl font-bold text-sm text-white transition hover:opacity-90"
                style={{ background: SNZ_BLUE }}>
                Save
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1.5">Leave blank to hide. Use your judgment on overall winner based on species placings.</p>
          </div>

          {/* Preregistrations */}
          {registrations.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm mb-6">
              <div className="px-4 py-3 border-b border-gray-100 bg-blue-50 flex items-center justify-between">
                <h3 className="font-black text-blue-800">🤿 Preregistered ({registrations.length})</h3>
                <span className="text-xs text-blue-500">Signed up before comp opens</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    {['Name', 'Registered', 'Has entries?'].map(h => (
                      <th key={h} className="px-4 py-2 text-left text-xs font-bold text-gray-400 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {registrations.map((r, i) => {
                    const hasEntry = entries.some(e => e.user_id === r.user_id)
                    return (
                      <tr key={r.id} className={`border-b border-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                        <td className="px-4 py-2 font-bold text-gray-900">{r.display_name}</td>
                        <td className="px-4 py-2 text-xs text-gray-400">{new Date(r.registered_at).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                        <td className="px-4 py-2">
                          {hasEntry
                            ? <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">✓ Yes</span>
                            : <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 border border-gray-200">Not yet</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Entries by species */}
          {Object.keys(bySpecies).length === 0 ? (
            <div className="text-center py-12 text-gray-400 bg-white rounded-2xl border border-gray-200">No entries yet.</div>
          ) : (
            Object.entries(bySpecies).map(([sp, list]) => (
              <div key={sp} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm mb-4">
                <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                  <h3 className="font-black text-gray-800">{sp}</h3>
                  <span className="text-xs text-gray-400">{list.length} entr{list.length === 1 ? 'y' : 'ies'}</span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {['#', 'Angler', 'Weight', 'Length', 'Photos', 'Date', ''].map(h => (
                        <th key={h} className="px-4 py-2 text-left text-xs font-bold text-gray-400 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {list.sort((a, b) => b.weight_kg - a.weight_kg).map((e, i) => (
                      <tr key={e.id} className={`border-b border-gray-50 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                        <td className="px-4 py-2 text-gray-400 text-xs">{i + 1}</td>
                        <td className="px-4 py-2 font-bold text-gray-900">{e.display_name}</td>
                        <td className="px-4 py-2 font-black" style={{ color: SNZ_BLUE }}>{e.weight_kg} kg</td>
                        <td className="px-4 py-2 text-gray-500">{e.length_cm} cm</td>
                        <td className="px-4 py-2">
                          <div className="flex gap-1">
                            {[e.photo_glory_url, e.photo_scales_url, e.photo_length_url].map((url, pi) => url && (
                              <a key={pi} href={url} target="_blank" rel="noreferrer">
                                <img src={url} alt="" className="w-8 h-8 object-cover rounded-lg border border-gray-200 hover:border-blue-400 transition" />
                              </a>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-xs text-gray-400">{new Date(e.created_at).toLocaleDateString('en-NZ')}</td>
                        <td className="px-4 py-2">
                          <button onClick={() => removeEntry(e)}
                            className="text-xs font-bold px-2 py-1 rounded-lg border border-gray-200 text-gray-400 hover:border-red-300 hover:text-red-500 transition">
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
        </div>
      </div>
    )
  }

  // ── Comp form ─────────────────────────────────────────────────────────────────
  if (editing !== null) {
    return (
      <CompForm
        initial={editing}
        allSpecies={species}
        onSave={saveComp}
        onCancel={() => setEditing(null)}
      />
    )
  }

  // ── Comp list ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <div style={{ background: SNZ_BLUE }} className="px-6 py-3 flex items-center justify-between border-b border-blue-700">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/admin')}
            className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
            ← Admin
          </button>
          <span className="text-blue-200 text-sm opacity-75">/ Big Fish</span>
        </div>
        <button onClick={() => setEditing({ name: '', description: '', start_date: '', end_date: '', is_active: false, species: [], champion_note: '' })}
          className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
          + New Competition
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-black text-gray-900 mb-6">Big Fish Competitions</h1>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading…</div>
        ) : comps.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-gray-200 text-gray-400">
            No competitions yet — create one above.
          </div>
        ) : (
          <div className="space-y-3">
            {comps.map(c => {
              const now = new Date()
              const start = new Date(c.start_date)
              const end   = new Date(c.end_date)
              const status = !c.is_active ? 'Inactive'
                : now < start ? 'Upcoming'
                : now > end   ? 'Closed'
                : 'Active'
              const statusStyle = {
                Active:   'bg-green-50 text-green-700 border-green-200',
                Upcoming: 'bg-blue-50 text-blue-700 border-blue-200',
                Closed:   'bg-gray-100 text-gray-400 border-gray-200',
                Inactive: 'bg-gray-100 text-gray-400 border-gray-200',
              }[status]

              return (
                <div key={c.id} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex items-center gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-black text-gray-900">{c.name}</h3>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${statusStyle}`}>{status}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{fmtDate(c.start_date)} – {fmtDate(c.end_date)} · {c.species.length} species</p>
                    {c.champion_note && <p className="text-xs text-amber-600 font-semibold mt-0.5">🏆 {c.champion_note}</p>}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => loadEntries(c)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600 transition">
                      View Entries
                    </button>
                    <button onClick={() => setEditing(c)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600 transition">
                      Edit
                    </button>
                    <button onClick={() => deleteComp(c)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-200 text-gray-400 hover:border-red-300 hover:text-red-500 transition">
                      Del
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Competition form ──────────────────────────────────────────────────────────
function CompForm({ initial, allSpecies, onSave, onCancel }) {
  const [form, setForm] = useState({
    id:            initial.id || null,
    name:          initial.name || '',
    description:   initial.description || '',
    start_date:    initial.start_date || '',
    end_date:      initial.end_date || '',
    is_active:     initial.is_active || false,
    species:       initial.species || [],
    champion_note: initial.champion_note || '',
  })
  const [search, setSearch] = useState('')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const toggleSpecies = (name) =>
    set('species', form.species.includes(name)
      ? form.species.filter(s => s !== name)
      : [...form.species, name])

  const filtered = allSpecies.filter(s =>
    !search || s.toLowerCase().includes(search.toLowerCase()))

  const submit = (e) => {
    e.preventDefault()
    if (!form.name.trim())   return
    if (!form.start_date)    return
    if (!form.end_date)      return
    if (!form.species.length) return alert('Select at least one species.')
    onSave(form)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div style={{ background: SNZ_BLUE }} className="px-6 py-3 flex items-center border-b border-blue-700">
        <button onClick={onCancel}
          className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
          ← Cancel
        </button>
        <span className="text-blue-200 text-sm ml-3">{form.id ? 'Edit Competition' : 'New Competition'}</span>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-black text-gray-900 mb-6">{form.id ? `Edit: ${initial.name}` : 'New Big Fish Competition'}</h1>

        <form onSubmit={submit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Competition Name *</label>
            <input type="text" value={form.name} onChange={e => set('name', e.target.value)} required
              placeholder="e.g. SNZ Big Fish 2025-26"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={2}
              placeholder="Optional description shown on the public page"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Start Date *</label>
              <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">End Date *</label>
              <input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>

          {/* Species selector */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
              Species * — {form.species.length} selected
            </label>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search species…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-blue-300" />
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="max-h-52 overflow-y-auto divide-y divide-gray-50">
                {filtered.map(s => (
                  <label key={s} className="flex items-center gap-3 px-3 py-2 hover:bg-blue-50 cursor-pointer transition">
                    <input type="checkbox" checked={form.species.includes(s)} onChange={() => toggleSpecies(s)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600" />
                    <span className="text-sm text-gray-700">{s}</span>
                  </label>
                ))}
              </div>
            </div>
            {form.species.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {form.species.map(s => (
                  <span key={s} className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    {s}
                    <button type="button" onClick={() => toggleSpecies(s)} className="hover:text-red-500 transition">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Overall Champion Note</label>
            <input type="text" value={form.champion_note} onChange={e => set('champion_note', e.target.value)}
              placeholder="🏆 Overall Big Fish Champion 2025-26 — Name (set when comp closes)"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            <p className="text-xs text-gray-400 mt-1">Leave blank while comp is running. Fill in once you've determined the overall winner.</p>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600" />
            <span className="text-sm font-semibold text-gray-700">Active (visible on the hub)</span>
          </label>

          <div className="flex gap-3 pt-1">
            <button type="submit"
              className="px-6 py-2.5 rounded-xl font-bold text-sm text-white transition hover:opacity-90"
              style={{ background: SNZ_BLUE }}>
              {form.id ? 'Update Competition' : 'Create Competition'}
            </button>
            <button type="button" onClick={onCancel}
              className="px-6 py-2.5 rounded-xl font-bold text-sm border-2 border-gray-200 text-gray-600 hover:border-gray-300 transition">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
