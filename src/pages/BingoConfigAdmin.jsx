import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, clearAdminSession } from '../lib/supabase'
import { RuleBody } from './bingo/BingoRulesPage'

const SNZ_BLUE = '#2B6CB0'

const STATUS_OPTIONS = [
  { value: 'upcoming', label: 'Upcoming', desc: 'Not open yet — claims disabled' },
  { value: 'active',   label: 'Active',   desc: 'Claims open' },
  { value: 'closed',   label: 'Closed',   desc: 'Season over — claims disabled' },
]

// datetime-local inputs want 'YYYY-MM-DDTHH:mm' in local time.
const toInputValue = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function BingoConfigAdmin() {
  const navigate = useNavigate()
  const [config, setConfig] = useState(null)
  const [form, setForm] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [preview, setPreview] = useState(null) // index of section being previewed

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('bingo_comp_config').select('*').eq('is_active', true).maybeSingle()
    setConfig(data)
    setForm(data ? {
      season: data.season || '',
      status: data.status || 'upcoming',
      comp_start: toInputValue(data.comp_start),
      comp_end: toInputValue(data.comp_end),
      rules_sections: data.rules_sections?.length ? [...data.rules_sections] : [],
    } : null)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  if (loading) return <div className="min-h-screen bg-white flex items-center justify-center text-gray-400 text-sm">Loading…</div>
  if (!config || !form) return (
    <div className="min-h-screen bg-white flex items-center justify-center text-gray-400 text-sm">
      No active Fish Bingo season config found.
    </div>
  )

  const set = k => v => setForm(f => ({ ...f, [k]: v }))
  const setSection = (i, field) => v => setForm(f => ({
    ...f, rules_sections: f.rules_sections.map((s, idx) => idx === i ? { ...s, [field]: v } : s),
  }))
  const addSection = () => setForm(f => ({ ...f, rules_sections: [...f.rules_sections, { title: 'New Section', body: '' }] }))
  const removeSection = (i) => setForm(f => ({ ...f, rules_sections: f.rules_sections.filter((_, idx) => idx !== i) }))
  const moveSection = (i, dir) => setForm(f => {
    const arr = [...f.rules_sections]
    const j = i + dir
    if (j < 0 || j >= arr.length) return f
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
    return { ...f, rules_sections: arr }
  })

  const save = async () => {
    setSaving(true); setError(''); setSaved(false)
    try {
      const res = await fetch('/.netlify/functions/bingo-admin-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminPassword: import.meta.env.VITE_ADMIN_PASSWORD,
          id: config.id,
          season: form.season.trim(),
          status: form.status,
          comp_start: form.comp_start ? new Date(form.comp_start).toISOString() : null,
          comp_end: form.comp_end ? new Date(form.comp_end).toISOString() : null,
          rules_sections: form.rules_sections,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setSaved(true)
      await load()
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <div style={{ background: SNZ_BLUE }} className="px-6 py-3 flex items-center justify-between border-b border-blue-700">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/bingo/admin')}
            className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
            ← Fish Bingo Admin
          </button>
          <span className="text-blue-200 text-sm opacity-75">/ Setup</span>
        </div>
        <button onClick={() => { clearAdminSession(); navigate('/') }}
          className="text-xs text-blue-200 hover:text-white transition">Sign out</button>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-5">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Season Setup</h1>
          <p className="text-sm text-gray-400 mt-0.5">Status, dates, and rules text for the current season.</p>
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>}

        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Season label</label>
            <input value={form.season} onChange={e => set('season')(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="e.g. 2025-26" />
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Status</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {STATUS_OPTIONS.map(o => (
                <button key={o.value} type="button" onClick={() => set('status')(o.value)}
                  className={`text-left p-3 rounded-xl border-2 transition ${form.status === o.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <p className={`text-sm font-black ${form.status === o.value ? 'text-blue-700' : 'text-gray-700'}`}>{o.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{o.desc}</p>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-2">This is the real switch — it overrides the dates below for whether claiming is open.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Comp start</label>
              <input type="datetime-local" value={form.comp_start} onChange={e => set('comp_start')(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Comp end</label>
              <input type="datetime-local" value={form.comp_end} onChange={e => set('comp_end')(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>
          <p className="text-xs text-gray-400">Shown on the Rules page as "The competition runs …". Dates are informational only now that Status is a manual switch.</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-black text-gray-900">Rules Text</h3>
              <p className="text-xs text-gray-400 mt-0.5">One card per section. Use **bold** and *italic* — line breaks become paragraphs.</p>
            </div>
            <button type="button" onClick={addSection}
              className="text-xs font-bold px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 flex-shrink-0">
              + Add section
            </button>
          </div>

          {form.rules_sections.length === 0 && (
            <p className="text-sm text-gray-400 italic py-4 text-center">No sections yet — add one above.</p>
          )}

          {form.rules_sections.map((s, i) => (
            <div key={i} className="border border-gray-200 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center gap-2">
                <input value={s.title} onChange={e => setSection(i, 'title')(e.target.value)}
                  className="flex-1 min-w-0 border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-300"
                  placeholder="Section title" />
                <button type="button" onClick={() => moveSection(i, -1)} disabled={i === 0}
                  className="w-7 h-7 rounded-lg border border-gray-300 text-gray-500 text-xs font-bold disabled:opacity-30 flex-shrink-0">↑</button>
                <button type="button" onClick={() => moveSection(i, 1)} disabled={i === form.rules_sections.length - 1}
                  className="w-7 h-7 rounded-lg border border-gray-300 text-gray-500 text-xs font-bold disabled:opacity-30 flex-shrink-0">↓</button>
                <button type="button" onClick={() => removeSection(i)}
                  className="text-xs font-bold px-2 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 flex-shrink-0">Remove</button>
              </div>
              <textarea value={s.body} onChange={e => setSection(i, 'body')(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 min-h-[90px] resize-y font-mono"
                placeholder="Section body — supports **bold**, *italic*, blank lines for new paragraphs" />
              <button type="button" onClick={() => setPreview(preview === i ? null : i)}
                className="text-xs font-bold" style={{ color: SNZ_BLUE }}>
                {preview === i ? 'Hide preview' : 'Preview'}
              </button>
              {preview === i && (
                <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-sm text-gray-600">
                  <RuleBody text={s.body} />
                </div>
              )}
            </div>
          ))}
        </div>

        <button onClick={save} disabled={saving}
          className="w-full py-3 rounded-xl font-black text-white text-sm disabled:opacity-50"
          style={{ background: SNZ_BLUE }}>
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}
