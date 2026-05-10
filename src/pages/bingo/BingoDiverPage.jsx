import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { pointsForSlug, isBonusSlug, imgFor } from '../../lib/bingo/helpers'
import '../../bingo.css'

const SNZ_BLUE = '#2B6CB0'

function useQuery() {
  const { search } = useLocation()
  return useMemo(() => new URLSearchParams(search), [search])
}

export default function BingoDiverPage() {
  const navigate = useNavigate()
  const query    = useQuery()
  const userId   = query.get('uid') || ''
  const diverName = query.get('name') || 'Diver'

  const [claims,   setClaims]  = useState([])
  const [species,  setSpecies] = useState([])
  const [bonuses,  setBonuses] = useState([])
  const [profile,  setProfile] = useState(null)
  const [loading,  setLoading] = useState(true)

  useEffect(() => {
    supabase.from('bingo_species').select('id, name, slug, points, image_path')
      .eq('is_active', true).then(({ data }) => setSpecies(data || []))
    supabase.from('bingo_bonuses').select('slug, points, title')
      .eq('is_active', true).then(({ data }) => setBonuses(data || []))
  }, [])

  useEffect(() => {
    if (!userId) return
    supabase.from('members').select('id, name, region').eq('id', userId).maybeSingle()
      .then(({ data }) => setProfile(data))
  }, [userId])

  useEffect(() => {
    if (!userId) { setLoading(false); return }
    supabase.from('bingo_claims')
      .select('id, user_id, species_slug, first_time, photo_url, thumb_url, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setClaims(data || []); setLoading(false) })
  }, [userId])

  const speciesIndex = useMemo(() => {
    const idx = {}
    for (const s of species) idx[s.slug] = s
    return idx
  }, [species])

  const bonusIndex = useMemo(() => {
    const idx = {}
    for (const b of bonuses) idx[b.slug] = b
    return idx
  }, [bonuses])

  const { catches, bonusClaims, totalScore } = useMemo(() => {
    const c = [], b = []
    let total = 0
    for (const row of claims) {
      const slug = row.species_slug || ''
      if (isBonusSlug(slug) && bonusIndex[slug]) {
        const pts = bonusIndex[slug].points || 0
        total += pts
        b.push({ ...row, _displayName: bonusIndex[slug].title || slug, _points: pts })
      } else if (speciesIndex[slug]) {
        const sp   = speciesIndex[slug]
        const base = sp.points || 0
        const pts  = row.first_time ? base * 2 : base
        total += pts
        c.push({ ...row, _displayName: sp.name, _imageSrc: row.photo_url || row.thumb_url || imgFor(sp), _points: pts, _isFirst: !!row.first_time })
      }
    }
    return { catches: c, bonusClaims: b, totalScore: total }
  }, [claims, speciesIndex, bonusIndex])

  if (!userId) {
    return (
      <div className="bingo-app">
        <div style={{ background: SNZ_BLUE }} className="px-6 py-3 flex items-center border-b border-blue-700">
          <button onClick={() => navigate('/bingo')}
            style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', fontWeight: 700, fontSize: 13, padding: '6px 10px', borderRadius: 8, cursor: 'pointer' }}>
            ← Fish Bingo
          </button>
        </div>
        <div className="container"><p className="muted">No diver specified.</p></div>
      </div>
    )
  }

  const displayName = profile?.name || diverName

  return (
    <div className="bingo-app">
      <div style={{ background: SNZ_BLUE, position: 'sticky', top: 0, zIndex: 20, padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
        <button onClick={() => navigate('/bingo')}
          style={{ background: 'rgba(255,255,255,0.15)', border: 'none', color: '#fff', fontWeight: 700, fontSize: 13, padding: '6px 10px', borderRadius: 8, cursor: 'pointer' }}>
          ← Fish Bingo
        </button>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>{displayName}</span>
        <span style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 999, padding: '3px 10px', fontSize: 13, color: '#fff', fontWeight: 700 }}>
          {totalScore} pts
        </span>
      </div>

      <div className="container" style={{ paddingTop: 12 }}>
        <div className="card" style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>{displayName}</h2>
          {profile?.region && <div className="small muted" style={{ marginTop: 4 }}>{profile.region}</div>}
        </div>

        <section style={{ marginBottom: 24 }}>
          <h3>Catches</h3>
          {loading && <p className="small muted">Loading…</p>}
          {!loading && catches.length === 0 && <p className="small muted">No catches yet.</p>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {catches.map(cl => (
              <div key={cl.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ padding: 6, border: '1px solid #3F444A', borderRadius: 10, background: '#33383D', width: '100%' }}>
                  <div style={{ width: '100%', aspectRatio: '1', background: '#2B2F33', border: '1px solid #3F444A', borderRadius: 8, overflow: 'hidden' }}>
                    {cl._imageSrc ? (
                      <img src={cl._imageSrc} alt={cl._displayName}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />
                    ) : (
                      <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: '#A8B0B6', fontSize: 11 }}>No image</div>
                    )}
                  </div>
                  <div className="diver-caption">
                    <span>{cl._displayName}</span>
                    <span className={cl._isFirst ? 'first-time' : ''} style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {cl._points} pts{cl._isFirst ? ' (first!)' : ''}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {bonusClaims.length > 0 && (
          <section>
            <h3>Bonuses</h3>
            <ul style={{ border: '1px solid #3F444A', borderRadius: 12, overflow: 'hidden', listStyle: 'none', padding: 0, margin: 0 }}>
              {bonusClaims.map(b => (
                <li key={b.id} style={{ background: '#33383D', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #3F444A' }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{b._displayName}</div>
                  <div style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>{b._points} pts</div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}
