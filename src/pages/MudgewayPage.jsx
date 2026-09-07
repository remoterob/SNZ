import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const SNZ_BLUE = '#2B6CB0'
const SNZ_DARK = '#1e3a5f'

const fmtDate = (d) => d
  ? new Date(d).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' })
  : '—'

// Whole months held, which is how custody actually gets talked about.
function heldFor(from) {
  if (!from) return ''
  const start = new Date(from)
  const days = Math.floor((Date.now() - start.getTime()) / 86400000)
  if (days < 31) return `${days} day${days === 1 ? '' : 's'}`
  const months = Math.floor(days / 30.44)
  if (months < 12) return `${months} month${months === 1 ? '' : 's'}`
  const years = Math.floor(months / 12)
  const rem = months % 12
  return `${years} year${years === 1 ? '' : 's'}${rem ? ` ${rem} month${rem === 1 ? '' : 's'}` : ''}`
}

export default function MudgewayPage() {
  const navigate = useNavigate()
  const [holder, setHolder] = useState(null)
  const [history, setHistory] = useState([])
  const [photos, setPhotos] = useState([])
  const [stars, setStars] = useState(0)
  const [queue, setQueue] = useState([])
  const [lightbox, setLightbox] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const { data: hist } = await supabase
        .from('mudgeway_holder_history')
        .select('id, club_id, held_from, held_until, source, notes, clubs(name)')
        .order('held_from', { ascending: false })

      const rows = hist || []
      const current = rows.find(r => !r.held_until) || null
      setHistory(rows)
      setHolder(current)

      if (current) {
        const { count } = await supabase
          .from('mudgeway_stars')
          .select('id', { count: 'exact', head: true })
          .eq('defending_club_id', current.club_id)
        setStars(count || 0)
      }

      const { data: pics } = await supabase
        .from('mudgeway_event_photos')
        .select('id, url, caption, credit, sort_order, event_id, mudgeway_events(event_date, venue)')
        .order('sort_order')
      setPhotos(pics || [])

      // Live challenges only — refused/cancelled/completed are history.
      const { data: q } = await supabase
        .from('mudgeway_challenges')
        .select('id, submitted_at, respond_by, status, challenger_club_id, defender_club_id')
        .in('status', ['submitted', 'scheduled', 'contested'])
        .order('submitted_at')
      setQueue(q || [])

      setLoading(false)
    })()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <div style={{ background: SNZ_DARK }} className="px-6 py-3 flex items-center border-b border-blue-900">
        <button onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
          ← Home
        </button>
        <span className="text-white/50 mx-2">/</span>
        <span className="text-white font-bold text-sm">Mudgeway Trophy</span>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">

        <div>
          <h1 className="text-3xl font-black text-gray-900">The Mudgeway Trophy</h1>
          <p className="text-gray-500 text-sm mt-1">
            New Zealand’s inter-club spearfishing challenge trophy. Any affiliated club may challenge
            the current holder — the holder sets the date, venue and fish list, and must be beaten on
            the day to give it up.
          </p>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">Loading…</div>
        ) : (
          <>
            {/* Current holder */}
            <div className="rounded-2xl overflow-hidden border-2 border-blue-200 bg-white">
              <div style={{ background: SNZ_DARK }} className="px-5 py-2.5">
                <p className="text-xs font-black tracking-widest uppercase text-blue-200">Current Holder</p>
              </div>
              {holder ? (
                <div className="p-5 flex items-center gap-5 flex-wrap">
                  <div className="flex-1 min-w-[180px]">
                    <p className="text-3xl font-black text-gray-900">{holder.clubs?.name || 'Unknown club'}</p>
                    <p className="text-sm text-gray-500 mt-1">
                      Held since {fmtDate(holder.held_from)} · {heldFor(holder.held_from)}
                    </p>
                  </div>
                  <div className="text-center px-5 py-3 rounded-xl bg-amber-50 border border-amber-200">
                    <p className="text-2xl font-black text-amber-700">
                      {stars > 0 ? '★'.repeat(Math.min(stars, 5)) : '—'}
                    </p>
                    <p className="text-xs font-bold text-amber-700 mt-0.5">
                      {stars} successful {stars === 1 ? 'defence' : 'defences'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-5 text-sm text-gray-400">No holder recorded yet.</div>
              )}
            </div>

            {/* Photos */}
            {photos.length > 0 && (
              <div>
                <h2 className="text-sm font-black tracking-widest uppercase text-gray-400 mb-3">Photos</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {photos.map((p, i) => (
                    <button key={p.id} onClick={() => setLightbox(p)}
                      className={`group relative rounded-xl overflow-hidden border border-gray-200 bg-white text-left ${i === 0 ? 'sm:col-span-2' : ''}`}>
                      <img src={p.url} alt={p.caption || 'Mudgeway Trophy'} loading="lazy"
                        className={`w-full object-cover ${i === 0 ? 'h-64 sm:h-80' : 'h-44'} group-hover:opacity-95 transition`} />
                      {p.caption && (
                        <div className="px-3 py-2">
                          <p className="text-xs font-semibold text-gray-700">{p.caption}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {fmtDate(p.mudgeway_events?.event_date)}
                            {p.credit ? ` · ${p.credit}` : ''}
                          </p>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Challenge queue */}
            <div>
              <h2 className="text-sm font-black tracking-widest uppercase text-gray-400 mb-3">Challenge Queue</h2>
              {queue.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-xl p-5 text-center">
                  <p className="text-sm text-gray-500 font-semibold">No challenges lodged.</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Challenges may be lodged between 1 November and 31 May. Online lodgement is coming
                    soon — until then, contact the SNZ secretary.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {queue.map((c, i) => (
                    <div key={c.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3">
                      <span className="w-7 h-7 rounded-full bg-blue-50 text-blue-700 font-black text-sm flex items-center justify-center flex-shrink-0">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900">Challenge #{c.id}</p>
                        <p className="text-xs text-gray-400">Lodged {fmtDate(c.submitted_at)}</p>
                      </div>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{c.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Holder history */}
            <div>
              <h2 className="text-sm font-black tracking-widest uppercase text-gray-400 mb-3">Holder History</h2>
              <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
                {history.map(h => (
                  <div key={h.id} className="px-4 py-3 flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${h.held_until ? 'bg-gray-300' : 'bg-green-500'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-gray-900">{h.clubs?.name || 'Unknown club'}</p>
                      <p className="text-xs text-gray-400">
                        {fmtDate(h.held_from)} — {h.held_until ? fmtDate(h.held_until) : 'present'}
                      </p>
                    </div>
                    {h.source === 'seed' && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200"
                        title={h.notes || 'Seeded historical record'}>
                        approximate
                      </span>
                    )}
                  </div>
                ))}
                {history.length === 0 && (
                  <div className="px-4 py-6 text-center text-sm text-gray-400">No history recorded yet.</div>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Records marked “approximate” were seeded from club records and photos; exact dates are
                still being confirmed.
              </p>
            </div>

            {/* Rules summary */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
              <h2 className="text-sm font-black text-blue-900 mb-2">How the challenge works</h2>
              <ul className="text-xs text-blue-800 space-y-1.5 list-disc list-inside leading-relaxed">
                <li>Challenges must be in writing and are swum in the order they’re received.</li>
                <li>A challenge must be swum within six weeks of being received.</li>
                <li>The defending club sets the date, venue, competition area and fish list.</li>
                <li>Teams are 3 to 6 pairs per club, one team per club.</li>
                <li>Six hours of fishing, with a four-hour minimum.</li>
                <li>A club that has just lost the trophy can’t challenge again for one month.</li>
                <li>If the winning team weighs in fewer than four fish it’s a no contest and the holder keeps the trophy.</li>
              </ul>
              <p className="text-xs text-blue-700 mt-3">
                Full rules are in Part I of the SNZ Nationals Rules.
              </p>
            </div>
          </>
        )}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.85)' }}
          onClick={() => setLightbox(null)}>
          <div className="max-w-4xl w-full" onClick={e => e.stopPropagation()}>
            <img src={lightbox.url} alt={lightbox.caption || 'Mudgeway Trophy'}
              className="w-full max-h-[80vh] object-contain rounded-xl" />
            <div className="flex items-start justify-between gap-4 mt-3">
              <div>
                <p className="text-white font-bold text-sm">{lightbox.caption}</p>
                <p className="text-white/50 text-xs mt-0.5">
                  {fmtDate(lightbox.mudgeway_events?.event_date)}
                  {lightbox.credit ? ` · ${lightbox.credit}` : ''}
                </p>
              </div>
              <button onClick={() => setLightbox(null)}
                className="text-white/70 hover:text-white text-sm font-bold flex-shrink-0">✕ Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
