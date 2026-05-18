import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useMemberSession } from '../components/MemberAuthGate'
import { notify } from '../utils/toasts'

const SNZ_BLUE = '#2B6CB0'
const BUCKET   = 'snz-media'

// Inject deep-link highlight animation once
if (typeof document !== 'undefined' && !document.getElementById('bf-highlight-style')) {
  const s = document.createElement('style')
  s.id = 'bf-highlight-style'
  s.textContent = `
    @keyframes bfFlash {
      0%   { box-shadow: 0 0 0 0 rgba(43,108,176,0);   background-color: rgba(43,108,176,0); }
      20%  { box-shadow: 0 0 0 6px rgba(43,108,176,0.35); background-color: rgba(43,108,176,0.08); }
      100% { box-shadow: 0 0 0 0 rgba(43,108,176,0);   background-color: rgba(43,108,176,0); }
    }
    .bf-highlight { animation: bfFlash 2.5s ease-out; position: relative; z-index: 1; }
  `
  document.head.appendChild(s)
}
const RANK_STYLE = {
  1: { label: '🥇' },
  2: { label: '🥈' },
  3: { label: '🥉' },
}

async function uploadPhoto(file, path) {
  const ext = file.name.split('.').pop().toLowerCase()
  const fullPath = `${path}.${ext}`
  const { error } = await supabase.storage.from(BUCKET)
    .upload(fullPath, file, { contentType: file.type, upsert: true })
  if (error) throw error
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(fullPath)
  return data.publicUrl
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function BigFishPage() {
  const navigate = useNavigate()
  const { session, member } = useMemberSession()
  const isActiveMember = !!session && member?.membership_status === 'active'

  const [comps,          setComps]          = useState([])
  const [activeComp,     setActiveComp]     = useState(null)
  const [entries,        setEntries]        = useState([])
  const [registrations,  setRegistrations]  = useState([])
  const [registering,    setRegistering]    = useState(false)
  const [activeTab,      setActiveTab]      = useState(0)
  const [lightbox,       setLightbox]       = useState(null)
  const [showEntry,      setShowEntry]      = useState(false)
  const [loading,        setLoading]        = useState(true)

  useEffect(() => {
    supabase.from('bigfish_comps').select('*')
      .eq('is_active', true)
      .order('start_date', { ascending: false })
      .then(({ data }) => {
        const list = data || []
        setComps(list)
        if (list.length) setActiveComp(list[0])
      })
  }, [])

  const loadEntries = async (comp) => {
    if (!comp) return
    setLoading(true)
    const [{ data: entriesData }, { data: regsData }] = await Promise.all([
      supabase.from('bigfish_entries').select('*').eq('comp_id', comp.id).order('weight_kg', { ascending: false }),
      supabase.from('bigfish_registrations').select('user_id, display_name').eq('comp_id', comp.id),
    ])
    setEntries(entriesData || [])
    setRegistrations(regsData || [])
    setLoading(false)
  }

  useEffect(() => { loadEntries(activeComp) }, [activeComp])

  const handleRegister = async () => {
    if (!session || !activeComp || registering) return
    setRegistering(true)
    await supabase.from('bigfish_registrations').upsert({
      comp_id: activeComp.id,
      user_id: session.user.id,
      display_name: member?.name || session.user.email,
    }, { onConflict: 'comp_id,user_id' })
    const { data } = await supabase.from('bigfish_registrations').select('user_id, display_name').eq('comp_id', activeComp.id)
    setRegistrations(data || [])
    setRegistering(false)
  }

  // Deep-link: /big-fish#catch-[entryId] → switch tab + highlight row
  useEffect(() => {
    const hash = window.location.hash
    if (!hash?.startsWith('#catch-') || !entries.length || !activeComp) return
    const entryId = hash.replace('#catch-', '')
    const entry = entries.find(e => e.id === entryId)
    if (!entry) return
    const tabIdx = (activeComp.species || []).indexOf(entry.species)
    if (tabIdx >= 0) setActiveTab(tabIdx)
    setTimeout(() => {
      const el = document.querySelector(`[data-deeplink="catch-${entry.id}"]`)
      if (!el) return
      const y = el.getBoundingClientRect().top + window.pageYOffset - window.innerHeight / 2
      window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' })
      el.classList.add('bf-highlight')
      setTimeout(() => el.classList.remove('bf-highlight'), 2600)
    }, 400)
  }, [entries, activeComp])

  const species = activeComp?.species || []
  const currentSpecies = species[activeTab] || ''

  const speciesEntries = useMemo(() =>
    entries.filter(e => e.species === currentSpecies),
    [entries, currentSpecies]
  )

  // My entries for this species (up to 3)
  const myEntries = useMemo(() =>
    session ? speciesEntries.filter(e => e.user_id === session.user.id) : [],
    [speciesEntries, session]
  )

  // Overall standings — points from placings across all species (1st=6, 2nd=4, 3rd=3, 4th=2, 5th=1)
  const overallStandings = useMemo(() => {
    if (!entries.length || !species.length) return []
    const POINTS = [6, 4, 3, 2, 1]
    const users = {}
    species.forEach(sp => {
      const byUser = {}
      entries.filter(e => e.species === sp).forEach(e => {
        if (!byUser[e.user_id]) byUser[e.user_id] = { user_id: e.user_id, display_name: e.display_name, total: 0 }
        byUser[e.user_id].total += parseFloat(e.weight_kg)
      })
      Object.values(byUser)
        .sort((a, b) => b.total - a.total)
        .forEach((u, i) => {
          if (!users[u.user_id]) users[u.user_id] = { user_id: u.user_id, display_name: u.display_name, points: 0, totalWeight: 0, placings: {} }
          users[u.user_id].points += POINTS[i] || 0
          users[u.user_id].totalWeight += u.total
          users[u.user_id].placings[sp] = i + 1
        })
    })
    return Object.values(users).sort((a, b) => b.points - a.points || b.totalWeight - a.totalWeight)
  }, [entries, species])

  // Group by angler, ordered by heaviest individual fish
  const groupedEntries = useMemo(() => {
    const byUser = {}
    speciesEntries.forEach(e => {
      if (!byUser[e.user_id]) byUser[e.user_id] = { user_id: e.user_id, display_name: e.display_name, fish: [] }
      byUser[e.user_id].fish.push(e)
    })
    return Object.values(byUser)
      .map(u => ({
        ...u,
        fish: [...u.fish].sort((a, b) => parseFloat(b.weight_kg) - parseFloat(a.weight_kg)),
        total: u.fish.reduce((s, e) => s + parseFloat(e.weight_kg), 0),
      }))
      .sort((a, b) => b.total - a.total)
  }, [speciesEntries])

  const fmtDate = (d) => new Date(d).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })
  const isOpen = activeComp
    ? new Date() >= new Date(activeComp.start_date) && new Date() <= new Date(activeComp.end_date)
    : false
  const isBefore = activeComp ? new Date() < new Date(activeComp.start_date) : false

  const hasAnyEntry   = session ? entries.some(e => e.user_id === session.user.id) : false
  const isRegistered  = session
    ? registrations.some(r => r.user_id === session.user.id) || hasAnyEntry
    : false
  const competitorCount = useMemo(() => {
    const ids = new Set([...registrations.map(r => r.user_id), ...entries.map(e => e.user_id)])
    return ids.size
  }, [registrations, entries])

  const myTotal = myEntries.reduce((s, e) => s + parseFloat(e.weight_kg), 0)
  const myBest  = myEntries.length ? Math.max(...myEntries.map(e => parseFloat(e.weight_kg))) : 0
  const myRank  = myEntries.length ? groupedEntries.findIndex(u => u.user_id === session?.user?.id) + 1 : 0

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div style={{ background: SNZ_BLUE }} className="px-6 py-3 flex items-center justify-between border-b border-blue-700">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
            ← SNZ Hub
          </button>
          <span className="text-blue-200 text-sm opacity-75">/ Big Fish</span>
        </div>
        <div className="flex items-center gap-2">
<button onClick={() => navigate('/admin/big-fish')}
            className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
            ⚙ Admin
          </button>
        </div>
      </div>

      {/* Hero */}
      <header className="border-b border-gray-200 px-6 py-6 bg-white">
        <div className="max-w-4xl mx-auto flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-black text-gray-900">Big Fish Competition</h1>
            <p className="text-gray-400 text-sm mt-1">
              {activeComp
                ? `${activeComp.name} · ${fmtDate(activeComp.start_date)} – ${fmtDate(activeComp.end_date)}`
                : 'No active competition'}
            </p>
            {competitorCount > 0 && (
              <p className="text-sm font-semibold mt-1" style={{ color: SNZ_BLUE }}>
                🎣 {competitorCount} competitor{competitorCount === 1 ? '' : 's'} registered
              </p>
            )}
          </div>
          {comps.length > 1 && (
            <select
              value={activeComp?.id || ''}
              onChange={e => { const c = comps.find(c => c.id === e.target.value); setActiveComp(c); setActiveTab(0) }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            >
              {comps.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
        </div>
        {activeComp?.champion_note && (
          <div className="max-w-4xl mx-auto mt-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
            <span className="text-2xl">🏆</span>
            <p className="text-amber-800 font-bold text-sm">{activeComp.champion_note}</p>
          </div>
        )}
        {activeComp?.description && (
          <div className="max-w-4xl mx-auto mt-3">
            <p className="text-gray-500 text-sm">{activeComp.description}</p>
          </div>
        )}
      </header>

      {/* Glory shot carousel */}
      {activeComp && entries.some(e => e.photo_glory_url) && (
        <GloryCarousel entries={entries} />
      )}

      {!activeComp ? (
        <div className="max-w-4xl mx-auto px-6 py-16 text-center text-gray-400">
          No active Big Fish competition right now — check back soon.
        </div>
      ) : (
        <div className="max-w-4xl mx-auto px-6 py-6">

          {/* Overall standings */}
          {overallStandings.length > 0 && (
            <OverallStandings standings={overallStandings} species={species} session={session} />
          )}

          {/* Species tabs */}
          <div className="flex gap-2 flex-wrap mb-6">
            {species.map((s, i) => (
              <button key={s} onClick={() => setActiveTab(i)}
                className="px-4 py-2 rounded-xl text-sm font-bold border-2 transition"
                style={activeTab === i
                  ? { background: SNZ_BLUE, color: '#fff', borderColor: SNZ_BLUE }
                  : { background: '#fff', color: '#374151', borderColor: '#e5e7eb' }}>
                {s}
              </button>
            ))}
          </div>

          {/* Compact scrollable leaderboard */}
          {speciesEntries.length > 0 && (
            <div className="mb-6 bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                <span className="text-xs font-bold tracking-widest text-gray-400 uppercase">{currentSpecies} · by weight</span>
                <span className="text-xs text-gray-400">{speciesEntries.length} {speciesEntries.length === 1 ? 'entry' : 'entries'}</span>
              </div>
              <div className="overflow-y-auto" style={{ maxHeight: 288 }}>
                {speciesEntries.map((e, i) => {
                  const rank = i + 1
                  const rs = RANK_STYLE[rank]
                  const isMe = session && e.user_id === session.user.id
                  return (
                    <div key={e.id}
                      className={`flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 last:border-0 ${isMe ? 'bg-blue-50' : ''}`}>
                      <div className="w-7 text-center flex-shrink-0">
                        {rs
                          ? <span className="text-base">{rs.label}</span>
                          : <span className="text-xs font-bold text-gray-400">{rank}</span>}
                      </div>
                      {e.photo_glory_url
                        ? <button onClick={() => setLightbox(e)} className="flex-shrink-0">
                            <img src={e.photo_glory_url} alt="" className="w-8 h-8 rounded-lg object-cover border border-gray-200 hover:border-blue-400 transition hover:brightness-75" />
                          </button>
                        : <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-sm flex-shrink-0">🐟</div>}
                      <div className="flex-1 min-w-0 truncate">
                        <span className="font-bold text-sm text-gray-900">{e.display_name}</span>
                        {isMe && <span className="ml-1 text-xs text-blue-500">(you)</span>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="font-black text-sm" style={{ color: SNZ_BLUE }}>{parseFloat(e.weight_kg).toFixed(2)} kg</div>
                        <div className="text-xs text-gray-400">{e.length_cm} cm</div>
                      </div>
                      <CatchShareButton entryId={e.id} small />
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Pre-comp registration CTA */}
          {isActiveMember && activeComp && isBefore && (
            <div className="mb-4 bg-blue-50 border border-blue-200 rounded-xl px-4 py-4 flex items-start gap-3">
              <span className="text-2xl flex-shrink-0">🎣</span>
              <div className="flex-1">
                {isRegistered ? (
                  <>
                    <p className="text-sm font-bold text-gray-900 mb-0.5">You're registered!</p>
                    <p className="text-xs text-gray-500">Check back from {fmtDate(activeComp.start_date)} to log your fish.</p>
                    <span className="inline-flex items-center gap-1 mt-2 text-sm font-bold text-green-700">✓ Registered</span>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-bold text-gray-900 mb-0.5">Register for the Big Fish Competition</p>
                    <p className="text-xs text-gray-500 mb-2">Lock in your spot now — submissions open {fmtDate(activeComp.start_date)}.</p>
                    <button onClick={handleRegister} disabled={registering}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-50"
                      style={{ background: SNZ_BLUE }}>
                      {registering ? 'Registering…' : 'Register Now →'}
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Submit / manage button */}
          {isActiveMember && isOpen && (
            <div className="mb-4 flex items-center gap-3 flex-wrap">
              <button
                onClick={() => setShowEntry(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm text-white transition hover:opacity-90"
                style={{ background: myEntries.length > 0 ? '#16a34a' : SNZ_BLUE }}>
                {myEntries.length === 3
                  ? `Manage entries (${currentSpecies})`
                  : myEntries.length > 0
                    ? `Add another ${currentSpecies} (${myEntries.length}/3)`
                    : hasAnyEntry
                      ? `Enter your ${currentSpecies}`
                      : `Log your first fish — start with ${currentSpecies}`}
              </button>
              {myEntries.length > 0 && (
                <span className="text-xs text-gray-400">
                  Best: <strong>{myBest.toFixed(2)} kg</strong>
                  {' · '}Total: <strong>{myTotal.toFixed(2)} kg</strong>
                  {myRank > 0 ? ` · best fish ranked #${myRank}` : ''}
                </span>
              )}
            </div>
          )}

          {!isActiveMember && (
            <div className="mb-4 bg-blue-50 border border-blue-200 rounded-xl px-4 py-4 flex items-start gap-3">
              <span className="text-2xl flex-shrink-0">🎣</span>
              <div>
                <p className="text-sm font-bold text-gray-900 mb-0.5">
                  {isOpen ? 'SNZ membership required to enter.' : 'Get ready — submissions open 30 May.'}
                </p>
                <p className="text-xs text-gray-500 mb-2">
                  {isOpen
                    ? 'Active SNZ members can submit catches and compete on the leaderboard.'
                    : 'Register as an SNZ member now so you\'re ready to submit your fish when the comp opens.'}
                </p>
                <button
                  onClick={() => navigate('/membership')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold text-white transition hover:opacity-90"
                  style={{ background: SNZ_BLUE }}>
                  Join SNZ →
                </button>
              </div>
            </div>
          )}

          {/* Standings — ranked by total weight, logged-in user's fish shown inline */}
          {loading ? (
            <div className="text-center py-12 text-gray-400">Loading…</div>
          ) : groupedEntries.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-2xl border border-gray-200">
              <p className="text-gray-500 font-semibold mb-1">No {currentSpecies} entries yet</p>
              {isActiveMember && isOpen && <p className="text-gray-400 text-sm">Be the first to enter!</p>}
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm mb-4">
              <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                <span className="text-xs font-bold tracking-widest text-gray-400 uppercase">Standings · total weight</span>
                <span className="text-xs text-gray-400">{groupedEntries.length} competitors</span>
              </div>
              {groupedEntries.map((u, i) => {
                const rank = i + 1
                const rs = RANK_STYLE[rank]
                const isMe = session && u.user_id === session.user.id
                return (
                  <div key={u.user_id} className={`border-b border-gray-100 last:border-0 ${isMe ? 'bg-blue-50' : ''}`}>
                    {/* Competitor row */}
                    <div className="flex items-center gap-3 px-4 py-3">
                      <div className="w-7 text-center flex-shrink-0">
                        {rs ? <span className="text-lg">{rs.label}</span>
                          : <span className="text-xs font-bold text-gray-400">{rank}</span>}
                      </div>
                      <div className="flex-1 font-bold text-gray-900 text-sm">
                        {u.display_name}
                        {isMe && <span className="ml-1.5 text-xs font-bold text-blue-500">(you)</span>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="font-black text-base" style={{ color: SNZ_BLUE }}>{u.total.toFixed(2)} kg</div>
                        <div className="text-xs text-gray-400">{u.fish.length} fish</div>
                      </div>
                      <CatchShareButton entryId={u.fish[0].id} small />
                    </div>
                    {/* Logged-in user's fish breakdown only */}
                    {isMe && u.fish.map((e, fi) => (
                      <div key={e.id}
                        data-deeplink={`catch-${e.id}`}
                        className="flex items-center gap-3 px-4 py-2 border-t border-blue-100 bg-blue-50/50">
                        <div className="w-7 text-center flex-shrink-0 text-xs font-black text-blue-300">#{fi + 1}</div>
                        {e.photo_glory_url ? (
                          <button onClick={() => setLightbox(e)} className="flex-shrink-0">
                            <img src={e.photo_glory_url} alt="competitor photo"
                              className="w-10 h-10 rounded-xl object-cover border-2 border-blue-200 hover:border-blue-400 transition" />
                          </button>
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-base flex-shrink-0">🐟</div>
                        )}
                        <div className="flex-1">
                          <span className="font-black text-sm" style={{ color: SNZ_BLUE }}>{parseFloat(e.weight_kg).toFixed(2)} kg</span>
                          <span className="text-xs text-gray-400 ml-2">{e.length_cm} cm</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          )}

          {/* Honor system notice */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs text-gray-400 leading-relaxed">
            <strong className="text-gray-500">Honor system</strong> — up to 3 fish per species, ordered by individual weight with your running total shown. Three photos per entry required (competitor photo, scales, length). You can replace an entry if you land a bigger fish. Spearfishing NZ reserves the right to remove unverified entries. All fish must be legally taken by freediving in NZ waters.
          </div>
        </div>
      )}

      {/* Entry modal */}
      {showEntry && activeComp && (
        <EntryModal
          comp={activeComp}
          species={currentSpecies}
          existingEntries={myEntries}
          allEntries={speciesEntries}
          session={session}
          member={member}
          onSuccess={() => { setShowEntry(false); loadEntries(activeComp) }}
          onClose={() => setShowEntry(false)}
        />
      )}

      {/* Photo lightbox */}
      {lightbox && <PhotoLightbox entry={lightbox} onClose={() => setLightbox(null)} />}
    </div>
  )
}

// ── Overall standings ─────────────────────────────────────────────────────────
const OVERALL_POINTS = [6, 4, 3, 2, 1]
const RANK_EMOJI_OS = { 1: '🥇', 2: '🥈', 3: '🥉' }

function spAbbr(name) {
  const words = name.trim().split(/\s+/)
  return words.length === 1
    ? name.slice(0, 2).toUpperCase()
    : (words[0][0] + words[1][0]).toUpperCase()
}

function OverallStandings({ standings, species, session }) {
  return (
    <div className="mb-6 bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
        <span className="text-xs font-bold tracking-widest text-gray-400 uppercase">Overall standings · points from placings</span>
        <span className="text-xs text-gray-400">{standings.length} {standings.length === 1 ? 'competitor' : 'competitors'}</span>
      </div>
      <div className="overflow-y-auto" style={{ maxHeight: 294 }}>
        {standings.map((u, i) => {
          const rank = i + 1
          const isMe = session && u.user_id === session.user.id
          return (
            <div key={u.user_id}
              className={`flex items-center gap-3 px-4 py-2.5 border-b border-gray-50 last:border-0 ${isMe ? 'bg-blue-50' : ''}`}>
              <div className="w-7 text-center flex-shrink-0">
                {RANK_EMOJI_OS[rank]
                  ? <span className="text-base">{RANK_EMOJI_OS[rank]}</span>
                  : <span className="text-xs font-bold text-gray-400">{rank}</span>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm text-gray-900 truncate">
                  {u.display_name}
                  {isMe && <span className="ml-1 text-xs text-blue-500">(you)</span>}
                </div>
                <div className="flex gap-1 mt-1 flex-wrap">
                  {species.map(sp => {
                    const p = u.placings[sp]
                    const style = p === 1 ? { background: '#fef3c7', color: '#92400e', borderColor: '#fcd34d' }
                      : p === 2 ? { background: '#f3f4f6', color: '#4b5563', borderColor: '#d1d5db' }
                      : p === 3 ? { background: '#fff7ed', color: '#c2410c', borderColor: '#fed7aa' }
                      : p ? { background: '#f9fafb', color: '#6b7280', borderColor: '#e5e7eb' }
                      : { background: '#f9fafb', color: '#d1d5db', borderColor: '#f3f4f6' }
                    return (
                      <span key={sp} className="text-xs font-bold px-1.5 py-0.5 rounded border"
                        style={style}>
                        {spAbbr(sp)}{p ? ` ${p}` : ' —'}
                      </span>
                    )
                  })}
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <div className="font-black text-sm" style={{ color: SNZ_BLUE }}>{u.points} pts</div>
                <div className="text-xs text-gray-400">{u.totalWeight.toFixed(1)} kg</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Catch share button ────────────────────────────────────────────────────────
function CatchShareButton({ entryId, small = false }) {
  const [copied, setCopied] = useState(false)
  const handle = async (e) => {
    e.stopPropagation()
    const url = `${window.location.origin}/big-fish#catch-${entryId}`
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      window.prompt('Copy this link:', url)
      return
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <button onClick={handle} title={copied ? 'Copied!' : 'Copy share link'}
      className={`inline-flex items-center gap-1 rounded-md border transition text-xs font-bold ${
        copied
          ? 'border-green-300 bg-green-50 text-green-700'
          : 'border-gray-200 bg-white text-gray-400 hover:border-blue-300 hover:text-blue-600'
      } ${small ? 'px-1.5 py-1' : 'px-2 py-1'}`}>
      {copied ? '✓' : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
        </svg>
      )}
      {!small && <span>{copied ? 'Copied' : 'Share'}</span>}
    </button>
  )
}

// ── Glory carousel ────────────────────────────────────────────────────────────
function GloryCarousel({ entries }) {
  const slides = useMemo(() =>
    entries
      .filter(e => e.photo_glory_url)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    [entries]
  )

  const [idx, setIdx]       = useState(0)
  const [fading, setFading] = useState(false)
  const timerRef            = useRef(null)

  const goTo = useCallback((next) => {
    setFading(true)
    setTimeout(() => { setIdx(next); setFading(false) }, 350)
  }, [])

  useEffect(() => {
    if (slides.length < 2) return
    timerRef.current = setInterval(() => {
      setIdx(i => {
        const next = (i + 1) % slides.length
        setFading(true)
        setTimeout(() => setFading(false), 350)
        return next
      })
    }, 4500)
    return () => clearInterval(timerRef.current)
  }, [slides.length])

  useEffect(() => {
    slides.forEach(s => { const img = new Image(); img.src = s.photo_glory_url })
  }, [slides])

  if (!slides.length) return null

  const s = slides[idx]
  const fmtDate = (d) => new Date(d).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })

  return (
    <div className="relative w-full overflow-hidden bg-black" style={{ height: 320 }}>
      <div style={{
        backgroundImage: `url(${s.photo_glory_url})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        filter: 'blur(18px) brightness(0.35)',
        transform: 'scale(1.1)',
        position: 'absolute', inset: 0,
        transition: 'opacity 0.35s',
        opacity: fading ? 0 : 1,
      }} />
      <img src={s.photo_glory_url} alt={s.display_name} loading="eager" style={{
        position: 'absolute', inset: 0,
        width: '100%', height: '100%',
        objectFit: 'contain',
        transition: 'opacity 0.35s',
        opacity: fading ? 0 : 1,
      }} />
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
        padding: '32px 16px 14px',
        transition: 'opacity 0.35s',
        opacity: fading ? 0 : 1,
      }}>
        <p className="text-white font-black text-base leading-tight drop-shadow">
          {s.display_name}
          <span className="font-normal text-white/70 ml-2 text-sm">
            {s.species} · {s.weight_kg} kg · {fmtDate(s.created_at)}
          </span>
        </p>
      </div>
      {slides.length > 1 && (
        <div className="absolute top-3 right-4 flex gap-1.5">
          {slides.map((_, i) => (
            <button key={i} onClick={() => goTo(i)} className="rounded-full transition-all"
              style={{ width: i === idx ? 20 : 7, height: 7, background: i === idx ? '#fff' : 'rgba(255,255,255,0.4)' }} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Entry modal ───────────────────────────────────────────────────────────────
function EntryModal({ comp, species, existingEntries, allEntries, session, member, onSuccess, onClose }) {
  const canAdd = existingEntries.length < 3
  const sortedEntries = [...existingEntries].sort((a, b) => parseFloat(b.weight_kg) - parseFloat(a.weight_kg))

  const [mode,          setMode]          = useState(existingEntries.length === 0 ? 'form' : 'list')
  const [replaceTarget, setReplaceTarget] = useState(null)
  const [weightKg,      setWeightKg]      = useState('')
  const [lengthCm,      setLengthCm]      = useState('')
  const [notes,         setNotes]         = useState('')
  const [gloryFile,     setGloryFile]     = useState(null)
  const [scalesFile,    setScalesFile]    = useState(null)
  const [lengthFile,    setLengthFile]    = useState(null)
  const [busy,          setBusy]          = useState(false)
  const [error,         setError]         = useState(null)

  const gloryRef  = useRef(null)
  const scalesRef = useRef(null)
  const lengthRef = useRef(null)

  const fmtDate = (d) => new Date(d).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })

  const deleteEntry = async (entry) => {
    const { error } = await supabase.from('bigfish_entries').delete().eq('id', entry.id)
    if (error) { notify('Failed to delete entry.', 'error'); return }
    notify('Entry removed.', 'success')
    onSuccess()
  }

  const openForm = (target = null) => {
    setReplaceTarget(target)
    setWeightKg('')
    setLengthCm('')
    setNotes('')
    setGloryFile(null)
    setScalesFile(null)
    setLengthFile(null)
    setError(null)
    setMode('form')
  }

  const submit = async (e) => {
    e?.preventDefault()
    if (!weightKg) return setError('Enter the weight.')
    if (!lengthCm) return setError('Enter the length.')
    if (!gloryFile || !scalesFile || !lengthFile)
      return setError('All three photos are required.')
    if (replaceTarget && parseFloat(weightKg) <= parseFloat(replaceTarget.weight_kg))
      return setError(`New fish must be heavier than ${replaceTarget.weight_kg} kg to replace this entry.`)

    setBusy(true)
    setError(null)
    try {
      const uid  = session.user.id
      const ts   = Date.now()
      const base = `bigfish/${comp.id}/${uid}/${species.replace(/\s+/g, '-').toLowerCase()}/${ts}`

      const gloryUrl  = await uploadPhoto(gloryFile,  `${base}/glory`)
      const scalesUrl = await uploadPhoto(scalesFile, `${base}/scales`)
      const lengthUrl = await uploadPhoto(lengthFile, `${base}/length`)

      const payload = {
        comp_id:          comp.id,
        user_id:          uid,
        display_name:     member?.name || 'Member',
        species,
        weight_kg:        parseFloat(weightKg),
        length_cm:        parseFloat(lengthCm),
        photo_glory_url:  gloryUrl,
        photo_scales_url: scalesUrl,
        photo_length_url: lengthUrl,
        notes:            notes.trim() || null,
      }

      if (replaceTarget) {
        await supabase.from('bigfish_entries').delete().eq('id', replaceTarget.id)
      }

      const { error: dbErr } = await supabase.from('bigfish_entries').insert(payload)
      if (dbErr) throw dbErr
      notify(replaceTarget ? 'Entry replaced! 🎣' : 'Entry submitted — good fish! 🎣', 'success')
      onSuccess()
    } catch (err) {
      setError(err.message || 'Submission failed.')
    } finally { setBusy(false) }
  }

  // ── List / management view ─────────────────────────────────────────────────
  if (mode === 'list') {
    const avg = existingEntries.reduce((s, e) => s + parseFloat(e.weight_kg), 0) / existingEntries.length
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
        style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
        <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl overflow-hidden shadow-2xl max-h-[92vh] overflow-y-auto"
          onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div>
              <h2 className="font-black text-gray-900">Your {species} entries</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                {existingEntries.length}/3 entries · avg {avg.toFixed(2)} kg
              </p>
            </div>
            <button onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 font-bold transition">✕</button>
          </div>

          <div className="px-5 py-4 space-y-3">
            {sortedEntries.map((e) => {
              const rank = (allEntries || []).findIndex(a => a.id === e.id) + 1
              const rs = RANK_STYLE[rank]
              return (
              <div key={e.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                <div className="w-8 text-center flex-shrink-0">
                  {rs
                    ? <span className="text-xl">{rs.label}</span>
                    : <span className="text-xs font-black text-gray-500">#{rank || '—'}</span>}
                </div>
                {e.photo_glory_url ? (
                  <img src={e.photo_glory_url} alt="competitor photo"
                    className="w-12 h-12 object-cover rounded-lg flex-shrink-0 border border-gray-200" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-xl flex-shrink-0">🐟</div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-black" style={{ color: SNZ_BLUE }}>{e.weight_kg} kg</div>
                  <div className="text-xs text-gray-400">{e.length_cm} cm · {fmtDate(e.created_at)}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openForm(e)}
                    className="text-xs text-amber-600 font-bold px-2 py-1 rounded-lg hover:bg-amber-50 border border-amber-200 transition">
                    Replace
                  </button>
                  <button onClick={() => { if (window.confirm(`Remove your ${e.weight_kg} kg ${species}?`)) deleteEntry(e) }}
                    className="text-xs text-red-500 font-bold px-2 py-1 rounded-lg hover:bg-red-50 border border-red-200 transition">
                    Delete
                  </button>
                </div>
              </div>
            )})}

            {canAdd ? (
              <button onClick={() => openForm(null)}
                className="w-full py-3 rounded-xl font-bold text-sm text-white transition hover:opacity-90"
                style={{ background: SNZ_BLUE }}>
                + Add another {species}
              </button>
            ) : (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700 text-center">
                Maximum 3 entries reached. Use Replace above when you land a bigger fish.
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // ── Add / replace form ─────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl overflow-hidden shadow-2xl max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            {existingEntries.length > 0 && (
              <button onClick={() => setMode('list')}
                className="text-gray-400 hover:text-gray-600 text-sm font-semibold transition">← Back</button>
            )}
            <h2 className="font-black text-gray-900">
              {replaceTarget ? `Replace ${replaceTarget.weight_kg} kg ${species}` : `Add ${species}`}
            </h2>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 font-bold transition">✕</button>
        </div>

        {replaceTarget && (
          <div className="mx-5 mt-4 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700">
            New fish must be heavier than <strong>{replaceTarget.weight_kg} kg</strong> to replace this entry.
          </div>
        )}

        <form onSubmit={submit} className="px-4 py-4 space-y-5">
          {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">{error}</div>}

          {/* Weight + Length — large inputs, text-base prevents iOS zoom */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Weight (kg) *</label>
              <input type="number" value={weightKg} onChange={e => setWeightKg(e.target.value)}
                step="0.1" min="0" placeholder="12.4" required inputMode="decimal"
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base font-bold focus:outline-none focus:border-blue-400 focus:ring-0" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Length (cm) *</label>
              <input type="number" value={lengthCm} onChange={e => setLengthCm(e.target.value)}
                step="0.5" min="0" placeholder="104.5" required inputMode="decimal"
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base font-bold focus:outline-none focus:border-blue-400 focus:ring-0" />
            </div>
          </div>

          {/* 3 photo uploads — large square tap targets */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
              Photos <span className="text-red-400">*</span>
              <span className="font-normal normal-case text-gray-400 ml-1">— all 3 required</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Competitor Photo', hint: 'You + fish',  ref: gloryRef,  file: gloryFile,  set: setGloryFile },
                { label: 'Scales',      hint: 'Weight shown',   ref: scalesRef, file: scalesFile, set: setScalesFile },
                { label: 'Length',      hint: 'Measure shown',  ref: lengthRef, file: lengthFile, set: setLengthFile },
              ].map(({ label, hint, ref, file, set }) => (
                <div key={label} className="flex flex-col items-center gap-1">
                  <button type="button" onClick={() => ref.current?.click()}
                    className="w-full relative overflow-hidden rounded-2xl border-2 transition active:scale-95"
                    style={{
                      aspectRatio: '1',
                      borderColor: file ? '#16a34a' : '#e5e7eb',
                      background: file ? '#f0fdf4' : '#f9fafb',
                    }}>
                    {file ? (
                      <>
                        <img src={URL.createObjectURL(file)} alt={label}
                          className="absolute inset-0 w-full h-full object-cover" />
                        <div className="absolute inset-0 flex items-end justify-end p-1.5">
                          <span className="bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-black">✓</span>
                        </div>
                      </>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round">
                          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                          <circle cx="12" cy="13" r="4"/>
                        </svg>
                        <span className="text-xs text-gray-400">{hint}</span>
                      </div>
                    )}
                  </button>
                  <span className="text-xs font-bold text-gray-500">{label}</span>
                  <input ref={ref} type="file" accept="image/*" className="hidden"
                    onChange={e => set(e.target.files?.[0] || null)} />
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Location, conditions, technique…"
              className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-blue-400 resize-none" />
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700">
            By submitting you confirm this fish was legally taken by freediving in NZ waters. Entries are live immediately on the honor system.
          </div>

          <div className="flex gap-3 pb-2">
            <button type="submit" disabled={busy}
              className="flex-1 py-3.5 rounded-xl font-black text-base text-white disabled:opacity-50 transition active:scale-95"
              style={{ background: SNZ_BLUE }}>
              {busy ? 'Submitting…' : replaceTarget ? 'Replace Entry' : 'Submit Entry'}
            </button>
            <button type="button"
              onClick={existingEntries.length > 0 ? () => setMode('list') : onClose}
              className="px-5 py-3.5 rounded-xl font-bold text-base border-2 border-gray-200 text-gray-600 active:bg-gray-50 transition">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Photo lightbox ────────────────────────────────────────────────────────────
function PhotoLightbox({ entry, onClose }) {
  const photos = [
    { url: entry.photo_glory_url,  label: 'Competitor Photo' },
    { url: entry.photo_scales_url, label: 'Scales' },
    { url: entry.photo_length_url, label: 'Length' },
  ].filter(p => p.url)

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex flex-col"
      style={{ background: 'rgba(0,0,0,0.95)' }}>
      {/* Top bar with close button — always visible */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
        <p className="text-white font-black text-sm leading-tight">
          {entry.display_name}<br />
          <span className="font-normal text-white/60">{entry.species} · {entry.weight_kg} kg · {entry.length_cm} cm</span>
        </p>
        <button onClick={onClose}
          className="w-11 h-11 rounded-full bg-white/15 active:bg-white/30 flex items-center justify-center text-white text-lg font-bold flex-shrink-0 ml-3">
          ✕
        </button>
      </div>

      {/* Photos */}
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {photos.map(p => (
            <div key={p.label} className="text-center">
              <img src={p.url} alt={p.label} className="w-full rounded-xl object-contain max-h-72 sm:max-h-80" />
              <p className="text-white/60 text-xs mt-2 font-semibold">{p.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tap outside area to close */}
      <button onClick={onClose}
        className="fixed inset-0 -z-10 w-full h-full cursor-default"
        tabIndex={-1} aria-label="Close" />
    </div>
  )
}
