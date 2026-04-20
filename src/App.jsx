import React, { useState, useEffect } from 'react'
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom'
import { supabase, isAdmin, setAdminSession } from './lib/supabase'
import { useAnalytics } from './lib/useAnalytics'
import PWAInstallPrompt from './components/PWAInstallPrompt'
import { useMemberSession } from './components/MemberAuthGate'

import PublicLeaderboard from './pages/PublicLeaderboard'
import AdminLogin from './pages/AdminLogin'
import AdminDashboard from './pages/AdminDashboard'
import TeamManagement from './pages/TeamManagement'
import WeighmasterInterface from './pages/WeighmasterInterface'
import CheckInDisplay from './pages/CheckInDisplay'
import ResultsManagement from './pages/ResultsManagement'
import RecordApplication from './pages/RecordApplication'
import CompetitionsPage from './pages/CompetitionsPage'
import MembershipRouter from './pages/MembershipPage'
import MembershipAdmin from './pages/MembershipAdmin'
import CompetitionDetail from './pages/CompetitionDetail'
import CompRegister from './pages/CompRegister'
import CompAdmin from './pages/CompAdmin'
import NationalsPage from './pages/NationalsPage'
import NationalsAdmin from './pages/NationalsAdmin'
import NationalsRegister from './pages/NationalsRegister'
import NationalsConfirm from './pages/NationalsConfirm'
import CatfishCullPage from './pages/CatfishCullPage'
import CompSuperAdmin from './pages/CompSuperAdmin'
import CompDeepLink from './pages/CompDeepLink'
import ApplicationArchive from './pages/ApplicationArchive'
import RecordsAdmin from './pages/RecordsAdmin'
import FishIDPage from './pages/FishIDPage'
import FishSpeciesAdmin from './pages/FishSpeciesAdmin'

function ProtectedRoute({ children }) {
  const location = useLocation()
  if (!isAdmin()) return <Navigate to="/admin/login" state={{ from: location.pathname }} replace />
  return children
}

const RECORD_DIVISIONS = ['All', 'Open', "Women's", 'Junior U18']
const SNZ_BLUE = '#2B6CB0'
const SNZ_LOGO = import.meta.env.VITE_SNZ_LOGO_URL || null

// ── Member badge — shown in blue nav bars across all pages ────────────────────
function MemberBadge() {
  const { member, session } = useMemberSession()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  if (!session) return (
    <button onClick={() => navigate('/membership/login')}
      className="flex items-center gap-1.5 text-white/70 hover:text-white text-xs font-semibold transition px-2 py-1 rounded-lg hover:bg-white/10">
      Sign in
    </button>
  )
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
        <div className="w-6 h-6 rounded-full bg-white/30 flex items-center justify-center text-white font-black text-xs flex-shrink-0">
          {member?.name?.[0]?.toUpperCase() || '?'}
        </div>
        <div className="text-left hidden sm:block">
          <div className="text-white font-bold text-xs leading-tight">{member?.name || 'Member'}</div>
          <div className="text-blue-200 text-xs leading-tight">{member?.member_number || 'SNZ Member'}</div>
        </div>
        <span className="text-white/50 text-xs ml-1">▾</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-44 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
          <button onClick={() => { setOpen(false); navigate('/') }}
            className="w-full text-left px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            ⌂ SNZ Hub
          </button>
          <button onClick={() => { setOpen(false); navigate('/membership/dashboard') }}
            className="w-full text-left px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            My Membership
          </button>
          <div className="border-t border-gray-100" />
          <button onClick={async () => { setOpen(false); await supabase.auth.signOut(); navigate('/') }}
            className="w-full text-left px-4 py-2.5 text-sm font-semibold text-red-500 hover:bg-red-50">
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

// White-background version for the Hub landing header
function HubMemberBadge() {
  const { member, session } = useMemberSession()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)

  if (!session) return (
    <button onClick={() => navigate('/membership/login')}
      className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition">
      Sign in
    </button>
  )
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition">
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white font-black text-xs flex-shrink-0"
          style={{ background: '#2B6CB0' }}>
          {member?.name?.[0]?.toUpperCase() || '?'}
        </div>
        <div className="text-left hidden sm:block">
          <div className="text-gray-900 font-bold text-xs leading-tight">{member?.name || 'Member'}</div>
          <div className="text-gray-400 text-xs leading-tight">{member?.member_number || 'SNZ Member'}</div>
        </div>
        <span className="text-gray-400 text-xs ml-1">▾</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-44 bg-white border border-gray-200 rounded-xl shadow-lg z-50 overflow-hidden">
          <button onClick={() => { setOpen(false); navigate('/membership/dashboard') }}
            className="w-full text-left px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">
            My Membership
          </button>
          <div className="border-t border-gray-100" />
          <button onClick={async () => { setOpen(false); await supabase.auth.signOut(); navigate('/') }}
            className="w-full text-left px-4 py-2.5 text-sm font-semibold text-red-500 hover:bg-red-50">
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}

const divBadgeClass = d =>
  d === 'Open'        ? 'bg-blue-50 text-blue-700 border border-blue-200' :
  d === "Women's"     ? 'bg-pink-50 text-pink-700 border border-pink-200' :
  d === 'Meritorious' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        'bg-purple-50 text-purple-700 border border-purple-200'


// ── Shared helpers ───────────────────────────────────────────────────────────
const SUPABASE_STORAGE = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/snz-media`
  : null

function PhotoModal({ url, caption, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.92)' }}
      onClick={onClose}
    >
      <div className="relative max-w-4xl w-full flex flex-col items-center" onClick={e => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-12 right-0 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white text-lg font-bold flex items-center justify-center transition"
        >✕</button>
        <img
          src={url}
          alt={caption || 'Record photo'}
          className="rounded-xl shadow-2xl object-contain max-h-[82vh] max-w-full"
        />
        {caption && (
          <p className="text-white/70 text-sm text-center mt-4 px-4">{caption}</p>
        )}
        <p className="text-white/30 text-xs mt-2">Press Esc or click outside to close</p>
      </div>
    </div>
  )
}

// ── NZ Records page (enhanced) ───────────────────────────────────────────────
function NZRecordsPage() {
  const navigate = useNavigate()
  const { session } = useMemberSession()
  const [filter, setFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('species') // 'species' | 'weight'
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lightbox, setLightbox] = useState(null)

  useEffect(() => {
    supabase
      .from('nz_records')
      .select('*')
      .order('species', { ascending: true })
      .then(({ data, error }) => {
        if (error) { setError('Failed to load records.'); console.error(error) }
        else setRecords(data || [])
        setLoading(false)
      })
  }, [])

  const filtered = records
    .filter(r =>
      r.division !== 'Meritorious' &&
      (filter === 'All' || r.division === filter) &&
      (search === '' ||
        r.species.toLowerCase().includes(search.toLowerCase()) ||
        (r.diver && r.diver.toLowerCase().includes(search.toLowerCase())))
    )
    .sort((a, b) => {
      if (sortBy === 'weight') return (b.weight_kg || 0) - (a.weight_kg || 0)
      return a.species.localeCompare(b.species)
    })

  const fmtWeight = (w) => w != null ? `${w} kg` : '—'

  return (
    <div className="min-h-screen bg-white">
      {lightbox && <PhotoModal url={lightbox.url} caption={lightbox.caption} onClose={() => setLightbox(null)} />}

      <div style={{ background: SNZ_BLUE }} className="px-6 py-3 flex items-center justify-between border-b border-blue-700">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">← SNZ Hub</button>
          <span className="text-blue-200 text-sm opacity-75">/ NZ Records</span>
        </div>
        <div className="flex items-center gap-2">
          <MemberBadge />
          <button onClick={() => navigate('/records/admin')}
            className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">⚙ Admin</button>
        </div>
      </div>

      <header className="border-b border-gray-200 px-6 py-4 bg-white flex items-center gap-4">
        {SNZ_LOGO && <img src={SNZ_LOGO} alt="Spearfishing NZ" className="h-10 w-auto object-contain" />}
        <div>
          <h1 className="text-2xl font-black text-gray-900">NZ Spearfishing Records</h1>
          <p className="text-xs text-gray-400 tracking-wider">Official records ratified by Spearfishing New Zealand</p>
        </div>
        <div className="ml-auto flex items-center gap-3 flex-wrap justify-end">
          <button
            onClick={() => session ? navigate('/apply') : navigate('/membership/login')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white transition hover:opacity-90"
            style={{ background: '#16a34a' }}
          >+ Submit a Record Claim</button>
          <button
            onClick={() => navigate('/awards')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold border border-gray-300 text-gray-600 hover:border-gray-400 hover:bg-gray-50 transition"
          >🏆 Annual Awards</button>
        </div>
      </header>

      <div className="max-w-5xl mx-auto p-6">
        {/* Filters */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 mb-6 flex flex-wrap gap-3 items-center">
          <input
            type="text"
            placeholder="Search species or diver..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-white border border-gray-300 text-gray-900 placeholder-gray-400 rounded-lg px-4 py-2 text-sm flex-1 min-w-48 focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <div className="flex gap-2 flex-wrap">
            {RECORD_DIVISIONS.map(d => (
              <button key={d} onClick={() => setFilter(d)}
                className="px-3 py-1.5 rounded-lg text-sm font-semibold transition border"
                style={filter === d
                  ? { background: SNZ_BLUE, color: '#fff', borderColor: SNZ_BLUE }
                  : { background: '#fff', color: '#374151', borderColor: '#d1d5db' }}
              >{d}</button>
            ))}
          </div>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value)}
            className="bg-white border border-gray-300 text-gray-700 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
          >
            <option value="species">Sort: A–Z</option>
            <option value="weight">Sort: Heaviest</option>
          </select>
          <span className="text-xs text-gray-400">{loading ? '…' : `${filtered.length} records`}</span>
        </div>

        {loading && <div className="text-center py-16 text-gray-400">Loading records…</div>}
        {error && <div className="text-center py-16 text-red-500">{error}</div>}

        {!loading && !error && (
          <>
            {/* Desktop table */}
            <div className="hidden md:block bg-white border border-gray-200 rounded-xl overflow-hidden mb-6 shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px]">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-3 py-3 w-12"></th>
                    {['Species','Record','Division','Diver','Club','Location','Date'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-bold tracking-widest text-gray-400 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => (
                    <tr key={r.id} className={`border-b border-gray-100 hover:bg-blue-50 transition ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}>
                      <td className="px-3 py-2">
                        {r.photo_url ? (
                          <button
                            onClick={() => setLightbox({ url: r.photo_url, caption: `${r.species} — ${r.diver} · ${r.weight_kg} kg · ${r.location}` })}
                            className="relative group w-12 h-12 flex-shrink-0 block"
                            title="View photo"
                          >
                            <img
                              src={r.photo_url}
                              alt={r.species}
                              className="w-12 h-12 object-cover rounded-lg border border-gray-200 group-hover:border-blue-400 transition group-hover:brightness-75"
                            />
                            <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-white text-base">
                              🔍
                            </span>
                          </button>
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-200 text-xl">🐟</div>
                        )}
                      </td>
                      <td className="px-4 py-3 font-bold text-gray-900">
                        <div className="flex items-center gap-2 flex-wrap">
                          {r.species}
                          {r.provisional && (
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 whitespace-nowrap">
                              Provisional
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xl font-black" style={{ color: SNZ_BLUE }}>{fmtWeight(r.weight_kg)}</td>
                      <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-bold ${divBadgeClass(r.division)}`}>{r.division}</span></td>
                      <td className="px-4 py-3 text-gray-700">{r.diver}</td>
                      <td className="px-4 py-3 text-gray-400 text-sm">{r.club}</td>
                      <td className="px-4 py-3 text-gray-400 text-sm">{r.location}</td>
                      <td className="px-4 py-3 text-gray-400 text-sm">{r.date_caught}</td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-400">No records match your search</td></tr>
                  )}
                </tbody>
              </table>
              </div>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-2 mb-6">
              {filtered.map((r) => (
                <div key={r.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm flex items-center gap-3 p-3">
                  {/* Thumbnail */}
                  <div className="flex-shrink-0">
                    {r.photo_url ? (
                      <button
                        onClick={() => setLightbox({ url: r.photo_url, caption: `${r.species} — ${r.diver} · ${r.weight_kg} kg · ${r.location}` })}
                        className="relative group block w-16 h-16"
                      >
                        <img
                          src={r.photo_url}
                          alt={r.species}
                          className="w-16 h-16 object-cover rounded-lg border border-gray-200 group-active:brightness-75 transition"
                        />
                        <span className="absolute inset-0 flex items-center justify-center rounded-lg opacity-0 group-active:opacity-100 bg-black/30 transition text-white text-xl">🔍</span>
                      </button>
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center text-2xl text-gray-200">🐟</div>
                    )}
                  </div>
                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                        <span className="font-bold text-gray-900 text-sm leading-tight truncate">{r.species}</span>
                        {r.provisional && (
                          <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 whitespace-nowrap flex-shrink-0">Provisional</span>
                        )}
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold flex-shrink-0 ${divBadgeClass(r.division)}`}>{r.division}</span>
                    </div>
                    <div className="text-lg font-black leading-tight" style={{ color: SNZ_BLUE }}>{fmtWeight(r.weight_kg)}</div>
                    <div className="text-xs font-semibold text-gray-700 truncate">{r.diver}</div>
                    <div className="text-xs text-gray-400 truncate">{r.location} · {r.date_caught}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Submit */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
          <p className="text-sm text-gray-600 leading-relaxed mb-4">
            Do you have a NEW SPEARFISHING RECORD? Submit your claim online, or download the PDF form and email it in.
          </p>
          <div className="flex flex-wrap gap-3 mb-4">
            <button
              onClick={() => session ? navigate('/apply') : navigate('/membership/login')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm text-white transition hover:opacity-90"
              style={{ background: SNZ_BLUE }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Apply Online
            </button>
            <a
              href="https://zodqgekuackcrqyzluoo.supabase.co/storage/v1/object/public/snz-media/awards/nz%20spearfishing%20record%20application%20form%20v2018%20(1).pdf"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-bold text-sm border-2 border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
              Download PDF Form
            </a>
          </div>
          <p className="text-xs text-gray-400">
            Email completed PDF forms and photos to{' '}
            <a href="mailto:records@spearfishingnz.co.nz" className="underline font-semibold" style={{ color: SNZ_BLUE }}>records@spearfishingnz.co.nz</a>
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Annual Awards page ───────────────────────────────────────────────────────
function AwardsPage() {
  const navigate = useNavigate()
  const [awards, setAwards] = useState([])
  const [meritorious, setMeritorious] = useState([])
  const [year, setYear] = useState(new Date().getFullYear())
  const [years, setYears] = useState([])
  const [loading, setLoading] = useState(true)
  const [merLoading, setMerLoading] = useState(true)
  const [lightbox, setLightbox] = useState(null)
  const [merSearch, setMerSearch] = useState('')
  const [merLightbox, setMerLightbox] = useState(null)

  useEffect(() => {
    supabase.from('snz_awards').select('year').order('year', { ascending: false })
      .then(({ data }) => {
        if (data) {
          const unique = [...new Set(data.map(r => r.year))]
          setYears(unique)
          if (unique.length > 0) setYear(unique[0])
        }
      })
    // Fetch all meritorious records
    supabase.from('nz_records').select('*').eq('division', 'Meritorious').order('date_caught', { ascending: false })
      .then(({ data }) => { setMeritorious(data || []); setMerLoading(false) })
  }, [])

  useEffect(() => {
    if (!year) return
    setLoading(true)
    supabase.from('snz_awards').select('*').eq('year', year).order('category')
      .then(({ data }) => { setAwards(data || []); setLoading(false) })
  }, [year])

  const categoryIcon = (cat) => {
    if (cat.toLowerCase().includes('meritorious')) return '⭐'
    if (cat.toLowerCase().includes('snapper')) return '🐠'
    if (cat.toLowerCase().includes('kingfish')) return '🐟'
    return '🏆'
  }

  const filteredMer = meritorious.filter(r =>
    merSearch === '' ||
    r.species.toLowerCase().includes(merSearch.toLowerCase()) ||
    (r.diver || '').toLowerCase().includes(merSearch.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-white">
      {lightbox && <PhotoModal url={lightbox.url} caption={lightbox.caption} onClose={() => setLightbox(null)} />}

      <div style={{ background: SNZ_BLUE }} className="px-6 py-3 flex items-center justify-between border-b border-blue-700">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/records')} className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">← NZ Records</button>
          <span className="text-blue-200 text-sm opacity-75">/ Annual Awards</span>
        </div>
        <div className="flex items-center gap-2">
          <MemberBadge />
          <button onClick={() => navigate('/records/admin')}
            className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">⚙ Admin</button>
        </div>
      </div>

      <header className="border-b border-gray-200 px-6 py-6 bg-white">
        <div className="max-w-3xl mx-auto flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-black text-gray-900 mb-1">Annual Awards</h1>
            <p className="text-gray-400 text-sm">Spearfishing New Zealand · Year in Review</p>
          </div>

        </div>
      </header>

      <div className="max-w-3xl mx-auto p-6">

        {/* ── Meritorious Fish ── */}
        <div className="mt-10">
          <div className="mb-4">
            <h2 className="text-2xl font-black text-gray-900 flex items-center gap-2">⭐ Meritorious Fish</h2>
            <p className="text-sm text-gray-400 mt-1">Exceptional or unusual catches recognised by Spearfishing New Zealand</p>
          </div>

          {/* Search */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-4 flex gap-3 items-center">
            <input
              type="text"
              placeholder="Search species or diver..."
              value={merSearch}
              onChange={e => setMerSearch(e.target.value)}
              className="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <span className="text-xs text-gray-400">{merLoading ? '…' : `${filteredMer.length} entries`}</span>
          </div>

          {merLoading && <div className="text-center py-8 text-gray-400">Loading…</div>}

          {!merLoading && filteredMer.length === 0 && (
            <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-xl">No meritorious fish recorded yet.</div>
          )}

          {!merLoading && filteredMer.length > 0 && (
            <>
              {/* Desktop table */}
              <div className="hidden md:block bg-white border border-gray-200 rounded-xl overflow-hidden mb-4 shadow-sm">
                <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-amber-50">
                      <th className="px-3 py-3 w-12"></th>
                      {['Species','Weight','Diver','Club','Location','Date'].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-bold tracking-widest text-amber-700 uppercase">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMer.map((r, i) => (
                      <tr key={r.id} className={`border-b border-gray-100 hover:bg-amber-50 transition ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                        <td className="px-3 py-2">
                          {r.photo_url ? (
                            <button onClick={() => setMerLightbox({ url: r.photo_url, caption: `${r.species} — ${r.diver}${r.weight_kg ? ` · ${r.weight_kg} kg` : ''} · ${r.location}` })}
                              className="relative group block w-12 h-12">
                              <img src={r.photo_url} alt={r.species} className="w-12 h-12 object-cover rounded-lg border-2 border-amber-300 group-hover:brightness-75 transition"/>
                              <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition text-white text-base">🔍</span>
                            </button>
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-xl">⭐</div>
                          )}
                        </td>
                        <td className="px-4 py-3 font-bold text-gray-900">
                        <div className="flex items-center gap-2 flex-wrap">
                          {r.species}
                          {r.provisional && (
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 whitespace-nowrap">
                              Provisional
                            </span>
                          )}
                        </div>
                      </td>
                        <td className="px-4 py-3 font-bold text-amber-600">{r.weight_kg ? `${r.weight_kg} kg` : '—'}</td>
                        <td className="px-4 py-3 text-gray-700">{r.diver}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{r.club}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{r.location}</td>
                        <td className="px-4 py-3 text-gray-400 text-xs">{r.date_caught}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-2 mb-4">
                {filteredMer.map(r => (
                  <div key={r.id} className="bg-white border border-amber-200 rounded-xl overflow-hidden shadow-sm flex items-center gap-3 p-3">
                    <div className="flex-shrink-0">
                      {r.photo_url ? (
                        <button onClick={() => setMerLightbox({ url: r.photo_url, caption: `${r.species} — ${r.diver}` })}
                          className="relative group block w-16 h-16">
                          <img src={r.photo_url} alt={r.species} className="w-16 h-16 object-cover rounded-lg border-2 border-amber-300 group-active:brightness-75 transition"/>
                        </button>
                      ) : (
                        <div className="w-16 h-16 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center text-2xl">⭐</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 text-sm truncate">{r.species}</p>
                      {r.weight_kg && <p className="font-black text-amber-600">{r.weight_kg} kg</p>}
                      <p className="text-xs font-semibold text-gray-700 truncate">{r.diver}</p>
                      <p className="text-xs text-gray-400 truncate">{r.location} · {r.date_caught}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Meritorious lightbox */}
          {merLightbox && <PhotoModal url={merLightbox.url} caption={merLightbox.caption} onClose={() => setMerLightbox(null)} />}
        </div>
      </div>
    </div>
  )
}

// ── News page ────────────────────────────────────────────────────────────────
function NewsPage() {
  const navigate = useNavigate()
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('snz_news').select('*').eq('published', true)
      .order('published_at', { ascending: false })
      .then(({ data }) => { setPosts(data || []); setLoading(false) })
  }, [])

  const fmtDate = (d) => new Date(d).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' })

  const categoryBadge = (cat) => {
    if (cat === 'record') return { label: 'New Record', cls: 'bg-blue-50 text-blue-700 border border-blue-200' }
    if (cat === 'event') return { label: 'Event', cls: 'bg-orange-50 text-orange-700 border border-orange-200' }
    return { label: 'News', cls: 'bg-green-50 text-green-700 border border-green-200' }
  }

  return (
    <div className="min-h-screen bg-white">
      <div style={{ background: SNZ_BLUE }} className="px-6 py-3 flex items-center justify-between border-b border-blue-700">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')} className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">← SNZ Hub</button>
          <span className="text-blue-200 text-sm opacity-75">/ News & Updates</span>
        </div>
        <MemberBadge />
      </div>
      <header className="border-b border-gray-200 px-6 py-6 bg-white">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-black text-gray-900">News & Updates</h1>
          <p className="text-gray-400 text-sm mt-1">Latest from Spearfishing New Zealand</p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto p-6">
        {loading && <div className="text-center py-16 text-gray-400">Loading…</div>}
        {!loading && posts.length === 0 && (
          <div className="text-center py-16 text-gray-400">No posts yet.</div>
        )}
        {!loading && posts.map(p => {
          const badge = categoryBadge(p.category)
          return (
            <article key={p.id} className="mb-6 bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              {p.photo_url && <img src={p.photo_url} alt={p.title} className="w-full h-52 object-cover" />}
              <div className="p-6">
                <div className="flex items-center gap-3 mb-3">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
                  <span className="text-xs text-gray-400">{fmtDate(p.published_at)}</span>
                  {p.author && <span className="text-xs text-gray-400">· {p.author}</span>}
                </div>
                <h2 className="text-xl font-black text-gray-900 mb-3">{p.title}</h2>
                <p className="text-gray-600 leading-relaxed text-sm whitespace-pre-line">{p.body}</p>
              </div>
            </article>
          )
        })}
      </div>
    </div>
  )
}


function SNZHub() {
  const navigate = useNavigate()

  const modules = [
    {
      num: '01', title: 'Membership',
      desc: 'Join SNZ — a small annual fee supports your national body. Manage your profile, track your competition history, and access member benefits.',
      onClick: () => navigate('/membership'),
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={SNZ_BLUE} strokeWidth="1.8" strokeLinecap="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
    },
    {
      num: '02', title: 'NZ Records',
      desc: 'Official national spearfishing records by species, division, and category. Submit and verify new claims.',
      onClick: () => navigate('/records'),
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={SNZ_BLUE} strokeWidth="1.8" strokeLinecap="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
    },
    {
      num: '03', title: 'Catfish Cull',
      desc: 'Rosemergy Catfish Cull · Motuoapa, Lake Taupō · 13 Feb 2027. Registration, 2026 results, event info and admin.',
      onClick: () => navigate('/catfish'),
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={SNZ_BLUE} strokeWidth="1.8" strokeLinecap="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>,
    },
    {
      num: '04', title: 'National Championships',
      desc: 'Tairua, Coromandel · 19–24 Jan 2027 · 8 events including Open, Juniors, Women\'s, Fin Swim, Photography, Silver & Golden Oldie, and Super Diver.',
      onClick: () => navigate('/nationals'),
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={SNZ_BLUE} strokeWidth="1.8" strokeLinecap="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg>,
    },
    {
      num: '05', title: 'Other Competitions',
      desc: 'Club competitions — register your team, view fish lists, live leaderboard, and results.',
      onClick: () => navigate('/competitions'),
      icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={SNZ_BLUE} strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>,
    },
  ]


  return (
    <div className="min-h-screen bg-white flex flex-col">
{/* Header with logo */}
      <header className="border-b border-gray-200 px-6 py-5 flex items-center justify-between bg-white">
        <div className="flex items-center gap-4">
          {SNZ_LOGO
            ? <img src={SNZ_LOGO} alt="Spearfishing NZ" className="h-16 w-auto object-contain" />
            : <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
                <path d="M18 48 Q10 36 13 26 Q16 16 24 11" stroke="#111" strokeWidth="2" fill="none" strokeLinecap="round"/>
                <path d="M18 48 L23 45 L20 37 L27 34 L25 27 L30 24" stroke={SNZ_BLUE} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="8" y1="7" x2="30" y2="42" stroke="#111" strokeWidth="2.5" strokeLinecap="round"/>
                <circle cx="8" cy="7" r="3" fill={SNZ_BLUE}/>
              </svg>
          }
          <div>
            <div className="text-2xl font-black tracking-wide text-gray-900 leading-none">Spearfishing NZ</div>
          </div>
        </div>
        <HubMemberBadge />
      </header>

      {/* Hero */}
      <section className="px-6 py-14 bg-gray-50 border-b border-gray-200">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl sm:text-5xl font-black text-gray-900 leading-tight mb-4">
            Your national<br/>
            <span style={{ color: SNZ_BLUE }}>spearfishing hub</span>
          </h1>
          <p className="text-gray-500 max-w-md leading-relaxed">
            Membership, records, competition management, and event results — all in one place for New Zealand's spearfishing community.
          </p>
        </div>
      </section>

      {/* Modules */}
      <section className="px-6 py-10 flex-1">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-6">What would you like to do?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {modules.map((m) => (
              <button
                key={m.num}
                onClick={m.onClick}
                disabled={m.soon}
                className={`relative text-left p-6 rounded-2xl border-2 flex flex-col gap-4 transition-all group
                  ${m.soon ? 'border-gray-100 bg-gray-50 cursor-default opacity-60' : 'border-gray-200 bg-white hover:shadow-md cursor-pointer'}
                `}
                style={!m.soon ? { borderColor: undefined } : {}}
                onMouseEnter={e => { if (!m.soon) e.currentTarget.style.borderColor = SNZ_BLUE }}
                onMouseLeave={e => { if (!m.soon) e.currentTarget.style.borderColor = '#e5e7eb' }}
              >
                {m.soon && (
                  <span className="absolute top-4 right-4 text-xs font-bold tracking-widest text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full uppercase">
                    Coming Soon
                  </span>
                )}
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-blue-50 border border-blue-100">
                  {m.icon}
                </div>
                <div>
                  <div className="text-xl font-black text-gray-900 mb-2">{m.title}</div>
                  <p className="text-sm text-gray-500 leading-relaxed">{m.desc}</p>
                </div>
                {!m.soon && (
                  <div className="flex items-center gap-1 mt-auto font-bold text-sm" style={{ color: SNZ_BLUE }}>
                    Open <span className="group-hover:translate-x-1 transition-transform inline-block">→</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      </section>


      {/* Footer */}
      <footer className="border-t border-gray-200 px-6 py-5 bg-gray-50">
        <div className="max-w-4xl mx-auto flex flex-wrap justify-between items-center gap-2">
          <span className="text-xs text-gray-400">© {new Date().getFullYear()} Spearfishing New Zealand Inc · Incorporated Society</span>
          <div className="flex gap-4 text-xs text-gray-400">
<a href="mailto:spearfishingnewzealand@gmail.com" className="hover:text-gray-600 transition">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

function AnalyticsTracker() {
  const { member } = useMemberSession()
  useAnalytics(member?.id || null)
  return null
}

export default function App() {
  return (
    <>
    <Routes>
      <Route path="/"              element={<SNZHub />} />
      <Route path="/records"       element={<NZRecordsPage />} />
      <Route path="/apply"         element={<RecordApplication />} />
      <Route path="/records/admin"   element={<ProtectedRoute><RecordsAdmin /></ProtectedRoute>} />
      <Route path="/records/admin/archive/:id" element={<ProtectedRoute><ApplicationArchive /></ProtectedRoute>} />
      <Route path="/fish-id"         element={<FishIDPage />} />
      <Route path="/fish-id/admin"   element={<ProtectedRoute><FishSpeciesAdmin /></ProtectedRoute>} />
      <Route path="/awards"        element={<AwardsPage />} />
      <Route path="/news"          element={<NewsPage />} />
      <Route path="/leaderboard"   element={<PublicLeaderboard />} />
      <Route path="/catfish"        element={<CatfishCullPage />} />
      <Route path="/membership/admin"       element={<MembershipAdmin />} />
      <Route path="/membership/*"           element={<MembershipRouter />} />
      <Route path="/membership/invited"       element={<MembershipRouter />} />
      <Route path="/nationals"              element={<NationalsPage />} />
      <Route path="/nationals/admin"         element={<ProtectedRoute><NationalsAdmin /></ProtectedRoute>} />
      <Route path="/nationals/register"      element={<NationalsRegister />} />
      <Route path="/nationals/confirm"       element={<NationalsConfirm />} />
      <Route path="/competitions"           element={<CompetitionsPage />} />
      <Route path="/competitions/admin"     element={<CompSuperAdmin />} />
      <Route path="/competitions/:id"       element={<CompetitionDetail />} />
      <Route path="/competitions/:id/register" element={<CompRegister />} />
      <Route path="/competitions/:id/admin" element={<CompAdmin />} />
      <Route path="/c/:id" element={<CompDeepLink />} />
      <Route path="/checkin"       element={<CheckInDisplay />} />
      <Route path="/admin/login"   element={<AdminLogin />} />
      <Route path="/admin"         element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/teams"   element={<ProtectedRoute><TeamManagement /></ProtectedRoute>} />
      <Route path="/admin/weighin" element={<ProtectedRoute><WeighmasterInterface /></ProtectedRoute>} />
      <Route path="/admin/results" element={<ProtectedRoute><ResultsManagement /></ProtectedRoute>} />
      <Route path="*"              element={<Navigate to="/" replace />} />
    </Routes>
    <AnalyticsTracker />
    <PWAInstallPrompt />
    </>
  )
}
