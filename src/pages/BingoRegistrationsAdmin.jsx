import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, clearAdminSession } from '../lib/supabase'
import { toCSV, downloadCSV } from '../lib/csvExport'
import { pointsMapFromSpecies, pointsForSlug, isBonusSlug } from '../lib/bingo/helpers'

const SNZ_BLUE = '#2B6CB0'
const API = '/.netlify/functions/bingo-registrations-admin'

const fmtDate = iso => iso
  ? new Date(iso).toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' })
  : ''

const ageFrom = (dob) => {
  if (!dob) return ''
  const d = new Date(dob)
  if (isNaN(d)) return ''
  const now = new Date()
  let a = now.getFullYear() - d.getFullYear()
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) a--
  return a
}

const SORTS = [
  { value: 'recent',  label: 'Newest first' },
  { value: 'score',   label: 'Score' },
  { value: 'name',    label: 'Name' },
  { value: 'claims',  label: 'Claims' },
]

const EXPORT_COLUMNS = [
  { label: 'Name',            key: 'name' },
  { label: 'Member #',        key: 'member_number' },
  { label: 'Email',           key: 'email' },
  { label: 'Phone',           key: 'phone' },
  { label: 'Club',            key: 'club' },
  { label: 'Region',          key: 'region' },
  { label: 'Experience',      key: 'experience' },
  { label: 'Gender',          key: 'gender' },
  { label: 'Age',             value: r => ageFrom(r.dob) },
  { label: 'Membership',      key: 'membership_status' },
  { label: 'Season',          key: 'comp_season' },
  { label: 'Registered',      value: r => fmtDate(r.created_at) },
  { label: 'Rules accepted',  value: r => fmtDate(r.rules_accepted_at) },
  { label: 'Claims',          value: r => r.claimCount },
  { label: 'Score',           value: r => r.score },
  { label: 'Last claim',      value: r => fmtDate(r.lastClaim) },
]

export default function BingoRegistrationsAdmin() {
  const navigate = useNavigate()
  const pw = import.meta.env.VITE_BINGO_ADMIN_PASSWORD || import.meta.env.VITE_ADMIN_PASSWORD

  const [seasons, setSeasons] = useState([])
  const [season, setSeason] = useState('')
  const [regs, setRegs] = useState(null)
  const [claims, setClaims] = useState([])
  const [pMap, setPMap] = useState(new Map())
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState('recent')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('bingo_comp_config').select('season, is_active, created_at')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const rows = data || []
        setSeasons(rows)
        setSeason(rows.find(r => r.is_active)?.season || rows[0]?.season || '')
      })
  }, [])

  // Species points — public read, scored with the app's own helpers so the
  // numbers here match what divers see on the leaderboard.
  useEffect(() => {
    supabase.from('bingo_species').select('slug, points')
      .then(({ data }) => setPMap(pointsMapFromSpecies(data || [])))
  }, [])

  useEffect(() => {
    if (!season) return
    setRegs(null)
    setError('')
    ;(async () => {
      try {
        const res = await fetch(API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ adminPassword: pw, season }),
        })
        const text = await res.text()
        let data
        try { data = JSON.parse(text) } catch {
          throw new Error(res.status === 404
            ? 'Admin service not reachable. Netlify Functions don\'t run under the local dev server — try the deployed site.'
            : `Admin service error (${res.status}).`)
        }
        if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
        setRegs(data.rows)
      } catch (e) {
        setError(e.message)
        setRegs([])
      }
    })()

    supabase.from('bingo_claims')
      .select('user_id, species_slug, first_time, created_at')
      .eq('comp_season', season)
      .then(({ data }) => setClaims(data || []))
  }, [season, pw])

  // Claim count / score / last claim per diver.
  const byUser = useMemo(() => {
    const m = {}
    for (const c of claims) {
      const u = c.user_id
      if (!u) continue
      if (!m[u]) m[u] = { claimCount: 0, score: 0, lastClaim: null }
      const base = pointsForSlug(c.species_slug, pMap)
      m[u].claimCount++
      m[u].score += isBonusSlug(c.species_slug) ? base : base * (c.first_time ? 2 : 1)
      if (!m[u].lastClaim || c.created_at > m[u].lastClaim) m[u].lastClaim = c.created_at
    }
    return m
  }, [claims, pMap])

  const rows = useMemo(() => {
    const merged = (regs || []).map(r => ({
      ...r,
      claimCount: byUser[r.user_id]?.claimCount || 0,
      score: byUser[r.user_id]?.score || 0,
      lastClaim: byUser[r.user_id]?.lastClaim || null,
    }))
    const q = search.trim().toLowerCase()
    const filtered = q
      ? merged.filter(r => [r.name, r.email, r.club, r.region]
          .filter(Boolean).some(v => v.toLowerCase().includes(q)))
      : merged
    const sorted = [...filtered]
    if (sort === 'score')  sorted.sort((a, b) => b.score - a.score)
    if (sort === 'claims') sorted.sort((a, b) => b.claimCount - a.claimCount)
    if (sort === 'name')   sorted.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    return sorted
  }, [regs, byUser, search, sort])

  const stats = useMemo(() => {
    const all = (regs || []).map(r => ({ ...r, claimCount: byUser[r.user_id]?.claimCount || 0 }))
    return {
      total: all.length,
      active: all.filter(r => r.claimCount > 0).length,
      notStarted: all.filter(r => r.claimCount === 0).length,
      lapsed: all.filter(r => r.membership_status !== 'active').length,
    }
  }, [regs, byUser])

  const exportCSV = () => {
    setBusy(true)
    try {
      if (!rows.length) { setError('Nothing to export.'); return }
      downloadCSV(
        `fish-bingo-registrations-${season || 'all'}-${new Date().toISOString().slice(0, 10)}.csv`,
        toCSV(rows, EXPORT_COLUMNS)
      )
    } finally { setBusy(false) }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div style={{ background: SNZ_BLUE }} className="px-4 sm:px-6 py-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => navigate('/bingo/admin')}
            className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition whitespace-nowrap">
            ← Fish Bingo Admin
          </button>
          <span className="text-blue-100 text-sm opacity-75 hidden sm:block">/ Registrations</span>
        </div>
        <button onClick={() => { clearAdminSession(); navigate('/') }}
          className="text-xs text-blue-100 hover:text-white transition">Sign out</button>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-5">
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-black text-gray-900">Who's Registered</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Everyone who has signed up to play Fish Bingo{season ? ` ${season}` : ''}.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {seasons.length > 0 && (
              <select value={season} onChange={e => setSeason(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white">
                {seasons.map(s => (
                  <option key={s.season} value={s.season}>{s.season}{s.is_active ? ' (active)' : ''}</option>
                ))}
              </select>
            )}
            <button onClick={exportCSV} disabled={busy || !rows.length}
              className="px-4 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-40"
              style={{ background: SNZ_BLUE }}>
              ↓ Export to CSV / Excel
            </button>
          </div>
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>}

        {regs !== null && regs.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatTile label="Registered" value={stats.total} />
            <StatTile label="Have claimed" value={stats.active} tone="green" />
            <StatTile label="Yet to claim" value={stats.notStarted} tone="amber" />
            <StatTile label="Membership not active" value={stats.lapsed} tone={stats.lapsed ? 'red' : undefined} />
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          {SORTS.map(s => (
            <button key={s.value} onClick={() => setSort(s.value)}
              className={`text-xs font-bold px-3 py-1.5 rounded-full border transition ${
                sort === s.value ? 'text-white border-transparent' : 'text-gray-600 border-gray-300 hover:bg-gray-50'}`}
              style={sort === s.value ? { background: SNZ_BLUE } : {}}>
              {s.label}
            </button>
          ))}
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name, email, club, region…"
            className="ml-auto border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 min-w-[220px]" />
        </div>

        {regs === null ? (
          <div className="text-center py-16 text-gray-400 text-sm">Loading registrations…</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16 bg-white border border-gray-200 rounded-2xl text-gray-400">
            <p className="font-semibold text-gray-500 mb-1">No registrations</p>
            <p className="text-sm">
              {(regs || []).length === 0
                ? `Nobody has registered for ${season || 'this season'} yet.`
                : 'Nothing matches that search.'}
            </p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-left">
                    <Th>Diver</Th><Th>Club</Th><Th>Region</Th><Th>Experience</Th>
                    <Th right>Claims</Th><Th right>Score</Th><Th>Registered</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map(r => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-gray-900">{r.name || 'Unknown diver'}</span>
                          {r.membership_status !== 'active' && (
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600 border border-red-200">
                              {r.membership_status || 'no membership'}
                            </span>
                          )}
                        </div>
                        {r.email && (
                          <a href={`mailto:${r.email}`} className="text-xs text-gray-400 hover:underline">{r.email}</a>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{r.club || <span className="text-gray-300">—</span>}</td>
                      <td className="px-4 py-3 text-gray-600">{r.region}</td>
                      <td className="px-4 py-3 text-gray-600">{r.experience}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {r.claimCount > 0
                          ? <span className="font-bold text-gray-900">{r.claimCount}</span>
                          : <span className="text-gray-300">0</span>}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-black"
                        style={{ color: r.score > 0 ? SNZ_BLUE : '#d1d5db' }}>
                        {r.score}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{fmtDate(r.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Th({ children, right }) {
  return (
    <th className={`px-4 py-2.5 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap ${right ? 'text-right' : ''}`}>
      {children}
    </th>
  )
}

function StatTile({ label, value, tone }) {
  const color = tone === 'green' ? '#15803d' : tone === 'amber' ? '#b45309' : tone === 'red' ? '#dc2626' : '#111827'
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-4 py-3">
      <p className="text-2xl font-black tabular-nums" style={{ color }}>{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{label}</p>
    </div>
  )
}
