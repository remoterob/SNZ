import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Clock, TrendingUp } from 'lucide-react'

const SNZ_BLUE = '#2B6CB0'
const SNZ_DARK = '#1e3a5f'
const SNZ_LOGO = import.meta.env.VITE_SNZ_LOGO_URL || null

// ── Embedded 2026 leaderboard data ───────────────────────────────────────────
function Leaderboard2026() {
  const [catches, setCatches] = useState([])
  const [eventState, setEventState] = useState(null)
  const [heaviestFish, setHeaviestFish] = useState(null)
  const [lightestFish, setLightestFish] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedDivision, setSelectedDivision] = useState('All')
  const [allTeams, setAllTeams] = useState([])
  const [lbCounts, setLbCounts] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(new Date())

  const fetchAll = async () => {
    try {
      const { data } = await supabase
        .from('leaderboard')
        .select('*')
        .order('catfish_count', { ascending: false })

      const dataWithNames = (data || []).map(c => ({
        ...c,
        team_names: [c.competitor1_name, c.competitor2_name, c.competitor3_name]
          .filter(Boolean).join(' & ')
      }))
      setCatches(dataWithNames)

      const eligible = dataWithNames.filter(c => c.eligible && c.status !== 'disqualified')
      setHeaviestFish(eligible.filter(c => c.heaviest_fish_grams).sort((a, b) => b.heaviest_fish_grams - a.heaviest_fish_grams)[0] || null)
      setLightestFish(eligible.filter(c => c.lightest_fish_grams).sort((a, b) => a.lightest_fish_grams - b.lightest_fish_grams)[0] || null)

      const { data: es } = await supabase.from('event_state').select('*').single()
      setEventState(es)

      const { data: teams } = await supabase.from('teams').select('id, is_junior, is_women, is_mixed, competitor3_name')
      setAllTeams(teams || [])

      const { data: lbc } = await supabase.from('leaderboard_counts').select('*').single()
      if (lbc) setLbCounts(lbc)

      setLastUpdated(new Date())
      setLoading(false)
    } catch (e) {
      console.error(e)
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
    const interval = setInterval(fetchAll, 30000)
    return () => clearInterval(interval)
  }, [])

  const filtered = selectedDivision === 'All' ? catches
    : selectedDivision === 'Juniors' ? catches.filter(c => c.is_junior)
    : selectedDivision === 'Women'   ? catches.filter(c => c.is_women)
    : selectedDivision === 'Mixed'   ? catches.filter(c => c.is_mixed)
    : catches

  const ranked = filtered.map((c, i, arr) => {
    if (c.status === 'disqualified') return { ...c, rank: '-' }
    const above = arr.slice(0, i).filter(x => x.status !== 'disqualified' && x.catfish_count > c.catfish_count)
    return { ...c, rank: above.length + 1 }
  })

  const totalCatfish = catches.reduce((s, c) => s + c.catfish_count, 0)

  if (loading) return <div className="py-12 text-center text-gray-400 text-sm">Loading results…</div>

  return (
    <div className="space-y-5">

      {/* Provisional banner */}
      {eventState?.status === 'provisional' && (
        <div className="bg-yellow-50 border border-yellow-300 rounded-xl px-4 py-3 flex items-center gap-2">
          <Clock className="w-4 h-4 text-yellow-600 flex-shrink-0" />
          <div>
            <p className="text-xs font-black text-yellow-800">Provisional Results</p>
            <p className="text-xs text-yellow-700">Protest period open until {eventState.protest_deadline}. Final results at prizegiving: {eventState.prizegiving_time}</p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-black text-gray-900">{catches.length}</p>
          <p className="text-xs text-gray-400 mt-0.5">Teams</p>
        </div>
        <div className="rounded-xl p-4 text-center text-white" style={{ background: SNZ_DARK }}>
          <p className="text-2xl font-black">{totalCatfish.toLocaleString()}</p>
          <p className="text-xs opacity-75 mt-0.5">Catfish Eradicated</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-black text-gray-900">{catches.length > 0 ? (totalCatfish / catches.length).toFixed(1) : '—'}</p>
          <p className="text-xs text-gray-400 mt-0.5">Average</p>
        </div>
      </div>

      {/* Prize fish */}
      {(heaviestFish || lightestFish) && (
        <div className="grid grid-cols-2 gap-3">
          {heaviestFish && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-xs font-black text-amber-700 uppercase tracking-wide mb-1">⚖️ Heaviest</p>
              <p className="text-xl font-black text-gray-900">{heaviestFish.heaviest_fish_grams}g</p>
              <p className="text-xs text-gray-500 truncate">{heaviestFish.team_names}</p>
            </div>
          )}
          {lightestFish && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-xs font-black text-green-700 uppercase tracking-wide mb-1">🪶 Lightest</p>
              <p className="text-xl font-black text-gray-900">{lightestFish.lightest_fish_grams}g</p>
              <p className="text-xs text-gray-500 truncate">{lightestFish.team_names}</p>
            </div>
          )}
        </div>
      )}

      {/* Division filter */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { id: 'All',     label: `All (${lbCounts?.total_teams ?? catches.length})` },
          { id: 'Juniors', label: `Juniors (${lbCounts?.junior_teams ?? allTeams.filter(t => t.is_junior).length})` },
          { id: 'Women',   label: `Women (${lbCounts?.women_teams ?? allTeams.filter(t => t.is_women).length})` },
          { id: 'Mixed',   label: `Mixed (${lbCounts?.mixed_teams ?? allTeams.filter(t => t.is_mixed).length})` },
        ].map(({ id, label }) => (
          <button key={id} onClick={() => setSelectedDivision(id)}
            className={`py-2 rounded-lg text-xs font-bold transition ${selectedDivision === id ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            style={selectedDivision === id ? { background: SNZ_BLUE } : {}}>
            {label}
          </button>
        ))}
      </div>

      {/* Leaderboard cards */}
      <div className="space-y-2">
        {ranked.length === 0 && (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-gray-400 text-sm">No results recorded.</div>
        )}
        {ranked.map(c => (
          <div key={c.id} className={`bg-white border border-gray-200 rounded-xl overflow-hidden ${c.status === 'disqualified' ? 'opacity-50' : ''}`}>
            <div className={`h-1 ${c.rank === 1 ? 'bg-yellow-400' : c.rank === 2 ? 'bg-gray-300' : c.rank === 3 ? 'bg-amber-600' : 'bg-gray-100'}`} />
            <div className="px-4 py-3 flex items-center gap-3">
              <div className="text-lg font-black w-8 text-center flex-shrink-0" style={{ color: SNZ_DARK }}>
                {c.rank === 1 ? '🥇' : c.rank === 2 ? '🥈' : c.rank === 3 ? '🥉' : c.rank === '-' ? '—' : `#${c.rank}`}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 flex-wrap mb-0.5">
                  <span className="text-xs font-black text-gray-500">#{c.team_number}</span>
                  {!c.eligible && <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-gray-100 text-gray-500">Triple</span>}
                  {c.is_junior && <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-purple-100 text-purple-700">Jr</span>}
                  {c.is_women  && <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-pink-100 text-pink-700">W</span>}
                  {c.is_mixed  && <span className="px-1.5 py-0.5 rounded text-xs font-bold bg-orange-100 text-orange-700">Mx</span>}
                </div>
                <p className="text-sm font-semibold text-gray-800 truncate">{c.team_names}</p>
                {c.status === 'under_protest'  && <p className="text-xs text-orange-600 mt-0.5">Under Protest</p>}
                {c.status === 'disqualified'   && <p className="text-xs text-red-600 mt-0.5">Disqualified</p>}
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-3xl font-black leading-none" style={{ color: SNZ_DARK }}>{c.catfish_count}</p>
                <p className="text-xs text-gray-400">catfish</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-gray-400 pb-2">
        Auto-refreshes every 30 seconds · Last updated {lastUpdated.toLocaleTimeString()}
      </p>
    </div>
  )
}

// ── Main CatfishCullPage ──────────────────────────────────────────────────────
export default function CatfishCullPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('2027')

  return (
    <div className="min-h-screen" style={{ background: '#f8fafc' }}>

      {/* Header — matches NationalsPage exactly */}
      <div style={{ background: SNZ_DARK }} className="px-6 py-3 flex items-center justify-between border-b border-blue-900">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
            ← SNZ Hub
          </button>
        </div>
        <button onClick={() => navigate('/catfish/admin')}
          className="text-xs font-bold text-white bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
          ⚙ Admin
        </button>
      </div>

      {/* Hero */}
      <div style={{ background: `linear-gradient(135deg, ${SNZ_DARK} 0%, ${SNZ_BLUE} 100%)` }} className="px-6 py-10 text-center">
        <p className="text-white/70 text-sm font-bold uppercase tracking-widest mb-2">Spearfishing New Zealand · Kaitiakitanga</p>
        <h1 className="text-4xl sm:text-5xl font-black text-white mb-3">Rosemergy<br/>Catfish Cull</h1>
        <p className="text-white/80 text-base mb-2">Lake Taupō pest removal — Hawaiian slings only</p>
        <div className="inline-flex items-center gap-2 bg-amber-400 text-amber-900 font-black text-sm px-4 py-2 rounded-full mt-2">
          📍 Motuoapa, Lake Taupō · 13 February 2027
        </div>
      </div>

      {/* Tab bar */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 overflow-x-auto">
        <div className="flex gap-1 max-w-3xl mx-auto">
          {[
            ['2027', '2027 Registration'],
            ['2026', '2026 Results'],
            ['about', 'About'],
          ].map(([tab, label]) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-bold whitespace-nowrap border-b-2 transition ${activeTab === tab ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8">

        {/* ── 2027 Registration tab ── */}
        {activeTab === '2027' && (
          <div className="space-y-5">

            {/* Event summary */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6">
              <h2 className="text-xl font-black text-gray-900 mb-4">Rosemergy Catfish Cull 2027</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
                {[
                  { icon: '📍', label: 'Location', value: 'Motuoapa, Lake Taupō' },
                  { icon: '📅', label: 'Date',     value: '13 February 2027' },
                  { icon: '🎯', label: 'Entry',    value: 'Registration opening soon' },
                ].map(item => (
                  <div key={item.label} className="bg-gray-50 rounded-xl p-4 text-center">
                    <p className="text-2xl mb-1">{item.icon}</p>
                    <p className="font-black text-gray-900 text-sm">{item.value}</p>
                    <p className="text-xs text-gray-400">{item.label}</p>
                  </div>
                ))}
              </div>

              {/* How it works */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
                <p className="text-sm font-black text-blue-900 mb-2">How the Cull works</p>
                <ul className="text-sm text-blue-800 space-y-1.5">
                  <li>• Hawaiian slings and pole spears only — no spearguns</li>
                  <li>• Compete in pairs, towing a float with a dive flag</li>
                  <li>• Groups of 3 are welcome but cannot win the top prizes</li>
                  <li>• Only catfish score — no trout, no kōura, no eels</li>
                  <li>• Competition area is the defined Motuoapa zone</li>
                  <li>• Water exit by 2:30pm — weigh-in from 3:00pm</li>
                  <li>• Additional prizes for junior pairs, heaviest and lightest catfish</li>
                </ul>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                <p className="text-sm font-black text-amber-800">⚠️ Important conservation rules</p>
                <p className="text-xs text-amber-700 mt-1">It is illegal to shoot trout. Any injured trout found by fishermen could result in the event being cancelled permanently. The kōura and eels in Lake Taupō belong to Ngāti Tūwharetoa and may not be taken. Keep 200m away from fly fishers at all times.</p>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <p className="text-sm font-black text-gray-800">🗓 Registration opening soon</p>
                <p className="text-xs text-gray-600 mt-1">Make sure your SNZ membership is active so you're ready to enter the moment registrations open.</p>
              </div>
            </div>

            {/* SNZ membership CTA */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 flex items-center justify-between gap-4">
              <div>
                <p className="font-black text-gray-900 text-sm">SNZ Membership required</p>
                <p className="text-xs text-gray-500 mt-0.5">Both divers must be active SNZ members to enter. $10/year.</p>
              </div>
              <button onClick={() => navigate('/membership')}
                className="px-4 py-2 rounded-xl font-black text-white text-xs flex-shrink-0"
                style={{ background: SNZ_BLUE }}>
                Join SNZ →
              </button>
            </div>

          </div>
        )}

        {/* ── 2026 Results tab ── */}
        {activeTab === '2026' && (
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <h2 className="text-lg font-black text-gray-900 mb-1">2026 Rosemergy Catfish Cull</h2>
              <p className="text-xs text-gray-400 mb-4">Motuoapa, Lake Taupō</p>
              <Leaderboard2026 />
            </div>
          </div>
        )}

        {/* ── About tab ── */}
        {activeTab === 'about' && (
          <div className="space-y-5">
            <div className="bg-white border border-gray-200 rounded-2xl p-6">
              <h2 className="text-xl font-black text-gray-900 mb-3">About the Catfish Cull</h2>
              <p className="text-gray-600 leading-relaxed mb-4">
                The Rosemergy Catfish Cull is SNZ's annual freshwater pest removal event held at Motuoapa on Lake Taupō.
                Catfish are an invasive pest species that damage the lake's ecosystem — the cull is a practical kaitiakitanga
                event that combines competitive spearfishing with meaningful environmental action.
              </p>
              <p className="text-gray-600 leading-relaxed mb-4">
                Hawaiian slings and pole spears only are permitted, keeping the event true to traditional
                freediving spearfishing. All fish harvested are removed from the lake, contributing directly
                to the health of the Taupō fishery.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
                <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                  <p className="font-black text-green-800 text-sm mb-2">🌿 Kaitiakitanga</p>
                  <p className="text-xs text-green-700 leading-relaxed">This event supports Ngāti Tūwharetoa's role as kaitiaki of Lake Taupō. Competitors must respect all tikanga — no kōura, no eels, no trout.</p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="font-black text-blue-800 text-sm mb-2">📋 Competition Rules</p>
                  <p className="text-xs text-blue-700 leading-relaxed">Governed by SNZ Catfish Cull rules (Part L of the SNZ Competition Rules & Guidelines). Full rules available at snz.org.nz</p>
                </div>
              </div>
            </div>

            {/* Key rules summary */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6">
              <h3 className="font-black text-gray-900 mb-3">Key Rules at a Glance</h3>
              <div className="space-y-2">
                {[
                  ['Hawaiian slings & pole spears only', 'No spearguns permitted'],
                  ['Pairs required', 'Groups of 3 allowed but ineligible for top prizes'],
                  ['Float & dive flag', 'Must be towed at all times while diving'],
                  ['Catfish only', 'Only catfish score — all other species protected'],
                  ['Exit water by 2:30pm', 'Weigh-in/roll call starts 3:00pm'],
                  ['200m from fly fishers', 'Mandatory clearance distance at all times'],
                ].map(([rule, detail]) => (
                  <div key={rule} className="flex gap-3 py-2 border-b border-gray-100 last:border-0">
                    <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: SNZ_BLUE }} />
                    <div>
                      <p className="text-sm font-bold text-gray-800">{rule}</p>
                      <p className="text-xs text-gray-500">{detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
