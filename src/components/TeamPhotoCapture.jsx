import { useState } from 'react'
import { supabase } from '../lib/supabase'

const SNZ_BLUE = '#2B6CB0'

/**
 * Team photo capture for the weigh station.
 *
 * Takes a shot straight off a phone camera, or links an image already hosted
 * elsewhere. Saves to comp_teams.team_photo_url, which the leaderboards
 * already read, so the photo shows up as the team's image without any further
 * plumbing.
 */
export default function TeamPhotoCapture({ competitionId, team, onSaved, showToast, compact = false }) {
  const [uploading, setUploading] = useState(false)
  const photoUrl = team?.team_photo_url || null

  const save = async (url) => {
    const { error } = await supabase.from('comp_teams').update({ team_photo_url: url }).eq('id', team.id)
    if (error) throw error
    onSaved?.(url)
  }

  const upload = async (file) => {
    if (!file || !team?.id) return
    if (file.size > 15 * 1024 * 1024) { showToast?.('Image too large — max 15 MB', 'error'); return }
    setUploading(true)
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace('heic', 'jpg').replace('heif', 'jpg')
      const path = `competitions/${competitionId}/teams/${team.id}.${ext}`
      await supabase.storage.from('snz-media').remove([path])
      const { error } = await supabase.storage.from('snz-media').upload(path, file, { contentType: file.type })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('snz-media').getPublicUrl(path)
      // Cache-buster: the path is stable per team, so replacing a photo would
      // otherwise keep serving the old one from cache.
      const bustUrl = `${publicUrl}?t=${Date.now()}`
      await save(bustUrl)
      showToast?.('Team photo saved')
    } catch (err) {
      showToast?.(err.message, 'error')
    } finally {
      setUploading(false)
    }
  }

  const clear = async () => {
    if (!window.confirm('Remove this team photo?')) return
    setUploading(true)
    try {
      await save(null)
      showToast?.('Team photo removed')
    } catch (err) {
      showToast?.(err.message, 'error')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className={`flex items-center gap-4 ${compact ? '' : 'px-5 py-3 border-b border-gray-100 bg-gray-50'}`}>
      <div className="flex-shrink-0">
        {photoUrl ? (
          <img src={photoUrl} alt={team?.team_name || 'Team'}
            className="w-20 h-16 object-cover rounded-xl border border-gray-200 cursor-pointer"
            onClick={() => window.open(photoUrl, '_blank')} />
        ) : (
          <div className="w-20 h-16 rounded-xl bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center text-2xl">👥</div>
        )}
      </div>

      <div className="min-w-0">
        <p className="text-sm font-bold text-gray-700">Team photo <span className="text-gray-400 font-normal">(optional)</span></p>
        <p className="text-xs text-gray-400 mb-2">Shown as their image on the leaderboard{photoUrl ? '' : ' — take one now or pick an existing photo'}</p>

        {/* Two inputs on purpose: `capture` forces the camera app on mobile, so
            a single input with it set makes picking an existing photo
            impossible. Without it, mobile offers gallery/files and desktop
            opens the normal file browser. */}
        <div className="flex items-center gap-2 flex-wrap">
          <label className={`cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-300 text-gray-600 hover:bg-white transition ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
            📷 Take photo
            <input type="file" accept="image/*" capture="environment" className="hidden" disabled={uploading}
              onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = '' }} />
          </label>

          <label className={`cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-300 text-gray-600 hover:bg-white transition ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
            🖼 Choose image
            <input type="file" accept="image/*" className="hidden" disabled={uploading}
              onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = '' }} />
          </label>

          {uploading && <span className="text-xs font-bold text-gray-400">Uploading…</span>}

          {photoUrl && !uploading && (
            <button type="button" onClick={clear}
              className="px-2 py-1.5 rounded-lg text-xs font-bold text-red-500 hover:bg-red-50 transition">
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
