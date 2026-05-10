import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const SNZ_BLUE = '#2B6CB0'

const MONTHS = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export default function BingoBonusAdmin() {
  const navigate = useNavigate()
  const [bonuses, setBonuses] = useState([])
  const [species, setSpecies] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const loadBonuses = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('bingo_bonuses')
      .select('*')
      .order('bonus_type', { ascending: true })
      .order('display_order', { ascending: true })
    if (error) setError(error.message)
    else setBonuses(data || [])
    setLoading(false)
  }

  const loadSpecies = async () => {
    const { data } = await supabase
      .from('bingo_species')
      .select('id, name, slug')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
    setSpecies(data || [])
  }

  useEffect(() => {
    loadBonuses()
    loadSpecies()
  }, [])

  const handleSave = async (form) => {
    setSaving(true)
    setError(null)
    const payload = {
      slug: form.slug.trim(),
      title: form.title.trim(),
      description: form.description.trim(),
      bonus_type: form.bonus_type,
      month: form.bonus_type === 'monthly' ? parseInt(form.month) : null,
      points: parseInt(form.points) || 0,
      species: form.species,
      display_order: parseInt(form.display_order) || 0,
      is_active: form.is_active,
    }
    let err
    if (form.id) {
      ;({ error: err } = await supabase.from('bingo_bonuses').update(payload).eq('id', form.id))
    } else {
      ;({ error: err } = await supabase.from('bingo_bonuses').insert(payload))
    }
    setSaving(false)
    if (err) { setError(err.message); return }
    setEditing(null)
    loadBonuses()
  }

  const toggleActive = async (b) => {
    await supabase.from('bingo_bonuses').update({ is_active: !b.is_active }).eq('id', b.id)
    loadBonuses()
  }

  const handleDelete = async (b) => {
    if (!window.confirm(`Delete "${b.title}"?`)) return
    const { error } = await supabase.from('bingo_bonuses').delete().eq('id', b.id)
    if (error) setError(error.message)
    else loadBonuses()
  }

  const monthly = bonuses.filter(b => b.bonus_type === 'monthly')
  const evergreen = bonuses.filter(b => b.bonus_type === 'evergreen')

  if (editing !== null) {
    return (
      <BonusForm
        initial={editing}
        species={species}
        saving={saving}
        error={error}
        onSave={handleSave}
        onCancel={() => { setEditing(null); setError(null) }}
      />
    )
  }

  const newBonus = { title: '', slug: '', description: '', bonus_type: 'evergreen', month: 1, points: 250, species: [], display_order: bonuses.length + 1, is_active: true }

  return (
    <div className="min-h-screen bg-white">
      <div style={{ background: SNZ_BLUE }} className="px-6 py-3 flex items-center justify-between border-b border-blue-700">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/bingo/admin')}
            className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
            ← Bingo Admin
          </button>
          <span className="text-blue-200 text-sm opacity-75">/ Bonuses</span>
        </div>
        <button
          onClick={() => setEditing(newBonus)}
          className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
          + Add Bonus
        </button>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-gray-900">Bingo Bonuses</h1>
          <p className="text-sm text-gray-400 mt-0.5">{bonuses.length} bonuses · {bonuses.filter(b => b.is_active).length} active</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600 mb-4">{error}</div>
        )}

        {loading ? (
          <div className="text-center py-16 text-gray-400">Loading…</div>
        ) : (
          <div className="space-y-8">
            <BonusSection
              title="Monthly Bonuses"
              subtitle="Awarded for completing a row within a specific calendar month"
              bonuses={monthly}
              onEdit={setEditing}
              onDelete={handleDelete}
              onToggle={toggleActive}
            />
            <BonusSection
              title="Evergreen Bonuses"
              subtitle="Available for the full competition season"
              bonuses={evergreen}
              onEdit={setEditing}
              onDelete={handleDelete}
              onToggle={toggleActive}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function BonusSection({ title, subtitle, bonuses, onEdit, onDelete, onToggle }) {
  return (
    <div>
      <div className="mb-3">
        <h2 className="text-lg font-black text-gray-900">{title}</h2>
        <p className="text-xs text-gray-400">{subtitle}</p>
      </div>

      {bonuses.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6 text-center text-sm text-gray-400">
          No {title.toLowerCase()} defined yet
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          {/* Desktop */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['Title', 'Month', 'Pts', 'Species', 'Active', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold tracking-widest text-gray-400 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bonuses.map((b, i) => (
                  <tr key={b.id} className={`border-b border-gray-100 hover:bg-blue-50 transition ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                    <td className="px-4 py-3 font-bold text-gray-900">{b.title}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{b.month ? MONTHS[b.month] : '—'}</td>
                    <td className="px-4 py-3 font-black text-sm" style={{ color: SNZ_BLUE }}>{b.points}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {Array.isArray(b.species) && b.species.length > 0
                        ? <span title={b.species.join(', ')}>{b.species.length} species</span>
                        : <span className="text-amber-500 font-semibold">None set</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => onToggle(b)}
                        className={`text-xs font-bold px-2 py-0.5 rounded-full border transition ${
                          b.is_active
                            ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                            : 'bg-gray-100 text-gray-400 border-gray-200 hover:bg-gray-200'
                        }`}
                      >
                        {b.is_active ? 'Active' : 'Off'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button onClick={() => onEdit(b)}
                          className="text-xs font-bold px-2 py-1 rounded-lg border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600 transition">
                          Edit
                        </button>
                        <button onClick={() => onDelete(b)}
                          className="text-xs font-bold px-2 py-1 rounded-lg border border-gray-200 text-gray-400 hover:border-red-300 hover:text-red-500 transition">
                          Del
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden divide-y divide-gray-100">
            {bonuses.map(b => (
              <div key={b.id} className="p-4 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-gray-900 text-sm">{b.title}</div>
                  {b.month && <div className="text-xs text-gray-400">{MONTHS[b.month]}</div>}
                  <div className="text-xs font-black mt-0.5" style={{ color: SNZ_BLUE }}>{b.points} pts</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {Array.isArray(b.species) && b.species.length > 0
                      ? `${b.species.length} species`
                      : <span className="text-amber-500 font-semibold">No species set</span>
                    }
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  <button onClick={() => onToggle(b)}
                    className={`text-xs font-bold px-2 py-0.5 rounded-full border ${b.is_active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-400 border-gray-200'}`}>
                    {b.is_active ? 'Active' : 'Off'}
                  </button>
                  <button onClick={() => onEdit(b)}
                    className="text-xs font-bold px-2 py-0.5 rounded-lg border border-gray-200 text-gray-600">
                    Edit
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function BonusForm({ initial, species, saving, error, onSave, onCancel }) {
  const [form, setForm] = useState({
    id: initial.id || null,
    title: initial.title || '',
    slug: initial.slug || '',
    description: initial.description || '',
    bonus_type: initial.bonus_type || 'evergreen',
    month: initial.month || 1,
    points: initial.points ?? 250,
    species: Array.isArray(initial.species) ? initial.species : [],
    display_order: initial.display_order ?? 0,
    is_active: initial.is_active !== false,
  })

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const toggleSpecies = (name) => {
    set('species', form.species.includes(name)
      ? form.species.filter(s => s !== name)
      : [...form.species, name]
    )
  }

  const autoSlug = (title) => {
    if (form.id) return
    set('slug', 'bonus-' + title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    if (!form.slug.trim()) return
    onSave(form)
  }

  return (
    <div className="min-h-screen bg-white">
      <div style={{ background: SNZ_BLUE }} className="px-6 py-3 flex items-center border-b border-blue-700">
        <button onClick={onCancel}
          className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
          ← Cancel
        </button>
        <span className="text-blue-200 text-sm ml-3">{form.id ? 'Edit Bonus' : 'Add Bonus'}</span>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-black text-gray-900 mb-6">{form.id ? `Edit: ${initial.title}` : 'Add New Bonus'}</h1>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600 mb-4">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Title" required>
              <input type="text" value={form.title} required
                onChange={e => { set('title', e.target.value); autoSlug(e.target.value) }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </Field>

            <Field label="Slug" required hint="Unique identifier">
              <input type="text" value={form.slug} required
                onChange={e => set('slug', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </Field>

            <Field label="Type" required>
              <select value={form.bonus_type} onChange={e => set('bonus_type', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="evergreen">Evergreen (full season)</option>
                <option value="monthly">Monthly (specific month)</option>
              </select>
            </Field>

            {form.bonus_type === 'monthly' && (
              <Field label="Month" required>
                <select value={form.month} onChange={e => set('month', parseInt(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                  {MONTHS.slice(1).map((m, i) => (
                    <option key={i + 1} value={i + 1}>{m}</option>
                  ))}
                </select>
              </Field>
            )}

            <Field label="Points" required>
              <input type="number" value={form.points} min="0" step="50" required
                onChange={e => set('points', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </Field>

            <Field label="Display Order">
              <input type="number" value={form.display_order} min="0"
                onChange={e => set('display_order', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </Field>
          </div>

          <Field label="Description">
            <textarea value={form.description} rows={2}
              onChange={e => set('description', e.target.value)}
              placeholder="Optional description shown to players…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-y" />
          </Field>

          <Field
            label={`Species for this bonus (${form.species.length} selected)`}
            hint="All selected species must be claimed to earn this bonus"
          >
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="bg-gray-50 px-3 py-2 border-b border-gray-200 flex items-center justify-between">
                <span className="text-xs text-gray-500">{species.length} active species</span>
                {form.species.length > 0 && (
                  <button type="button" onClick={() => set('species', [])}
                    className="text-xs text-red-500 hover:text-red-700 font-semibold transition">
                    Clear all
                  </button>
                )}
              </div>
              <div className="p-3 max-h-56 overflow-y-auto">
                {species.length === 0 ? (
                  <p className="text-xs text-gray-400">Loading species…</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {species.map(s => (
                      <label key={s.slug} className="flex items-center gap-2 cursor-pointer px-2 py-1.5 rounded-lg hover:bg-blue-50 transition">
                        <input type="checkbox"
                          checked={form.species.includes(s.name)}
                          onChange={() => toggleSpecies(s.name)}
                          className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600"
                        />
                        <span className="text-sm text-gray-700">{s.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Field>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_active}
              onChange={e => set('is_active', e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600" />
            <span className="text-sm font-semibold text-gray-700">Active (visible to players)</span>
          </label>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving}
              className="px-6 py-2.5 rounded-xl font-bold text-sm text-white disabled:opacity-50 transition hover:opacity-90"
              style={{ background: SNZ_BLUE }}>
              {saving ? 'Saving…' : (form.id ? 'Update Bonus' : 'Add Bonus')}
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

function Field({ label, required, hint, children }) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
        {label}{required && <span className="text-red-400 ml-1">*</span>}
      </label>
      {hint && <p className="text-xs text-gray-400 mb-1">{hint}</p>}
      {children}
    </div>
  )
}
