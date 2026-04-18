import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'


const SNZ_BLUE = '#2B6CB0'

function MemberBadge() {
  const { member, session } = useMemberSession()
  const navigate = useNavigate()
  if (!session) return (
    <button onClick={() => navigate('/membership/login')}
      className="flex items-center gap-1.5 text-white/70 hover:text-white text-xs font-semibold transition px-2 py-1 rounded-lg hover:bg-white/10">
      Sign in
    </button>
  )
  return (
    <button onClick={() => navigate('/membership/dashboard')}
      className="flex items-center gap-2 bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
      <div className="w-6 h-6 rounded-full bg-white/30 flex items-center justify-center text-white font-black text-xs flex-shrink-0">
        {member?.name?.[0]?.toUpperCase() || '?'}
      </div>
      <div className="text-left hidden sm:block">
        <div className="text-white font-bold text-xs leading-tight">{member?.name || 'Member'}</div>
        <div className="text-blue-200 text-xs leading-tight">{member?.member_number || 'SNZ Member'}</div>
      </div>
    </button>
  )
}

const SNZ_LOGO = import.meta.env.VITE_SNZ_LOGO_URL || null

const CATEGORY_COLORS = {
  'Mens':   'bg-blue-50 text-blue-700 border border-blue-200',
  'Womens': 'bg-pink-50 text-pink-700 border border-pink-200',
  'Mixed':  'bg-purple-50 text-purple-700 border border-purple-200',
  'Junior': 'bg-green-50 text-green-700 border border-green-200',
  'Open':   'bg-gray-50 text-gray-700 border border-gray-200',
}

function calcPoints(fish, weightKg, mode) {
  if (mode === 'bingo') return fish.points || 100
  const base = fish.points || 100
  const cap = fish.max_weight_kg || 8
  const bonus = Math.min(cap * 10, Math.floor((weightKg || 0) * 10))
  return base + bonus
}

function SponsorBar({ comp }) {
  const sponsors = [comp?.sponsor1_url, comp?.sponsor2_url, comp?.sponsor3_url].filter(Boolean)
  if (!sponsors.length) return null
  return (
    <div className="bg-white border-t border-gray-100 px-6 py-5">
      <div className="max-w-5xl mx-auto">
        <p className="text-xs font-bold tracking-widest uppercase text-gray-400 text-center mb-3">Proudly Sponsored By</p>
        <div className="flex items-center justify-center gap-8 flex-wrap">
          {sponsors.map((url, i) => (
            <img key={i} src={url} alt={`Sponsor ${i+1}`}
              className="h-12 max-w-32 object-contain opacity-80 hover:opacity-100 transition" />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function CompetitionDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [comp, setComp] = useState(null)
  const [fish, setFish] = useState([])
  const [teams, setTeams] = useState([])
  const [members, setMembers] = useState([])
  const [weighins, setWeighins] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('info')

  useEffect(() => {
    Promise.all([
      supabase.from('competitions').select('*').eq('id', id).single(),
      supabase.from('comp_fish').select('*').eq('competition_id', id).order('sort_order'),
      supabase.from('comp_teams').select('*').eq('competition_id', id).neq('status', 'pending_payment').order('registered_at'),
      supabase.from('comp_team_members').select('*').eq('competition_id', id),
      supabase.from('comp_weighins').select('*').eq('competition_id', id),
    ]).then(([c, f, t, m, w]) => {
      setComp(c.data)
      setFish(f.data || [])
      setTeams(t.data || [])
      setMembers(m.data || [])
      setWeighins(w.data || [])
      setLoading(false)
    })
  }, [id])

  // Build leaderboard
  const leaderboard = teams.map(team => {
    const teamWeighins = weighins.filter(w => w.team_id === team.id)
    const total = teamWeighins.reduce((s, w) => s + (w.points_awarded || 0), 0)
    const fishCount = teamWeighins.length
    return { ...team, total, fishCount }
  }).sort((a, b) => b.total - a.total)

  const tabs = [
    { id: 'info', label: 'Info' },
    { id: 'fish', label: `Fish List (${fish.length})` },
    { id: 'teams', label: `Teams (${teams.length})` },
    { id: 'leaderboard', label: 'Leaderboard' },
  ]

  if (loading) return <div className="min-h-screen bg-white flex items-center justify-center text-gray-400">Loading…</div>
  if (!comp) return <div className="min-h-screen bg-white flex items-center justify-center text-gray-400">Competition not found.</div>

  return (
    <div className="min-h-screen bg-white">
      <div style={{ background: SNZ_BLUE }} className="px-6 py-3 flex items-center justify-between border-b border-blue-700">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/competitions')} className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">← Competitions</button>
          <span className="text-blue-200 text-sm opacity-75">/ {comp.name}</span>
        </div>
        <button onClick={() => navigate(`/competitions/${id}/admin`)} className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">⚙ Admin</button>
      </div>

      {/* Hero */}
      {comp.cover_image_url && (
        <div className="w-full overflow-hidden bg-gray-100 flex justify-center">
          <img src={comp.cover_image_url} alt={comp.name}
            className="w-full h-auto object-contain max-h-screen" />
        </div>
      )}
      <div className="border-b border-gray-200 px-6 py-5 bg-white">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${comp.status === 'active' ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-gray-100 text-gray-500 border border-gray-300'}`}>
                  {comp.status === 'active' ? '● Live' : comp.status === 'closed' ? 'Closed' : 'Upcoming'}
                </span>
                <span className="text-xs text-gray-400">{comp.club_name}</span>
              </div>
              <h1 className="text-3xl font-black text-gray-900">{comp.name}</h1>
              {comp.location && <p className="text-gray-500 mt-1">📍 {comp.location}</p>}
            </div>
            {comp.status === 'active' && (
              <button
                onClick={() => navigate(`/competitions/${id}/register`)}
                className="flex-shrink-0 px-5 py-2.5 rounded-xl font-black text-white text-sm hover:opacity-90 transition"
                style={{ background: '#16a34a' }}
              >+ Register Your Team</button>
            )}
          </div>
          <div className="flex gap-2 mt-3 flex-wrap">
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              {comp.scoring_mode === 'standard' ? '⚖ Standard scoring' : '🎯 Fish bingo'}
            </span>
            {(comp.categories || []).map(cat => (
              <span key={cat} className={`text-xs font-bold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[cat] || CATEGORY_COLORS['Open']}`}>{cat}</span>
            ))}
            {comp.date_start && (
              <span className="text-xs text-gray-500">
                📅 {new Date(comp.date_start).toLocaleDateString('en-NZ', { day:'numeric', month:'long', year:'numeric' })}
                {comp.date_end && comp.date_end !== comp.date_start && ` – ${new Date(comp.date_end).toLocaleDateString('en-NZ', { day:'numeric', month:'long', year:'numeric' })}`}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 px-6 bg-white">
        <div className="max-w-4xl mx-auto flex gap-1">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`py-3 px-4 text-sm font-bold border-b-2 transition ${tab === t.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
            >{t.label}</button>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6">

        {/* INFO TAB */}
        {tab === 'info' && (
          <div className="space-y-5">
            {comp.details && (
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="font-black text-gray-900 mb-2">About this Competition</h3>
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>{comp.details}</p>
              </div>
            )}
            {comp.event_info && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
                <h3 className="font-black text-gray-900 mb-2">📍 Event Info</h3>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>{comp.event_info}</p>
              </div>
            )}
            {comp.rules && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
                <h3 className="font-black text-gray-900 mb-2" style={{ color: SNZ_BLUE }}>Rules</h3>
                <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>{comp.rules}</p>
              </div>
            )}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
              <h3 className="font-black text-gray-900 mb-3">Scoring</h3>
              {comp.scoring_mode === 'standard' ? (
                <div className="text-sm text-gray-600 space-y-1">
                  <p>• <strong>100 points</strong> per species caught</p>
                  <p>• <strong>+10 points per kg</strong> of fish weight</p>
                  <p>• Maximum weight bonus capped at <strong>8 kg per fish</strong> (80 points)</p>
                  <p>• Maximum possible score per fish: <strong>180 points</strong></p>
                </div>
              ) : (
                <div className="text-sm text-gray-600">
                  <p>Points are fixed per species — see the fish list for individual values.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* FISH LIST TAB */}
        {tab === 'fish' && (
          <div>
            {fish.length === 0 && <div className="text-center py-12 text-gray-400">Fish list not yet published.</div>}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {fish.map(f => (
                <div key={f.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                  <div className="relative w-full h-32 bg-gray-50 flex items-center justify-center text-4xl">
                    <span>🐟</span>
                    {f.photo_url && (
                      <img src={f.photo_url} alt={f.species_name}
                        className="absolute inset-0 w-full h-full object-cover"
                        onError={e => e.target.remove()} />
                    )}
                  </div>
                  <div className="p-3">
                    <p className="font-bold text-gray-900 text-sm">{f.species_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {comp.scoring_mode === 'standard'
                        ? `${f.points || 100} pts + weight bonus`
                        : `${f.points} points`}
                    </p>
                    {f.allow_multiples && <p className="text-xs text-blue-600 mt-0.5">Up to {f.max_count}× allowed</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TEAMS TAB */}
        {tab === 'teams' && (
          <div>
            {teams.length === 0 && <div className="text-center py-12 text-gray-400">No teams registered yet.</div>}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full min-w-[500px] text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {['Team','Category','Members','Registered'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-bold tracking-widest text-gray-400 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {teams.map((t, i) => {
                    const mems = members.filter(m => m.team_id === t.id)
                    return (
                      <tr key={t.id} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                        <td className="px-4 py-3 font-bold text-gray-900">{t.team_name}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[t.category] || CATEGORY_COLORS['Open']}`}>{t.category}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{mems.map(m => m.name).join(' & ')}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{new Date(t.registered_at).toLocaleDateString('en-NZ')}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* LEADERBOARD TAB */}
        {tab === 'leaderboard' && (
          <div>
            {!comp.public_leaderboard && comp.status !== 'closed' && (
              <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-xl">Leaderboard will be published when the competition closes.</div>
            )}
            {(comp.public_leaderboard || comp.status === 'closed') && (
              <>
                {(comp.categories || []).length > 1
                  ? (comp.categories || []).map(cat => {
                      const catBoard = leaderboard.filter(t => t.category === cat)
                      if (catBoard.length === 0) return null
                      return (
                        <div key={cat} className="mb-8">
                          <h3 className={`inline-flex text-sm font-black px-3 py-1 rounded-full mb-3 ${CATEGORY_COLORS[cat] || CATEGORY_COLORS['Open']}`}>{cat}</h3>
                          <LeaderboardTable board={catBoard} />
                        </div>
                      )
                    })
                  : <LeaderboardTable board={leaderboard} />
                }
              </>
            )}
          </div>
        )}
      </div>
      <SponsorBar comp={comp} />
    </div>
  )
}

function LeaderboardTable({ board }) {
  
const SNZ_BLUE = '#2B6CB0'

function MemberBadge() {
  const { member, session } = useMemberSession()
  const navigate = useNavigate()
  if (!session) return (
    <button onClick={() => navigate('/membership/login')}
      className="flex items-center gap-1.5 text-white/70 hover:text-white text-xs font-semibold transition px-2 py-1 rounded-lg hover:bg-white/10">
      Sign in
    </button>
  )
  return (
    <button onClick={() => navigate('/membership/dashboard')}
      className="flex items-center gap-2 bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
      <div className="w-6 h-6 rounded-full bg-white/30 flex items-center justify-center text-white font-black text-xs flex-shrink-0">
        {member?.name?.[0]?.toUpperCase() || '?'}
      </div>
      <div className="text-left hidden sm:block">
        <div className="text-white font-bold text-xs leading-tight">{member?.name || 'Member'}</div>
        <div className="text-blue-200 text-xs leading-tight">{member?.member_number || 'SNZ Member'}</div>
      </div>
    </button>
  )
}

  const medals = ['🥇','🥈','🥉']
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
      <table className="w-full min-w-[500px] text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <th className="px-4 py-3 text-left text-xs font-bold tracking-widest text-gray-400 uppercase w-12">Rank</th>
            <th className="px-4 py-3 text-left text-xs font-bold tracking-widest text-gray-400 uppercase">Team</th>
            <th className="px-4 py-3 text-left text-xs font-bold tracking-widest text-gray-400 uppercase">Fish</th>
            <th className="px-4 py-3 text-left text-xs font-bold tracking-widest text-gray-400 uppercase">Points</th>
          </tr>
        </thead>
        <tbody>
          {board.map((t, i) => (
            <tr key={t.id} className={`border-b border-gray-100 ${i === 0 ? 'bg-amber-50' : i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
              <td className="px-4 py-3 text-lg">{medals[i] || i + 1}</td>
              <td className="px-4 py-3 font-bold text-gray-900">{t.team_name}</td>
              <td className="px-4 py-3 text-gray-500">{t.fishCount}</td>
              <td className="px-4 py-3 text-2xl font-black" style={{ color: SNZ_BLUE }}>{t.total}</td>
            </tr>
          ))}
          {board.length === 0 && (
            <tr><td colSpan={4} className="px-4 py-12 text-center text-gray-400">No scores yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
