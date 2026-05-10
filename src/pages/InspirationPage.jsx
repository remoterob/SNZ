import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useMemberSession } from '../components/MemberAuthGate'
import { notify } from '../utils/toasts'

const SNZ_BLUE = '#2B6CB0'
const STORAGE_BUCKET = 'snz-media'

// ── Species grouping ──────────────────────────────────────────────────────────
// Variants collapsed into one display group for search/upload
const SPECIES_GROUP_MAP = {
  'Snapper':            'Snapper',
  'Snapper over 5 kg':  'Snapper',
  'Snapper over 10kg':  'Snapper',
  'Kingfish':           'Kingfish',
  'Kingfish over 15kg': 'Kingfish',
  'Kingfish over 30kg': 'Kingfish',
  'Tuna - Albacore':    'Tuna',
  'Tuna - Skippie':     'Tuna',
  'Tuna - Yellow Fin':  'Tuna',
  'Tuna - Blue Fin':    'Tuna',
  'Paua':               'Paua',
  'Paua - Yellow Foot': 'Paua',
  'Red Cray':           'Crayfish',
  'Pack horse cray':    'Crayfish',
  'Blue Mao Mao':       'Mao Mao',
  'Pink Mao Mao':       'Mao Mao',
  'Trevally':           'Trevally',
  'Trevally over 3kg':  'Trevally',
}
const groupSpecies = (name) => SPECIES_GROUP_MAP[name] || name

// ── Helpers ───────────────────────────────────────────────────────────────────
async function makeThumbnail(file, maxWidth = 500) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width)
      const c = document.createElement('canvas')
      c.width  = Math.max(1, Math.round(img.width  * scale))
      c.height = Math.max(1, Math.round(img.height * scale))
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      c.toBlob(blob => {
        if (!blob) return reject(new Error('Thumbnail failed'))
        resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }))
      }, 'image/jpeg', 0.82)
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function InspirationPage() {
  const navigate = useNavigate()
  const { session, member } = useMemberSession()
  const isActiveMember = !!session && member?.membership_status === 'active'

  const [speciesFilter, setSpeciesFilter] = useState('')
  const [search,        setSearch]        = useState('')
  const [recipes,       setRecipes]       = useState([])
  const [loading,       setLoading]       = useState(true)
  const [speciesList,   setSpeciesList]   = useState([])
  const [showUpload,    setShowUpload]     = useState(false)
  const [expanded,      setExpanded]      = useState(null) // recipe id with comments open

  // Load grouped species list from bingo_species for the filter/upload selector
  useEffect(() => {
    supabase.from('bingo_species').select('name').eq('is_active', true)
      .then(({ data }) => {
        const groups = [...new Set((data || []).map(s => groupSpecies(s.name)))]
          .filter(g => !['Perform a rescue', 'Take a beginner out', 'Share 3 dishes'].includes(g))
          .sort((a, b) => a.localeCompare(b))
        setSpeciesList(groups)
      })
  }, [])

  const loadRecipes = useCallback(async () => {
    setLoading(true)
    try {
      let q = supabase
        .from('snz_recipes')
        .select('id, display_name, species, title, description, recipe_url, photo_url, thumb_url, created_at')
        .eq('is_approved', true)
        .order('created_at', { ascending: false })

      if (speciesFilter) q = q.eq('species', speciesFilter)

      const { data, error } = await q
      if (error) throw error
      setRecipes(data || [])
    } catch (e) {
      notify('Could not load recipes — please try again.', 'error')
    } finally {
      setLoading(false)
    }
  }, [speciesFilter])

  useEffect(() => { loadRecipes() }, [loadRecipes])

  const filtered = useMemo(() => {
    if (!search.trim()) return recipes
    const q = search.toLowerCase()
    return recipes.filter(r =>
      r.title?.toLowerCase().includes(q) ||
      r.species?.toLowerCase().includes(q) ||
      r.description?.toLowerCase().includes(q) ||
      r.display_name?.toLowerCase().includes(q)
    )
  }, [recipes, search])

  const toggleComments = (id) => setExpanded(expanded === id ? null : id)

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div style={{ background: SNZ_BLUE }} className="px-6 py-3 flex items-center justify-between border-b border-blue-700">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
            ← SNZ Hub
          </button>
          <span className="text-blue-200 text-sm opacity-75">/ Inspiration</span>
        </div>
      </div>

      {/* Hero */}
      <header className="border-b border-gray-200 px-6 py-6 bg-white">
        <div className="max-w-4xl mx-auto flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-black text-gray-900">Community Recipes</h1>
            <p className="text-gray-400 text-sm mt-1">Inspiration from the SNZ spearfishing community — search by species and share your own.</p>
          </div>
          {isActiveMember ? (
            <button
              onClick={() => setShowUpload(s => !s)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white transition hover:opacity-90"
              style={{ background: SNZ_BLUE }}>
              {showUpload ? '✕ Cancel' : '+ Share a Recipe'}
            </button>
          ) : (
            <button
              onClick={() => navigate('/membership')}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm border-2 border-gray-200 text-gray-600 hover:border-blue-300 hover:text-blue-600 transition">
              Join SNZ to share
            </button>
          )}
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">

        {/* Upload form */}
        {showUpload && isActiveMember && (
          <UploadForm
            species={speciesList}
            member={member}
            session={session}
            onSuccess={() => { setShowUpload(false); loadRecipes() }}
            onCancel={() => setShowUpload(false)}
          />
        )}

        {/* Filter bar */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6 flex flex-wrap gap-3 items-center">
          <select
            value={speciesFilter}
            onChange={e => setSpeciesFilter(e.target.value)}
            className="bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 min-w-40"
          >
            <option value="">All species</option>
            {speciesList.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          <input
            type="text"
            placeholder="Search recipes…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 min-w-48 bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />

          {(speciesFilter || search) && (
            <button
              onClick={() => { setSpeciesFilter(''); setSearch('') }}
              className="text-sm text-gray-400 hover:text-gray-600 font-semibold transition px-2"
            >
              Clear
            </button>
          )}

          <span className="text-xs text-gray-400 ml-auto">
            {loading ? '…' : `${filtered.length} recipe${filtered.length !== 1 ? 's' : ''}`}
          </span>
        </div>

        {/* Recipe grid */}
        {loading ? (
          <div className="text-center py-16 text-gray-400">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-gray-50 rounded-2xl border border-gray-200">
            <p className="text-gray-500 font-semibold mb-1">No recipes yet{speciesFilter ? ` for ${speciesFilter}` : ''}</p>
            <p className="text-gray-400 text-sm">
              {isActiveMember ? 'Be the first to share one!' : 'Join SNZ to be the first to share one.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {filtered.map(r => (
              <RecipeCard
                key={r.id}
                recipe={r}
                session={session}
                member={member}
                isActiveMember={isActiveMember}
                expanded={expanded === r.id}
                onToggleComments={() => toggleComments(r.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Recipe card ───────────────────────────────────────────────────────────────
function RecipeCard({ recipe: r, session, member, isActiveMember, expanded, onToggleComments }) {
  const [comments,       setComments]       = useState([])
  const [commentsLoaded, setCommentsLoaded] = useState(false)
  const [draft,          setDraft]          = useState('')
  const [posting,        setPosting]        = useState(false)
  const [descExpanded,   setDescExpanded]   = useState(false)

  useEffect(() => {
    if (!expanded || commentsLoaded) return
    supabase.from('snz_recipe_comments')
      .select('id, display_name, comment, created_at')
      .eq('recipe_id', r.id)
      .order('created_at', { ascending: true })
      .then(({ data }) => { setComments(data || []); setCommentsLoaded(true) })
  }, [expanded, r.id, commentsLoaded])

  const postComment = async () => {
    if (!isActiveMember || !draft.trim()) return
    setPosting(true)
    try {
      const { error } = await supabase.from('snz_recipe_comments').insert({
        recipe_id:    r.id,
        user_id:      session.user.id,
        display_name: member?.name || 'Member',
        comment:      draft.trim(),
      })
      if (error) throw error
      setDraft('')
      // Reload comments
      const { data } = await supabase.from('snz_recipe_comments')
        .select('id, display_name, comment, created_at')
        .eq('recipe_id', r.id).order('created_at', { ascending: true })
      setComments(data || [])
      notify('Comment posted.', 'success')
    } catch (e) {
      notify('Could not post comment.', 'error')
    } finally { setPosting(false) }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm flex flex-col">
      {/* Photo */}
      {r.photo_url && (
        <a href={r.photo_url} target="_blank" rel="noopener noreferrer" className="relative block flex-shrink-0">
          <img
            src={r.thumb_url || r.photo_url}
            alt={r.title}
            className="w-full h-52 object-cover"
            loading="lazy"
          />
          <span className="absolute top-3 right-3 text-xs font-bold px-2 py-1 rounded-full text-white"
            style={{ background: 'rgba(0,0,0,0.55)' }}>
            {r.species}
          </span>
          <span className="absolute top-3 left-3 text-xs font-bold px-2 py-1 rounded-full text-white"
            style={{ background: 'rgba(43,108,176,0.85)' }}>
            {r.display_name}
          </span>
        </a>
      )}

      <div className="p-4 flex flex-col flex-1">
        {/* No photo fallback header */}
        {!r.photo_url && (
          <div className="flex items-center justify-between mb-2 flex-wrap gap-1">
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">{r.species}</span>
            <span className="text-xs text-gray-400 font-semibold">{r.display_name}</span>
          </div>
        )}

        <h3 className="font-black text-gray-900 text-base mb-1 leading-tight">{r.title}</h3>

        {r.description && (
          <div className="mb-3">
            <p className={`text-sm text-gray-500 leading-relaxed ${descExpanded ? '' : 'line-clamp-3'}`}>
              {r.description}
            </p>
            <button
              onClick={() => setDescExpanded(e => !e)}
              className="text-xs font-bold mt-1 transition"
              style={{ color: SNZ_BLUE }}
            >
              {descExpanded ? 'Show less' : 'Read more'}
            </button>
          </div>
        )}

        <div className="mt-auto flex items-center gap-3 flex-wrap">
          {r.recipe_url && (
            <a href={r.recipe_url} target="_blank" rel="noopener noreferrer"
              className="text-sm font-bold flex items-center gap-1 transition hover:opacity-80"
              style={{ color: SNZ_BLUE }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
              View Recipe
            </a>
          )}
          <button
            onClick={onToggleComments}
            className="ml-auto text-xs text-gray-400 hover:text-gray-600 font-semibold transition flex items-center gap-1">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            {expanded ? 'Hide' : 'Comments'}
          </button>
        </div>

        {/* Comments */}
        {expanded && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            {!commentsLoaded ? (
              <p className="text-xs text-gray-400">Loading comments…</p>
            ) : comments.length === 0 ? (
              <p className="text-xs text-gray-400 mb-3">No comments yet.</p>
            ) : (
              <div className="space-y-2 mb-3">
                {comments.map(c => (
                  <div key={c.id} className="bg-gray-50 rounded-lg px-3 py-2">
                    <span className="text-xs font-bold text-gray-700">{c.display_name}</span>
                    <span className="text-xs text-gray-500 ml-1">{c.comment}</span>
                    <div className="text-xs text-gray-300 mt-0.5">
                      {new Date(c.created_at).toLocaleDateString('en-NZ')}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {isActiveMember ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && postComment()}
                  placeholder="Add a comment…"
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                <button
                  onClick={postComment}
                  disabled={posting || !draft.trim()}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-40 transition"
                  style={{ background: SNZ_BLUE }}>
                  {posting ? '…' : 'Post'}
                </button>
              </div>
            ) : (
              <p className="text-xs text-gray-400">Sign in as an SNZ member to comment.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Upload form ───────────────────────────────────────────────────────────────
function UploadForm({ species, member, session, onSuccess, onCancel }) {
  const fileRef    = useRef(null)
  const [title,    setTitle]    = useState('')
  const [sp,       setSp]       = useState('')
  const [desc,     setDesc]     = useState('')
  const [url,      setUrl]      = useState('')
  const [file,     setFile]     = useState(null)
  const [preview,  setPreview]  = useState(null)
  const [busy,     setBusy]     = useState(false)

  const handleFile = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  const submit = async (e) => {
    e?.preventDefault()
    if (!title.trim()) return notify('Enter a title.', 'error')
    if (!sp)           return notify('Select a species.', 'error')
    if (!file)         return notify('Add a photo.', 'error')
    if (file.size > 10 * 1024 * 1024) return notify('Photo too large — max 10 MB.', 'error')

    setBusy(true)
    try {
      const uid  = session.user.id
      const ts   = Date.now()
      const ext  = file.name.split('.').pop().toLowerCase()
      const full = `inspiration/${uid}/${ts}.${ext}`
      const thum = `inspiration/thumbs/${uid}/${ts}.jpg`

      let thumbUrl = ''
      try {
        const tf = await makeThumbnail(file, 600)
        await supabase.storage.from(STORAGE_BUCKET).upload(thum, tf, { upsert: true })
        const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(thum)
        thumbUrl = data?.publicUrl || ''
      } catch {}

      await supabase.storage.from(STORAGE_BUCKET).upload(full, file, { upsert: true })
      const { data: fd } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(full)

      const { error } = await supabase.from('snz_recipes').insert({
        user_id:      uid,
        display_name: member?.name || 'Member',
        species:      sp,
        title:        title.trim(),
        description:  desc.trim() || null,
        recipe_url:   url.trim() || null,
        photo_url:    fd.publicUrl,
        thumb_url:    thumbUrl || fd.publicUrl,
      })
      if (error) throw error

      notify('Recipe shared!', 'success')
      onSuccess()
    } catch (err) {
      notify('Could not save: ' + (err.message || err), 'error')
    } finally { setBusy(false) }
  }

  return (
    <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-6 mb-6">
      <h2 className="text-lg font-black text-gray-900 mb-4">Share a Recipe</h2>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Dish name" required>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)} required
              placeholder="e.g. Beer-battered Snapper Tacos"
              className="w-full border border-gray-300 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </Field>
          <Field label="Species" required>
            <select value={sp} onChange={e => setSp(e.target.value)} required
              className="w-full border border-gray-300 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
              <option value="">Select species…</option>
              {species.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Recipe URL" hint="Link to the recipe you used or adapted">
          <input type="url" value={url} onChange={e => setUrl(e.target.value)}
            placeholder="https://…"
            className="w-full border border-gray-300 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
        </Field>

        <Field label="Description" hint="How you cooked it, any tips, etc.">
          <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3}
            placeholder="Optional notes, cooking tips, modifications…"
            className="w-full border border-gray-300 bg-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-y" />
        </Field>

        <Field label="Photo" required>
          {preview ? (
            <div className="flex items-start gap-4">
              <img src={preview} alt="preview" className="w-24 h-24 object-cover rounded-xl border border-gray-200 flex-shrink-0" />
              <div>
                <p className="text-xs text-green-600 font-semibold mb-2">✓ {file?.name}</p>
                <button type="button" onClick={() => { setFile(null); setPreview(null); if (fileRef.current) fileRef.current.value = '' }}
                  className="text-xs text-red-500 hover:text-red-700 font-semibold">Remove</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()}
              className="w-full flex flex-col items-center gap-2 py-6 border-2 border-dashed border-gray-300 rounded-xl text-gray-400 hover:text-blue-500 hover:border-blue-300 transition bg-white">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              <span className="text-sm font-semibold">Click to upload photo</span>
              <span className="text-xs">JPG, PNG, WebP · max 10 MB</span>
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </Field>

        <div className="flex gap-3 pt-1">
          <button type="submit" disabled={busy}
            className="px-6 py-2.5 rounded-xl font-bold text-sm text-white disabled:opacity-50 transition hover:opacity-90"
            style={{ background: SNZ_BLUE }}>
            {busy ? 'Uploading…' : 'Share Recipe'}
          </button>
          <button type="button" onClick={onCancel}
            className="px-6 py-2.5 rounded-xl font-bold text-sm border-2 border-gray-200 text-gray-600 hover:border-gray-300 transition">
            Cancel
          </button>
        </div>
      </form>
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
