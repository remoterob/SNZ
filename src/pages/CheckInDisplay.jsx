import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Users, CheckCircle, Clock, AlertTriangle, Map } from 'lucide-react'

const SNZ_LOGO = import.meta.env.VITE_SNZ_LOGO_URL || '/api/placeholder/200/80'
const PAGE_INTERVAL = 15000
const TABS = ['arriving', 'incomplete', 'checkedin', 'map']
function DivBadge({ label, color }) {
  const styles = { blue: 'bg-blue-100 text-blue-700', pink: 'bg-pink-100 text-pink-700', purple: 'bg-purple-100 text-purple-700', orange: 'bg-orange-100 text-orange-700' }
  return <span className={`px-1.5 py-0 rounded-full text-[11px] font-bold leading-5 ${styles[color]}`}>{label}</span>
}

function ShirtIcon({ size }) {
  if (!size) return null
  const display = size.replace(/^(Male |Female |Child )/i, '')
  const isMale = /^male/i.test(size)
  const isFemale = /^female/i.test(size)
  const strokeColor = isMale ? '#3b82f6' : isFemale ? '#ec4899' : '#9ca3af'
  return (
    <div title={size} className="flex flex-col items-center">
      <svg viewBox="0 0 100 90" className="w-7 h-7" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M30 5 L15 20 L2 15 L10 40 L20 38 L20 85 L80 85 L80 38 L90 40 L98 15 L85 20 L70 5 Q60 14 50 14 Q40 14 30 5 Z"
          fill="white" stroke={strokeColor} strokeWidth="4" strokeLinejoin="round"
        />
        <text x="50" y="63" textAnchor="middle"
          fontSize={display.length > 2 ? "26" : "30"}
          fontWeight="bold" fill="#374151" fontFamily="Arial, sans-serif"
        >{display}</text>
      </svg>
    </div>
  )
}

function TeamCard({ team, variant }) {
  const names = [team.competitor1_name, team.competitor2_name].filter(Boolean)
  const partnerNote = team.notes?.match(/Specified partner: (.+) \(not registered\)/)
  const specifiedPartner = partnerNote ? partnerNote[1] : null

  const styles = {
    waiting:    { wrap: 'border-l-4 border-l-amber-400 bg-amber-50',  num: 'text-amber-700' },
    incomplete: { wrap: 'border-l-4 border-l-red-500 bg-red-50',      num: 'text-red-700'   },
    arrived:    { wrap: 'border-l-4 border-l-green-500 bg-green-50',  num: 'text-green-700' },
  }[variant]

  return (
    <div className={`rounded-md px-3 py-2 ${styles.wrap}`}>
      {/* Team number */}
      <span className={`text-sm font-black ${styles.num}`}>#{team.team_number}</span>

      {/* Names — larger, on separate lines */}
      <div className="mt-0.5">
        {names.map((name, i) => (
          <p key={i} className="text-lg font-bold text-gray-900 leading-tight">{name}</p>
        ))}
        {variant === 'incomplete' && (
          <p className="text-xs text-red-500 italic leading-tight mt-0.5">
            {specifiedPartner ? `→ ${specifiedPartner}` : 'No partner specified'}
          </p>
        )}
      </div>

      {/* Badges + shirts on same row */}
      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
        <div className="flex gap-1 flex-wrap">
          <DivBadge label="Open" color="blue" />
          {team.is_junior && <DivBadge label="Juniors" color="purple" />}
          {team.is_women  && <DivBadge label="Women"   color="pink"   />}
          {team.is_mixed  && <DivBadge label="Mixed"   color="orange" />}
        </div>
        {(team.tshirt1 || team.tshirt2) && (
          <div className="flex gap-1 ml-auto">
            {team.tshirt1 && <ShirtIcon size={team.tshirt1} />}
            {team.tshirt2 && <ShirtIcon size={team.tshirt2} />}
          </div>
        )}
      </div>
    </div>
  )
}

// Compact single-line row for mobile
function MobileRow({ team, variant }) {
  const names = [team.competitor1_name, team.competitor2_name].filter(Boolean)
  const partnerNote = team.notes?.match(/Specified partner: (.+) \(not registered\)/)
  const specifiedPartner = partnerNote ? partnerNote[1] : null

  const border = {
    waiting:    'border-l-4 border-l-amber-400 bg-amber-50',
    incomplete: 'border-l-4 border-l-red-500 bg-red-50',
    arrived:    'border-l-4 border-l-green-500 bg-green-50',
  }[variant]
  const numColor = {
    waiting: 'text-amber-700', incomplete: 'text-red-700', arrived: 'text-green-700'
  }[variant]

  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-md ${border}`}>
      {/* Team number */}
      <span className={`text-sm font-black shrink-0 w-8 ${numColor}`}>#{team.team_number}</span>

      {/* Names */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-900 leading-tight truncate">
          {names.join(' / ')}
        </p>
        {variant === 'incomplete' && (
          <p className="text-xs text-red-500 italic leading-tight truncate">
            {specifiedPartner ? `→ ${specifiedPartner}` : 'No partner specified'}
          </p>
        )}
        <div className="flex gap-1 mt-0.5 flex-wrap">
          <DivBadge label="Open" color="blue" />
          {team.is_junior && <DivBadge label="Juniors" color="purple" />}
          {team.is_women  && <DivBadge label="Women"   color="pink"   />}
          {team.is_mixed  && <DivBadge label="Mixed"   color="orange" />}
        </div>
      </div>

      {/* Shirts pushed right */}
      {(team.tshirt1 || team.tshirt2) && (
        <div className="flex gap-1 shrink-0">
          {team.tshirt1 && <ShirtIcon size={team.tshirt1} />}
          {team.tshirt2 && <ShirtIcon size={team.tshirt2} />}
        </div>
      )}
    </div>
  )
}


function StatPill({ icon: Icon, value, label, colorClass }) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${colorClass}`}>
      <Icon className="w-4 h-4 shrink-0" />
      <span className="text-xl font-black leading-none">{value}</span>
      <span className="text-xs font-semibold uppercase tracking-wide opacity-80 leading-tight">{label}</span>
    </div>
  )
}

const PER_PAGE = 20

export default function CheckInDisplay() {
  const [teams, setTeams]             = useState([])
  const [counts, setCounts]           = useState(null)
  const [loading, setLoading]         = useState(true)
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [activeTab, setActiveTab]     = useState('arriving')
  const tabRef                        = useRef('arriving')
  const [arrivingPage, setArrivingPage]     = useState(0)
  const [incompletePage, setIncompletePage] = useState(0)
  const [checkedInPage, setCheckedInPage]   = useState(0)
  const arrivingPageRef   = useRef(0)
  const incompletePageRef = useRef(0)
  const checkedInPageRef  = useRef(0)
  const [tabProgress, setTabProgress] = useState(0)
  const tabProgressRef = useRef(0)

  // Dynamically calculate how many teams fit on screen
  const CARD_HEIGHT_DESKTOP = 115
  const CARD_HEIGHT_MOBILE  = 72
  const OVERHEAD_DESKTOP = 220
  const OVERHEAD_MOBILE  = 180
  const [perPage, setPerPage] = useState(20)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const calc = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      const available = window.innerHeight - (mobile ? OVERHEAD_MOBILE : OVERHEAD_DESKTOP)
      const cardH     = mobile ? CARD_HEIGHT_MOBILE : CARD_HEIGHT_DESKTOP
      const cols      = mobile ? 1 : 4
      const rows      = Math.max(1, Math.floor(available / cardH))
      setPerPage(rows * cols)
    }
    calc()
    window.addEventListener('resize', calc)
    return () => window.removeEventListener('resize', calc)
  }, [])

  const fetchCounts = async () => {
    const { data } = await supabase.from('registration_counts').select('*').single()
    if (data) setCounts(data)
  }

  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase.from('teams').select('*').order('team_number', { ascending: true })
      if (error) throw error
      setTeams(data || [])
      setLastUpdated(new Date())
      setLoading(false)
    } catch (e) { console.error(e); setLoading(false) }
  }

  useEffect(() => {
    fetchTeams(); fetchCounts()
    const interval = setInterval(() => { fetchTeams(); fetchCounts() }, 5000)
    return () => clearInterval(interval)
  }, [])

  const incomplete    = teams.filter(t => !t.competitor2_name || !t.competitor2_name.trim())
  const notYetArrived = teams.filter(t => !t.registered && t.competitor2_name?.trim()).sort((a,b) => a.team_number - b.team_number)
  const checkedIn     = teams.filter(t => t.registered).sort((a,b) => new Date(b.updated_at||b.created_at) - new Date(a.updated_at||a.created_at))

  const arrivingPages   = Math.max(1, Math.ceil(notYetArrived.length / perPage))
  const incompletePages = Math.max(1, Math.ceil(incomplete.length    / perPage))
  const checkedInPages  = Math.max(1, Math.ceil(checkedIn.length     / perPage))

  const pageSlice = (list, page) => list.slice(page * perPage, (page + 1) * perPage)

  useEffect(() => { if (arrivingPage >= arrivingPages)     { setArrivingPage(0);   arrivingPageRef.current = 0   } }, [arrivingPages])
  useEffect(() => { if (incompletePage >= incompletePages) { setIncompletePage(0); incompletePageRef.current = 0 } }, [incompletePages])
  useEffect(() => { if (checkedInPage >= checkedInPages)   { setCheckedInPage(0);  checkedInPageRef.current = 0  } }, [checkedInPages])

  // Unified sequencer: page through all blocks in current section, THEN advance to next section
  // State stored in refs so the interval closure always sees current values
  const pagesForTab = (tab) => {
    if (tab === 'arriving')   return Math.max(1, Math.ceil(notYetArrived.length / perPage))
    if (tab === 'incomplete') return Math.max(1, Math.ceil(incomplete.length    / perPage))
    if (tab === 'map')        return 1
    return Math.max(1, Math.ceil(checkedIn.length / perPage))
  }

  useEffect(() => {
    // Progress bar ticks every 100ms
    const progTimer = setInterval(() => {
      tabProgressRef.current = Math.min(tabProgressRef.current + (100 / (PAGE_INTERVAL / 100)), 100)
      setTabProgress(tabProgressRef.current)
    }, 100)

    // Main advance — fires every PAGE_INTERVAL
    const advanceTimer = setInterval(() => {
      const tab   = tabRef.current
      const pages = pagesForTab(tab)

      // Which page ref/setter for current tab?
      const pageRef = tab === 'arriving' ? arrivingPageRef : tab === 'incomplete' ? incompletePageRef : checkedInPageRef
      const setPage = tab === 'arriving' ? setArrivingPage  : tab === 'incomplete' ? setIncompletePage  : setCheckedInPage

      const nextPage = pageRef.current + 1

      if (nextPage < pages) {
        // More pages in this section — advance page
        pageRef.current = nextPage
        setPage(nextPage)
      } else {
        // Last page of this section — reset its page and move to next tab
        pageRef.current = 0
        setPage(0)
        const nextTab = TABS[(TABS.indexOf(tab) + 1) % TABS.length]
        tabRef.current = nextTab
        setActiveTab(nextTab)
      }

      tabProgressRef.current = 0
      setTabProgress(0)
    }, PAGE_INTERVAL)

    return () => { clearInterval(progTimer); clearInterval(advanceTimer) }
  }, [notYetArrived.length, incomplete.length, checkedIn.length, perPage])

  const switchTab = (tab) => {
    // Reset page for the tab we're switching to
    if (tab === 'arriving')   { arrivingPageRef.current = 0;   setArrivingPage(0)   }
    if (tab === 'incomplete') { incompletePageRef.current = 0; setIncompletePage(0) }
    if (tab === 'checkedin')  { checkedInPageRef.current = 0;  setCheckedInPage(0)  }
    tabRef.current = tab; setActiveTab(tab)
    tabProgressRef.current = 0; setTabProgress(0)
  }

  const getContent = () => {
    if (activeTab === 'arriving') {
      const slice = pageSlice(notYetArrived, arrivingPage)
      const q = Math.ceil(slice.length / 4)
      return { cols: [slice.slice(0, q), slice.slice(q, q*2), slice.slice(q*2, q*3), slice.slice(q*3)],
        variant: 'waiting', total: notYetArrived.length, page: arrivingPage, pages: arrivingPages,
        onPrev: () => { const p=(arrivingPage-1+arrivingPages)%arrivingPages; setArrivingPage(p); arrivingPageRef.current=p },
        onNext: () => { const p=(arrivingPage+1)%arrivingPages; setArrivingPage(p); arrivingPageRef.current=p } }
    }
    if (activeTab === 'incomplete') {
      const slice = pageSlice(incomplete, incompletePage)
      const q = Math.ceil(slice.length / 4)
      return { cols: [slice.slice(0, q), slice.slice(q, q*2), slice.slice(q*2, q*3), slice.slice(q*3)],
        variant: 'incomplete', total: incomplete.length, page: incompletePage, pages: incompletePages,
        onPrev: () => { const p=(incompletePage-1+incompletePages)%incompletePages; setIncompletePage(p); incompletePageRef.current=p },
        onNext: () => { const p=(incompletePage+1)%incompletePages; setIncompletePage(p); incompletePageRef.current=p } }
    }
    if (activeTab === 'map') {
      return { cols: [], variant: 'map', total: 1, page: 0, pages: 1, onPrev: () => {}, onNext: () => {} }
    }
    const slice = pageSlice(checkedIn, checkedInPage)
    const q = Math.ceil(slice.length / 4)
    return { cols: [slice.slice(0, q), slice.slice(q, q*2), slice.slice(q*2, q*3), slice.slice(q*3)],
      variant: 'arrived', total: checkedIn.length, page: checkedInPage, pages: checkedInPages,
      onPrev: () => { const p=(checkedInPage-1+checkedInPages)%checkedInPages; setCheckedInPage(p); checkedInPageRef.current=p },
      onNext: () => { const p=(checkedInPage+1)%checkedInPages; setCheckedInPage(p); checkedInPageRef.current=p } }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center">
        <div className="text-white text-2xl font-semibold">Loading registration data...</div>
      </div>
    )
  }

  const content = getContent()
  const tabCfg = {
    arriving:   { label: isMobile ? `To Arrive (${notYetArrived.length})`  : `Still to Arrive (${notYetArrived.length})`, Icon: Clock,         activeBar: 'bg-amber-400', activeBg: 'bg-amber-500 text-white',  inactiveBg: 'bg-amber-50 text-amber-700',  pulse: false },
    incomplete: { label: `Incomplete (${incomplete.length})`,                                                               Icon: AlertTriangle, activeBar: 'bg-red-500',   activeBg: 'bg-red-600 text-white',    inactiveBg: 'bg-red-50 text-red-700',      pulse: incomplete.length > 0 },
    checkedin:  { label: isMobile ? `Checked In (${checkedIn.length})`      : `Checked In (${checkedIn.length})`,          Icon: CheckCircle,   activeBar: 'bg-green-500', activeBg: 'bg-green-600 text-white',  inactiveBg: 'bg-green-50 text-green-700',  pulse: false },
    map:        { label: 'Lake Taupō Map',                                                                                  Icon: Map,           activeBar: 'bg-blue-500',  activeBg: 'bg-blue-600 text-white',   inactiveBg: 'bg-blue-50 text-blue-700',    pulse: false },
  }

  return (
    <div className="h-screen bg-gradient-to-br from-blue-900 to-blue-700 p-3 flex flex-col gap-3 overflow-hidden">

      {/* HEADER */}
      {isMobile ? (
        /* Mobile header: compact single row */
        <div className="bg-white rounded-xl shadow-xl px-3 py-2 flex items-center gap-3">
          <img src={SNZ_LOGO} alt="SNZ" className="h-8 w-auto object-contain shrink-0" />
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-black text-blue-900 leading-tight">Rosemergy Catfish Cull 2026</h1>
          </div>
          <div className="flex gap-2 shrink-0 text-sm font-bold">
            <span className="text-green-600">{counts?.checked_in ?? checkedIn.length} ✓</span>
            <span className="text-amber-600">{counts?.not_yet_arrived ?? notYetArrived.length} ⏱</span>
            <span className="text-red-600">{counts?.incomplete ?? incomplete.length} ⚠</span>
          </div>
        </div>
      ) : (
        /* Desktop header */
        <div className="bg-white rounded-xl shadow-xl px-5 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img src={SNZ_LOGO} alt="SNZ" className="h-10 w-auto object-contain" />
            <div>
              <h1 className="text-2xl font-black text-blue-900 leading-tight">Rosemergy Catfish Cull 2026</h1>
              <p className="text-gray-400 text-xs font-medium">Registration Check-In</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end flex-1">
            <StatPill icon={Users}         value={counts?.total_teams     ?? teams.length}         label="Total"      colorClass="bg-blue-50 text-blue-700"   />
            <StatPill icon={CheckCircle}   value={counts?.checked_in      ?? checkedIn.length}     label="Checked In" colorClass="bg-green-50 text-green-700" />
            <StatPill icon={Clock}         value={counts?.not_yet_arrived ?? notYetArrived.length} label="To Arrive"  colorClass="bg-amber-50 text-amber-700" />
            <StatPill icon={AlertTriangle} value={counts?.incomplete      ?? incomplete.length}    label="Incomplete" colorClass="bg-red-50 text-red-600"     />
          </div>
          <div className="text-right text-xs text-gray-400 shrink-0">
            <div>Auto-updates every 5s</div>
            <div>{lastUpdated.toLocaleTimeString()}</div>
          </div>
        </div>
      )}

      {/* TAB PANEL */}
      <div className="bg-white rounded-xl shadow-xl flex flex-col flex-1 min-h-0 overflow-hidden">

        {/* Tab bar */}
        <div className="flex">
          {TABS.map(tab => {
            const cfg = tabCfg[tab]
            const isActive = activeTab === tab
            return (
              <button key={tab} onClick={() => switchTab(tab)}
                className={`flex-1 flex items-center justify-center gap-2 py-3.5 px-4 text-sm font-bold transition-colors
                  ${isActive ? cfg.activeBg : cfg.inactiveBg}
                  ${!isActive && cfg.pulse ? 'animate-pulse' : ''}`}>
                <cfg.Icon className="w-4 h-4" />
                {cfg.label}
              </button>
            )
          })}
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-gray-100">
          <div className={`h-1 transition-none ${tabCfg[activeTab].activeBar}`} style={{ width: `${tabProgress}%` }} />
        </div>

        {/* Content — fixed height, no overflow */}
        <div className={`flex-1 min-h-0 overflow-hidden ${activeTab === 'incomplete' && incomplete.length > 0 ? 'bg-red-50/20' : ''}`}>
          {activeTab === 'map' ? (
            /* MAP TAB — full bleed image */
            <div className="w-full h-full flex items-center justify-center bg-slate-100">
              <img
                src="https://zodqgekuackcrqyzluoo.supabase.co/storage/v1/object/public/assets/Lake%20map.png"
                alt="Lake Taupō Map"
                className="w-full h-full object-contain"
              />
            </div>
          ) : content.total === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <CheckCircle className="w-16 h-16 opacity-20 mb-3" />
              <p className="text-xl font-semibold">
                {activeTab === 'arriving'   ? 'Everyone has arrived! 🎉' :
                 activeTab === 'incomplete' ? 'No incomplete teams 👍'  : 'No check-ins yet'}
              </p>
            </div>
          ) : (
            <div className="p-4 h-full flex flex-col">
              {isMobile ? (
                /* Mobile: simple single-column list */
                <div className="flex flex-col gap-1.5 flex-1 min-h-0 overflow-hidden">
                  {pageSlice(
                    activeTab === 'arriving'   ? notYetArrived :
                    activeTab === 'incomplete' ? incomplete : checkedIn,
                    content.page
                  ).map(team => <MobileRow key={team.id} team={team} variant={content.variant} />)}
                </div>
              ) : (
                /* Desktop: 4-column grid */
                <div className="grid grid-cols-4 gap-3 flex-1 min-h-0 overflow-hidden">
                  {content.cols.map((col, ci) => (
                    <div key={ci} className="flex flex-col gap-2">
                      {col.map(team => <TeamCard key={team.id} team={team} variant={content.variant} />)}
                    </div>
                  ))}
                </div>
              )}

              {content.pages > 1 && (
                <div className="flex items-center justify-center gap-3 mt-3 shrink-0">
                  <button onClick={content.onPrev} className="w-7 h-7 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-bold flex items-center justify-center">‹</button>
                  <span className="text-sm text-gray-500 font-semibold">{content.page + 1} / {content.pages}</span>
                  <button onClick={content.onNext} className="w-7 h-7 rounded bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-bold flex items-center justify-center">›</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <p className="text-center text-white text-xs opacity-40 pb-1">catfish-cull.netlify.app/checkin</p>
    </div>
  )
}
