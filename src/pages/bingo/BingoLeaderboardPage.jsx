import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { pointsForSlug, isBonusSlug } from '../../lib/bingo/helpers'

const SNZ_BLUE = '#2B6CB0'
const medalFor = (rank) => rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`

export default function BingoLeaderboardPage({ allClaims, pMap }) {
  const navigate = useNavigate()

  const scoreClaim = (c) => {
    const base = pointsForSlug(c.species_slug, pMap)
    return isBonusSlug(c.species_slug) ? base : base * (c.first_time ? 2 : 1)
  }

  const leaderboard = useMemo(() => {
    const totals = new Map()
    const names  = new Map()
    for (const c of allClaims || []) {
      const uid = c.user_id
      if (!uid) continue
      totals.set(uid, (totals.get(uid) || 0) + scoreClaim(c))
      if (!names.has(uid)) names.set(uid, c.display_name || 'Diver')
    }
    return Array.from(totals.entries())
      .map(([id, score]) => ({ id, score, name: names.get(id) || 'Diver' }))
      .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
  }, [allClaims, pMap])

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="px-4 sm:px-5 py-4 border-b border-gray-100 bg-gray-50">
        <h3 className="font-black text-gray-900">Leaderboard</h3>
        <p className="text-xs text-gray-400 mt-0.5">{leaderboard.length} diver{leaderboard.length !== 1 ? 's' : ''} on the board</p>
      </div>
      {leaderboard.length === 0 ? (
        <p className="px-4 sm:px-5 py-8 text-sm text-gray-400 text-center">No claims yet — be the first on the board!</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {leaderboard.map((r, i) => (
            <div key={r.id} className={`px-4 sm:px-5 py-3 flex items-center gap-3 ${i === 0 ? 'bg-amber-50' : ''}`}>
              <span className="w-9 text-center font-black text-sm flex-shrink-0">{medalFor(i + 1)}</span>
              <button
                onClick={() => navigate(`/bingo/diver?uid=${r.id}&name=${encodeURIComponent(r.name)}`)}
                className="flex-1 min-w-0 text-left font-bold text-sm truncate hover:underline"
                style={{ color: SNZ_BLUE }}>
                {r.name}
              </button>
              <span className="text-sm font-black flex-shrink-0" style={{ color: SNZ_BLUE }}>{r.score} pts</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
