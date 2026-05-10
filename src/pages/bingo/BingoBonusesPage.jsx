import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { imgFor } from '../../lib/bingo/helpers'

const BINGO_CLAIM_API = '/.netlify/functions/bingo-claim'
const normalize = (s = '') => s.toString().trim().toLowerCase()

function resolveSlugByName(speciesArray, name) {
  if (!Array.isArray(speciesArray)) return null
  const q = normalize(name)
  const bySlug = speciesArray.find(s => normalize(s.slug) === q)
  if (bySlug) return bySlug.slug
  const byName = speciesArray.find(s => normalize(s.name) === q)
  if (byName) return byName.slug
  const parts = q.split(' ')
  const fuzzy = speciesArray.find(s => {
    const n = normalize(s.name).split(' ')
    return parts.every(p => n.includes(p))
  })
  return fuzzy ? fuzzy.slug : null
}

function getCurrentMonth() { return new Date().getMonth() + 1 }

export default function BingoBonusesPage({ species, myClaims, compCfg, signedIn, token }) {
  const [bonuses, setBonuses] = useState([])
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    supabase.from('bingo_bonuses')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .then(({ data }) => setBonuses(data || []))
  }, [refreshKey])

  const claimedSpecies = useMemo(() => new Set((myClaims || []).map(c => c.species_slug)), [myClaims])

  const onChanged = () => setRefreshKey(k => k + 1)

  if (!species || bonuses.length === 0) {
    return <div className="card"><p className="small muted">Loading bonuses…</p></div>
  }

  const month = getCurrentMonth()
  const monthRow = bonuses.find(b => b.bonus_type === 'monthly' && b.month === month) || null
  const evergreen = bonuses.filter(b => b.bonus_type === 'evergreen')

  return (
    <div>
      {monthRow && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="row" style={{ alignItems: 'baseline', marginBottom: 6 }}>
            <h3 style={{ margin: 0 }}>Row of the Month</h3>
            <div className="right small muted">{monthRow.title} · +{monthRow.points} pts</div>
          </div>
          <BonusGroup group={monthRow} species={species} claimedSpecies={claimedSpecies}
            signedIn={signedIn} token={token} compCfg={compCfg} onChanged={onChanged} />
        </div>
      )}

      <div className="card">
        <h3>Full competition bonuses</h3>
        {evergreen.map(g => (
          <div key={g.id} style={{ borderTop: '1px solid #222', paddingTop: 12, marginTop: 12 }}>
            <div className="row" style={{ alignItems: 'baseline' }}>
              <strong>{g.title}</strong>
              <div className="right small muted">+{g.points} pts</div>
            </div>
            {g.description && <p className="small muted" style={{ margin: '4px 0 0' }}>{g.description}</p>}
            <BonusGroup group={g} species={species} claimedSpecies={claimedSpecies}
              signedIn={signedIn} token={token} compCfg={compCfg} onChanged={onChanged} />
          </div>
        ))}
      </div>
    </div>
  )
}

function BonusGroup({ group, species, claimedSpecies, signedIn, token, compCfg, onChanged }) {
  const items = (group.species || []).map(name => {
    const slug = resolveSlugByName(species, name)
    const sp   = slug ? species.find(s => s.slug === slug) : null
    const has  = slug ? claimedSpecies.has(slug) : false
    return { name, slug, sp, has }
  })

  const required   = items.filter(i => !!i.slug).map(i => i.slug)
  const claimed    = items.filter(i => i.has).length
  const allMet     = required.length > 0 && claimed === required.length
  const bonusClaimed = claimedSpecies.has(group.slug)

  const doClaimBonus = async () => {
    if (!signedIn) { alert('Please sign in first.'); return }
    if (!allMet)   { alert('Claim all species in this row first.'); return }
    if (bonusClaimed) { alert('Already claimed.'); return }
    try {
      const r = await fetch(BINGO_CLAIM_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ species_slug: group.slug, first_time: false, comp_season: compCfg?.season }),
      })
      if (!r.ok) throw new Error((await r.json())?.error || 'Claim failed')
      onChanged?.()
    } catch (e) { alert(e.message) }
  }

  const doUnclaim = async () => {
    if (!signedIn) return
    try {
      const r = await fetch(`${BINGO_CLAIM_API}?species_slug=${encodeURIComponent(group.slug)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!r.ok) throw new Error(await r.text())
      onChanged?.()
    } catch (e) { alert(e.message) }
  }

  return (
    <div>
      <div className="grid grid-3" style={{ marginTop: 8 }}>
        {items.map(({ name, sp, has }) => (
          <div key={name} className="row" style={{ alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
              {sp ? (
                <img src={imgFor(sp) || ''} alt={name}
                  style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 6, border: '1px solid #2a2a2a' }}
                  onError={e => { e.target.style.display = 'none' }}
                />
              ) : (
                <div className="small muted" style={{ width: 40, height: 40, display: 'grid', placeItems: 'center', border: '1px solid #2a2a2a', borderRadius: 6 }}>?</div>
              )}
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</span>
              {has && <span style={{ fontSize: '1.6em', color: '#10b981', lineHeight: 1, marginLeft: 4 }}>✓</span>}
            </div>
          </div>
        ))}
      </div>
      <div className="row" style={{ marginTop: 8, alignItems: 'center' }}>
        <div className="small muted">{claimed} / {items.length} claimed</div>
        <div className="right">
          {bonusClaimed ? (
            <>
              <button className="btn" disabled>Claimed ✓</button>
              <button className="btn" style={{ marginLeft: 8 }} onClick={doUnclaim}>Unclaim</button>
            </>
          ) : allMet ? (
            <button className="btn primary" disabled={!signedIn} onClick={doClaimBonus}>Claim bonus</button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
