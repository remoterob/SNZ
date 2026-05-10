import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const SNZ_BLUE = '#2B6CB0'
const BUCKET   = 'snz-media'

async function makeThumbnail(file, maxWidth = 800) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width)
      const c = document.createElement('canvas')
      c.width  = Math.round(img.width  * scale)
      c.height = Math.round(img.height * scale)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      c.toBlob(blob => {
        if (!blob) return reject(new Error('Thumbnail failed'))
        resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }))
      }, 'image/jpeg', 0.85)
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

export default function CarouselAdmin() {
  const navigate = useNavigate()
  const fileRef  = useRef(null)

  const [slides,  setSlides]  = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [file,    setFile]    = useState(null)
  const [preview, setPreview] = useState(null)
  const [busy,    setBusy]    = useState(false)

  const load = async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('snz_carousel')
      .select('id, photo_url, thumb_url, is_active, created_at')
      .order('created_at', { ascending: false })
    if (error) setError(error.message)
    else setSlides(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleFile = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  const handleUpload = async (e) => {
    e?.preventDefault()
    if (!file) return setError('Select a photo.')
    if (file.size > 15 * 1024 * 1024) return setError('File too large — max 15 MB.')

    setBusy(true)
    setError(null)
    try {
      const ts   = Date.now()
      const ext  = file.name.split('.').pop().toLowerCase()
      const full = `carousel/${ts}.${ext}`
      const thum = `carousel/thumbs/${ts}.jpg`

      const { error: upErr } = await supabase.storage.from(BUCKET)
        .upload(full, file, { contentType: file.type, upsert: true })
      if (upErr) throw upErr
      const { data: fd } = supabase.storage.from(BUCKET).getPublicUrl(full)

      let thumbUrl = fd.publicUrl
      try {
        const tf = await makeThumbnail(file, 800)
        await supabase.storage.from(BUCKET).upload(thum, tf, { contentType: 'image/jpeg', upsert: true })
        const { data: td } = supabase.storage.from(BUCKET).getPublicUrl(thum)
        thumbUrl = td.publicUrl
      } catch {}

      const { error: insErr } = await supabase.from('snz_carousel').insert({
        photo_url: fd.publicUrl,
        thumb_url: thumbUrl,
        is_active: true,
      })
      if (insErr) throw insErr

      setFile(null); setPreview(null)
      if (fileRef.current) fileRef.current.value = ''
      load()
    } catch (err) {
      setError(err.message || 'Upload failed.')
    } finally { setBusy(false) }
  }

  const toggleActive = async (s) => {
    await supabase.from('snz_carousel').update({ is_active: !s.is_active }).eq('id', s.id)
    load()
  }

  const deleteSlide = async (s) => {
    if (!window.confirm('Remove this photo from the carousel?')) return
    try {
      const match = s.photo_url.match(/\/snz-media\/(.+)$/)
      if (match) await supabase.storage.from(BUCKET).remove([match[1]])
      if (s.thumb_url) {
        const tm = s.thumb_url.match(/\/snz-media\/(.+)$/)
        if (tm) await supabase.storage.from(BUCKET).remove([tm[1]])
      }
    } catch {}
    await supabase.from('snz_carousel').delete().eq('id', s.id)
    load()
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div style={{ background: SNZ_BLUE }} className="px-6 py-3 flex items-center gap-3 border-b border-blue-700">
        <button onClick={() => navigate('/admin')}
          className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
          ← Admin
        </button>
        <span className="text-blue-200 text-sm opacity-75">/ Hub Carousel</span>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-black text-gray-900">Hub Carousel</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            {slides.filter(s => s.is_active).length} of {slides.length} photos live · order is random on each page load
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600 mb-4">{error}</div>
        )}

        {/* Upload */}
        <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-6 shadow-sm">
          <h2 className="text-base font-black text-gray-900 mb-4">Add a Photo</h2>
          <form onSubmit={handleUpload} className="space-y-4">
            {preview ? (
              <div className="relative rounded-xl overflow-hidden flex items-center justify-center" style={{ height: 220, background: '#111' }}>
                <div style={{
                  position: 'absolute', inset: 0,
                  backgroundImage: `url(${preview})`,
                  backgroundSize: 'cover', backgroundPosition: 'center',
                  filter: 'blur(14px) brightness(0.45)', transform: 'scale(1.08)',
                }} />
                <img src={preview} alt="preview" className="relative z-10 max-w-full max-h-full"
                  style={{ objectFit: 'contain', height: '100%', width: '100%' }} />
                <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent px-3 pb-2 pt-6 z-20">
                  <span className="text-white text-xs font-semibold">{file?.name}</span>
                </div>
                <button type="button"
                  onClick={() => { setFile(null); setPreview(null); if (fileRef.current) fileRef.current.value = '' }}
                  className="absolute top-2 right-2 z-20 w-7 h-7 rounded-full bg-black/50 text-white text-xs font-bold hover:bg-black/70 transition flex items-center justify-center">
                  ✕
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => fileRef.current?.click()}
                className="w-full flex flex-col items-center gap-2 py-12 border-2 border-dashed border-gray-300 rounded-xl text-gray-400 hover:text-blue-500 hover:border-blue-300 transition bg-gray-50">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                <span className="text-sm font-semibold">Click to upload photo</span>
                <span className="text-xs">JPG, PNG, WebP · max 15 MB · portrait and landscape both work</span>
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

            <button type="submit" disabled={busy || !file}
              className="w-full py-2.5 rounded-xl font-bold text-sm text-white disabled:opacity-40 transition hover:opacity-90"
              style={{ background: SNZ_BLUE }}>
              {busy ? 'Uploading…' : 'Add to Carousel'}
            </button>
          </form>
        </div>

        {/* Slides list */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <h2 className="text-sm font-black text-gray-700">Current Photos</h2>
            <span className="text-xs text-gray-400">Toggle Live/Off to show or hide individual photos</span>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-400 text-sm">Loading…</div>
          ) : slides.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No photos yet — add one above.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {slides.map((s) => (
                <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                  <img
                    src={s.thumb_url || s.photo_url}
                    alt=""
                    className="w-24 h-14 object-cover rounded-lg border border-gray-200 flex-shrink-0 bg-gray-100"
                    onError={e => { e.target.style.display = 'none' }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400">
                      Added {new Date(s.created_at).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <button onClick={() => toggleActive(s)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-full border transition flex-shrink-0 ${
                      s.is_active
                        ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                        : 'bg-gray-100 text-gray-400 border-gray-200 hover:bg-gray-200'
                    }`}>
                    {s.is_active ? 'Live' : 'Off'}
                  </button>
                  <button onClick={() => deleteSlide(s)}
                    className="text-xs font-bold px-2 py-1.5 rounded-lg border border-gray-200 text-gray-400 hover:border-red-300 hover:text-red-500 transition flex-shrink-0">
                    Del
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-xs text-gray-400 text-center mt-4">
          Photos show in a random order each time the page loads. Changes go live immediately.
        </p>
      </div>
    </div>
  )
}
