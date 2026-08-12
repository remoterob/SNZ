import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { pointsForSlug, isBonusSlug } from '../../lib/bingo/helpers'

const SNZ_BLUE = '#2B6CB0'
const medalFor = (rank) => rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`

const AGE_GROUP_ORDER = ['Junior (Under 18)', '18–50', '50+']

function ageGroupFor(dob) {
  if (!dob) return null
  const birth = new Date(dob)
  if (isNaN(birth)) return null
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const beforeBirthday = now.getMonth() < birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())
  if (beforeBirthday) age--
  if (age < 18) return 'Junior (Under 18)'
  if (age < 50) return '18–50'
  return '50+'
}

const DIMENSIONS = [
  { id: 'overall',    label: 'Overall' },
  { id: 'region',     label: 'Region' },
  { id: 'gender',     label: 'Gender' },
  { id: 'age',        label: 'Age Group' },
  { id: 'club',       label: 'Club' },
  { id: 'experience', label: 'Experience' },
]

const UNSTATED = new Set(['Not stated', 'No club listed'])

export default function BingoLeaderboardPage({ allClaims, pMap, profiles }) {
  const navigate = useNavigate()
  const [dimension, setDimension] = useState('overall')

  const scoreClaim = (c) => {
    const base = pointsForSlug(c.species_slug, pMap)
    return isBonusSlug(c.species_slug) ? base : base * (c.first_time ? 2 : 1)
  }

  // Per-diver totals, independent of which grouping is being viewed.
  const divers = useMemo(() => {
    const totals = new Map()
    const names  = new Map()
    for (const c of allClaims || []) {
      const uid = c.user_id
      if (!uid) continue
      totals.set(uid, (totals.get(uid) || 0) + scoreClaim(c))
      if (!names.has(uid)) names.set(uid, c.display_name || 'Diver')
    }
    return Array.from(totals.entries()).map(([id, score]) => ({
      id, score, name: names.get(id) || 'Diver', profile: (profiles && profiles[id]) || {},
    }))
  }, [allClaims, pMap, profiles])

  const groupKeyFor = (d) => {
    const p = d.profile
    if (dimension === 'region') return p.region?.trim() || 'Not stated'
    if (dimension === 'gender') return p.gender || 'Not stated'
    if (dimension === 'age') return ageGroupFor(p.dob) || 'Not stated'
    if (dimension === 'club') return p.club?.trim() || 'No club listed'
    if (dimension === 'experience') return p.experience || 'Not stated'
    return 'Overall'
  }

  const rank = (list) => [...list].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))

  const groups = useMemo(() => {
    if (dimension === 'overall') return [{ key: 'Overall', divers: rank(divers) }]
    const byKey = new Map()
    for (const d of divers) {
      const key = groupKeyFor(d)
      if (!byKey.has(key)) byKey.set(key, [])
      byKey.get(key).push(d)
    }
    const keys = Array.from(byKey.keys())
    if (dimension === 'age') {
      keys.sort((a, b) => {
        const ia = AGE_GROUP_ORDER.indexOf(a), ib = AGE_GROUP_ORDER.indexOf(b)
        if (ia === -1 && ib === -1) return a.localeCompare(b)
        if (ia === -1) return 1
        if (ib === -1) return -1
        return ia - ib
      })
    } else {
      // Unstated / no-club buckets sink to the bottom; everything else A–Z.
      keys.sort((a, b) => {
        const aU = UNSTATED.has(a), bU = UNSTATED.has(b)
        if (aU !== bU) return aU ? 1 : -1
        return a.localeCompare(b)
      })
    }
    return keys.map(key => ({ key, divers: rank(byKey.get(key)) }))
  }, [dimension, divers])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {DIMENSIONS.map(d => (
          <button key={d.id} onClick={() => setDimension(d.id)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
              dimension === d.id ? 'text-white border-transparent' : 'text-gray-600 border-gray-300 hover:bg-gray-50'
            }`}
            style={dimension === d.id ? { background: SNZ_BLUE } : {}}>
            {d.label}
          </button>
        ))}
      </div>

      {divers.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center text-sm text-gray-400">
          No claims yet — be the first on the board!
        </div>
      ) : (
        groups.map(g => (
          <div key={g.key} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="px-4 sm:px-5 py-4 border-b border-gray-100 bg-gray-50">
              <h3 className="font-black text-gray-900">{g.key}</h3>
              <p className="text-xs text-gray-400 mt-0.5">{g.divers.length} diver{g.divers.length !== 1 ? 's' : ''} on the board</p>
            </div>
            <div className="divide-y divide-gray-100">
              {g.divers.map((r, i) => (
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
          </div>
        ))
      )}
    </div>
  )
}
