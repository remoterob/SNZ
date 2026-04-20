import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const SNZ_BLUE = '#2B6CB0'
const SNZ_DARK = '#1e3a5f'
const BUCKET = 'fish-species-photos'

export default function FishSpeciesAdmin() {
  const navigate = useNavigate()
  const [species, setSpecies] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [tips, setTips] = useState('')
  const [photos, setPhotos] = useState([])
  const fileRef = useRef(null)

  const fetchSpecies = async () => {
    const { data } = await supabase.from('fish_species')
      .select('id, common_name, scientific_name, tips')
      .order('common_name')
    setSpecies(data || [])
    setLoading(false)
  }

  const fetchPhotos = async (speciesId) => {
    const { data } = await supabase.from('fish_species_photos')
      .select('*').eq('species_id', speciesId)
      .order('is_hero', { ascending: false }).order('sort_order')
    setPhotos(data || [])
  }

  useEffect(() => { fetchSpecies() }, [])

  const selectSpecies = (s) => {
    setSelected(s)
    setTips(s.tips || '')
    fetchPhotos(s.id)
  }

  const saveTips = async () => {
    if (!selected) return
    setSaving(true)
    const { error } = await supabase.from('fish_species')
      .update({ tips }).eq('id', selected.id)
    setSaving(false)
    if (error) { alert('Save failed: ' + error.message); return }
    setSpecies(species.map(s => s.id === selected.id ? { ...s, tips } : s))
    setSelected({ ...selected, tips })
  }

  const deletePhoto = async (photo) => {
    if (!confirm('Delete this photo?')) return
    // Try to delete from storage (best-effort — URL may not map)
    try {
      const match = photo.photo_url.match(/\/fish-species-photos\/(.+)$/)
      if (match) await supabase.storage.from(BUCKET).remove([match[1]])
    } catch {}
    await supabase.from('fish_species_photos').delete().eq('id', photo.id)
    fetchPhotos(selected.id)
  }

  const setHero = async (photo) => {
    // Unset current hero
    await supabase.from('fish_species_photos')
      .update({ is_hero: false }).eq('species_id', selected.id).eq('is_hero', true)
    // Set new hero
    await supabase.from('fish_species_photos')
      .update({ is_hero: true }).eq('id', photo.id)
    fetchPhotos(selected.id)
  }

  const uploadPhoto = async (file) => {
    if (!file || !selected) return
    setSaving(true)
    try {
      const ext = file.name.split('.').pop()
      const storagePath = `admin-uploads/${selected.id}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from(BUCKET)
        .upload(storagePath, file, { contentType: file.type, upsert: false })
      if (upErr) throw upErr
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
      await supabase.from('fish_species_photos').insert({
        species_id: selected.id,
        photo_url: urlData.publicUrl,
        is_hero: false,
        sort_order: 30,
      })
      fetchPhotos(selected.id)
    } catch (err) {
      alert('Upload failed: ' + err.message)
    } finally {
      setSaving(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const filtered = species.filter(s =>
    !search || s.common_name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div style={{ background: SNZ_DARK }} className="px-6 py-3 flex items-center gap-3 border-b border-blue-900">
        <button onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
          ← Home
        </button>
        <span className="text-white/50">/</span>
        <span className="text-white font-bold text-sm">Fish Species Admin</span>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 grid grid-cols-1 md:grid-cols-[320px,1fr] gap-4">
        {/* Species list */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden flex flex-col" style={{ maxHeight: 'calc(100vh - 120px)' }}>
          <div className="p-3 border-b border-gray-100">
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search species…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading && <div className="p-4 text-sm text-gray-400">Loading…</div>}
            {filtered.map(s => (
              <button key={s.id} onClick={() => selectSpecies(s)}
                className={`w-full text-left px-4 py-3 border-b border-gray-100 text-sm hover:bg-blue-50 transition ${selected?.id === s.id ? 'bg-blue-50 border-l-4' : 'border-l-4 border-l-transparent'}`}
                style={selected?.id === s.id ? { borderLeftColor: SNZ_BLUE } : {}}>
                <div className="font-bold text-gray-900">{s.common_name}</div>
                {s.scientific_name && <div className="text-xs italic text-gray-400">{s.scientific_name}</div>}
              </button>
            ))}
            {!loading && filtered.length === 0 && (
              <div className="p-4 text-sm text-gray-400 text-center">No species match.</div>
            )}
          </div>
        </div>

        {/* Detail pane */}
        {!selected ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center text-gray-400">
            Select a species from the list to edit.
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <h2 className="text-2xl font-black text-gray-900">{selected.common_name}</h2>
              {selected.scientific_name && <p className="italic text-gray-500 text-sm mt-0.5">{selected.scientific_name}</p>}
            </div>

            {/* Tips editor */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-sm uppercase tracking-widest" style={{ color: SNZ_BLUE }}>How to target {selected.common_name}</h3>
                <span className="text-xs text-gray-400">Markdown supported</span>
              </div>
              <textarea value={tips} onChange={e => setTips(e.target.value)}
                rows={10}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300"
                placeholder="Tips for targeting this species…"
              />
              <div className="flex gap-2 justify-end">
                <button onClick={() => setTips(selected.tips || '')}
                  className="px-4 py-2 rounded-lg text-sm font-bold border border-gray-300 text-gray-600 hover:bg-gray-50">
                  Revert
                </button>
                <button onClick={saveTips} disabled={saving || tips === (selected.tips || '')}
                  className="px-5 py-2 rounded-lg text-sm font-black text-white disabled:opacity-40"
                  style={{ background: SNZ_BLUE }}>
                  {saving ? 'Saving…' : 'Save Tips'}
                </button>
              </div>
            </div>

            {/* Photos */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-black text-sm uppercase tracking-widest" style={{ color: SNZ_BLUE }}>Photos ({photos.length})</h3>
                <label className="cursor-pointer px-4 py-2 rounded-lg text-sm font-black text-white"
                  style={{ background: SNZ_BLUE }}>
                  + Add Photo
                  <input ref={fileRef} type="file" accept="image/*"
                    onChange={e => uploadPhoto(e.target.files?.[0])}
                    className="hidden" />
                </label>
              </div>

              {photos.length === 0 && (
                <div className="text-center py-8 text-gray-400 text-sm bg-gray-50 rounded-xl">No photos yet.</div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {photos.map(p => (
                  <div key={p.id} className="relative group border border-gray-200 rounded-xl overflow-hidden">
                    <img src={p.photo_url} alt="" className="w-full h-32 object-cover" />
                    {p.is_hero && (
                      <span className="absolute top-1 left-1 bg-amber-400 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded-full">HERO</span>
                    )}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1">
                      {!p.is_hero && (
                        <button onClick={() => setHero(p)}
                          className="text-xs font-bold bg-amber-400 text-amber-900 px-2 py-1 rounded">
                          Make Hero
                        </button>
                      )}
                      <button onClick={() => deletePhoto(p)}
                        className="text-xs font-bold bg-red-500 text-white px-2 py-1 rounded">
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
