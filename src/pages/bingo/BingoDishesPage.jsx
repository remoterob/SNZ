import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { isBonusSlug } from '../../lib/bingo/helpers'

const SNZ_BLUE = '#2B6CB0'
const STORAGE_BUCKET = 'snz-media'
const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300'

export default function BingoDishesPage({ species, me, signedIn, compCfg }) {
  const [name,        setName]       = useState('')
  const [speciesSlug, setSpeciesSlug] = useState('')
  const [recipeLink,  setRecipeLink] = useState('')
  const [desc,        setDesc]       = useState('')
  const [file,        setFile]       = useState(null)
  const [busy,        setBusy]       = useState(false)
  const [mine,        setMine]       = useState([])

  const edibleSpecies = useMemo(() => (species || []).filter(s => !isBonusSlug(s.slug)), [species])

  const loadMine = useCallback(async () => {
    if (!me?.id) { setMine([]); return }
    const { data } = await supabase
      .from('bingo_dishes')
      .select('id, title, species_slug, recipe_link, description, photo_url, thumb_url, created_at')
      .eq('user_id', me.id)
      .order('created_at', { ascending: false })
    setMine(data || [])
  }, [me?.id])

  useEffect(() => { loadMine() }, [loadMine])

  if (!signedIn || !me?.id) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-6 text-center">
        <h3 className="font-black text-gray-900 mb-1">Dishes</h3>
        <p className="text-sm text-gray-400">Sign in to add and view your dishes.</p>
      </div>
    )
  }

  const onSubmit = async (e) => {
    e?.preventDefault?.()
    if (!name.trim()) return alert('Please enter a dish name.')
    if (!speciesSlug)  return alert('Please pick a species.')
    if (!file)         return alert('Please select a photo.')
    if (file.size > 10 * 1024 * 1024) return alert('File too large – max 10 MB.')

    setBusy(true)
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
      const ts  = Date.now()
      const base      = `bingo/dishes/${me.id}/${speciesSlug}-${ts}`
      const fullPath  = `${base}.${ext}`
      const thumbPath = `bingo/dishes/thumbs/${me.id}/${speciesSlug}-${ts}.jpg`

      let thumbUrl = ''
      try {
        const thumbFile = await makeThumbnail(file, 500)
        await supabase.storage.from(STORAGE_BUCKET).upload(thumbPath, thumbFile, { upsert: true })
        const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(thumbPath)
        thumbUrl = data?.publicUrl || ''
      } catch {}

      await supabase.storage.from(STORAGE_BUCKET).upload(fullPath, file, { upsert: true })
      const { data: fd } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(fullPath)

      const { error } = await supabase.from('bingo_dishes').insert({
        user_id:     me.id,
        title:       name.trim(),
        species_slug: speciesSlug,
        recipe_link: recipeLink?.trim() || null,
        description: desc?.trim() || null,
        photo_url:   fd.publicUrl,
        thumb_url:   thumbUrl || fd.publicUrl,
        comp_season: compCfg?.season || '',
      })
      if (error) throw error

      setName(''); setSpeciesSlug(''); setRecipeLink(''); setDesc(''); setFile(null)
      await loadMine()
    } catch (err) {
      alert('Could not save dish: ' + (err.message || err))
    } finally { setBusy(false) }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5">
        <h3 className="font-black text-gray-900 mb-3">Add a New Dish</h3>
        <form onSubmit={onSubmit} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input className={inputClass} placeholder="Dish name *" value={name} onChange={e => setName(e.target.value)} />
            <select className={inputClass} value={speciesSlug} onChange={e => setSpeciesSlug(e.target.value)}>
              <option value="">Select species *</option>
              {edibleSpecies.map(s => <option key={s.slug} value={s.slug}>{s.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input className={inputClass} placeholder="Recipe URL (optional)" value={recipeLink} onChange={e => setRecipeLink(e.target.value)} />
            <input className={inputClass} type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] || null)} />
          </div>
          <textarea className={`${inputClass} min-h-[90px] resize-y`} placeholder="Description & Cooking Guide (optional)" value={desc} onChange={e => setDesc(e.target.value)} />
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <button className="text-sm font-bold px-4 py-2 rounded-lg text-white disabled:opacity-50" style={{ background: SNZ_BLUE }} disabled={busy}>
              {busy ? 'Saving…' : 'Add Dish'}
            </button>
            <span className="text-xs text-gray-400">Photo max 10 MB</span>
          </div>
        </form>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5">
        <h3 className="font-black text-gray-900 mb-3">Your Dishes</h3>
        {mine.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No dishes yet – add your first above!</p>
        ) : (
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
            {mine.map(d => (
              <div key={d.id} className="bg-white border border-gray-200 rounded-xl p-2">
                <a href={d.photo_url} target="_blank" rel="noreferrer" className="relative block">
                  <img src={d.thumb_url || d.photo_url} alt={d.title} className="w-full rounded-lg" loading="lazy" />
                  <span className="absolute top-1.5 right-1.5 text-xs font-bold px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100">
                    {edibleSpecies.find(s => s.slug === d.species_slug)?.name || d.species_slug}
                  </span>
                </a>
                <p className="font-bold text-gray-900 text-sm mt-1.5">{d.title}</p>
                {d.recipe_link && (
                  <a href={d.recipe_link} target="_blank" rel="noreferrer" className="text-xs font-semibold underline" style={{ color: SNZ_BLUE }}>
                    View Recipe
                  </a>
                )}
                {d.description && (
                  <p className="text-xs text-gray-500 mt-1 whitespace-pre-wrap">{d.description}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

async function makeThumbnail(file, maxWidth = 500) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width)
      const canvas = document.createElement('canvas')
      canvas.width  = Math.max(1, Math.round(img.width  * scale))
      canvas.height = Math.max(1, Math.round(img.height * scale))
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(blob => {
        if (!blob) return reject(new Error('Thumbnail failed'))
        resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }))
      }, 'image/jpeg', 0.82)
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}
