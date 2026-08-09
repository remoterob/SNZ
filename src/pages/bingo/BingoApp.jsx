import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useMemberSession, MemberAuthGate } from '../../components/MemberAuthGate'
import { pointsMapFromSpecies, buildInfoMap, scoreForClaims } from '../../lib/bingo/helpers'

import BingoPlayPage from './BingoPlayPage'
import BingoBonusesPage from './BingoBonusesPage'
import BingoLeaderboardPage from './BingoLeaderboardPage'
import BingoLatestCatchesPage from './BingoLatestCatchesPage'
import BingoRulesPage from './BingoRulesPage'

const SNZ_BLUE = '#2B6CB0'
const SNZ_DARK = '#1e3a5f'

// ── Shared closed-season UI ───────────────────────────────────────────────────

function SeasonClosedHero() {
  return (
    <div style={{ background: `linear-gradient(135deg, ${SNZ_DARK} 0%, ${SNZ_BLUE} 100%)` }}
      className="px-6 py-12 text-center">
      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/15 text-white text-xs font-bold mb-4 tracking-wide uppercase">
        🏁 Season Closed
      </div>
      <h1 className="text-3xl sm:text-4xl font-black text-white mb-3 leading-tight">
        Fish Bingo 2025–26
      </h1>
      <p className="text-blue-100 text-base leading-relaxed max-w-md mx-auto mb-2">
        That's a wrap on this season — thanks to everyone who got out there and speared something worth bragging about.
      </p>
      <p className="text-white font-black text-lg mt-4">
        🤿 Coming back bigger than ever later this season
      </p>
    </div>
  )
}

function SeasonClosedBanner() {
  return (
    <div style={{ background: `linear-gradient(135deg, ${SNZ_DARK} 0%, ${SNZ_BLUE} 100%)` }}
      className="rounded-2xl p-5 mb-4">
      <span className="inline-block bg-white/20 rounded-full px-2.5 py-0.5 text-xs font-bold text-white tracking-wide uppercase mb-2">
        🏁 Season Closed
      </span>
      <p className="text-white font-black text-lg mb-1">The 2025–26 season has wrapped up</p>
      <p className="text-blue-100 text-sm">
        Fish Bingo is coming back bigger than ever later this season — check the leaderboard to see how you finished.
      </p>
    </div>
  )
}

const TABS = [
  { id: 'play',        label: 'Play' },
  { id: 'bonuses',     label: 'Bonuses' },
  { id: 'leaderboard', label: 'Leaderboard' },
  { id: 'catches',     label: 'Catches' },
  { id: 'rules',       label: 'Rules' },
]

export default function BingoApp() {
  const navigate = useNavigate()
  const { session, member, loading: authLoading } = useMemberSession()

  const [tab, setTab] = useState(() => localStorage.getItem('bingo_tab') || 'play')
  const changeTab = (t) => { setTab(t); localStorage.setItem('bingo_tab', t) }

  // ── Data ──────────────────────────────────────────────────────────────────
  const [species,   setSpecies]   = useState(null)
  const [compCfg,   setCompCfg]   = useState(null)
  const [allClaims, setAllClaims] = useState([])
  const [myClaims,  setMyClaims]  = useState([])
  const [dataReady, setDataReady] = useState(false)

  const [firstChoice,    setFirstChoice]    = useState({})
  const [openInfoSlug,   setOpenInfoSlug]   = useState(null)

  const userId = session?.user?.id
  const token  = session?.access_token
  const me     = session ? {
    id:    userId,
    name:  member?.name || session.user.email?.split('@')[0] || 'Member',
    email: session.user.email,
  } : null
  const isActiveMember = !!session && member?.membership_status === 'active'
  const signedIn = isActiveMember

  // Species
  useEffect(() => {
    supabase.from('bingo_species')
      .select('*')
      .eq('is_active', true)
      .order('display_order', { ascending: true })
      .then(({ data }) => setSpecies(data || []))
  }, [])

  // Comp config (active season)
  useEffect(() => {
    supabase.from('bingo_comp_config')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setCompCfg(data || null))
  }, [])

  // All claims (for leaderboard + latest catches)
  const reloadAll = useCallback(async () => {
    if (!compCfg?.season) return
    const { data } = await supabase
      .from('bingo_claims')
      .select('id, user_id, species_slug, first_time, photo_url, thumb_url, created_at, comp_season')
      .eq('comp_season', compCfg.season)
      .order('created_at', { ascending: false })
    // Fetch member names for all unique user_ids
    const rows = data || []
    const uids = [...new Set(rows.map(c => c.user_id).filter(Boolean))]
    if (uids.length) {
      const { data: members } = await supabase
        .from('members')
        .select('id, name')
        .in('id', uids)
      const nameMap = Object.fromEntries((members || []).map(m => [m.id, m.name]))
      rows.forEach(c => { c.display_name = nameMap[c.user_id] || 'Diver' })
    }
    setAllClaims(rows)
  }, [compCfg?.season])

  // My claims
  const reloadMine = useCallback(async () => {
    if (!userId || !compCfg?.season) { setMyClaims([]); return }
    const { data } = await supabase
      .from('bingo_claims')
      .select('id, user_id, species_slug, first_time, photo_url, thumb_url, created_at, comp_season')
      .eq('user_id', userId)
      .eq('comp_season', compCfg.season)
      .order('created_at', { ascending: false })
    setMyClaims(data || [])
  }, [userId, compCfg?.season])

  useEffect(() => {
    if (compCfg?.season) {
      Promise.all([reloadAll(), reloadMine()]).then(() => setDataReady(true))
    }
  }, [reloadAll, reloadMine, compCfg?.season])

  // ── Derived ───────────────────────────────────────────────────────────────
  const pMap    = useMemo(() => pointsMapFromSpecies(species || []), [species])
  const infoMap = useMemo(() => buildInfoMap(species || []),         [species])
  const myScore = useMemo(() => scoreForClaims(myClaims, pMap),     [myClaims, pMap])

  // Season status — 'open' | 'before' | 'after' | 'none' (no config)
  const seasonStatus = useMemo(() => {
    if (!compCfg) return 'none'
    const now   = new Date()
    const start = new Date(compCfg.comp_start)
    const end   = new Date(compCfg.comp_end)
    if (now < start) return 'before'
    if (now > end)   return 'after'
    return 'open'
  }, [compCfg])

  const seasonClosed = seasonStatus === 'after' || seasonStatus === 'none'

  // ── Auth states ───────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-400 text-sm">Loading…</p>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div style={{ background: SNZ_BLUE }} className="px-4 sm:px-6 py-3 flex items-center justify-between gap-2 border-b border-blue-700">
          <button onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition whitespace-nowrap">
            ← SNZ Hub
          </button>
          <button onClick={() => navigate('/bingo/admin')}
            className="text-xs font-bold text-white bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition whitespace-nowrap">
            ⚙ Admin
          </button>
        </div>
        <SeasonClosedHero />
        <div className="max-w-sm mx-auto px-6 py-8">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Sign in to view your results</p>
          <MemberAuthGate message="Sign in with your SNZ membership." />
        </div>
      </div>
    )
  }

  if (!isActiveMember) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div style={{ background: SNZ_BLUE }} className="px-4 sm:px-6 py-3 flex items-center justify-between gap-2 border-b border-blue-700">
          <button onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition whitespace-nowrap">
            ← SNZ Hub
          </button>
          <button onClick={() => navigate('/bingo/admin')}
            className="text-xs font-bold text-white bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition whitespace-nowrap">
            ⚙ Admin
          </button>
        </div>
        <div className="max-w-sm mx-auto px-6 py-12 text-center">
          <h1 className="text-2xl font-black text-gray-900 mb-2">Active Membership Required</h1>
          <p className="text-gray-500 text-sm mb-6">Fish Bingo is only available to active SNZ members. Complete your membership to play.</p>
          <button onClick={() => navigate('/membership')}
            className="px-5 py-2.5 rounded-xl font-bold text-sm text-white transition hover:opacity-90"
            style={{ background: SNZ_BLUE }}>
            Complete Membership
          </button>
        </div>
      </div>
    )
  }

  // ── Game shell ────────────────────────────────────────────────────────────
  const sharedProps = {
    species, compCfg, allClaims, myClaims, pMap, infoMap,
    signedIn, me, token, myScore, seasonClosed,
    reloadAll, reloadMine,
    firstChoice, setFirstChoice,
    openInfoSlug, setOpenInfoSlug,
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div style={{ background: SNZ_DARK }} className="px-4 sm:px-6 py-3 flex items-center justify-between gap-2 border-b border-blue-900">
        <button onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition whitespace-nowrap flex-shrink-0">
          ← SNZ Hub
        </button>
        <span className="text-white/70 text-xs font-semibold truncate min-w-0 hidden sm:block">🐟 Fish Bingo</span>
        <div className="flex items-center gap-2 flex-shrink-0">
          {signedIn && (
            <span className="bg-white/15 text-white text-xs font-bold px-3 py-1.5 rounded-full whitespace-nowrap">
              {myScore} pts
            </span>
          )}
          <button onClick={() => navigate('/bingo/admin')}
            className="text-xs font-bold text-white bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition whitespace-nowrap">
            ⚙ Admin
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 overflow-x-auto">
        <div className="flex gap-1 max-w-3xl mx-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => changeTab(t.id)}
              className={`px-4 py-3 text-sm font-bold whitespace-nowrap border-b-2 transition ${tab === t.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Page content */}
      {!dataReady && species === null ? (
        <div className="max-w-3xl mx-auto px-4 py-12 text-center text-gray-400 text-sm">Loading…</div>
      ) : (
        <div className="max-w-3xl mx-auto px-4 py-6">
          {seasonClosed && tab === 'play' && <SeasonClosedBanner />}
          {tab === 'play'        && <BingoPlayPage        {...sharedProps} />}
          {tab === 'bonuses'     && <BingoBonusesPage     {...sharedProps} />}
          {tab === 'leaderboard' && <BingoLeaderboardPage {...sharedProps} />}
          {tab === 'catches'     && <BingoLatestCatchesPage {...sharedProps} />}
          {tab === 'rules'       && <BingoRulesPage />}
        </div>
      )}
    </div>
  )
}
