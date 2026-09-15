import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, clearAdminSession } from '../lib/supabase'
import { generateCatchCard, catchCardFilename } from '../lib/bingoCatchCard'
import { downloadDataUrl, downloadBlob, buildZip } from '../lib/teamCard'

const SNZ_BLUE = '#2B6CB0'

const RANGE_OPTIONS = [
  { value: 7,     label: 'Last 7 days' },
  { value: 30,    label: 'Last 30 days' },
  { value: 90,    label: 'Last 90 days' },
  { value: 'all', label: 'All time' },
]

export default function BingoPhotoExportAdmin() {
  const navigate = useNavigate()

  const [seasons, setSeasons] = useState([])       // [{ season, is_active }]
  const [season, setSeason] = useState('')
  const [rangeDays, setRangeDays] = useState(7)     // number of days, or 'all'
  const [claims, setClaims] = useState(null)        // null = loading
  const [species, setSpecies] = useState({})        // slug -> name
  const [members, setMembers] = useState({})        // id -> { name, club }

  const [previews, setPreviews] = useState({})      // claim id -> dataURL
  const [generating, setGenerating] = useState(null)
  const [selected, setSelected] = useState(new Set())
  const [bulk, setBulk] = useState(null)             // null | { done, total }
  const [error, setError] = useState('')

  // Seasons for the picker.
  useEffect(() => {
    supabase.from('bingo_comp_config')
      .select('season, is_active, created_at')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const rows = data || []
        setSeasons(rows)
        const active = rows.find(r => r.is_active)
        setSeason(active?.season || rows[0]?.season || '')
      })
  }, [])

  // Species names, for the subtitle line.
  useEffect(() => {
    supabase.from('bingo_species').select('slug, name')
      .then(({ data }) => setSpecies(Object.fromEntries((data || []).map(s => [s.slug, s.name]))))
  }, [])

  // Claims with photos for the selected season + date range, newest first.
  // Filtered server-side (not fetched-then-filtered) since this table only
  // grows — pulling every photo ever uploaded on each load doesn't scale.
  useEffect(() => {
    if (!season) return
    setClaims(null)
    setSelected(new Set())
    setPreviews({})
    let query = supabase.from('bingo_claims')
      .select('id, user_id, species_slug, photo_url, created_at')
      .eq('comp_season', season)
      .not('photo_url', 'is', null)
    if (rangeDays !== 'all') {
      const cutoff = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000).toISOString()
      query = query.gte('created_at', cutoff)
    }
    query.order('created_at', { ascending: false })
      .then(async ({ data }) => {
        const rows = data || []
        setClaims(rows)
        const uids = [...new Set(rows.map(c => c.user_id).filter(Boolean))]
        if (uids.length) {
          const { data: mem } = await supabase.from('members').select('id, name, club').in('id', uids)
          setMembers(Object.fromEntries((mem || []).map(m => [m.id, m])))
        }
      })
  }, [season, rangeDays])

  const cards = useMemo(() => (claims || []).map(c => {
    const m = members[c.user_id] || {}
    return {
      key: c.id,
      heroUrl: c.photo_url,
      diverName: m.name || 'Diver',
      club: m.club || '',
      speciesName: species[c.species_slug] || c.species_slug,
      createdAt: c.created_at,
    }
  }), [claims, members, species])

  const toggle = (key) => setSelected(s => {
    const n = new Set(s)
    n.has(key) ? n.delete(key) : n.add(key)
    return n
  })
  const selectAll = () => setSelected(new Set(cards.map(c => c.key)))
  const clearAll = () => setSelected(new Set())

  const build = async (card) => {
    if (previews[card.key]) return previews[card.key]
    setGenerating(card.key)
    try {
      const dataUrl = await generateCatchCard({
        photoUrl: card.heroUrl,
        diverName: card.diverName,
        club: card.club,
        speciesName: card.speciesName,
        tagLine: season ? `Fish Bingo ${season}` : 'Fish Bingo',
      })
      setPreviews(p => ({ ...p, [card.key]: dataUrl }))
      return dataUrl
    } catch (e) {
      setError(`Could not generate card for ${card.diverName}: ${e.message}`)
      return null
    } finally {
      setGenerating(null)
    }
  }

  const downloadOne = async (card) => {
    const dataUrl = await build(card)
    if (dataUrl) downloadDataUrl(dataUrl, catchCardFilename(card.diverName, card.speciesName))
  }

  const downloadMany = async (list) => {
    if (!list.length) return
    setError('')
    setBulk({ done: 0, total: list.length })
    const files = []
    for (const card of list) {
      const dataUrl = await build(card)
      if (dataUrl) files.push({ name: catchCardFilename(card.diverName, card.speciesName), dataUrl })
      setBulk(b => ({ ...b, done: b.done + 1 }))
    }
    setBulk(null)
    if (!files.length) { setError('No cards could be generated.'); return }
    if (files.length === 1) { downloadDataUrl(files[0].dataUrl, files[0].name); return }
    downloadBlob(buildZip(files), `fish-bingo-${season || 'photos'}.zip`)
  }

  const selectedCards = cards.filter(c => selected.has(c.key))

  return (
    <div className="min-h-screen bg-white">
      <div style={{ background: SNZ_BLUE }} className="px-6 py-3 flex items-center justify-between border-b border-blue-700">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/bingo/admin')}
            className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
            ← Fish Bingo Admin
          </button>
          <span className="text-blue-200 text-sm opacity-75">/ Photo Export</span>
        </div>
        <button onClick={() => { clearAdminSession(); navigate('/') }}
          className="text-xs text-blue-200 hover:text-white transition">Sign out</button>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-black text-gray-900">Catch Photo Export</h1>
            <p className="text-sm text-gray-400 mt-0.5">Every uploaded catch photo, stamped with the SNZ logo and the diver's name and club — ready to post.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select value={rangeDays} onChange={e => setRangeDays(e.target.value === 'all' ? 'all' : Number(e.target.value))}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white">
              {RANGE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {seasons.length > 0 && (
              <select value={season} onChange={e => setSeason(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white">
                {seasons.map(s => (
                  <option key={s.season} value={s.season}>{s.season}{s.is_active ? ' (active)' : ''}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>
        )}

        {claims === null ? (
          <div className="text-center py-16 text-gray-400 text-sm">Loading…</div>
        ) : cards.length === 0 ? (
          <div className="text-center py-16 bg-gray-50 rounded-xl text-gray-400">
            <p className="font-semibold text-gray-500 mb-1">No photos</p>
            <p className="text-sm">
              Nothing uploaded for {season || 'this season'}
              {rangeDays !== 'all' ? ` in the last ${rangeDays} days` : ''}.
              {rangeDays !== 'all' && ' Try widening the date range above.'}
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <button onClick={selectAll}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">Select all</button>
                {selected.size > 0 && (
                  <button onClick={clearAll}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50">Clear</button>
                )}
                <span className="text-xs text-gray-500">{cards.length} photo{cards.length !== 1 ? 's' : ''}{selected.size ? ` · ${selected.size} selected` : ''}</span>
              </div>
              <div className="flex items-center gap-2">
                {selected.size > 0 && (
                  <button onClick={() => downloadMany(selectedCards)} disabled={!!bulk}
                    className="px-4 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-50"
                    style={{ background: SNZ_BLUE }}>
                    ↓ Download {selected.size} selected
                  </button>
                )}
                <button onClick={() => downloadMany(cards)} disabled={!!bulk}
                  className="px-4 py-2 rounded-lg text-sm font-bold border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                  {bulk ? `Generating ${bulk.done}/${bulk.total}…` : `↓ Download all (${cards.length})`}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {cards.map(card => {
                const isSelected = selected.has(card.key)
                const isGenerating = generating === card.key
                const preview = previews[card.key]
                return (
                  <div key={card.key}
                    className={`bg-white rounded-xl overflow-hidden shadow-sm border-2 transition ${isSelected ? 'border-blue-500' : 'border-gray-200 hover:border-gray-300'}`}>
                    <button type="button" onClick={() => toggle(card.key)} className="block w-full relative">
                      <img src={preview || card.heroUrl} alt={card.diverName} className="w-full aspect-square object-cover" />
                      {isSelected && (
                        <span className="absolute top-2 left-2 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-black flex items-center justify-center">✓</span>
                      )}
                      {isGenerating && (
                        <span className="absolute inset-0 bg-black/40 text-white text-sm font-bold flex items-center justify-center">Generating…</span>
                      )}
                    </button>
                    <div className="p-3 flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 text-sm truncate">{card.diverName}</p>
                        <p className="text-xs text-gray-400 truncate">{[card.club, card.speciesName].filter(Boolean).join(' · ')}</p>
                      </div>
                      <button onClick={() => downloadOne(card)} disabled={isGenerating || !!bulk}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 flex-shrink-0">
                        ↓ Save
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
