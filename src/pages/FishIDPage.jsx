import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const SNZ_BLUE = '#2B6CB0'
const SNZ_DARK = '#1e3a5f'

export default function FishIDPage() {
  const navigate = useNavigate()
  const [image, setImage] = useState(null) // base64 data URL
  const [imagePreview, setImagePreview] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [speciesData, setSpeciesData] = useState(null)
  const [lightbox, setLightbox] = useState(null)
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)

  const handleFile = async (file) => {
    if (!file) return
    setError('')
    setResult(null)

    // Validate
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Image too large (max 10MB).')
      return
    }

    // Compress / resize client-side to reduce API payload
    const compressed = await compressImage(file, 1568, 0.92)
    setImage(compressed.base64)
    setImagePreview(compressed.dataUrl)
  }

  const compressImage = (file, maxDim, quality) => new Promise((resolve, reject) => {
    const img = new Image()
    const reader = new FileReader()
    reader.onload = () => {
      img.onload = () => {
        let { width, height } = img
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = (height * maxDim) / width
            width = maxDim
          } else {
            width = (width * maxDim) / height
            height = maxDim
          }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        const dataUrl = canvas.toDataURL('image/jpeg', quality)
        const base64 = dataUrl.split(',')[1]
        resolve({ dataUrl, base64 })
      }
      img.onerror = reject
      img.src = reader.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  const identify = async () => {
    if (!image) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await fetch('/.netlify/functions/identify-fish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: image, mediaType: 'image/jpeg' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Identification failed')
      setResult(data)

      // Look up species in our DB for tips + photos (best-effort)
      if (data.commonName && data.commonName !== 'Not a fish') {
        try {
          const { data: species } = await supabase
            .from('fish_species')
            .select('id, common_name, tips')
            .ilike('common_name', data.commonName)
            .maybeSingle()
          if (species) {
            const { data: photos } = await supabase
              .from('fish_species_photos')
              .select('*')
              .eq('species_id', species.id)
              .order('is_hero', { ascending: false })
              .order('sort_order')
              .limit(8)
            setSpeciesData({ ...species, photos: photos || [] })
          }
        } catch (err) {
          console.warn('Species lookup failed:', err)
        }
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setImage(null)
    setImagePreview(null)
    setResult(null)
    setSpeciesData(null)
    setError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (cameraInputRef.current) cameraInputRef.current.value = ''
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div style={{ background: SNZ_DARK }} className="px-6 py-3 flex items-center border-b border-blue-900">
        <button onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
          ← Home
        </button>
        <span className="text-white/50 mx-2">/</span>
        <span className="text-white font-bold text-sm">Fish ID</span>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8 space-y-5">
        <div>
          <h1 className="text-3xl font-black text-gray-900 flex items-center gap-2">🐟 Fish ID</h1>
          <p className="text-gray-500 text-sm mt-1">AI-assisted species identification. Take or upload a photo to identify.</p>
        </div>

        {/* Disclaimer */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-xs font-black text-amber-800 uppercase tracking-wide">⚠️ AI Assisted — Not Legal Advice</p>
          <p className="text-xs text-amber-700 mt-1">
            This is an experimental tool. Always verify species and legal size with <a href="https://www.mpi.govt.nz/fishing-aquaculture/recreational-fishing/" target="_blank" rel="noopener noreferrer" className="underline font-bold">MPI's official rules</a> before keeping any fish. Mis-identification is your responsibility.
          </p>
        </div>

        {/* Upload area */}
        {!imagePreview && (
          <div className="bg-white border-2 border-dashed border-gray-300 rounded-2xl p-8 text-center space-y-4">
            <div className="text-5xl">📷</div>
            <div>
              <p className="font-bold text-gray-900">Take or upload a photo</p>
              <p className="text-xs text-gray-400 mt-0.5">Clear side-on shot works best. JPEG or PNG, max 10MB.</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button onClick={() => cameraInputRef.current?.click()}
                className="px-5 py-2.5 rounded-xl text-sm font-black text-white"
                style={{ background: SNZ_BLUE }}>
                📸 Take Photo
              </button>
              <button onClick={() => fileInputRef.current?.click()}
                className="px-5 py-2.5 rounded-xl text-sm font-bold border border-gray-300 text-gray-700 hover:bg-gray-50">
                🖼️ Upload from Gallery
              </button>
            </div>
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment"
              onChange={e => handleFile(e.target.files?.[0])} className="hidden" />
            <input ref={fileInputRef} type="file" accept="image/*"
              onChange={e => handleFile(e.target.files?.[0])} className="hidden" />
          </div>
        )}

        {/* Preview + identify */}
        {imagePreview && !result && (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <img src={imagePreview} alt="Preview" className="w-full max-h-96 object-contain bg-gray-900" />
            <div className="p-4 flex gap-3">
              <button onClick={reset}
                className="flex-1 py-2.5 rounded-xl border border-gray-300 text-sm font-bold text-gray-600 hover:bg-gray-50">
                Different photo
              </button>
              <button onClick={identify} disabled={loading}
                className="flex-1 py-2.5 rounded-xl text-sm font-black text-white disabled:opacity-50"
                style={{ background: SNZ_BLUE }}>
                {loading ? 'Identifying…' : 'Identify →'}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">• {error}</div>
        )}

        {/* Result */}
        {result && (
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              {imagePreview && <img src={imagePreview} alt="Identified fish" className="w-full max-h-72 object-contain bg-gray-900" />}
              <div className="p-5 space-y-3">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Identified as</p>
                  <h2 className="text-2xl font-black text-gray-900 mt-1">{result.commonName || 'Unknown'}</h2>
                  {result.scientificName && (
                    <p className="text-sm italic text-gray-500 mt-0.5">{result.scientificName}</p>
                  )}
                </div>

                {result.confidence && (
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Confidence</p>
                    <span className={`inline-block text-xs font-bold px-3 py-1 rounded-full ${
                      result.confidence === 'high' ? 'bg-green-100 text-green-700'
                      : result.confidence === 'medium' ? 'bg-amber-100 text-amber-700'
                      : 'bg-red-100 text-red-700'
                    }`}>
                      {result.confidence.toUpperCase()}
                    </span>
                  </div>
                )}

                {result.distinguishingFeatures && (
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Distinguishing features</p>
                    <p className="text-sm text-gray-700">{result.distinguishingFeatures}</p>
                  </div>
                )}

                {result.alternativeSpecies?.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Could also be</p>
                    <p className="text-sm text-gray-600">{result.alternativeSpecies.join(' · ')}</p>
                  </div>
                )}

                {result.notes && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                    <p className="text-xs text-blue-800">{result.notes}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Tips section — from our DB */}
            {speciesData?.tips && <SpeciesTips commonName={speciesData.common_name} tips={speciesData.tips} />}

            {/* Photo gallery */}
            {speciesData?.photos?.length > 0 && (
              <SpeciesPhotos photos={speciesData.photos} onPhotoClick={setLightbox} />
            )}

            {/* MPI link — Phase 2 will add local rules DB */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Legal sizes & bag limits</p>
                <p className="text-sm text-gray-700 mt-1">Always check current rules before keeping your catch.</p>
              </div>
              <a href={`https://www.mpi.govt.nz/fishing-aquaculture/recreational-fishing/fishing-rules/`}
                target="_blank" rel="noopener noreferrer"
                className="inline-block w-full text-center py-2.5 rounded-xl font-black text-white text-sm"
                style={{ background: '#059669' }}>
                View MPI Rules →
              </a>
              <a href={`https://www.google.com/search?q=${encodeURIComponent((result.commonName || '') + ' NZ minimum legal size daily bag limit')}`}
                target="_blank" rel="noopener noreferrer"
                className="inline-block w-full text-center py-2.5 rounded-xl font-bold text-sm border border-gray-300 text-gray-700 hover:bg-gray-50">
                Search "{result.commonName}" rules →
              </a>
            </div>

            <button onClick={reset}
              className="w-full py-3 rounded-xl font-black text-white text-sm"
              style={{ background: SNZ_BLUE }}>
              Identify Another Fish
            </button>
          </div>
        )}

        <p className="text-xs text-gray-400 text-center pt-4">
          Powered by Claude vision · Spearfishing New Zealand
        </p>
      </div>

      {/* Lightbox for photo viewing */}
      {lightbox && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          <button onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white text-xl hover:bg-white/20">×</button>
          <img src={lightbox.photo_url} alt="" className="max-w-full max-h-full object-contain rounded-lg" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function SpeciesTips({ commonName, tips }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = tips.length > 220
  const displayed = expanded || !isLong ? tips : tips.slice(0, 220) + '…'
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xl">📖</span>
        <h3 className="font-black text-sm uppercase tracking-widest" style={{ color: SNZ_BLUE }}>
          How to target {commonName}
        </h3>
      </div>
      <div className="text-sm text-gray-700 leading-relaxed">
        <TipsMarkdown text={displayed} />
      </div>
      {isLong && (
        <button onClick={() => setExpanded(e => !e)}
          className="text-xs font-bold uppercase tracking-wide" style={{ color: SNZ_BLUE }}>
          {expanded ? '▲ Show less' : '▼ Read more'}
        </button>
      )}
    </div>
  )
}

function SpeciesPhotos({ photos, onPhotoClick }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xl">📸</span>
        <h3 className="font-black text-sm uppercase tracking-widest" style={{ color: SNZ_BLUE }}>
          Example photos
        </h3>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {photos.map(p => (
          <button key={p.id} onClick={() => onPhotoClick(p)}
            className="aspect-square relative overflow-hidden rounded-lg border border-gray-200 group">
            <img src={p.photo_url} alt="" loading="lazy"
              className="w-full h-full object-cover group-hover:scale-105 transition" />
            {p.is_hero && (
              <span className="absolute top-1 left-1 bg-amber-400/90 text-amber-900 text-[9px] font-black px-1.5 py-0.5 rounded">★</span>
            )}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-gray-400 text-center">Tap any photo to view larger</p>
    </div>
  )
}

// Minimal markdown renderer — bold, italic, line breaks
function TipsMarkdown({ text }) {
  const lines = text.split('\n')
  return (
    <div className="space-y-2">
      {lines.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1" />
        const html = line
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
          .replace(/\*([^*]+)\*/g, '<em>$1</em>')
        return <p key={i} dangerouslySetInnerHTML={{ __html: html }} />
      })}
    </div>
  )
}
