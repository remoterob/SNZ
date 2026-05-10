import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const SNZ_BLUE = '#2B6CB0'
const STORAGE_BUCKET = 'snz-media'
const STORAGE_PREFIX = 'bingo/fish'

// Handles both legacy relative paths (fish/snapper.jpg) and full storage URLs
const imgSrc = (path) => {
  if (!path) return null
  return path.startsWith('http') ? path : `/${path}`
}

const uploadImage = async (file, slug) => {
  const ext = file.name.split('.').pop().toLowerCase()
  const storagePath = `${STORAGE_PREFIX}/${slug}.${ext}`
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, file, { contentType: file.type, upsert: true })
  if (error) throw error
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath)
  return data.publicUrl
}

export default function BingoSpeciesAdmin() {
  const navigate = useNavigate()
  const [species, setSpecies] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('bingo_species')
      .select('*')
      .order('display_order', { ascending: true })
    if (error) setError(error.message)
    else setSpecies(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleSave = async (form, imageFile) => {
    setSaving(true)
    setError(null)
    try {
      let imagePath = form.image_path
      if (imageFile) {
        if (!form.slug.trim()) throw new Error('Set the slug before uploading an image')
        imagePath = await uploadImage(imageFile, form.slug.trim())
      }
      const payload = {
        name: form.name.trim(),
        slug: form.slug.trim(),
        points: parseInt(form.points) || 0,
        image_path: imagePath,
        tips: form.tips.trim(),
        recipe_url: form.recipe_url.trim(),
        is_active: form.is_active,
        display_order: parseInt(form.display_order) || 0,
      }
      let err
      if (form.id) {
        ;({ error: err } = await supabase.from('bingo_species').update(payload).eq('id', form.id))
      } else {
        ;({ error: err } = await supabase.from('bingo_species').insert(payload))
      }
      if (err) throw err
      setEditing(null)
      load()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (s) => {
    await supabase.from('bingo_species').update({ is_active: !s.is_active }).eq('id', s.id)
    load()
  }

  const handleDelete = async (s) => {
    if (!window.confirm(`Delete "${s.name}"? This cannot be undone.`)) return
    const { error } = await supabase.from('bingo_species').delete().eq('id', s.id)
    if (error) setError(error.message)
    else load()
  }

  const filtered = species.filter(s =>
    search === '' ||
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.slug.toLowerCase().includes(search.toLowerCase())
  )

  if (editing !== null) {
    return (
      <SpeciesForm
        initial={editing}
        saving={saving}
        error={error}
        onSave={handleSave}
        onCancel={() => { setEditing(null); setError(null) }}
      />
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <div style={{ background: SNZ_BLUE }} className="px-6 py-3 flex items-center justify-between border-b border-blue-700">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/bingo/admin')}
            className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
            ← Bingo Admin
          </button>
          <span className="text-blue-200 text-sm opacity-75">/ Species</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-gray-900">Bingo Species</h1>
            <p className="text-sm text-gray-400 mt-0.5">{species.length} species · {species.filter(s => s.is_active).length} active</p>
          </div>
          <button
            onClick={() => setEditing({ name: '', slug: '', points: 100, image_path: '', tips: '', recipe_url: '', is_active: true, display_order: species.length + 1 })}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm text-white transition hover:opacity-90"
            style={{ background: SNZ_BLUE }}
          >
            + Add Species
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600 mb-4">{error}</div>
        )}

        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-4">
          <input
            type="text"
            placeholder="Search species or slug…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400">Loading…</div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm mb-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {['#', 'Species', 'Slug', 'Pts', 'Image', 'Active', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-bold tracking-widest text-gray-400 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s, i) => (
                    <tr key={s.id} className={`border-b border-gray-100 hover:bg-blue-50 transition ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                      <td className="px-4 py-3 text-gray-400 text-xs">{s.display_order}</td>
                      <td className="px-4 py-3 font-bold text-gray-900">
                        <div className="flex items-center gap-2">
                          {imgSrc(s.image_path) ? (
                            <img src={imgSrc(s.image_path)} alt={s.name}
                              className="w-10 h-10 object-cover rounded-lg border border-gray-200 flex-shrink-0"
                              onError={e => { e.target.style.display = 'none' }}
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-300 text-lg flex-shrink-0">🐟</div>
                          )}
                          {s.name}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs font-mono">{s.slug}</td>
                      <td className="px-4 py-3 font-black" style={{ color: SNZ_BLUE }}>{s.points}</td>
                      <td className="px-4 py-3">
                        {s.image_path ? (
                          <span className="text-xs text-green-600 font-semibold">✓ Set</span>
                        ) : (
                          <span className="text-xs text-amber-500 font-semibold">None</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleActive(s)}
                          className={`text-xs font-bold px-2 py-0.5 rounded-full border transition ${
                            s.is_active
                              ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                              : 'bg-gray-100 text-gray-400 border-gray-200 hover:bg-gray-200'
                          }`}
                        >
                          {s.is_active ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => setEditing(s)}
                            className="text-xs font-bold px-2 py-1 rounded-lg border border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600 transition">
                            Edit
                          </button>
                          <button onClick={() => handleDelete(s)}
                            className="text-xs font-bold px-2 py-1 rounded-lg border border-gray-200 text-gray-400 hover:border-red-300 hover:text-red-500 transition">
                            Del
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">No species match your search</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-2">
              {filtered.map(s => (
                <div key={s.id} className="bg-white border border-gray-200 rounded-xl p-3 flex items-center gap-3 shadow-sm">
                  {imgSrc(s.image_path) ? (
                    <img src={imgSrc(s.image_path)} alt={s.name}
                      className="w-12 h-12 object-cover rounded-lg border border-gray-200 flex-shrink-0"
                      onError={e => { e.target.style.display = 'none' }}
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-gray-300 text-xl flex-shrink-0">🐟</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-gray-900 text-sm">{s.name}</div>
                    <div className="text-xs text-gray-400 font-mono">{s.slug}</div>
                    <div className="text-xs font-black mt-0.5" style={{ color: SNZ_BLUE }}>{s.points} pts</div>
                  </div>
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    <button onClick={() => toggleActive(s)}
                      className={`text-xs font-bold px-2 py-0.5 rounded-full border ${s.is_active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-400 border-gray-200'}`}>
                      {s.is_active ? 'Active' : 'Off'}
                    </button>
                    <button onClick={() => setEditing(s)}
                      className="text-xs font-bold px-2 py-0.5 rounded-lg border border-gray-200 text-gray-600">
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function SpeciesForm({ initial, saving, error, onSave, onCancel }) {
  const fileRef = useRef(null)
  const [form, setForm] = useState({
    id: initial.id || null,
    name: initial.name || '',
    slug: initial.slug || '',
    points: initial.points ?? 100,
    image_path: initial.image_path || '',
    tips: initial.tips || '',
    recipe_url: initial.recipe_url || '',
    is_active: initial.is_active !== false,
    display_order: initial.display_order ?? 0,
  })
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(imgSrc(initial.image_path))
  const [uploading, setUploading] = useState(false)

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const autoSlug = (name) => {
    if (form.id) return
    set('slug', name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.slug.trim()) return
    setUploading(!!imageFile)
    await onSave(form, imageFile)
    setUploading(false)
  }

  const clearImage = () => {
    setImageFile(null)
    setImagePreview(null)
    set('image_path', '')
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="min-h-screen bg-white">
      <div style={{ background: SNZ_BLUE }} className="px-6 py-3 flex items-center border-b border-blue-700">
        <button onClick={onCancel}
          className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
          ← Cancel
        </button>
        <span className="text-blue-200 text-sm ml-3">{form.id ? 'Edit Species' : 'Add Species'}</span>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8">
        <h1 className="text-2xl font-black text-gray-900 mb-6">{form.id ? `Edit: ${initial.name}` : 'Add New Species'}</h1>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600 mb-4">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Name" required>
              <input type="text" value={form.name} required
                onChange={e => { set('name', e.target.value); autoSlug(e.target.value) }}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </Field>

            <Field label="Slug" required hint="Unique URL-safe identifier">
              <input type="text" value={form.slug} required
                onChange={e => set('slug', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </Field>

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

          {/* Image upload */}
          <Field label="Species Image">
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-4">
              {imagePreview ? (
                <div className="flex items-start gap-4">
                  <img src={imagePreview} alt="preview"
                    className="w-24 h-24 object-cover rounded-xl border border-gray-200 flex-shrink-0"
                    onError={e => { e.target.style.display = 'none' }}
                  />
                  <div className="flex-1 min-w-0">
                    {imageFile ? (
                      <p className="text-xs font-semibold text-green-600 mb-1">✓ New image ready to upload: {imageFile.name}</p>
                    ) : (
                      <p className="text-xs text-gray-400 mb-1 break-all">{form.image_path}</p>
                    )}
                    <div className="flex gap-2 mt-2">
                      <button type="button"
                        onClick={() => fileRef.current?.click()}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg border-2 border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600 transition">
                        Replace image
                      </button>
                      <button type="button" onClick={clearImage}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg border-2 border-gray-200 text-gray-400 hover:border-red-200 hover:text-red-500 transition">
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <button type="button"
                  onClick={() => fileRef.current?.click()}
                  className="w-full flex flex-col items-center gap-2 py-4 text-gray-400 hover:text-blue-500 transition">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <circle cx="8.5" cy="8.5" r="1.5"/>
                    <polyline points="21 15 16 10 5 21"/>
                  </svg>
                  <span className="text-sm font-semibold">Click to upload image</span>
                  <span className="text-xs">JPG, PNG, WebP</span>
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          </Field>

          <Field label="Recipe URL">
            <input type="url" value={form.recipe_url}
              onChange={e => set('recipe_url', e.target.value)}
              placeholder="https://…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </Field>

          <Field label="Tips">
            <textarea value={form.tips} rows={5}
              onChange={e => set('tips', e.target.value)}
              placeholder="Targeting tips for this species…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-y" />
          </Field>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_active}
              onChange={e => set('is_active', e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600" />
            <span className="text-sm font-semibold text-gray-700">Active (visible on bingo board)</span>
          </label>

          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={saving || uploading}
              className="px-6 py-2.5 rounded-xl font-bold text-sm text-white disabled:opacity-50 transition hover:opacity-90"
              style={{ background: SNZ_BLUE }}>
              {uploading ? 'Uploading image…' : saving ? 'Saving…' : (form.id ? 'Update Species' : 'Add Species')}
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
