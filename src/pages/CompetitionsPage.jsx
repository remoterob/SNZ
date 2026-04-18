import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const SNZ_BLUE = '#2B6CB0'
const SNZ_LOGO = import.meta.env.VITE_SNZ_LOGO_URL || null

const CATEGORY_COLORS = {
  'Mens':   'bg-blue-50 text-blue-700 border border-blue-200',
  'Womens': 'bg-pink-50 text-pink-700 border border-pink-200',
  'Mixed':  'bg-purple-50 text-purple-700 border border-purple-200',
  'Junior': 'bg-green-50 text-green-700 border border-green-200',
  'Open':   'bg-gray-50 text-gray-700 border border-gray-200',
}

const statusBadge = (s) => {
  if (s === 'active') return 'bg-green-100 text-green-700 border border-green-300'
  if (s === 'closed') return 'bg-gray-100 text-gray-500 border border-gray-300'
  return 'bg-amber-100 text-amber-700 border border-amber-300'
}

export default function CompetitionsPage() {
  const navigate = useNavigate()
  const [comps, setComps] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('competitions').select('*')
      .in('status', ['active', 'closed'])
      .order('date_start', { ascending: false })
      .then(({ data }) => { setComps(data || []); setLoading(false) })
  }, [])

  return (
    <div className="min-h-screen bg-white">
      <div style={{ background: SNZ_BLUE }} className="px-6 py-3 flex items-center justify-between border-b border-blue-700">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">← SNZ Hub</button>
          <span className="text-blue-200 text-sm opacity-75">/ Other Competitions</span>
        </div>
        <button onClick={() => navigate('/competitions/admin')} className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">⚙ Admin</button>
      </div>

      <header className="border-b border-gray-200 px-6 py-5 bg-white flex items-center gap-4">
        {SNZ_LOGO && <img src={SNZ_LOGO} alt="SNZ" className="h-10 w-auto object-contain" />}
        <div>
          <h1 className="text-2xl font-black text-gray-900">Other Competitions</h1>
          <p className="text-xs text-gray-400 tracking-wider">NZ Spearfishing club competitions</p>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-6">
        {loading && <div className="text-center py-16 text-gray-400">Loading competitions…</div>}

        {!loading && comps.length === 0 && (
          <div className="text-center py-16 text-gray-400 bg-gray-50 rounded-2xl">
            <div className="text-4xl mb-3">🎣</div>
            <p className="font-semibold text-gray-600">No competitions running right now.</p>
            <p className="text-sm mt-1">Check back soon or contact your club.</p>
          </div>
        )}

        <div className="space-y-4">
          {comps.map(c => (
            <div key={c.id}
              onClick={() => navigate(`/competitions/${c.id}`)}
              className="bg-white border-2 border-gray-100 rounded-2xl overflow-hidden hover:border-blue-300 hover:shadow-md transition cursor-pointer"
            >
              {/* Cover image */}
              {c.cover_image_url && (
                <div className="w-full overflow-hidden bg-gray-100" style={{ maxHeight: '320px' }}>
                  <img src={c.cover_image_url} alt={c.name} className="w-full h-auto object-contain" />
                </div>
              )}
              <div className="p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${statusBadge(c.status)}`}>
                        {c.status === 'active' ? '● Live' : c.status === 'closed' ? 'Closed' : 'Upcoming'}
                      </span>
                      <span className="text-xs text-gray-400">{c.club_name}</span>
                    </div>
                    <h2 className="text-xl font-black text-gray-900">{c.name}</h2>
                    {c.location && <p className="text-sm text-gray-500 mt-0.5">📍 {c.location}</p>}
                  </div>
                  <div className="text-right flex-shrink-0 text-sm text-gray-400">
                    {c.date_start && <div>{new Date(c.date_start).toLocaleDateString('en-NZ', { day:'numeric', month:'short', year:'numeric' })}</div>}
                    {c.date_end && c.date_end !== c.date_start && <div>→ {new Date(c.date_end).toLocaleDateString('en-NZ', { day:'numeric', month:'short', year:'numeric' })}</div>}
                  </div>
                </div>
                <div className={`flex items-center gap-2 flex-wrap ${c.cover_image_url ? 'px-5 pb-5' : 'px-6 pb-6'}`}>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    {c.scoring_mode === 'standard' ? '⚖ Standard scoring' : '🎯 Fish bingo'}
                  </span>
                  {(c.categories || []).map(cat => (
                    <span key={cat} className={`text-xs font-bold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[cat] || CATEGORY_COLORS['Open']}`}>{cat}</span>
                  ))}
                  <span className="ml-auto text-sm font-bold" style={{ color: SNZ_BLUE }}>View details →</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
