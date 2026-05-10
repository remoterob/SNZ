import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { isBonusSlug } from '../../lib/bingo/helpers'

const STORAGE_BUCKET = 'snz-media'

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
      <div className="card">
        <h3>Dishes</h3>
        <p className="small muted">Sign in to add and view your dishes.</p>
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
    <div className="card">
      <h3>Add a New Dish</h3>
      <form onSubmit={onSubmit} className="add-dish-form">
        <div className="row2">
          <input className="input" placeholder="Dish name *" value={name} onChange={e => setName(e.target.value)} />
          <select className="input" value={speciesSlug} onChange={e => setSpeciesSlug(e.target.value)}>
            <option value="">Select species *</option>
            {edibleSpecies.map(s => <option key={s.slug} value={s.slug}>{s.name}</option>)}
          </select>
        </div>
        <div className="row2">
          <input className="input" placeholder="Recipe URL (optional)" value={recipeLink} onChange={e => setRecipeLink(e.target.value)} />
          <input className="input" type="file" accept="image/*" onChange={e => setFile(e.target.files?.[0] || null)} />
        </div>
        <textarea className="input" placeholder="Description & Cooking Guide (optional)" value={desc} onChange={e => setDesc(e.target.value)} />
        <div className="actions">
          <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Add Dish'}</button>
          <span className="small muted right">Photo max 10 MB</span>
        </div>
      </form>

      <div style={{ marginTop: 16 }}>
        <h3>Your Dishes</h3>
        {mine.length === 0 ? (
          <p className="small muted">No dishes yet – add your first above!</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {mine.map(d => (
              <div key={d.id} className="card" style={{ padding: 8 }}>
                <a href={d.photo_url} target="_blank" rel="noreferrer" style={{ display: 'block', position: 'relative' }}>
                  <img src={d.thumb_url || d.photo_url} alt={d.title} style={{ width: '100%', borderRadius: 8 }} loading="lazy" />
                  <div className="badge" style={{ position: 'absolute', top: 6, right: 6 }}>
                    {edibleSpecies.find(s => s.slug === d.species_slug)?.name || d.species_slug}
                  </div>
                </a>
                <div style={{ marginTop: 6 }}><strong>{d.title}</strong></div>
                {d.recipe_link && (
                  <div className="small"><a href={d.recipe_link} target="_blank" rel="noreferrer" style={{ color: '#009688' }}>View Recipe</a></div>
                )}
                {d.description && (
                  <div className="small muted" style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>{d.description}</div>
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
