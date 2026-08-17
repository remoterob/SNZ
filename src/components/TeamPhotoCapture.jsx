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
  const [linking, setLinking] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
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

  const saveLink = async () => {
    const url = linkUrl.trim()
    if (!url) return
    if (!/^https?:\/\//i.test(url)) { showToast?.('Enter a full image URL starting with http', 'error'); return }
    setUploading(true)
    try {
      await save(url)
      showToast?.('Team photo linked')
      setLinkUrl('')
      setLinking(false)
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
        <p className="text-xs text-gray-400 mb-2">Shown as their image on the leaderboard</p>

        {linking ? (
          <div className="flex items-center gap-2 flex-wrap">
            <input type="url" value={linkUrl} onChange={e => setLinkUrl(e.target.value)}
              placeholder="https://…/photo.jpg"
              className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs w-56 focus:outline-none focus:ring-1 focus:ring-blue-300" />
            <button type="button" onClick={saveLink} disabled={uploading || !linkUrl.trim()}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-40"
              style={{ background: SNZ_BLUE }}>
              {uploading ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={() => { setLinking(false); setLinkUrl('') }}
              className="px-2 py-1.5 rounded-lg text-xs font-bold text-gray-500 hover:bg-white">Cancel</button>
            <p className="text-[11px] text-gray-400 w-full">
              Linked images show on the leaderboard, but some sites block other sites from reusing them — if the social card won't generate, upload the photo instead.
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <label className={`cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-300 text-gray-600 hover:bg-white transition ${uploading ? 'opacity-50' : ''}`}>
              {uploading ? 'Uploading…' : photoUrl ? '📷 Replace' : '📷 Take photo'}
              <input type="file" accept="image/*" capture="environment" className="hidden" disabled={uploading}
                onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = '' }} />
            </label>
            <button type="button" onClick={() => setLinking(true)} disabled={uploading}
              className="px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-300 text-gray-600 hover:bg-white transition disabled:opacity-40">
              🔗 Link image
            </button>
            {photoUrl && (
              <button type="button" onClick={clear} disabled={uploading}
                className="px-2 py-1.5 rounded-lg text-xs font-bold text-red-500 hover:bg-red-50 transition disabled:opacity-40">
                Remove
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
