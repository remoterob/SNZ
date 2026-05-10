import { supabase } from '../../lib/supabase'
import { imgFor, infoFor, pointsForSlug, scoreForClaims, isBonusSlug, windowState, nzFormat } from '../../lib/bingo/helpers'
import { notify } from '../../utils/toasts'

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

  const windowGate = compCfg
    ? windowState(new Date().toISOString(), compCfg.comp_start, compCfg.comp_end)
    : { ok: true, state: 'unknown' }

  if (!species) return <div className="card"><p className="small muted">Loading species…</p></div>

  return (
    <div>
      {/* Score chip */}
      {signedIn && (
        <div className="card" style={{ marginBottom: 12, padding: 10 }}>
          <div className="row" style={{ alignItems: 'center' }}>
            <strong>Welcome, {me.name}</strong>
            <div className="right badge" style={{ fontSize: 13 }}>
              {scoreForClaims(myClaims, pMap)} pts
            </div>
          </div>
        </div>
      )}

      {/* Comp window info */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="row" style={{ alignItems: 'baseline' }}>
          <h3 style={{ marginRight: 8 }}>Claim a Fish</h3>
          {compCfg && (
            <span className="small muted">
              {windowGate.ok
                ? `Season closes ${nzFormat(compCfg.comp_end)}`
                : windowGate.state === 'before'
                  ? `Opens ${nzFormat(compCfg.comp_start)}`
                  : 'Season closed'}
            </span>
          )}
        </div>
        <p className="small muted">Tick "First time" if it's truly your first ever claim for that species — you get double points.</p>

        <div className="grid grid-3">
          {species.filter(s => !isBonusSlug(s.slug)).map(s => {
            const mine  = myClaimFor(s.slug)
            const info  = infoFor(infoMap, s.name)
            const pts   = mine ? s.points * (mine.first_time ? 2 : 1) : 0
            const checked = !!firstChoice[s.slug]

            return (
              <div key={s.slug} className="card">
                <div className="img-box" style={{ position: 'relative' }}>
                  <img
                    src={mine?.photo_url || mine?.thumb_url || imgFor(s) || ''}
                    alt={s.name}
                    onError={e => { e.currentTarget.style.opacity = 0.3 }}
                  />
                  {mine && (
                    <div style={{ position: 'absolute', top: 6, right: 6, background: '#009688', color: '#fff', padding: '4px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>
                      Claimed
                    </div>
                  )}
                </div>

                <div className="row" style={{ marginTop: 8, alignItems: 'baseline' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                      <strong>{s.name}</strong>
                      {info && (info.tips || info.recipe) && (
                        <button
                          onClick={() => setOpenInfoSlug(openInfoSlug === s.slug ? null : s.slug)}
                          className="small"
                          style={{ all: 'unset', cursor: 'pointer', color: '#009688', borderBottom: '1px dashed #009688' }}
                        >
                          Tips & recipes
                        </button>
                      )}
                    </div>
                    <div className="small muted">{s.points} pts</div>
                  </div>
                </div>

                {openInfoSlug === s.slug && info && (
                  <div className="small" style={{ marginTop: 8, background: '#2B2F33', border: '1px solid #3F444A', padding: 8, borderRadius: 8 }}>
                    {info.tips && (
                      <div style={{ marginBottom: 6 }}>
                        <strong>Tips:</strong>{' '}
                        <span className="muted" dangerouslySetInnerHTML={{ __html: info.tips }} />
                      </div>
                    )}
                    {info.recipe && (
                      <div>
                        <strong>Recipe:</strong>{' '}
                        <a href={info.recipe} target="_blank" rel="noreferrer" style={{ color: '#009688' }}>
                          {(() => { try { return new URL(info.recipe).hostname } catch { return 'Open link' } })()}
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {!mine ? (
                  <div className="row" style={{ marginTop: 8, alignItems: 'center' }}>
                    {!NO_FIRST_TIME.has(s.slug) && (
                      <>
                        <input type="checkbox" id={`ft-${s.slug}`} checked={checked}
                          onChange={e => setFirstChoice(prev => ({ ...prev, [s.slug]: e.target.checked }))} />
                        <label htmlFor={`ft-${s.slug}`} className="small" style={{ marginLeft: 6 }}>First time (2x pts)</label>
                      </>
                    )}
                    <button className="btn primary right"
                      onClick={() => { setFirstChoice(p => ({ ...p, [s.slug]: false })); claim(s.slug) }}
                      disabled={!signedIn || (compCfg && !windowGate.ok)}>
                      Claim
                    </button>
                  </div>
                ) : (
                  <div className="row" style={{ marginTop: 8, alignItems: 'center', justifyContent: 'space-between' }}>
                    <div className="small" style={{ flex: '1 1 auto' }}>
                      <strong>{pts}</strong> pts {mine.first_time ? '(first-time ×2)' : ''}
                    </div>
                    <div style={{ flexShrink: 0, display: 'flex', gap: 6 }}>
                      {mine.photo_url ? (
                        <a href={mine.photo_url} target="_blank" rel="noreferrer"
                          className="btn small" style={{ background: '#009688', color: '#fff', textAlign: 'center' }}>
                          View Pic
                        </a>
                      ) : (
                        <>
                          <input type="file" accept="image/*" id={`upload-${s.slug}`} style={{ display: 'none' }}
                            onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(f, s.slug) }} />
                          <label htmlFor={`upload-${s.slug}`} className="btn small" style={{ background: '#444', color: '#fff', cursor: 'pointer' }}>
                            Add Pic
                          </label>
                        </>
                      )}
                      <button className="btn small" onClick={() => unclaim(s.slug)}>Unclaim</button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* My claims table */}
      <div className="card">
        <h3>Your Claims</h3>
        {!signedIn ? (
          <p className="small muted">Sign in to see your claims.</p>
        ) : myClaims.length === 0 ? (
          <p className="small muted">No claims yet — get out there!</p>
        ) : (
          <table className="table">
            <thead><tr><th>Time</th><th>Species</th><th>Points</th><th></th></tr></thead>
            <tbody>
              {myClaims.map(c => {
                const sp = species.find(s => s.slug === c.species_slug)
                const isBonus = isBonusSlug(c.species_slug)
                const name = sp ? sp.name : c.species_slug
                const base = pointsForSlug(c.species_slug, pMap)
                const pts  = base * (isBonus ? 1 : c.first_time ? 2 : 1)
                return (
                  <tr key={c.id}>
                    <td className="small">{c.created_at ? new Date(c.created_at).toLocaleString('en-NZ') : ''}</td>
                    <td>{name}{!isBonus && c.first_time ? ' (first-time)' : ''}</td>
                    <td><strong>{pts}</strong></td>
                    <td><button className="btn" onClick={() => unclaim(c.species_slug)} style={{ padding: '3px 8px', fontSize: 12 }}>Unclaim</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
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
