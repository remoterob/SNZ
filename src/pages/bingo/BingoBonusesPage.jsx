import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { imgFor } from '../../lib/bingo/helpers'

const SNZ_BLUE = '#2B6CB0'
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
    return <div className="bg-white border border-gray-200 rounded-2xl p-6 text-center text-gray-400 text-sm">Loading bonuses…</div>
  }

  const month = getCurrentMonth()
  const monthRow = bonuses.find(b => b.bonus_type === 'monthly' && b.month === month) || null
  const evergreen = bonuses.filter(b => b.bonus_type === 'evergreen')

  return (
    <div className="space-y-4">
      {monthRow && (
        <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5">
          <div className="flex items-baseline justify-between gap-3 mb-2 flex-wrap">
            <h3 className="font-black text-gray-900">Row of the Month</h3>
            <span className="text-xs text-gray-400">{monthRow.title} · +{monthRow.points} pts</span>
          </div>
          <BonusGroup group={monthRow} species={species} claimedSpecies={claimedSpecies}
            signedIn={signedIn} token={token} compCfg={compCfg} onChanged={onChanged} />
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5">
        <h3 className="font-black text-gray-900 mb-3">Full competition bonuses</h3>
        {evergreen.map((g, i) => (
          <div key={g.id} className={i > 0 ? 'border-t border-gray-100 pt-4 mt-4' : ''}>
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <p className="font-bold text-gray-900 text-sm">{g.title}</p>
              <span className="text-xs text-gray-400">+{g.points} pts</span>
            </div>
            {g.description && <p className="text-xs text-gray-500 mt-1">{g.description}</p>}
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
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
        {items.map(({ name, sp, has }) => (
          <div key={name} className="flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-lg p-1.5">
            {sp ? (
              <img src={imgFor(sp) || ''} alt={name}
                className="w-9 h-9 object-cover rounded-md border border-gray-200 flex-shrink-0"
                onError={e => { e.target.style.display = 'none' }} />
            ) : (
              <div className="w-9 h-9 flex items-center justify-center text-xs text-gray-400 border border-gray-200 rounded-md flex-shrink-0">?</div>
            )}
            <span className="text-xs text-gray-700 truncate flex-1 min-w-0">{name}</span>
            {has && <span className="text-green-600 font-black text-sm flex-shrink-0">✓</span>}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3 mt-3">
        <p className="text-xs text-gray-400">{claimed} / {items.length} claimed</p>
        <div className="flex gap-2">
          {bonusClaimed ? (
            <>
              <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-green-50 text-green-700 border border-green-200">Claimed ✓</span>
              <button className="text-xs font-bold px-2.5 py-1 rounded-lg border border-red-200 text-red-500 hover:bg-red-50" onClick={doUnclaim}>Unclaim</button>
            </>
          ) : allMet ? (
            <button className="text-xs font-bold px-3 py-1.5 rounded-lg text-white disabled:opacity-40"
              style={{ background: SNZ_BLUE }} disabled={!signedIn} onClick={doClaimBonus}>
              Claim bonus
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
