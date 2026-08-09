import { supabase } from '../../lib/supabase'
import { imgFor, infoFor, pointsForSlug, scoreForClaims, isBonusSlug, windowState, nzFormat } from '../../lib/bingo/helpers'
import { notify } from '../../utils/toasts'

const SNZ_BLUE = '#2B6CB0'
const BINGO_CLAIM_API = '/.netlify/functions/bingo-claim'
const NO_FIRST_TIME = new Set(['rescue', 'Dishes'])
const STORAGE_BUCKET = 'snz-media'

export default function BingoPlayPage(props) {
  const {
    species, compCfg, myClaims, pMap, infoMap,
    signedIn, me, token, seasonClosed,
    firstChoice, setFirstChoice,
    openInfoSlug, setOpenInfoSlug,
    reloadAll, reloadMine,
  } = props

  const myClaimFor = (slug) => signedIn ? (myClaims.find(c => c.species_slug === slug) || null) : null

  const precheckWindow = () => {
    if (!compCfg) return { ok: true, state: 'unknown' }
    return windowState(new Date().toISOString(), compCfg.comp_start, compCfg.comp_end)
  }

  const claim = async (slug) => {
    if (!signedIn) { notify('Please sign in first.', 'info'); return }
    if (myClaimFor(slug)) return
    const gate = precheckWindow()
    if (!gate.ok) {
      notify(gate.state === 'before'
        ? `Claims open ${nzFormat(compCfg.comp_start)}`
        : 'The competition has finished for this season.', 'info')
      return
    }
    const first_time = !NO_FIRST_TIME.has(slug) && !!firstChoice[slug]
    try {
      const r = await fetch(BINGO_CLAIM_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ species_slug: slug, first_time, comp_season: compCfg.season }),
      })
      if (r.status === 409) {
        setFirstChoice(prev => ({ ...prev, [slug]: false }))
        await Promise.all([reloadAll(), reloadMine()])
        notify('Already claimed.', 'info')
        return
      }
      if (!r.ok) throw new Error((await r.json())?.error || `Claim failed (${r.status})`)
      setFirstChoice(prev => ({ ...prev, [slug]: false }))
      await Promise.all([reloadAll(), reloadMine()])
    } catch (e) {
      notify(String(e.message || e), 'error')
    }
  }

  const unclaim = async (slug) => {
    if (!signedIn) return
    const claimRow = myClaims.find(c => c.species_slug === slug)
    try {
      const r = await fetch(`${BINGO_CLAIM_API}?species_slug=${encodeURIComponent(slug)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!r.ok) throw new Error(await r.text())
      // Remove photo from storage if present
      if (claimRow?.photo_url) {
        try {
          const match = claimRow.photo_url.match(/\/snz-media\/(.+)$/)
          if (match) await supabase.storage.from(STORAGE_BUCKET).remove([match[1]])
        } catch {}
      }
      await Promise.all([reloadAll(), reloadMine()])
    } catch (e) {
      notify(String(e.message || e), 'error')
    }
  }

  const uploadPhoto = async (file, slug) => {
    if (!file || !me) return
    if (file.size > 10 * 1024 * 1024) { notify('File too large – max 10 MB.', 'error'); return }
    const ext = file.name.split('.').pop()
    const ts = Date.now()
    const fullPath = `bingo/catches/${me.id}/${slug}-${ts}.${ext}`
    const thumbPath = `bingo/catches/thumbs/${me.id}/${slug}-${ts}.jpg`

    try {
      // Thumbnail
      const thumbFile = await makeThumbnail(file, 400)
      await supabase.storage.from(STORAGE_BUCKET).upload(thumbPath, thumbFile, { upsert: true })
      const { data: td } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(thumbPath)

      // Full
      await supabase.storage.from(STORAGE_BUCKET).upload(fullPath, file, { upsert: true })
      const { data: fd } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(fullPath)

      await supabase.from('bingo_claims')
        .update({ photo_url: fd.publicUrl, thumb_url: td.publicUrl })
        .eq('user_id', me.id)
        .eq('species_slug', slug)
        .eq('comp_season', compCfg?.season)

      notify('Photo uploaded!', 'success')
      await reloadMine()
    } catch (err) {
      notify('Upload failed: ' + (err.message || err), 'error')
    }
  }

  // Prefers the admin-set compCfg.status override (a real manual open/close
  // switch); falls back to computing from dates for rows saved before that
  // column existed.
  const windowGate = compCfg
    ? (compCfg.status
        ? { ok: compCfg.status === 'active', state: compCfg.status === 'active' ? 'open' : compCfg.status === 'upcoming' ? 'before' : 'after' }
        : windowState(new Date().toISOString(), compCfg.comp_start, compCfg.comp_end))
    : { ok: true, state: 'unknown' }

  if (!species) return <div className="bg-white border border-gray-200 rounded-2xl p-6 text-center text-gray-400 text-sm">Loading species…</div>

  return (
    <div className="space-y-4">
      {/* Score chip */}
      {signedIn && (
        <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 flex items-center justify-between">
          <p className="font-bold text-gray-900 text-sm">Welcome, {me.name}</p>
          <span className="text-xs font-black px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-100">
            {scoreForClaims(myClaims, pMap)} pts
          </span>
        </div>
      )}

      {/* Comp window info */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5">
        <div className="flex items-baseline justify-between gap-3 mb-1 flex-wrap">
          <h3 className="font-black text-gray-900">Claim a Fish</h3>
          {compCfg && (
            <span className="text-xs text-gray-400">
              {windowGate.ok
                ? `Season closes ${nzFormat(compCfg.comp_end)}`
                : windowGate.state === 'before'
                  ? `Opens ${nzFormat(compCfg.comp_start)}`
                  : 'Season closed'}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 mb-4">Tick "First time" if it's truly your first ever claim for that species — you get double points.</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {species.filter(s => !isBonusSlug(s.slug)).map(s => {
            const mine  = myClaimFor(s.slug)
            const info  = infoFor(infoMap, s.name)
            const pts   = mine ? s.points * (mine.first_time ? 2 : 1) : 0
            const checked = !!firstChoice[s.slug]

            return (
              <div key={s.slug} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="relative w-full aspect-[5/4] bg-gray-50">
                  <img
                    src={mine?.photo_url || mine?.thumb_url || imgFor(s) || ''}
                    alt={s.name}
                    className="w-full h-full object-cover"
                    onError={e => { e.currentTarget.style.opacity = 0.2 }}
                  />
                  {mine && (
                    <div className="absolute top-1.5 right-1.5 bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      Claimed
                    </div>
                  )}
                </div>

                <div className="p-2.5">
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <p className="font-bold text-gray-900 text-sm leading-tight">{s.name}</p>
                    {info && (info.tips || info.recipe) && (
                      <button
                        onClick={() => setOpenInfoSlug(openInfoSlug === s.slug ? null : s.slug)}
                        className="text-xs font-semibold border-b border-dashed"
                        style={{ color: SNZ_BLUE, borderColor: SNZ_BLUE }}
                      >
                        Tips &amp; recipes
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">{s.points} pts</p>

                  {openInfoSlug === s.slug && info && (
                    <div className="text-xs mt-2 bg-blue-50 border border-blue-100 rounded-lg p-2 text-gray-700 space-y-1">
                      {info.tips && (
                        <p><span className="font-bold">Tips:</span> <span className="text-gray-600" dangerouslySetInnerHTML={{ __html: info.tips }} /></p>
                      )}
                      {info.recipe && (
                        <p><span className="font-bold">Recipe:</span>{' '}
                          <a href={info.recipe} target="_blank" rel="noreferrer" className="underline" style={{ color: SNZ_BLUE }}>
                            {(() => { try { return new URL(info.recipe).hostname } catch { return 'Open link' } })()}
                          </a>
                        </p>
                      )}
                    </div>
                  )}

                  {!mine ? (
                    <div className="flex items-center gap-2 mt-2">
                      {!NO_FIRST_TIME.has(s.slug) && (
                        <label className="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer flex-1 min-w-0">
                          <input type="checkbox" checked={checked} className="w-3.5 h-3.5 flex-shrink-0"
                            onChange={e => setFirstChoice(prev => ({ ...prev, [s.slug]: e.target.checked }))} />
                          <span className="truncate">First time (2x)</span>
                        </label>
                      )}
                      <button
                        className="text-xs font-bold px-3 py-1.5 rounded-lg text-white disabled:opacity-40 ml-auto flex-shrink-0"
                        style={{ background: SNZ_BLUE }}
                        onClick={() => { setFirstChoice(p => ({ ...p, [s.slug]: false })); claim(s.slug) }}
                        disabled={!signedIn || (compCfg && !windowGate.ok)}>
                        Claim
                      </button>
                    </div>
                  ) : (
                    <div className="mt-2">
                      <p className="text-xs text-gray-600 mb-1.5">
                        <span className="font-black text-gray-900">{pts}</span> pts {mine.first_time ? '(first-time ×2)' : ''}
                      </p>
                      <div className="flex gap-1.5 flex-wrap">
                        {mine.photo_url ? (
                          <a href={mine.photo_url} target="_blank" rel="noreferrer"
                            className="text-xs font-bold px-2.5 py-1 rounded-lg text-white text-center"
                            style={{ background: SNZ_BLUE }}>
                            View Pic
                          </a>
                        ) : (
                          <>
                            <input type="file" accept="image/*" id={`upload-${s.slug}`} className="hidden"
                              onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(f, s.slug) }} />
                            <label htmlFor={`upload-${s.slug}`}
                              className="text-xs font-bold px-2.5 py-1 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 cursor-pointer">
                              Add Pic
                            </label>
                          </>
                        )}
                        <button
                          className="text-xs font-bold px-2.5 py-1 rounded-lg border border-red-200 text-red-500 hover:bg-red-50"
                          onClick={() => unclaim(s.slug)}>
                          Unclaim
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* My claims */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-4 sm:px-5 py-4 border-b border-gray-100">
          <h3 className="font-black text-gray-900">Your Claims</h3>
        </div>
        {!signedIn ? (
          <p className="px-4 sm:px-5 py-6 text-sm text-gray-400 text-center">Sign in to see your claims.</p>
        ) : myClaims.length === 0 ? (
          <p className="px-4 sm:px-5 py-6 text-sm text-gray-400 text-center">No claims yet — get out there!</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {myClaims.map(c => {
              const sp = species.find(s => s.slug === c.species_slug)
              const isBonus = isBonusSlug(c.species_slug)
              const name = sp ? sp.name : c.species_slug
              const base = pointsForSlug(c.species_slug, pMap)
              const pts  = base * (isBonus ? 1 : c.first_time ? 2 : 1)
              return (
                <div key={c.id} className="px-4 sm:px-5 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 text-sm truncate">
                      {name}{!isBonus && c.first_time ? ' (first-time)' : ''}
                    </p>
                    <p className="text-xs text-gray-400">
                      {c.created_at ? new Date(c.created_at).toLocaleString('en-NZ') : ''}
                    </p>
                  </div>
                  <span className="text-sm font-black flex-shrink-0" style={{ color: SNZ_BLUE }}>{pts} pts</span>
                  <button
                    className="text-xs font-bold px-2.5 py-1 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 flex-shrink-0"
                    onClick={() => unclaim(c.species_slug)}>
                    Unclaim
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

async function makeThumbnail(file, maxWidth = 400) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width)
      const canvas = document.createElement('canvas')
      canvas.width  = img.width  * scale
      canvas.height = img.height * scale
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(blob => {
        if (!blob) return reject(new Error('Canvas failed'))
        resolve(new File([blob], file.name, { type: 'image/jpeg' }))
      }, 'image/jpeg', 0.8)
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}
