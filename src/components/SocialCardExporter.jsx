import { useState } from 'react'
import { generateTeamCard, cardFilename, downloadDataUrl, buildZip, downloadBlob } from '../lib/teamCard'

const SNZ_BLUE = '#2B6CB0'

/**
 * Grid of generated share cards with selection + download.
 *
 * `cards` is a list of:
 *   { key, heroUrl, teamPhotoUrl, teamName, subtitle, statLine, scoreLine, usedFallback }
 *
 * Selecting nothing and hitting "Download all" exports every card as a zip —
 * browsers throttle long runs of individual downloads, so bulk goes out as one
 * archive rather than 40 separate files.
 */
export default function SocialCardExporter({ comp, cards, emptyHint }) {
  const [previews, setPreviews] = useState({})   // key -> dataURL
  const [generating, setGenerating] = useState(null)
  const [selected, setSelected] = useState(new Set())
  const [bulk, setBulk] = useState(null)         // null | { done, total }
  const [error, setError] = useState('')

  const compName = comp?.name || ''

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
      const dataUrl = await generateTeamCard({ ...card, compName })
      setPreviews(p => ({ ...p, [card.key]: dataUrl }))
      return dataUrl
    } catch (e) {
      setError(`Could not generate card for ${card.teamName}: ${e.message}`)
      return null
    } finally {
      setGenerating(null)
    }
  }

  const downloadOne = async (card) => {
    const dataUrl = await build(card)
    if (dataUrl) downloadDataUrl(dataUrl, cardFilename(compName, card.teamName, card.suffix))
  }

  const downloadMany = async (list) => {
    if (!list.length) return
    setError('')
    setBulk({ done: 0, total: list.length })
    const files = []
    for (const card of list) {
      const dataUrl = await build(card)
      if (dataUrl) files.push({ name: cardFilename(compName, card.teamName, card.suffix), dataUrl })
      setBulk(b => ({ ...b, done: b.done + 1 }))
    }
    setBulk(null)
    if (!files.length) { setError('No cards could be generated.'); return }
    if (files.length === 1) { downloadDataUrl(files[0].dataUrl, files[0].name); return }
    const zipName = `${(compName || 'competition').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-').toLowerCase()}-cards.zip`
    downloadBlob(buildZip(files), zipName)
  }

  if (!cards.length) return (
    <div className="text-center py-16 bg-gray-50 rounded-xl text-gray-400">
      <p className="font-semibold text-gray-500 mb-1">No photos yet</p>
      <p className="text-sm">{emptyHint}</p>
    </div>
  )

  const selectedCards = cards.filter(c => selected.has(c.key))

  return (
    <div className="space-y-5">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <p className="font-bold mb-1">Social Media Export</p>
        <p className="text-xs">
          One 1080×1080 card per team — competition name, team name, score and the SNZ logo stamped on.
          Tap a card to select. Download one at a time, your selection, or everything as a zip.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={selectAll}
            className="text-xs font-bold px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">Select all</button>
          {selected.size > 0 && (
            <button onClick={clearAll}
              className="text-xs font-bold px-3 py-1.5 rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50">Clear</button>
          )}
          <span className="text-xs text-gray-500">{cards.length} card{cards.length !== 1 ? 's' : ''}{selected.size ? ` · ${selected.size} selected` : ''}</span>
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {cards.map(card => {
          const isSelected = selected.has(card.key)
          const isGenerating = generating === card.key
          const preview = previews[card.key]
          return (
            <div key={card.key}
              className={`bg-white rounded-xl overflow-hidden shadow-sm border-2 transition ${isSelected ? 'border-blue-500' : 'border-gray-200 hover:border-gray-300'}`}>
              <button type="button" onClick={() => toggle(card.key)} className="block w-full relative">
                <img src={preview || card.heroUrl} alt={card.teamName} className="w-full aspect-square object-cover" />
                {isSelected && (
                  <span className="absolute top-2 left-2 w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-black flex items-center justify-center">✓</span>
                )}
                {card.usedFallback && (
                  <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px] font-bold">team photo</span>
                )}
                {isGenerating && (
                  <span className="absolute inset-0 bg-black/40 text-white text-sm font-bold flex items-center justify-center">Generating…</span>
                )}
              </button>
              <div className="p-3 flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 text-sm truncate">{card.teamName}</p>
                  <p className="text-xs text-gray-400 truncate">{card.statLine || card.subtitle} · {card.scoreLine}</p>
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
    </div>
  )
}
