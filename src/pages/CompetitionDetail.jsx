import { useState, useEffect, useRef, Fragment } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useMemberSession } from '../components/MemberAuthGate'
import CompCopilotFAB from './CompCopilotFAB'


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
  'Mens':      'bg-blue-50 text-blue-700 border border-blue-200',
  'Womens':    'bg-pink-50 text-pink-700 border border-pink-200',
  'Mixed':     'bg-purple-50 text-purple-700 border border-purple-200',
  'Junior':    'bg-green-50 text-green-700 border border-green-200',
  'Open':      'bg-gray-50 text-gray-700 border border-gray-200',
  'Beginner':  'bg-teal-50 text-teal-700 border border-teal-200',
  'Advanced':  'bg-orange-50 text-orange-700 border border-orange-200',
  'Hard Out':  'bg-red-50 text-red-700 border border-red-200',
}

function calcPoints(fish, weightKg, mode, teamCategory) {
  if (mode === 'fish_bingo' || mode === 'fish_bingo_individual') {
    if (fish.category_points && teamCategory && fish.category_points[teamCategory] != null)
      return fish.category_points[teamCategory]
    return fish.points || 100
  }
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
  const [searchParams, setSearchParams] = useSearchParams()
  const { member } = useMemberSession()
  const [comp, setComp] = useState(null)
  const [fish, setFish] = useState([])
  const [teams, setTeams] = useState([])
  const [members, setMembers] = useState([])
  const [weighins, setWeighins] = useState([])
  const [myTeam, setMyTeam] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState(searchParams.get('tab') || 'info')
  const [lightbox, setLightbox] = useState(null)

  const fetchWeighins = async () => {
    const { data } = await supabase.from('comp_weighins').select('*').eq('competition_id', id)
    setWeighins(data || [])
  }

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

  // Find logged-in user's team for this comp using diver member IDs on comp_teams
  useEffect(() => {
    if (!member?.id || !teams.length) { setMyTeam(null); return }
    const team = teams.find(t => t.diver1_member_id === member.id || t.diver2_member_id === member.id)
    setMyTeam(team || null)
  }, [member, teams])

  // Build leaderboard
  const leaderboard = teams.map(team => {
    const teamWeighins = weighins.filter(w => w.team_id === team.id)
    const total = teamWeighins.reduce((s, w) => s + (w.points_awarded || 0), 0)
    const fishCount = teamWeighins.filter(w => !w.is_bulk).length
    return { ...team, total, fishCount }
  }).sort((a, b) => b.total - a.total)

  const isFishBingo = comp?.scoring_mode === 'fish_bingo' || comp?.scoring_mode === 'fish_bingo_individual'
  const isSelfSubmit = comp?.scoring_mode === 'standard_self_submit'

  const tabs = [
    { id: 'info', label: 'Info' },
    { id: 'fish', label: `Fish List (${fish.length})` },
    { id: 'teams', label: `Teams (${teams.length})` },
    { id: 'leaderboard', label: 'Leaderboard' },
    ...(isFishBingo ? [{ id: 'mycatches', label: myTeam ? '🎯 My Catches' : '🎯 Submit Catch' }] : []),
    ...(isSelfSubmit ? [{ id: 'mycatches', label: myTeam ? '⚖ My Catches' : '⚖ Submit Catch' }] : []),
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
              <h1 className="text-2xl sm:text-3xl font-black text-gray-900">{comp.name}</h1>
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
              {comp.scoring_mode === 'standard' ? '⚖ Standard scoring' : comp.scoring_mode === 'standard_self_submit' ? '⚖ Standard · Self-Submit' : comp.scoring_mode === 'fish_bingo' ? '🎯 Fish Bingo – Pairs' : comp.scoring_mode === 'fish_bingo_individual' ? '🎯 Fish Bingo – Individual' : '🎯 Fish Bingo'}
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
        <div className="max-w-4xl mx-auto flex gap-1 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map(t => (
            <button key={t.id} onClick={() => { setTab(t.id); setSearchParams(t.id === 'info' ? {} : { tab: t.id }) }}
              className={`py-3 px-4 text-sm font-bold border-b-2 transition whitespace-nowrap ${tab === t.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-400 hover:text-gray-600'}`}
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
              ) : comp.scoring_mode === 'standard_self_submit' ? (
                <div className="text-sm text-gray-600 space-y-1">
                  <p>• <strong>100 points</strong> per species caught</p>
                  <p>• <strong>+10 points per kg</strong> of fish weight</p>
                  <p>• Maximum weight bonus capped at <strong>8 kg per fish</strong> (80 points)</p>
                  <p>• Maximum possible score per fish: <strong>180 points</strong></p>
                  <p>• Teams <strong>self-submit</strong> their own catches — upload a photo on scales with the weight entered</p>
                </div>
              ) : comp.scoring_mode === 'fish_bingo' ? (
                <div className="text-sm text-gray-600 space-y-1">
                  <p>Points are fixed per species — see the fish list tab for individual values.</p>
                  {(comp.categories || []).length > 1 && (
                    <p className="mt-1">Different divisions may have different point values per species.</p>
                  )}
                  <p>Submit your catches with a photo via the <strong>My Catches</strong> tab.</p>
                </div>
              ) : comp.scoring_mode === 'fish_bingo_individual' ? (
                <div className="text-sm text-gray-600 space-y-1">
                  <p>Points are fixed per species — see the fish list tab for individual values.</p>
                  <p>Solo entry — one competitor per registration.</p>
                  <p>Submit your catches with a photo via the <strong>My Catches</strong> tab.</p>
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
                    {(comp.scoring_mode === 'standard' || comp.scoring_mode === 'standard_self_submit') ? (
                      <p className="text-xs text-gray-400 mt-0.5">{f.points || 100} pts + weight bonus</p>
                    ) : (comp.scoring_mode === 'fish_bingo' || comp.scoring_mode === 'fish_bingo_individual') && f.category_points && Object.keys(f.category_points).length > 0 ? (
                      <div className="mt-0.5 space-y-0.5">
                        {Object.entries(f.category_points).map(([cat, pts]) => (
                          <p key={cat} className="text-xs text-gray-500"><span className="font-semibold">{cat}:</span> {pts} pts</p>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 mt-0.5">{f.points || 100} points</p>
                    )}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {teams.map(t => {
                const mems = members.filter(m => m.team_id === t.id)
                return (
                  <div key={t.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4">
                    <div
                      onClick={t.team_photo_url ? () => setLightbox({ url: t.team_photo_url, name: t.team_name }) : undefined}
                      className={`w-14 h-14 rounded-xl flex-shrink-0 overflow-hidden bg-gray-100 border border-gray-200 flex items-center justify-center text-2xl ${t.team_photo_url ? 'cursor-zoom-in hover:border-blue-400 transition' : ''}`}
                    >
                      {t.team_photo_url
                        ? <img src={t.team_photo_url} alt={t.team_name} className="w-full h-full object-cover" />
                        : '👥'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-gray-900 text-sm truncate">{t.team_name}</p>
                      {mems.length > 0 && (
                        <p className="text-xs text-gray-500 truncate mt-0.5">{mems.map(m => m.name).join(' & ')}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${CATEGORY_COLORS[t.category] || CATEGORY_COLORS['Open']}`}>{t.category}</span>
                        <span className="text-xs text-gray-400">{new Date(t.registered_at).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* LEADERBOARD TAB */}
        {tab === 'leaderboard' && (
          <div>
            {!comp.public_leaderboard && comp.status !== 'closed' && (
              <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-xl">Leaderboard will be published when the competition closes.</div>
            )}
            {(comp.public_leaderboard || comp.status === 'closed') && weighins.length === 0 && (
              <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-xl">
                <div className="text-3xl mb-2">⏳</div>
                <p className="font-semibold text-gray-600">Leaderboard will appear once the first weigh-in is entered.</p>
              </div>
            )}
            {(comp.public_leaderboard || comp.status === 'closed') && weighins.length > 0 && (
              <>
                {(comp.categories || []).length > 1
                  ? (comp.categories || []).map(cat => {
                      const catBoard = leaderboard.filter(t => t.category === cat)
                      if (catBoard.length === 0) return null
                      return (
                        <div key={cat} className="mb-8">
                          <h3 className={`inline-flex text-sm font-black px-3 py-1 rounded-full mb-3 ${CATEGORY_COLORS[cat] || CATEGORY_COLORS['Open']}`}>{cat}</h3>
                          <LeaderboardTable board={catBoard} weighins={weighins} members={members} />
                        </div>
                      )
                    })
                  : <LeaderboardTable board={leaderboard} weighins={weighins} members={members} />
                }
              </>
            )}
          </div>
        )}
        {/* MY CATCHES TAB */}
        {tab === 'mycatches' && (
          <MyCatchesTab
            comp={comp}
            fish={fish}
            myTeam={myTeam}
            member={member}
            weighins={weighins}
            onRefresh={fetchWeighins}
            navigate={navigate}
          />
        )}
      </div>
      <SponsorBar comp={comp} />
      <CompCopilotFAB competitionId={id} competitionName={comp.name} mode="competitor" />

      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4"
        >
          <button
            onClick={(e) => { e.stopPropagation(); setLightbox(null) }}
            aria-label="Close"
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/15 hover:bg-white/30 text-white text-xl font-bold flex items-center justify-center transition"
          >
            ✕
          </button>
          <img
            src={lightbox.url}
            alt={lightbox.name}
            onClick={(e) => e.stopPropagation()}
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
          />
        </div>
      )}
    </div>
  )
}

function MyCatchesTab({ comp, fish, myTeam, member, weighins, onRefresh, navigate }) {
  const isSelfSubmit = comp.scoring_mode === 'standard_self_submit'
  // fish_bingo: key → File
  const [pending, setPending] = useState({})
  // standard_self_submit: separate file + weight per key
  const [selfFiles, setSelfFiles] = useState({})
  const [selfWeights, setSelfWeights] = useState({})
  const [uploading, setUploading] = useState(null)
  const [toast, setToast] = useState(null)
  const fileRefs = useRef({})

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  const myWeighins = weighins.filter(w => w.team_id === myTeam?.id)

  // Fixed points for fish_bingo
  const getBingoPoints = (f) => {
    if (f.category_points && myTeam?.category && f.category_points[myTeam.category] != null)
      return f.category_points[myTeam.category]
    return f.points || 100
  }

  // Weight-based points for self-submit (points capped at max_weight_kg, but entry can be higher)
  const calcSelfSubmitPoints = (f, weightKg) => {
    const base = f.points || 100
    const cap = f.max_weight_kg || 8
    const bonus = Math.min(cap * 10, Math.floor((parseFloat(weightKg) || 0) * 10))
    return base + bonus
  }

  const hasClaimed = (fishId, inst) => myWeighins.some(w => w.fish_id === fishId && w.instance === inst)
  const getWeighin = (fishId, inst) => myWeighins.find(w => w.fish_id === fishId && w.instance === inst)

  const totalPoints = myWeighins.reduce((s, w) => s + (w.points_awarded || 0), 0)
  const totalWeightKg = myWeighins.reduce((s, w) => s + (w.weight_kg || 0), 0)

  const submitCatch = async (f, inst) => {
    const key = `${f.id}-${inst}`
    setUploading(key)
    try {
      if (isSelfSubmit) {
        const file = selfFiles[key]
        const weightStr = selfWeights[key]
        if (!file) { showToast('Please upload a photo showing the weight on scales', 'error'); setUploading(null); return }
        const weightKg = parseFloat(weightStr)
        if (isNaN(weightKg) || weightKg <= 0) { showToast('Please enter the weight in kg', 'error'); setUploading(null); return }
        const pts = calcSelfSubmitPoints(f, weightKg)
        const ext = file.name.split('.').pop().toLowerCase().replace('heic', 'jpg').replace('heif', 'jpg')
        const contentType = (file.type && file.type.startsWith('image/') && file.type !== 'image/heic' && file.type !== 'image/heif') ? file.type : 'image/jpeg'
        const path = `competitions/${comp.id}/self-catches/${myTeam.id}/${f.id}-${inst}-${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage.from('snz-media').upload(path, file, { contentType })
        if (upErr) throw upErr
        const { data: { publicUrl } } = supabase.storage.from('snz-media').getPublicUrl(path)
        const { error: dbErr } = await supabase.from('comp_weighins').insert({
          competition_id: comp.id, team_id: myTeam.id,
          fish_id: f.id, fish_name: f.species_name,
          weight_kg: weightKg, points_awarded: pts,
          instance: inst, is_bulk: false, catch_photo_url: publicUrl,
        })
        if (dbErr) throw dbErr
        setSelfFiles(p => { const n = { ...p }; delete n[key]; return n })
        setSelfWeights(p => { const n = { ...p }; delete n[key]; return n })
        showToast(`${f.species_name} submitted — +${pts} pts`)
      } else {
        const file = pending[key]
        if (!file) { showToast('Please select a photo of your catch first', 'error'); setUploading(null); return }
        const pts = getBingoPoints(f)
        const ext = file.name.split('.').pop().toLowerCase().replace('heic', 'jpg').replace('heif', 'jpg')
        const contentType = (file.type && file.type.startsWith('image/') && file.type !== 'image/heic' && file.type !== 'image/heif') ? file.type : 'image/jpeg'
        const path = `competitions/${comp.id}/self-catches/${myTeam.id}/${f.id}-${inst}-${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage.from('snz-media').upload(path, file, { contentType })
        if (upErr) throw upErr
        const { data: { publicUrl } } = supabase.storage.from('snz-media').getPublicUrl(path)
        const { error: dbErr } = await supabase.from('comp_weighins').insert({
          competition_id: comp.id, team_id: myTeam.id,
          fish_id: f.id, fish_name: f.species_name,
          weight_kg: null, points_awarded: pts,
          instance: inst, is_bulk: false, catch_photo_url: publicUrl,
        })
        if (dbErr) throw dbErr
        setPending(p => { const n = { ...p }; delete n[key]; return n })
        showToast(`${f.species_name} submitted — +${pts} pts`)
      }
      onRefresh()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setUploading(null)
    }
  }

  const deleteCatch = async (weighin, fishName) => {
    if (!window.confirm(`Remove your ${fishName} catch? This cannot be undone.`)) return
    await supabase.from('comp_weighins').delete().eq('id', weighin.id)
    showToast(`${fishName} removed`)
    onRefresh()
  }

  if (!member) {
    return (
      <div className="text-center py-16 bg-gray-50 rounded-2xl border border-gray-200">
        <div className="text-4xl mb-3">🤿</div>
        <p className="font-black text-gray-900 mb-1">Sign in to submit your catch</p>
        <p className="text-sm text-gray-500 mb-5">You need to be signed in as an SNZ member to submit catches for this competition.</p>
        <button onClick={() => navigate('/membership/login')}
          className="px-6 py-2.5 rounded-xl font-bold text-white text-sm"
          style={{ background: SNZ_BLUE }}>Sign In</button>
      </div>
    )
  }

  if (!myTeam) {
    return (
      <div className="text-center py-16 bg-gray-50 rounded-2xl border border-gray-200">
        <div className="text-4xl mb-3">🤿</div>
        <p className="font-black text-gray-900 mb-1">You're not registered in this competition</p>
        <p className="text-sm text-gray-500 mb-5">Only registered competitors can submit catches.</p>
        {comp.status === 'active' && (
          <button onClick={() => navigate(`/competitions/${comp.id}/register`)}
            className="px-6 py-2.5 rounded-xl font-bold text-white text-sm"
            style={{ background: '#16a34a' }}>Register Now →</button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-semibold shadow-lg max-w-xs ${toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'} text-white`}>
          {toast.msg}
        </div>
      )}

      {/* Score summary */}
      <div className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center gap-4">
        <div className="w-14 h-14 rounded-xl flex-shrink-0 overflow-hidden bg-gray-100 border border-gray-200 flex items-center justify-center text-2xl">
          {myTeam.team_photo_url
            ? <img src={myTeam.team_photo_url} alt={myTeam.team_name} className="w-full h-full object-cover" />
            : '👥'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-black text-gray-900">{myTeam.team_name}</p>
          <p className="text-xs text-gray-400">{myTeam.category} · {myWeighins.length} fish submitted</p>
          {isSelfSubmit && myWeighins.length > 0 && (
            <p className="text-xs text-gray-400">{totalWeightKg.toFixed(2)} kg total weight</p>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-3xl font-black" style={{ color: SNZ_BLUE }}>{totalPoints}</div>
          <div className="text-xs text-gray-400">points</div>
        </div>
      </div>

      {isSelfSubmit && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800">
          Enter the weight and upload a photo of each fish on the scales. Weight over 8 kg is recorded but points are capped at 8 kg (80 bonus points).
        </div>
      )}

      {comp.status !== 'active' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800 font-semibold">
          {comp.status === 'closed' ? 'This competition has closed — catches are locked.' : 'This competition is not yet open for submissions.'}
        </div>
      )}

      <div className="space-y-3">
        {fish.map(f => {
          const instances = f.allow_multiples ? f.max_count : 1
          return Array.from({ length: instances }, (_, i) => i + 1).map(inst => {
            const key = `${f.id}-${inst}`
            const claimed = hasClaimed(f.id, inst)
            const weighin = getWeighin(f.id, inst)
            const isUploading = uploading === key

            // Display points in header depends on mode
            const headerPts = isSelfSubmit
              ? (selfWeights[key] && parseFloat(selfWeights[key]) > 0
                  ? `${calcSelfSubmitPoints(f, selfWeights[key])} pts`
                  : `${f.points || 100} pts + weight bonus`)
              : `${getBingoPoints(f)} pts`

            return (
              <div key={key} className={`bg-white border-2 rounded-2xl overflow-hidden shadow-sm transition ${claimed ? 'border-green-400' : 'border-gray-200'}`}>
                <div className="flex items-center gap-3 p-3">
                  <div className="relative w-14 h-12 flex-shrink-0 rounded-xl overflow-hidden bg-gray-50 border border-gray-100">
                    {f.photo_url
                      ? <img src={f.photo_url} alt={f.species_name} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center text-xl">🐟</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 text-sm">{f.species_name}{f.allow_multiples ? ` #${inst}` : ''}</p>
                    <p className="text-xs font-bold" style={{ color: SNZ_BLUE }}>{headerPts}</p>
                  </div>
                  {claimed && (
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-green-100 text-green-700 flex-shrink-0">✓ Submitted</span>
                  )}
                </div>

                {/* Claimed — self-submit: show weight + photo + delete */}
                {claimed && weighin && isSelfSubmit && (
                  <div className="border-t border-green-100 bg-green-50 px-3 py-3 flex items-center gap-3">
                    {weighin.catch_photo_url && (
                      <a href={weighin.catch_photo_url} target="_blank" rel="noreferrer">
                        <img src={weighin.catch_photo_url} alt="catch"
                          className="w-16 h-12 object-cover rounded-lg border border-green-200 hover:brightness-90 transition" />
                      </a>
                    )}
                    <div className="flex-1 text-xs text-green-700 space-y-0.5">
                      {weighin.weight_kg != null && (
                        <div className="font-bold">{weighin.weight_kg} kg · {weighin.points_awarded} pts</div>
                      )}
                      <div>Submitted {new Date(weighin.created_at || weighin.weighed_at).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
                    </div>
                    {comp.status === 'active' && (
                      <button onClick={() => deleteCatch(weighin, f.species_name)}
                        className="text-xs text-red-400 hover:text-red-600 font-bold flex-shrink-0">Remove</button>
                    )}
                  </div>
                )}

                {/* Claimed — fish_bingo: show photo + delete */}
                {claimed && weighin && !isSelfSubmit && (
                  <div className="border-t border-green-100 bg-green-50 px-3 py-3 flex items-center gap-3">
                    {weighin.catch_photo_url && (
                      <a href={weighin.catch_photo_url} target="_blank" rel="noreferrer">
                        <img src={weighin.catch_photo_url} alt="catch"
                          className="w-16 h-12 object-cover rounded-lg border border-green-200 hover:brightness-90 transition" />
                      </a>
                    )}
                    <div className="flex-1 text-xs text-green-700">
                      Submitted {new Date(weighin.created_at || weighin.weighed_at).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </div>
                    {comp.status === 'active' && (
                      <button onClick={() => deleteCatch(weighin, f.species_name)}
                        className="text-xs text-red-400 hover:text-red-600 font-bold flex-shrink-0">Remove</button>
                    )}
                  </div>
                )}

                {/* Not claimed, comp active — self-submit: weight + photo */}
                {!claimed && comp.status === 'active' && isSelfSubmit && (
                  <div className="border-t border-gray-100 bg-gray-50 px-3 py-3 space-y-2">
                    <p className="text-xs text-gray-500">Enter weight and upload a photo showing weight on scales</p>
                    <div className="flex items-center gap-2">
                      <input
                        type="number" step="0.01" min="0"
                        value={selfWeights[key] ?? ''}
                        onChange={e => setSelfWeights(w => ({ ...w, [key]: e.target.value }))}
                        placeholder="0.00"
                        className="w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-300"
                      />
                      <span className="text-xs text-gray-500">kg</span>
                      {parseFloat(selfWeights[key]) > 0 && (
                        <span className="text-xs font-black" style={{ color: SNZ_BLUE }}>
                          = {calcSelfSubmitPoints(f, selfWeights[key])} pts
                        </span>
                      )}
                      {parseFloat(selfWeights[key]) > (f.max_weight_kg || 8) && (
                        <span className="text-xs text-amber-600 font-semibold">
                          (capped at {f.max_weight_kg || 8} kg for points)
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <label className={`cursor-pointer flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg border-2 transition ${selfFiles[key] ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-600 hover:border-gray-400'}`}>
                        📷 {selfFiles[key] ? selfFiles[key].name.slice(0, 18) + (selfFiles[key].name.length > 18 ? '…' : '') : 'Photo on scales'}
                        <input
                          type="file" accept="image/*" className="hidden"
                          onChange={e => { const file = e.target.files[0]; if (file) setSelfFiles(p => ({ ...p, [key]: file })) }}
                        />
                      </label>
                      <button
                        onClick={() => submitCatch(f, inst)}
                        disabled={isUploading || !selfFiles[key] || !(parseFloat(selfWeights[key]) > 0)}
                        className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg text-white disabled:opacity-40 transition"
                        style={{ background: SNZ_BLUE }}>
                        {isUploading ? 'Submitting…' : 'Submit'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Not claimed, comp active — fish_bingo: photo only */}
                {!claimed && comp.status === 'active' && !isSelfSubmit && (
                  <div className="border-t border-gray-100 bg-gray-50 px-3 py-3">
                    <p className="text-xs text-gray-500 mb-2">Upload a photo of your catch to submit</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <label className={`cursor-pointer flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg border-2 transition ${pending[key] ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-gray-300 text-gray-600 hover:border-gray-400'}`}>
                        📷 {pending[key] ? pending[key].name.slice(0, 20) + (pending[key].name.length > 20 ? '…' : '') : 'Choose photo'}
                        <input
                          type="file" accept="image/*" className="hidden"
                          ref={el => { fileRefs.current[key] = el }}
                          onChange={e => { const file = e.target.files[0]; if (file) setPending(p => ({ ...p, [key]: file })) }}
                        />
                      </label>
                      <button
                        onClick={() => submitCatch(f, inst)}
                        disabled={isUploading || !pending[key]}
                        className="flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded-lg text-white disabled:opacity-40 transition"
                        style={{ background: SNZ_BLUE }}>
                        {isUploading ? 'Submitting…' : `Submit +${getBingoPoints(f)}pts`}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        })}
      </div>

      {fish.length === 0 && (
        <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-2xl border border-gray-200">
          Fish list hasn't been published yet — check back soon.
        </div>
      )}
    </div>
  )
}

function LeaderboardTable({ board, weighins = [], members = [] }) {
  const [expandedId, setExpandedId] = useState(null)
  const medals = ['🥇','🥈','🥉']
  const scoredBoard = board.filter(x => x.total > 0)

  const toggle = (id, hasScore) => { if (hasScore) setExpandedId(v => v === id ? null : id) }

  const renderBreakdown = (team) => {
    const entries = weighins.filter(w => w.team_id === team.id)
    const fishEntries = entries.filter(w => !w.is_bulk)
    const bulkEntry = entries.find(w => w.is_bulk)
    return (
      <tr>
        <td colSpan={4} className="px-5 py-3 bg-blue-50 border-b border-blue-100">
          <div className="space-y-1.5 max-w-xs">
            {fishEntries.map(w => (
              <div key={w.id} className="flex items-center justify-between text-xs">
                <span className="font-semibold text-gray-700">🐟 {w.fish_name}{w.instance > 1 ? ` #${w.instance}` : ''}</span>
                <div className="flex items-center gap-3">
                  {w.weight_kg != null && <span className="text-gray-400">{w.weight_kg} kg</span>}
                  <span className="font-black w-14 text-right" style={{ color: SNZ_BLUE }}>{w.points_awarded} pts</span>
                </div>
              </div>
            ))}
            {bulkEntry && (
              <div className="flex items-center justify-between text-xs border-t border-blue-200 pt-1.5">
                <span className="font-semibold text-gray-500">⚖ Bulk — {bulkEntry.weight_kg} kg</span>
                <span className="font-black w-14 text-right" style={{ color: SNZ_BLUE }}>+{bulkEntry.points_awarded} pts</span>
              </div>
            )}
            <div className="flex items-center justify-between text-xs border-t border-blue-300 pt-1.5">
              <span className="font-black text-gray-700">Total</span>
              <span className="text-base font-black" style={{ color: SNZ_BLUE }}>{team.total} pts</span>
            </div>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm overflow-x-auto">
      <table className="w-full min-w-[380px] text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <th className="px-4 py-3 text-left text-xs font-bold tracking-widest text-gray-400 uppercase w-12">Rank</th>
            <th className="px-4 py-3 text-left text-xs font-bold tracking-widest text-gray-400 uppercase">Team</th>
            <th className="px-4 py-3 text-left text-xs font-bold tracking-widest text-gray-400 uppercase">Fish</th>
            <th className="px-4 py-3 text-left text-xs font-bold tracking-widest text-gray-400 uppercase">Points</th>
          </tr>
        </thead>
        <tbody>
          {board.map((t, i) => {
            const hasScore = t.total > 0
            const rank = hasScore ? scoredBoard.indexOf(t) : -1
            const isExpanded = expandedId === t.id
            return (
              <Fragment key={t.id}>
                <tr
                  onClick={() => toggle(t.id, hasScore)}
                  className={`border-b border-gray-100 transition select-none
                    ${hasScore ? 'cursor-pointer' : ''}
                    ${isExpanded ? 'bg-blue-50' : hasScore && rank === 0 ? 'bg-amber-50 hover:bg-amber-100/60' : i % 2 === 0 ? 'bg-white hover:bg-blue-50/40' : 'bg-gray-50/30 hover:bg-blue-50/40'}`}>
                  <td className="px-4 py-3 text-lg">{hasScore ? (medals[rank] || rank + 1) : '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {t.team_photo_url
                        ? <img src={t.team_photo_url} alt={t.team_name} className="w-9 h-9 rounded-lg object-cover border border-gray-200 flex-shrink-0" />
                        : <div className="w-9 h-9 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center text-base flex-shrink-0">👥</div>
                      }
                      <div className="min-w-0">
                        <div className="font-bold text-gray-900 flex items-center gap-1">
                          {t.team_name}
                          {hasScore && <span className="text-gray-400 text-xs">{isExpanded ? '▲' : '▼'}</span>}
                        </div>
                        {(() => { const divers = members.filter(m => m.team_id === t.id); return divers.length > 0 ? <div className="text-xs text-gray-400 truncate">{divers.map(m => m.name).join(' & ')}</div> : null })()}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{hasScore ? t.fishCount : '—'}</td>
                  <td className="px-4 py-3 text-2xl font-black" style={{ color: hasScore ? SNZ_BLUE : '#d1d5db' }}>{hasScore ? t.total : '—'}</td>
                </tr>
                {isExpanded && renderBreakdown(t)}
              </Fragment>
            )
          })}
          {board.length === 0 && (
            <tr><td colSpan={4} className="px-4 py-12 text-center text-gray-400">No scores yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
