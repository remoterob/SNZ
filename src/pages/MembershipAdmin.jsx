import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import { supabase, isAdmin, setAdminSession } from '../lib/supabase'

const SNZ_BLUE = '#2B6CB0'
const SNZ_LOGO = import.meta.env.VITE_SNZ_LOGO_URL || null

// ── Admin gate ────────────────────────────────────────────────────────────────
function RequireAdmin({ children }) {
  const location = useLocation()
  if (!isAdmin()) return <Navigate to="/admin/login" state={{ from: location.pathname }} replace />
  return children
}

// ── Member Admin ──────────────────────────────────────────────────────────────
export default function MembershipAdmin() {
  return (
    <RequireAdmin>
      <MemberAdminInner />
    </RequireAdmin>
  )
}

function MemberAdminInner() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('members')
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all') // 'all'|'active'|'pending'
  const [toast, setToast] = useState(null)

  // Password reset state
  const [resetTarget, setResetTarget] = useState(null)
  const [tempPwd, setTempPwd] = useState('')
  const [resetting, setResetting] = useState(false)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  useEffect(() => { fetchMembers() }, [])

  const fetchMembers = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('members')
      .select('*')
      .order('created_at', { ascending: false })
    setMembers(data || [])
    setLoading(false)
  }

  const filtered = members.filter(m => {
    const matchSearch = !search ||
      m.name?.toLowerCase().includes(search.toLowerCase()) ||
      m.email?.toLowerCase().includes(search.toLowerCase()) ||
      m.member_number?.toLowerCase().includes(search.toLowerCase()) ||
      m.club?.toLowerCase().includes(search.toLowerCase())
    const matchFilter =
      filter === 'all' ||
      (filter === 'active' && m.payment_status === 'paid') ||
      (filter === 'pending' && m.payment_status !== 'paid')
    return matchSearch && matchFilter
  })

  const exportCSV = () => {
    const headers = ['Member Number', 'Name', 'Email', 'Phone', 'Club', 'Gender', 'DOB',
      'Region', 'Experience', 'Emergency Contact', 'Emergency Phone',
      'Membership Status', 'Payment Status', 'Paid At', 'Joined']
    const esc = v => { const s = String(v || ''); return s.includes(',') ? `"${s}"` : s }
    const rows = [headers.join(',')]
    filtered.forEach(m => rows.push([
      m.member_number, m.name, m.email, m.phone, m.club, m.gender, m.dob,
      m.region, m.experience, m.emergency_contact, m.emergency_phone,
      m.membership_status, m.payment_status, m.paid_at,
      m.created_at ? new Date(m.created_at).toLocaleDateString('en-NZ') : ''
    ].map(esc).join(',')))
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `SNZ-Members-${new Date().toISOString().slice(0,10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
    showToast(`Exported ${filtered.length} members`)
  }

  const activateMember = async (m) => {
    if (!confirm(`Mark ${m.name || m.email} as active (paid)?`)) return
    const { error } = await supabase.from('members').update({
      payment_status: 'paid',
      membership_status: 'active',
      paid_at: new Date().toISOString(),
    }).eq('id', m.id)
    if (error) showToast(error.message, 'error')
    else { showToast(`${m.name || m.email} activated`); fetchMembers() }
  }

  const resetPassword = async () => {
    if (!resetTarget || tempPwd.length < 8) return
    setResetting(true)
    try {
      // Try sessionStorage first, fall back to VITE_ADMIN_PASSWORD env var
      const adminPassword = sessionStorage.getItem('snz_admin_session') || 
                           sessionStorage.getItem('admin_password') ||
                           import.meta.env.VITE_ADMIN_PASSWORD
      const res = await fetch('/.netlify/functions/admin-reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminPassword,
          memberId: resetTarget.id,
          tempPassword: tempPwd,
        })
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error)
      showToast(`✓ Password set for ${resetTarget.name}. Temp: ${tempPwd}`)
      setResetTarget(null)
      setTempPwd('')
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setResetting(false)
    }
  }

  const activeCount = members.filter(m => m.payment_status === 'paid').length
  const pendingCount = members.filter(m => m.payment_status !== 'paid').length

  return (
    <div className="min-h-screen bg-gray-50">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-semibold shadow-lg max-w-sm ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ background: SNZ_BLUE }} className="px-6 py-3 flex items-center justify-between border-b border-blue-700">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/membership')}
            className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
            ← Membership
          </button>
          <span className="text-blue-200 text-sm opacity-75">/ Member Admin</span>
        </div>
        {SNZ_LOGO && <img src={SNZ_LOGO} alt="SNZ" className="h-8 object-contain" style={{ filter: 'brightness(0) invert(1)' }} />}
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-200">
          {[['members','Members'],['whitelist','Fee Whitelist'],['analytics','Analytics']].map(([t,label]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-5 py-2.5 text-sm font-bold border-b-2 transition -mb-px ${tab===t ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === 'analytics' && <AnalyticsDashboard />}
        {tab === 'whitelist' && <WhitelistAdmin />}
        {tab === 'members' && (
          <div>
            <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-black text-gray-900">Member Administration</h1>
              <p className="text-sm text-gray-400 mt-0.5">
                {members.length} total · {activeCount} active · {pendingCount} pending payment
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={exportCSV}
                className="px-4 py-2 rounded-lg text-sm font-bold border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 transition">
                ↓ Export CSV
              </button>
              <RunBackupButton showToast={showToast} />
            </div>
          </div>

        {/* Filters */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-5 flex flex-wrap gap-3 items-center">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name, email, number, club…"
            className="flex-1 min-w-48 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          <div className="flex gap-2">
            {[['all', 'All'], ['active', 'Active'], ['pending', 'Pending payment']].map(([val, lbl]) => (
              <button key={val} onClick={() => setFilter(val)}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition ${filter === val ? 'text-white border-transparent' : 'border-gray-300 text-gray-500 hover:border-gray-400'}`}
                style={filter === val ? { background: SNZ_BLUE } : {}}>
                {lbl}
              </button>
            ))}
          </div>
        </div>

        {/* Password reset modal */}
        {resetTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}
            onClick={e => e.target === e.currentTarget && setResetTarget(null)}>
            <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl">
              <h3 className="font-black text-gray-900 mb-1">Set Temporary Password</h3>
              <p className="text-sm text-gray-500 mb-1">{resetTarget.name}</p>
              <p className="text-xs text-gray-400 mb-4">{resetTarget.email}</p>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-xs text-amber-800">
                Tell the member their temporary password directly — by phone or in person. They can change it from their membership dashboard.
              </div>
              <input type="text" value={tempPwd} onChange={e => setTempPwd(e.target.value)}
                placeholder="Temporary password (min 8 chars)"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 mb-4" />
              <div className="flex gap-3">
                <button onClick={() => { setResetTarget(null); setTempPwd('') }}
                  className="flex-1 py-2.5 rounded-xl border border-gray-300 text-sm font-bold text-gray-600">Cancel</button>
                <button onClick={resetPassword} disabled={resetting || tempPwd.length < 8}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
                  style={{ background: '#d97706' }}>
                  {resetting ? 'Setting…' : 'Set Password'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Members table */}
        {loading ? (
          <div className="text-center py-16 text-gray-400">Loading members…</div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {['Number', 'Name', 'Email', 'Club', 'Joined', 'Status', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold tracking-widest text-gray-400 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((m, i) => (
                  <tr key={m.id} className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                    <td className="px-4 py-3 text-xs font-mono text-gray-500">{m.member_number || '—'}</td>
                    <td className="px-4 py-3">
                      <p className="font-bold text-gray-900">{m.name || '—'}</p>
                      <p className="text-xs text-gray-400">{m.phone || ''}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">{m.email}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{m.club || '—'}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {m.created_at ? new Date(m.created_at).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' }) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${m.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                        {m.payment_status === 'paid' ? '● Active' : '⏳ Pending'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {m.payment_status !== 'paid' && (
                          <button onClick={() => activateMember(m)}
                            className="text-xs font-bold px-3 py-1.5 rounded-lg border border-green-300 text-green-700 hover:bg-green-50 whitespace-nowrap">
                            Activate
                          </button>
                        )}
                        <button onClick={() => { setResetTarget(m); setTempPwd('') }}
                          className="text-xs font-bold px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 whitespace-nowrap">
                          Reset pwd
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">No members found</td></tr>
                )}
              </tbody>
            </table>
            </div>
          )}
          </div>
        )}

      </div>
    </div>
  )
}

// ── Analytics Dashboard ───────────────────────────────────────────────────────
function AnalyticsDashboard() {
  const [stats, setStats] = useState(null)
  const [topPages, setTopPages] = useState([])
  const [recentViews, setRecentViews] = useState([])
  const [devices, setDevices] = useState([])
  const [browsers, setBrowsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [dateRange, setDateRange] = useState('7') // days

  useEffect(() => { fetchAnalytics() }, [dateRange])

  const fetchAnalytics = async () => {
    setLoading(true)
    const since = new Date()
    since.setDate(since.getDate() - parseInt(dateRange))
    const sinceISO = since.toISOString()

    const [totalRes, pagesRes, recentRes, deviceRes, browserRes] = await Promise.all([
      // Total views + unique sessions
      supabase.from('page_views').select('id, session_id, member_id', { count: 'exact' })
        .gte('created_at', sinceISO),
      // Top pages
      supabase.from('page_views').select('path')
        .gte('created_at', sinceISO)
        .limit(500),
      // Recent views with detail
      supabase.from('page_views')
        .select('path, created_at, device_type, browser, os, screen_width, member_id, duration_ms')
        .gte('created_at', sinceISO)
        .order('created_at', { ascending: false })
        .limit(200),
      // Device breakdown
      supabase.from('page_views').select('device_type')
        .gte('created_at', sinceISO).limit(1000),
      // Browser breakdown
      supabase.from('page_views').select('browser')
        .gte('created_at', sinceISO).limit(1000),
    ])

    const views = totalRes.data || []
    const uniqueSessions = new Set(views.map(v => v.session_id)).size
    const loggedInViews = views.filter(v => v.member_id).length

    // Aggregate top pages
    const pageCounts = {}
    ;(pagesRes.data || []).forEach(v => {
      pageCounts[v.path] = (pageCounts[v.path] || 0) + 1
    })
    const sortedPages = Object.entries(pageCounts)
      .sort((a,b) => b[1] - a[1]).slice(0, 15)

    // Device breakdown
    const devCounts = {}
    ;(deviceRes.data || []).forEach(v => {
      const k = v.device_type || 'unknown'
      devCounts[k] = (devCounts[k] || 0) + 1
    })

    // Browser breakdown
    const brCounts = {}
    ;(browserRes.data || []).forEach(v => {
      const k = v.browser || 'Unknown'
      brCounts[k] = (brCounts[k] || 0) + 1
    })

    setStats({ total: views.length, uniqueSessions, loggedInViews })
    setTopPages(sortedPages)
    setRecentViews(recentRes.data || [])
    setDevices(Object.entries(devCounts).sort((a,b) => b[1]-a[1]))
    setBrowsers(Object.entries(brCounts).sort((a,b) => b[1]-a[1]))
    setLoading(false)
  }

  const fmtPath = p => p === '/' ? 'Home' : p.replace(/^\//, '')
  const fmtDuration = ms => ms ? `${Math.round(ms/1000)}s` : '—'
  const fmtTime = ts => new Date(ts).toLocaleString('en-NZ', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })

  const maxPageCount = topPages[0]?.[1] || 1

  return (
    <div className="space-y-6">
      {/* Date range */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-gray-900">Analytics</h1>
        <div className="flex gap-2">
          {[['7','7 days'],['30','30 days'],['90','90 days']].map(([val,label]) => (
            <button key={val} onClick={() => setDateRange(val)}
              className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition ${dateRange===val ? 'text-white border-transparent' : 'border-gray-300 text-gray-500 hover:border-gray-400'}`}
              style={dateRange===val ? { background: SNZ_BLUE } : {}}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading analytics…</div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              ['Total Page Views', stats?.total?.toLocaleString(), 'Views in period'],
              ['Unique Sessions', stats?.uniqueSessions?.toLocaleString(), 'Distinct visitors'],
              ['Logged-in Views', stats?.loggedInViews?.toLocaleString(), 'Views by members'],
            ].map(([title, value, sub]) => (
              <div key={title} className="bg-white border border-gray-200 rounded-xl p-5">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{title}</p>
                <p className="text-3xl font-black text-gray-900">{value}</p>
                <p className="text-xs text-gray-400 mt-1">{sub}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* Top pages */}
            <div className="bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="font-black text-gray-900 mb-4">Top Pages</h3>
              <div className="space-y-2">
                {topPages.map(([path, count]) => (
                  <div key={path} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-semibold text-gray-700 truncate">{fmtPath(path)}</span>
                        <span className="text-xs font-black text-gray-900 ml-2 flex-shrink-0">{count}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${(count/maxPageCount)*100}%`, background: SNZ_BLUE }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-6">
              {/* Devices */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="font-black text-gray-900 mb-3">Devices</h3>
                <div className="space-y-2">
                  {devices.map(([type, count]) => {
                    const total = devices.reduce((s,[,c]) => s+c, 0)
                    return (
                      <div key={type} className="flex items-center justify-between">
                        <span className="text-sm capitalize text-gray-700">{type}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">{Math.round(count/total*100)}%</span>
                          <span className="text-sm font-bold text-gray-900">{count}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Browsers */}
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <h3 className="font-black text-gray-900 mb-3">Browsers</h3>
                <div className="space-y-2">
                  {browsers.map(([br, count]) => {
                    const total = browsers.reduce((s,[,c]) => s+c, 0)
                    return (
                      <div key={br} className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">{br}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">{Math.round(count/total*100)}%</span>
                          <span className="text-sm font-bold text-gray-900">{count}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Recent views */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="font-black text-gray-900">Recent Page Views</h3>
              <p className="text-xs text-gray-400 mt-0.5">Last 200 views — most recent first</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {['Time','Page','Device','Browser','OS','Screen','Duration','Member'].map(h => (
                      <th key={h} className="px-4 py-2 text-left text-xs font-bold tracking-widest text-gray-400 uppercase whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentViews.map((v, i) => (
                    <tr key={i} className={`border-b border-gray-50 ${i%2===0?'bg-white':'bg-gray-50/30'}`}>
                      <td className="px-4 py-2 text-xs text-gray-400 whitespace-nowrap">{fmtTime(v.created_at)}</td>
                      <td className="px-4 py-2 text-xs font-semibold text-gray-700 max-w-32 truncate">{fmtPath(v.path)}</td>
                      <td className="px-4 py-2 text-xs text-gray-500 capitalize">{v.device_type || '—'}</td>
                      <td className="px-4 py-2 text-xs text-gray-500">{v.browser || '—'}</td>
                      <td className="px-4 py-2 text-xs text-gray-500">{v.os || '—'}</td>
                      <td className="px-4 py-2 text-xs text-gray-400">{v.screen_width ? `${v.screen_width}×${v.screen_height}` : '—'}</td>
                      <td className="px-4 py-2 text-xs text-gray-400">{fmtDuration(v.duration_ms)}</td>
                      <td className="px-4 py-2 text-xs">
                        {v.member_id
                          ? <span className="text-green-600 font-bold">● Member</span>
                          : <span className="text-gray-300">Guest</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ── Whitelist Admin ───────────────────────────────────────────────────────────
function WhitelistAdmin() {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [newEmail, setNewEmail] = useState('')
  const [newName, setNewName] = useState('')
  const [newSource, setNewSource] = useState('manual')
  const [adding, setAdding] = useState(false)
  const [toast, setToast] = useState(null)
  const showToast = (msg, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),3000) }

  useEffect(() => { fetchWhitelist() }, [])

  const fetchWhitelist = async () => {
    setLoading(true)
    const { data } = await supabase.from('member_whitelist')
      .select('*').order('created_at', { ascending: false })
    setEntries(data || [])
    setLoading(false)
  }

  const addEntry = async () => {
    if (!newEmail.trim()) return
    setAdding(true)
    const { error } = await supabase.from('member_whitelist').insert({
      email: newEmail.trim().toLowerCase(),
      name: newName.trim() || null,
      source: newSource,
    })
    if (error) showToast(error.message, 'error')
    else { showToast('Added to whitelist'); setNewEmail(''); setNewName(''); fetchWhitelist() }
    setAdding(false)
  }

  const removeEntry = async (id, email) => {
    if (!confirm(`Remove ${email} from whitelist?`)) return
    await supabase.from('member_whitelist').delete().eq('id', id)
    showToast('Removed from whitelist')
    fetchWhitelist()
  }

  const exportCSV = () => {
    const rows = [['Email','Name','Source','Added'].join(',')]
    entries.forEach(e => rows.push([e.email, e.name||'', e.source||'', new Date(e.created_at).toLocaleDateString('en-NZ')].join(',')))
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob)
    a.download = 'SNZ-fee-whitelist.csv'; a.click(); URL.revokeObjectURL(a.href)
  }

  return (
    <div className="space-y-6">
      {toast && <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-semibold shadow-lg ${toast.type==='error'?'bg-red-600':'bg-green-600'} text-white`}>{toast.msg}</div>}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Fee Whitelist</h1>
          <p className="text-sm text-gray-400 mt-0.5">Members on this list sign up with the fee automatically waived</p>
        </div>
        <button onClick={exportCSV} className="px-4 py-2 rounded-lg text-sm font-bold border border-gray-300 text-gray-700 bg-white hover:bg-gray-50">↓ Export</button>
      </div>

      {/* Add new */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="text-sm font-black text-gray-700 mb-3">Add to Whitelist</h3>
        <div className="flex gap-2 flex-wrap">
          <input value={newEmail} onChange={e => setNewEmail(e.target.value)}
            placeholder="Email address" type="email"
            className="flex-1 min-w-48 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          <input value={newName} onChange={e => setNewName(e.target.value)}
            placeholder="Name (optional)"
            className="flex-1 min-w-32 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          <select value={newSource} onChange={e => setNewSource(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none">
            {['manual','nationals','worlds','catfish_cull'].map(s => (
              <option key={s} value={s}>{s.replace('_',' ')}</option>
            ))}
          </select>
          <button onClick={addEntry} disabled={adding || !newEmail.trim()}
            className="px-4 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-50"
            style={{ background: SNZ_BLUE }}>
            {adding ? 'Adding…' : '+ Add'}
          </button>
        </div>
      </div>

      {/* List */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm font-bold text-gray-700">{entries.length} entries</p>
        </div>
        {loading ? (
          <div className="py-10 text-center text-gray-400 text-sm">Loading…</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {['Email','Name','Source','Added',''].map(h => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-bold tracking-widest text-gray-400 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((e,i) => (
                <tr key={e.id} className={`border-b border-gray-50 ${i%2===0?'bg-white':'bg-gray-50/30'}`}>
                  <td className="px-4 py-2.5 text-sm text-gray-700">{e.email}</td>
                  <td className="px-4 py-2.5 text-sm text-gray-500">{e.name || '—'}</td>
                  <td className="px-4 py-2.5">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 capitalize">{(e.source||'').replace('_',' ')}</span>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-400">{new Date(e.created_at).toLocaleDateString('en-NZ')}</td>
                  <td className="px-4 py-2.5">
                    <button onClick={() => removeEntry(e.id, e.email)}
                      className="text-xs text-red-400 hover:text-red-600 font-bold">Remove</button>
                  </td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-400">No entries yet</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ── Run Backup Button ─────────────────────────────────────────────────────────
function RunBackupButton({ showToast }) {
  const [running, setRunning] = useState(false)

  const run = async () => {
    if (!confirm('Send backup CSVs to secretary@spearfishingnz.co.nz now?')) return
    setRunning(true)
    try {
      const res = await fetch('/.netlify/functions/daily-backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminPassword: sessionStorage.getItem('snz_admin_session') || import.meta.env.VITE_ADMIN_PASSWORD
        })
      })
      const text = await res.text()
      if (res.ok) showToast('Backup sent to secretary@spearfishingnz.co.nz ✓')
      else showToast('Backup failed: ' + text, 'error')
    } catch (err) {
      showToast('Backup failed: ' + err.message, 'error')
    } finally {
      setRunning(false)
    }
  }

  return (
    <button onClick={run} disabled={running}
      className="px-4 py-2 rounded-lg text-sm font-bold border border-blue-300 text-blue-700 bg-blue-50 hover:bg-blue-100 transition disabled:opacity-50 whitespace-nowrap">
      {running ? 'Sending…' : '📧 Send Backup'}
    </button>
  )
}
