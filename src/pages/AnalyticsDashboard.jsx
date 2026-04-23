import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const SNZ_BLUE = '#2B6CB0'
const SNZ_DARK = '#1e3a5f'

const QUICK_ACTION_LABELS = {
  promo: '📣 Draft Facebook Promo',
  briefing: '🎤 Pre-Comp Briefing',
  safety: '🛟 Safety Checklist',
  results: '🏆 Results Announcement',
  weather: '🌦️ Weather Postponement',
  fishlist: '🐟 Fish List Advice',
  bring: '📋 What should I bring?',
  fish: '🐟 Fish & scoring rules',
  weighin: '⚖️ Weigh-in process',
  penalties: '⚠️ Penalties & DQs',
  area: '🗺️ Competition area',
}

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="text-2xl font-black text-gray-900">{value}</div>
      <div className="text-sm font-semibold text-gray-700 mt-0.5">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
    </div>
  )
}

function SectionHeader({ title }) {
  return <h2 className="text-base font-black text-gray-800 mb-3 mt-6">{title}</h2>
}

function BarRow({ label, count, max }) {
  const pct = max > 0 ? Math.round((count / max) * 100) : 0
  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="w-44 truncate text-gray-700 flex-shrink-0">{label}</div>
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: SNZ_BLUE }} />
      </div>
      <div className="w-8 text-right text-gray-500 font-semibold">{count}</div>
    </div>
  )
}

export default function AnalyticsDashboard() {
  const navigate = useNavigate()
  const [range, setRange] = useState('30')
  const [copilotEvents, setCopilotEvents] = useState([])
  const [pageViews, setPageViews] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const since = new Date(Date.now() - parseInt(range) * 24 * 60 * 60 * 1000).toISOString()
    setLoading(true)

    async function fetchAll(table) {
      const PAGE = 100
      let all = []
      let from = 0
      while (true) {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .gte('created_at', since)
          .order('created_at', { ascending: false })
          .range(from, from + PAGE - 1)
        if (error || !data?.length) break
        all = all.concat(data)
        if (data.length < PAGE) break
        from += PAGE
      }
      return all
    }

    Promise.all([fetchAll('copilot_events'), fetchAll('page_views')]).then(([copilotData, pageData]) => {
      setCopilotEvents(copilotData)
      setPageViews(pageData)
      setLoading(false)
    })
  }, [range])

  // Copilot stats
  const adminEvents = copilotEvents.filter(e => e.mode === 'admin')
  const competitorEvents = copilotEvents.filter(e => e.mode === 'competitor')

  const quickActionCounts = {}
  copilotEvents.forEach(e => {
    if (e.quick_action_id) {
      quickActionCounts[e.quick_action_id] = (quickActionCounts[e.quick_action_id] || 0) + 1
    }
  })
  const quickActionRows = Object.entries(quickActionCounts).sort((a, b) => b[1] - a[1])
  const maxQA = quickActionRows[0]?.[1] || 1

  const uniqueCopilotSessions = new Set(copilotEvents.map(e => e.session_id).filter(Boolean)).size
  const avgResponseMs = copilotEvents.length
    ? Math.round(copilotEvents.reduce((s, e) => s + (e.response_time_ms || 0), 0) / copilotEvents.length)
    : 0

  // Page view stats
  const uniquePVSessions = new Set(pageViews.map(v => v.session_id).filter(Boolean)).size

  const pathCounts = {}
  pageViews.forEach(v => {
    pathCounts[v.path] = (pathCounts[v.path] || 0) + 1
  })
  const topPages = Object.entries(pathCounts).sort((a, b) => b[1] - a[1]).slice(0, 10)
  const maxPage = topPages[0]?.[1] || 1

  const deviceCounts = {}
  pageViews.forEach(v => {
    if (v.device_type) deviceCounts[v.device_type] = (deviceCounts[v.device_type] || 0) + 1
  })

  const browserCounts = {}
  pageViews.forEach(v => {
    if (v.browser) browserCounts[v.browser] = (browserCounts[v.browser] || 0) + 1
  })
  const topBrowsers = Object.entries(browserCounts).sort((a, b) => b[1] - a[1])
  const maxBrowser = topBrowsers[0]?.[1] || 1

  return (
    <div className="min-h-screen bg-gray-50">
      <div style={{ background: SNZ_DARK }} className="px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-white">Analytics</h1>
          <p className="text-xs text-white/60">SNZ Hub usage & copilot activity</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={range}
            onChange={e => setRange(e.target.value)}
            className="text-sm border border-white/30 rounded-lg px-3 py-1.5 bg-white/10 text-white focus:outline-none"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
          <button onClick={() => navigate('/admin')} className="text-white/60 hover:text-white text-sm">← Admin</button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {loading ? (
          <div className="text-center text-gray-400 py-16">Loading…</div>
        ) : (
          <>
            {/* Copilot */}
            <SectionHeader title="Copilot Usage" />
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatCard label="Total conversations" value={copilotEvents.length} />
              <StatCard label="Admin Copilot" value={adminEvents.length} sub="comp organiser" />
              <StatCard label="Competitor Assistant" value={competitorEvents.length} sub="competitor-side" />
              <StatCard label="Unique sessions" value={uniqueCopilotSessions} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
              <StatCard
                label="Avg response time"
                value={avgResponseMs > 0 ? `${(avgResponseMs / 1000).toFixed(1)}s` : '—'}
              />
              <StatCard
                label="Quick action rate"
                value={copilotEvents.length > 0
                  ? `${Math.round((copilotEvents.filter(e => e.quick_action_id).length / copilotEvents.length) * 100)}%`
                  : '—'}
                sub="of messages via quick action"
              />
              <StatCard
                label="Free-text rate"
                value={copilotEvents.length > 0
                  ? `${Math.round((copilotEvents.filter(e => !e.quick_action_id).length / copilotEvents.length) * 100)}%`
                  : '—'}
                sub="of messages typed"
              />
            </div>

            {quickActionRows.length > 0 && (
              <>
                <SectionHeader title="Quick Actions Used" />
                <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
                  {quickActionRows.map(([id, count]) => (
                    <BarRow key={id} label={QUICK_ACTION_LABELS[id] || id} count={count} max={maxQA} />
                  ))}
                </div>
              </>
            )}

            {/* Recent copilot events */}
            {copilotEvents.length > 0 && (
              <>
                <SectionHeader title="Recent Copilot Messages" />
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-left text-xs text-gray-400">
                        <th className="px-4 py-2 font-semibold">When</th>
                        <th className="px-4 py-2 font-semibold">Mode</th>
                        <th className="px-4 py-2 font-semibold">Question</th>
                        <th className="px-4 py-2 font-semibold">Action</th>
                        <th className="px-4 py-2 font-semibold">ms</th>
                      </tr>
                    </thead>
                    <tbody>
                      {copilotEvents.slice(0, 20).map(e => (
                        <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="px-4 py-2 text-gray-400 whitespace-nowrap">
                            {new Date(e.created_at).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })}
                          </td>
                          <td className="px-4 py-2">
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                              e.mode === 'competitor' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                            }`}>
                              {e.mode === 'competitor' ? 'competitor' : 'admin'}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-gray-700 max-w-xs truncate">{e.question}</td>
                          <td className="px-4 py-2 text-gray-400 text-xs">{e.quick_action_id || '—'}</td>
                          <td className="px-4 py-2 text-gray-400">{e.response_time_ms || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* Page views */}
            <SectionHeader title="Page Views" />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <StatCard label="Total page views" value={pageViews.length} />
              <StatCard label="Unique sessions" value={uniquePVSessions} />
              <StatCard
                label="Avg views / session"
                value={uniquePVSessions > 0 ? (pageViews.length / uniquePVSessions).toFixed(1) : '—'}
              />
            </div>

            {topPages.length > 0 && (
              <>
                <SectionHeader title="Top Pages" />
                <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
                  {topPages.map(([path, count]) => (
                    <BarRow key={path} label={path} count={count} max={maxPage} />
                  ))}
                </div>
              </>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              {Object.keys(deviceCounts).length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <div className="text-sm font-black text-gray-700 mb-3">Device types</div>
                  <div className="space-y-2">
                    {Object.entries(deviceCounts).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                      <BarRow key={type} label={type} count={count} max={pageViews.length} />
                    ))}
                  </div>
                </div>
              )}
              {topBrowsers.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                  <div className="text-sm font-black text-gray-700 mb-3">Browsers</div>
                  <div className="space-y-2">
                    {topBrowsers.map(([browser, count]) => (
                      <BarRow key={browser} label={browser} count={count} max={maxBrowser} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
