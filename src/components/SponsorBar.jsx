import { useState } from 'react'
import { supabase } from '../lib/supabase'

const SPONSOR_KEYS = ['sponsor1_url', 'sponsor2_url', 'sponsor3_url']

/**
 * "Proudly Sponsored By" strip — up to 3 logos from competitions.sponsor{1,2,3}_url.
 * Renders nothing when no sponsors are set, so it's safe to drop at the bottom
 * of any competition screen.
 *
 * `comp` may be a full competitions row or just the sponsor fields.
 */
export default function SponsorBar({ comp, className = '' }) {
  const sponsors = SPONSOR_KEYS.map(k => comp?.[k]).filter(Boolean)
  if (!sponsors.length) return null
  return (
    <div className={`bg-white border-t border-gray-100 px-6 py-5 ${className}`}>
      <div className="max-w-5xl mx-auto">
        <p className="text-xs font-bold tracking-widest uppercase text-gray-400 text-center mb-3">Proudly Sponsored By</p>
        <div className="flex items-center justify-center gap-8 flex-wrap">
          {sponsors.map((url, i) => (
            <img key={i} src={url} alt={`Sponsor ${i + 1}`}
              className="h-12 max-w-32 object-contain opacity-80 hover:opacity-100 transition" />
          ))}
        </div>
      </div>
    </div>
  )
}

/**
 * One upload slot. Uploading writes the file to storage and hands the public URL
 * back via onUploaded — the parent form is responsible for persisting it.
 * Removing clears the column immediately, since the file is already gone.
 */
export function SponsorUploadSlot({ label, fieldKey, url, compId, onUploaded, onRemoved, showToast }) {
  const [uploading, setUploading] = useState(false)

  const upload = async (file) => {
    setUploading(true)
    try {
      const ext = file.name.split('.').pop().toLowerCase()
      const slug = label.toLowerCase().replace(/\s+/g, '')
      const path = `competitions/${compId}/${slug}.${ext}`
      await supabase.storage.from('snz-media').remove([path])
      const { error } = await supabase.storage.from('snz-media').upload(path, file, { contentType: file.type })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('snz-media').getPublicUrl(path)
      await onUploaded(`${publicUrl}?t=${Date.now()}`)
      showToast?.(`${label} uploaded`)
    } catch (err) { showToast?.(err.message, 'error') }
    finally { setUploading(false) }
  }

  const remove = async () => {
    try {
      if (compId) {
        const { error } = await supabase.from('competitions').update({ [fieldKey]: null }).eq('id', compId)
        if (error) throw error
      }
      onRemoved()
      showToast?.(`${label} removed`)
    } catch (err) { showToast?.(err.message, 'error') }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="w-full h-20 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden">
        {url
          ? <img src={url} alt={label} className="h-full w-full object-contain p-2" />
          : <span className="text-xs text-gray-400">{label}</span>
        }
      </div>
      <div className="flex gap-1.5">
        <label className={`cursor-pointer text-xs font-bold px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition ${uploading ? 'opacity-50' : ''}`}>
          {uploading ? 'Uploading…' : url ? '📷 Replace' : '📷 Upload'}
          <input type="file" accept="image/*" className="hidden" disabled={uploading}
            onChange={e => e.target.files[0] && upload(e.target.files[0])} />
        </label>
        {url && (
          <button onClick={remove}
            className="text-xs font-bold px-2 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50">✕</button>
        )}
      </div>
    </div>
  )
}

export { SPONSOR_KEYS }
