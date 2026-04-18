import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Clock, TrendingUp } from 'lucide-react'

const SNZ_LOGO = import.meta.env.VITE_SNZ_LOGO_URL || '/api/placeholder/200/80'
const SPONSOR_LOGO = import.meta.env.VITE_SPONSOR_LOGO_URL || '/api/placeholder/300/120'

export default function PublicLeaderboard() {
  const [catches, setCatches] = useState([])
  const [selectedDivision, setSelectedDivision] = useState('All')
  const [eventState, setEventState] = useState(null)
  const [heaviestFish, setHeaviestFish] = useState(null)
  const [lightestFish, setLightestFish] = useState(null)
  const [loading, setLoading] = useState(true)
  const [latestEntries, setLatestEntries] = useState([])
  const [allTeams, setAllTeams] = useState([])
  const [lbCounts, setLbCounts] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(new Date())

  const fetchLeaderboard = async () => {
    try {
      const { data, error } = await supabase
        .from('leaderboard')
        .select('*')
        .order('catfish_count', { ascending: false })

      if (error) throw error

      const dataWithNames = (data || []).map(c => ({
        ...c,
        team_names: [c.competitor1_name, c.competitor2_name, c.competitor3_name]
          .filter(Boolean)
          .join(' & ')
      }))

      setCatches(dataWithNames)

      const eligible = dataWithNames?.filter(c => c.eligible && c.status !== 'disqualified') || []

      const heaviest = eligible
        .filter(c => c.heaviest_fish_grams)
        .sort((a, b) => b.heaviest_fish_grams - a.heaviest_fish_grams)[0]

      const lightest = eligible
        .filter(c => c.lightest_fish_grams)
        .sort((a, b) => a.lightest_fish_grams - b.lightest_fish_grams)[0]

      setHeaviestFish(heaviest || null)
      setLightestFish(lightest || null)

      const { data: latestData, error: latestError } = await supabase
        .from('catches')
        .select(`
          id,
          catfish_count,
          photo_urls,
          created_at,
          team_id,
          teams (
            team_number,
            competitor1_name,
            competitor2_name,
            competitor3_name,
            is_junior,
            is_women,
            is_mixed,
            division
          )
        `)
        .order('created_at', { ascending: false })
        .limit(3)

      if (!latestError && latestData && latestData.length > 0) {
        const entriesWithRanks = latestData.map(entry => {
          const isEligible = !entry.teams.competitor3_name || entry.teams.competitor3_name.trim() === ''
          const overallRank = dataWithNames?.findIndex(c => c.team_id === entry.team_id) + 1
          return {
            ...entry,
            eligible: isEligible,
            overallRank: overallRank || '-',
          }
        })
        setLatestEntries(entriesWithRanks)
      } else {
        setLatestEntries([])
      }

      setLastUpdated(new Date())
      setLoading(false)
    } catch (error) {
      console.error('Error fetching leaderboard:', error)
      setLoading(false)
    }
  }

  const fetchEventState = async () => {
    const { data } = await supabase.from('event_state').select('*').single()
    setEventState(data)
  }

  const fetchAllTeams = async () => {
    const { data } = await supabase
      .from('teams')
      .select('id, is_junior, is_women, is_mixed, competitor3_name')
    setAllTeams(data || [])
  }

  const fetchLbCounts = async () => {
    const { data } = await supabase
      .from('leaderboard_counts')
      .select('*')
      .single()
    if (data) setLbCounts(data)
  }

  useEffect(() => {
    fetchLeaderboard()
    fetchEventState()
    fetchAllTeams()
    fetchLbCounts()
    const interval = setInterval(() => {
      fetchLeaderboard()
      fetchEventState()
      fetchAllTeams()
      fetchLbCounts()
    }, 10000)
    return () => clearInterval(interval)
  }, [])

  const filteredCatches = selectedDivision === 'All'
    ? catches
    : selectedDivision === 'Juniors'
    ? catches.filter(c => c.is_junior)
    : selectedDivision === 'Women'
    ? catches.filter(c => c.is_women)
    : selectedDivision === 'Mixed'
    ? catches.filter(c => c.is_mixed)
    : catches

  const rankedCatches = filteredCatches.map((c, index, arr) => {
    if (c.status === 'disqualified') return { ...c, rank: '-' }
    const eligibleAbove = arr
      .slice(0, index)
      .filter(x => x.status !== 'disqualified' && x.catfish_count > c.catfish_count)
    return { ...c, rank: eligibleAbove.length + 1 }
  })

  const totalTeams = catches.length
  const totalCatfish = catches.reduce((sum, c) => sum + c.catfish_count, 0)
  const avgCatfish = totalTeams > 0 ? (totalCatfish / totalTeams).toFixed(1) : 0

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center">
        <div className="text-white text-2xl">Loading leaderboard...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 p-4">
      <div className="max-w-7xl mx-auto">

        {/* TITLE CARD — clean, no logos */}
        <div className="bg-white rounded-lg shadow-2xl p-6 mb-4">
          <div className="flex items-center gap-4">
            <img
              src={SNZ_LOGO}
              alt="Spearfishing New Zealand"
              className="h-16 md:h-20 w-auto object-contain flex-shrink-0"
            />
            <div>
              <div className="flex items-start justify-between gap-4">
              <h1 className="text-3xl md:text-4xl font-bold text-blue-900">Rosemergy Catfish Cull 2026</h1>
              <a href="/admin/login" className="flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 transition whitespace-nowrap">Admin →</a>
            </div>
            </div>
          </div>

          {eventState?.status === 'provisional' && (
            <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4 mt-4">
              <div className="flex items-center gap-2 text-yellow-800">
                <Clock className="w-5 h-5" />
                <div>
                  <p className="font-semibold">PROVISIONAL RESULTS</p>
                  <p className="text-sm">
                    Protest period open until {eventState.protest_deadline}.
                    Final results at prizegiving: {eventState.prizegiving_time}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* SPONSOR CARD — its own card below title */}
        <div className="bg-white rounded-lg shadow-lg px-6 py-4 mb-6 flex items-center gap-4">
          <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold whitespace-nowrap">
            Proudly Sponsored By
          </p>
          <img
            src={SPONSOR_LOGO}
            alt="Hunting & Fishing Taupo"
            className="h-10 md:h-14 w-auto object-contain"
          />
          <div className="w-px h-10 bg-gray-200 mx-1" />
          <img
            src={SNZ_LOGO}
            alt="Spearfishing NZ"
            className="h-10 md:h-14 w-auto object-contain"
          />
        </div>

        {/* LATEST ENTRIES */}
        {latestEntries.length > 0 && (
          <div className="bg-white rounded-lg shadow-2xl overflow-hidden mb-6">
            <div className="px-6 pt-5 pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <span className="text-xl">🔥</span>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-widest">Latest Entry</h3>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {latestEntries.map((entry, idx) => (
                  <div key={entry.id} className={idx > 0 ? "hidden md:block" : ""}>
                    <div className="flex items-start gap-4">
                      {/* Photo */}
                      <div className="flex-shrink-0">
                        {entry.photo_urls && entry.photo_urls.length > 0 ? (
                          <img
                            src={entry.photo_urls[0]}
                            alt="Latest catch"
                            className="w-24 h-24 object-cover rounded-lg border-4 border-green-400 shadow-lg"
                          />
                        ) : (
                          <div className="w-24 h-24 bg-gradient-to-br from-blue-100 to-blue-200 rounded-lg border-4 border-gray-300 shadow-lg flex items-center justify-center">
                            <div className="text-center">
                              <div className="text-2xl mb-1">🎣</div>
                              <p className="text-xs text-gray-600">No photo</p>
                            </div>
                          </div>
                        )}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xl font-bold text-gray-900">Team #{entry.teams.team_number}</p>
                        <p className="text-xs text-gray-600 mb-2 truncate">
                          {entry.teams.competitor1_name} & {entry.teams.competitor2_name}
                          {entry.teams.competitor3_name && ` & ${entry.teams.competitor3_name}`}
                        </p>
                        <div className="bg-green-100 px-3 py-1.5 rounded-lg inline-block mb-2">
                          <p className="text-2xl font-bold text-green-600 leading-none">{entry.catfish_count}</p>
                          <p className="text-xs text-green-700">Catfish</p>
                        </div>
                        <div className="space-y-1">
                          <div className="flex flex-wrap gap-1">
                            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">Open</span>
                            {!entry.eligible && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-200 text-gray-600">Triple Team</span>
                            )}
                            {entry.teams.is_junior && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">Juniors</span>
                            )}
                            {entry.teams.is_women && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-pink-100 text-pink-800">Women</span>
                            )}
                            {entry.teams.is_mixed && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800">Mixed</span>
                            )}
                          </div>
                          <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
                            #{entry.overallRank} Overall
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* CATEGORY TABS — 4-col grid */}
        <div className="bg-white rounded-lg shadow-lg p-3 mb-6">
          <div className="grid grid-cols-4 gap-2">
            {[
              { id: 'All',     label: `🎯 All (${lbCounts?.total_teams ?? allTeams.length})` },
              { id: 'Women',   label: `👩 Women (${lbCounts?.women_teams ?? allTeams.filter(t => t.is_women).length})` },
              { id: 'Juniors', label: `🧒 Juniors (${lbCounts?.junior_teams ?? allTeams.filter(t => t.is_junior).length})` },
              { id: 'Mixed',   label: `🤝 Mixed (${lbCounts?.mixed_teams ?? allTeams.filter(t => t.is_mixed).length})` },
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setSelectedDivision(id)}
                className={`py-3 rounded-lg font-semibold text-sm transition ${
                  selectedDivision === id
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>


        {/* PRIZE FISH — different icons for heavy vs light */}
        {(heaviestFish || lightestFish) && (
          <div className="grid grid-cols-2 gap-4 mb-6">
            {heaviestFish && (
              <div className="bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg shadow-xl p-5 text-white">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl">⚖️</span>
                  <h3 className="text-base font-bold">Heaviest Fish</h3>
                </div>
                <p className="text-3xl font-bold">{heaviestFish.heaviest_fish_grams}g</p>
                <p className="text-sm mt-1 opacity-90">Team #{heaviestFish.team_number}</p>
                <p className="text-xs opacity-75 truncate">{heaviestFish.team_names}</p>
              </div>
            )}
            {lightestFish && (
              <div className="bg-gradient-to-br from-green-400 to-teal-500 rounded-lg shadow-xl p-5 text-white">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl">🪶</span>
                  <h3 className="text-base font-bold">Lightest Fish</h3>
                </div>
                <p className="text-3xl font-bold">{lightestFish.lightest_fish_grams}g</p>
                <p className="text-sm mt-1 opacity-90">Team #{lightestFish.team_number}</p>
                <p className="text-xs opacity-75 truncate">{lightestFish.team_names}</p>
              </div>
            )}
          </div>
        )}

        {/* STATS */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white rounded-lg shadow-lg p-4">
            <div className="flex items-center gap-1 text-blue-600 mb-1">
              <TrendingUp className="w-4 h-4" />
              <h3 className="font-semibold text-xs md:text-sm">Teams</h3>
            </div>
            <p className="text-2xl font-bold text-gray-900">{totalTeams}</p>
          </div>
          <div className="bg-gradient-to-br from-orange-500 to-red-500 rounded-lg shadow-lg p-4 text-white">
            <div className="flex items-center gap-1 mb-1 opacity-90">
              <span className="text-sm leading-none">🐟</span>
              <h3 className="font-semibold text-xs leading-tight">Catfish Eradicated</h3>
            </div>
            <p className="text-2xl font-bold">{totalCatfish.toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-lg shadow-lg p-4">
            <div className="flex items-center gap-1 text-blue-600 mb-1">
              <TrendingUp className="w-4 h-4" />
              <h3 className="font-semibold text-xs md:text-sm">Average</h3>
            </div>
            <p className="text-2xl font-bold text-gray-900">{avgCatfish}</p>
          </div>
        </div>

        {/* LEADERBOARD — table on desktop */}
        <div className="hidden md:block bg-white rounded-lg shadow-2xl overflow-hidden mb-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-blue-600 text-white">
                <tr>
                  <th className="px-4 py-3 text-left">Rank</th>
                  <th className="px-4 py-3 text-left">Team #</th>
                  <th className="px-4 py-3 text-left">Team</th>
                  <th className="px-4 py-3 text-left">Categories</th>
                  <th className="px-4 py-3 text-center">Catfish</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {rankedCatches.map((c, index) => (
                  <tr
                    key={c.id}
                    className={`border-b ${
                      c.status === 'disqualified'
                        ? 'bg-gray-100 text-gray-500'
                        : index % 2 === 0 ? 'bg-white' : 'bg-blue-50'
                    }`}
                  >
                    <td className="px-4 py-3 font-bold text-lg">
                      {c.rank === 1 ? '🥇' : c.rank === 2 ? '🥈' : c.rank === 3 ? '🥉' : c.rank}
                    </td>
                    <td className="px-4 py-3 font-medium">#{c.team_number}</td>
                    <td className="px-4 py-3">{c.team_names}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">Open</span>
                        {!c.eligible && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-200 text-gray-600">Triple Team</span>}
                        {c.is_junior && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">Juniors</span>}
                        {c.is_women && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-pink-100 text-pink-800">Women</span>}
                        {c.is_mixed && <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-800">Mixed</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-xl font-bold">{c.catfish_count}</td>
                    <td className="px-4 py-3">
                      {c.status === 'under_protest' && <span className="text-orange-600 font-semibold text-sm">Under Protest</span>}
                      {c.status === 'disqualified' && <span className="text-red-600 font-semibold text-sm">Disqualified</span>}
                    </td>
                  </tr>
                ))}
                {rankedCatches.length === 0 && (
                  <tr>
                    <td colSpan="6" className="px-4 py-8 text-center text-gray-500">
                      No scores yet. First team to weigh in will appear here!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* LEADERBOARD — cards on mobile */}
        <div className="md:hidden space-y-3 mb-6">
          {rankedCatches.length === 0 && (
            <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
              No scores yet. First team to weigh in will appear here!
            </div>
          )}
          {rankedCatches.map((c) => (
            <div
              key={c.id}
              className={`bg-white rounded-lg shadow-lg overflow-hidden ${
                c.status === 'disqualified' ? 'opacity-60' : ''
              }`}
            >
              {/* Colour strip for top 3 */}
              <div className={`h-1.5 ${
                c.rank === 1 ? 'bg-yellow-400' :
                c.rank === 2 ? 'bg-gray-300' :
                c.rank === 3 ? 'bg-amber-600' :
                'bg-blue-100'
              }`} />
              <div className="p-4 flex items-center gap-3">
                {/* Rank */}
                <div className="text-xl font-black text-blue-900 w-9 text-center flex-shrink-0">
                  {c.rank === 1 ? '🥇' : c.rank === 2 ? '🥈' : c.rank === 3 ? '🥉' : c.rank === '-' ? '—' : `#${c.rank}`}
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                    <span className="font-bold text-gray-900 text-sm">#{c.team_number}</span>
                    <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800">Open</span>
                    {!c.eligible && <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-gray-200 text-gray-600">Triple</span>}
                    {c.is_junior && <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-purple-100 text-purple-800">Jr</span>}
                    {c.is_women && <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-pink-100 text-pink-800">W</span>}
                    {c.is_mixed && <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-orange-100 text-orange-800">Mx</span>}
                  </div>
                  <p className="text-sm text-gray-600 truncate">{c.team_names}</p>
                  {c.status === 'under_protest' && <p className="text-xs text-orange-600 mt-0.5">Under Protest</p>}
                  {c.status === 'disqualified' && <p className="text-xs text-red-600 mt-0.5">Disqualified</p>}
                </div>
                {/* Catfish count */}
                <div className="text-right flex-shrink-0">
                  <p className="text-3xl font-black text-blue-900 leading-none">{c.catfish_count}</p>
                  <p className="text-xs text-gray-400">catfish</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <p className="text-center text-white text-sm pb-6 opacity-75">
          Auto-refreshes every 10 seconds • Last updated: {lastUpdated.toLocaleTimeString()}
        </p>

      </div>
    </div>
  )
}
