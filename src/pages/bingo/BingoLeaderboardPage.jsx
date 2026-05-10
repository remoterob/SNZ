import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { pointsForSlug, isBonusSlug } from '../../lib/bingo/helpers'

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
    <div className="card">
      <h3>Leaderboard</h3>
      {leaderboard.length === 0 ? (
        <p className="small muted">No claims yet — be the first on the board!</p>
      ) : (
        <>
          <div className="leaderboard-grid leaderboard-header" style={{ marginBottom: 8 }}>
            <div className="col-rank">#</div>
            <div className="col-name">Name</div>
            <div className="col-score">Score</div>
          </div>
          {leaderboard.map((r, i) => (
            <div key={r.id} className="leaderboard-grid" style={{ padding: '6px 0', borderTop: i ? '1px solid #3F444A' : 'none' }}>
              <div className="col-rank">{i + 1}</div>
              <div className="col-name">
                <button
                  onClick={() => navigate(`/bingo/diver?uid=${r.id}&name=${encodeURIComponent(r.name)}`)}
                  style={{ all: 'unset', cursor: 'pointer', color: '#009688', textDecoration: 'underline', textUnderlineOffset: 2, wordBreak: 'break-word' }}>
                  {r.name}
                </button>
              </div>
              <div className="col-score">{r.score}</div>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
