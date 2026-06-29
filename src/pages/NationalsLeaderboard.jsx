import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  teamLeaderboard, photographyLeaderboard, finSwimLeaderboard, superDiverLeaderboard, medalFor,
} from '../lib/nationalsScoring'

const SNZ_BLUE = '#2B6CB0'
const SNZ_DARK = '#1e3a5f'

const BOARDS = [
  { id: 'open',        label: '🏆 Open',        type: 'team' },
  { id: 'womens',      label: "🔱 Women's",     type: 'team', scoreFrom: 'open' },
  { id: 'juniors',     label: '🌟 Juniors',     type: 'team' },
  { id: 'under23',     label: '🎯 Under 23',    type: 'team' },
  { id: 'photography', label: '📸 Photography', type: 'photo' },
  { id: 'goldenoldie', label: '🎖️ 60+ Boat',    type: 'team' },
  { id: 'finswim',     label: '🐟 Fin Swim',    type: 'finswim' },
  { id: 'superdiver',  label: '⭐ Super Diver',  type: 'superdiver' },
]

const diverLine = (t) => `${t._d1?.name || 'Diver 1'}${t._d2?.name ? ` & ${t._d2.name}` : ''}`

// Per-team fish breakdown — the weigh-ins that make up a team's score.
function FishBreakdown({ teamId, weighins, scoreDiv }) {
  const entries = weighins.filter(w => w.team_id === teamId && w.division === scoreDiv)
  const fish = entries.filter(w => !w.is_bulk)
  const bulk = entries.find(w => w.is_bulk)
  return (
    <div className="px-4 py-3 bg-blue-50/60 border-t border-blue-100">
      <div className="space-y-1.5 max-w-sm mx-auto sm:mx-0">
        {fish.map((w, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <span className="font-semibold text-gray-700">🐟 {w.fish_name}{w.instance > 1 ? ` #${w.instance}` : ''}</span>
            <div className="flex items-center gap-3">
              {w.weight_kg != null && <span className="text-gray-400">{w.weight_kg} kg</span>}
              <span className="font-black w-14 text-right" style={{ color: SNZ_BLUE }}>{w.points_awarded} pts</span>
            </div>
          </div>
        ))}
        {bulk && (
          <div className="flex items-center justify-between text-xs border-t border-blue-200 pt-1.5">
            <span className="font-semibold text-gray-500">⚖ Bulk — {bulk.weight_kg} kg</span>
            <span className="font-black w-14 text-right" style={{ color: SNZ_BLUE }}>+{bulk.points_awarded} pts</span>
          </div>
        )}
        {fish.length === 0 && !bulk && <p className="text-xs text-gray-400">No individual fish recorded.</p>}
      </div>
    </div>
  )
}

function Row({ rank, title, sub, right, rightSub, top }) {
  return (
    <div className={`px-4 py-3 flex items-center gap-3 ${top ? 'bg-amber-50' : ''}`}>
      <span className="w-9 text-center font-black text-base flex-shrink-0">
        {rank ? medalFor(rank) : <span className="text-gray-300 text-sm">–</span>}
      </span>
      <div className="flex-1 min-w-0">
        <p className="font-bold text-gray-900 text-sm truncate">{title}</p>
        {sub && <p className="text-xs text-gray-400 truncate">{sub}</p>}
      </div>
      <div className="text-right flex-shrink-0">
        {right}
        {rightSub && <p className="text-xs text-gray-400">{rightSub}</p>}
      </div>
    </div>
  )
}

function TeamBoardRows({ board, teams, weighins }) {
  const [expandedId, setExpandedId] = useState(null)
  const rows = teamLeaderboard(teams, weighins, board.id, board.scoreFrom)
  const scoreDiv = board.scoreFrom || board.id
  if (rows.length === 0) {
    return <div className="p-8 text-center text-gray-400 text-sm">No teams registered for this event yet.</div>
  }
  return (
    <div className="divide-y divide-gray-100">
      {rows.map((t, i) => {
        const open = expandedId === t.id
        return (
          <div key={t.id}>
            <button type="button" disabled={!t.hasEntry}
              onClick={() => setExpandedId(open ? null : t.id)}
              className={`w-full text-left px-4 py-3 flex items-center gap-3 ${t.hasEntry ? 'cursor-pointer hover:bg-gray-50' : 'cursor-default'} ${open ? 'bg-blue-50' : i === 0 && t.hasEntry ? 'bg-amber-50' : ''}`}>
              <span className="w-9 text-center font-black text-base flex-shrink-0">
                {t.rank ? medalFor(t.rank) : <span className="text-gray-300 text-sm">–</span>}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 text-sm truncate flex items-center gap-1">
                  {t.team_name}{t.hasEntry && <span className="text-gray-400 text-xs">{open ? '▲' : '▼'}</span>}
                </p>
                <p className="text-xs text-gray-400 truncate">{diverLine(t)}</p>
              </div>
              <div className="text-right flex-shrink-0">
                {t.hasEntry
                  ? <><p className="text-base font-black" style={{ color: SNZ_BLUE }}>{t.total} pts</p><p className="text-xs text-gray-400">{t.fishCount} fish</p></>
                  : <p className="text-xs text-gray-300">Not weighed in</p>}
              </div>
            </button>
            {open && <FishBreakdown teamId={t.id} weighins={weighins} scoreDiv={scoreDiv} />}
          </div>
        )
      })}
    </div>
  )
}

function Board({ board, teams, weighins }) {
  let rows, render, empty

  if (board.type === 'team') {
    const count = teamLeaderboard(teams, weighins, board.id, board.scoreFrom).filter(r => r.hasEntry).length
    return (
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <h2 className="font-black text-gray-900">{board.label} — Leaderboard</h2>
          <span className="text-xs text-gray-400">{count} result{count !== 1 ? 's' : ''} · tap a pair for their fish</span>
        </div>
        <TeamBoardRows board={board} teams={teams} weighins={weighins} />
      </div>
    )
  } else if (board.type === 'photo') {
    rows = photographyLeaderboard(teams, weighins)
    empty = 'No photography competitors registered yet.'
    render = (c, i) => (
      <Row key={c.key} top={i === 0 && c.hasResult} rank={c.rank}
        title={c.name} sub={c.team.team_name}
        right={c.hasResult
          ? <p className="text-base font-black" style={{ color: SNZ_BLUE }}>{c.count}</p>
          : <p className="text-xs text-gray-300">No result</p>}
        rightSub={c.hasResult ? 'species' : null} />
    )
  } else if (board.type === 'finswim') {
    rows = finSwimLeaderboard(teams, weighins)
    empty = 'No fin swimmers registered yet.'
    render = (c, i) => (
      <Row key={c.key} top={c.placing === 1} rank={c.placing}
        title={c.name} sub={c.team.team_name}
        right={c.hasResult
          ? <p className="text-sm font-bold text-gray-700">{c.placing === 1 ? '1st' : c.placing === 2 ? '2nd' : c.placing === 3 ? '3rd' : `${c.placing}th`}</p>
          : <p className="text-xs text-gray-300">No placing</p>} />
    )
  } else { // superdiver
    rows = superDiverLeaderboard(teams, weighins)
    empty = 'No Super Diver entrants yet — requires Open, Photography & Fin Swim.'
    render = (c, i) => (
      <Row key={c.key} top={i === 0 && c.complete} rank={c.rank}
        title={c.name} sub={c.team.team_name}
        right={c.complete
          ? <p className="text-base font-black" style={{ color: SNZ_BLUE }}>{c.aggregate}</p>
          : <p className="text-xs text-amber-500">Incomplete</p>}
        rightSub={c.complete
          ? `Open ${c.openPlacing} · Photo ${c.photoPlacing} · Swim ${c.swimPlacing}`
          : 'needs all 3 events'} />
    )
  }

  const entered = rows.filter(r => r.hasEntry || r.hasResult || r.complete).length

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
        <h2 className="font-black text-gray-900">{board.label} — Leaderboard</h2>
        <span className="text-xs text-gray-400">{entered} result{entered !== 1 ? 's' : ''}</span>
      </div>
      {board.id === 'superdiver' && (
        <p className="px-4 pt-3 text-xs text-gray-400">Lowest aggregate of Open + Photography + Fin Swim placings wins.</p>
      )}
      {rows.length === 0
        ? <div className="p-8 text-center text-gray-400 text-sm">{empty}</div>
        : <div className="divide-y divide-gray-100">{rows.map(render)}</div>}
    </div>
  )
}

export default function NationalsLeaderboard() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('open')

  const load = async () => {
    try {
      const res = await fetch('/.netlify/functions/nationals-leaderboard')
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Failed to load leaderboard')
      setData(body)
      setError('')
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const id = setInterval(load, 60000) // refresh every 60s
    return () => clearInterval(id)
  }, [])

  const board = BOARDS.find(b => b.id === tab)

  return (
    <div className="min-h-screen bg-gray-50">
      <div style={{ background: SNZ_DARK }} className="px-6 py-3 flex items-center justify-between border-b border-blue-900">
        <button onClick={() => navigate('/nationals')}
          className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
          ← Nationals
        </button>
        <span className="text-white/70 text-xs font-semibold">{data?.comp?.name || 'SNZ Nationals 2027'}</span>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-black text-gray-900 mb-1">Live Leaderboards</h1>
        <p className="text-gray-500 text-sm mb-4">Results per event. Updates automatically every minute.</p>

        <div className="flex gap-1.5 flex-wrap mb-4">
          {BOARDS.map(b => (
            <button key={b.id} onClick={() => setTab(b.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold transition border ${tab === b.id ? 'text-white border-transparent' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}
              style={tab === b.id ? { background: SNZ_BLUE } : {}}>
              {b.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="p-12 text-center text-gray-400 text-sm">Loading results…</div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
            <p className="text-sm text-red-700">{error}</p>
            <button onClick={load} className="mt-3 px-4 py-2 rounded-xl font-bold text-white text-sm" style={{ background: SNZ_BLUE }}>Retry</button>
          </div>
        ) : (
          <Board board={board} teams={data.teams} weighins={data.weighins} />
        )}
      </div>
    </div>
  )
}
