import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { isBonusSlug, imgFor } from '../../lib/bingo/helpers'

const SNZ_BLUE = '#2B6CB0'
const SNZ_DARK = '#1e3a5f'

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
      <div className="min-h-screen bg-gray-50">
        <div style={{ background: SNZ_DARK }} className="px-4 sm:px-6 py-3 flex items-center border-b border-blue-900">
          <button onClick={() => navigate('/bingo')}
            className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
            ← Fish Bingo
          </button>
        </div>
        <p className="max-w-3xl mx-auto px-4 py-8 text-sm text-gray-400">No diver specified.</p>
      </div>
    )
  }

  const displayName = profile?.name || diverName

  return (
    <div className="min-h-screen bg-gray-50">
      <div style={{ background: SNZ_DARK }} className="sticky top-0 z-20 px-4 sm:px-6 py-3 flex items-center justify-between gap-2 border-b border-blue-900">
        <button onClick={() => navigate('/bingo')}
          className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition whitespace-nowrap flex-shrink-0">
          ← Fish Bingo
        </button>
        <span className="text-white font-bold text-sm truncate min-w-0 text-center">{displayName}</span>
        <span className="bg-white/15 text-white text-xs font-bold px-3 py-1.5 rounded-full whitespace-nowrap flex-shrink-0">
          {totalScore} pts
        </span>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        <div className="bg-white border border-gray-200 rounded-2xl p-4">
          <h2 className="font-black text-gray-900 text-lg">{displayName}</h2>
          {profile?.region && <p className="text-xs text-gray-400 mt-0.5">{profile.region}</p>}
        </div>

        <section>
          <h3 className="font-black text-gray-900 mb-3">Catches</h3>
          {loading && <p className="text-sm text-gray-400">Loading…</p>}
          {!loading && catches.length === 0 && <p className="text-sm text-gray-400">No catches yet.</p>}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {catches.map(cl => (
              <div key={cl.id} className="bg-white border border-gray-200 rounded-xl p-1.5">
                <div className="w-full aspect-square bg-gray-50 rounded-lg overflow-hidden">
                  {cl._imageSrc ? (
                    <img src={cl._imageSrc} alt={cl._displayName}
                      className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 text-xs">No image</div>
                  )}
                </div>
                <div className="text-center mt-1.5">
                  <p className="text-xs font-semibold text-gray-700 truncate">{cl._displayName}</p>
                  <p className={`text-xs font-bold ${cl._isFirst ? 'text-green-600' : 'text-gray-400'}`}>
                    {cl._points} pts{cl._isFirst ? ' (first!)' : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {bonusClaims.length > 0 && (
          <section>
            <h3 className="font-black text-gray-900 mb-3">Bonuses</h3>
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden divide-y divide-gray-100">
              {bonusClaims.map(b => (
                <div key={b.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-gray-800">{b._displayName}</p>
                  <p className="text-sm font-bold flex-shrink-0" style={{ color: SNZ_BLUE }}>{b._points} pts</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
