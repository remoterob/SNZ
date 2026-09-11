import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { medalFor } from '../lib/nationalsScoring'

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
  const [results, setResults] = useState([])
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
        .select('id, submitted_at, respond_by, status, message, challenger_club_id, defender_club_id, challenger:challenger_club_id(name), defender:defender_club_id(name)')
        .in('status', ['submitted', 'scheduled', 'contested'])
        .order('submitted_at')
      setQueue(q || [])

      // Completed events with a confirmed result, newest first.
      const { data: ev } = await supabase
        .from('mudgeway_events')
        .select('id, event_date, venue, mudgeway_results(team_id, fish_count, bulk_weight_g, total_points, outcome, confirmed_at, mudgeway_teams(clubs(name)))')
        .order('event_date', { ascending: false })
        .limit(10)
      setResults((ev || []).filter(e => (e.mudgeway_results || []).some(r => r.confirmed_at)))

      setLoading(false)
    })()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header — matches NationalsPage / CatfishCullPage */}
      <div style={{ background: SNZ_DARK }} className="px-6 py-3 flex items-center justify-between border-b border-blue-900">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
            ← SNZ Hub
          </button>
        </div>
        <button onClick={() => navigate('/admin/mudgeway')}
          className="text-xs font-bold text-white bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
          ⚙ Admin
        </button>
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
                    Challenges may be lodged between 1 November and 31 May.
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
                        <p className="text-sm font-bold text-gray-900">
                          {c.challenger?.name || 'Unknown club'} <span className="text-gray-400 font-normal">vs</span> {c.defender?.name || 'Unknown club'}
                        </p>
                        <p className="text-xs text-gray-400">
                          Lodged {fmtDate(c.submitted_at)} · to be swum by {fmtDate(c.respond_by)}
                          {new Date() > new Date(c.respond_by) && (
                            <span className="text-red-600 font-bold"> · overdue</span>
                          )}
                        </p>
                        {c.message && (
                          <p className={`text-xs mt-1 ${/^example/i.test(c.message) ? 'font-bold text-amber-700' : 'text-gray-500 italic'}`}>
                            {/^example/i.test(c.message) ? '⚠️ ' : ''}{c.message}
                          </p>
                        )}
                      </div>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{c.status}</span>
                      {c.status === 'submitted' && (
                        <button onClick={() => navigate(`/mudgeway/challenge/${c.id}/respond`)}
                          className="text-xs font-bold px-2.5 py-1 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 whitespace-nowrap">
                          Respond
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <button onClick={() => navigate('/mudgeway/challenge')}
                className="mt-3 px-5 py-2.5 rounded-xl font-black text-white text-sm"
                style={{ background: SNZ_BLUE }}>
                Challenge for the Trophy →
              </button>
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

            {/* Recent results — with the rule 3.3 dispute window */}
            {results.length > 0 && (
              <div>
                <h2 className="text-sm font-black tracking-widest uppercase text-gray-400 mb-3">Results</h2>
                <div className="space-y-2">
                  {results.map(ev => {
                    const confirmedAt = ev.mudgeway_results?.[0]?.confirmed_at
                    const closes = confirmedAt ? new Date(new Date(confirmedAt).getTime() + 7 * 86400000) : null
                    const open = closes && new Date() < closes
                    return (
                      <div key={ev.id} className="bg-white border border-gray-200 rounded-xl p-4">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div>
                            <p className="text-sm font-black text-gray-900">{ev.venue || 'Mudgeway event'}</p>
                            <p className="text-xs text-gray-400">{fmtDate(ev.event_date)}</p>
                          </div>
                          {open && (
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                              Disputes close {fmtDate(closes)}
                            </span>
                          )}
                        </div>
                        {/* Ranked rows, same shape as the Nationals leaderboard */}
                        <div className="mt-3 -mx-4 border-t border-gray-100">
                          {(ev.mudgeway_results || [])
                            .slice()
                            .sort((a, b) => b.total_points - a.total_points)
                            .map((r, i, arr) => {
                              const noContest = r.outcome === 'no_contest'
                              // Shared points share a placing (rule 24.7).
                              const rank = noContest ? null
                                : arr.filter(o => o.total_points > r.total_points).length + 1
                              const top = rank === 1 && !noContest
                              return (
                                <div key={r.team_id}
                                  className={`px-4 py-2.5 flex items-center gap-3 border-b border-gray-50 last:border-0 ${top ? 'bg-amber-50' : ''}`}>
                                  <span className="w-9 text-center font-black text-base flex-shrink-0">
                                    {rank ? medalFor(rank) : <span className="text-gray-300 text-sm">–</span>}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <p className="font-bold text-gray-900 text-sm truncate">
                                      {r.mudgeway_teams?.clubs?.name || 'Team'}
                                    </p>
                                    {r.outcome && (
                                      <p className={`text-xs font-semibold ${
                                        r.outcome === 'won' ? 'text-green-600'
                                        : r.outcome === 'retained' ? 'text-blue-600'
                                        : r.outcome === 'no_contest' ? 'text-amber-600'
                                        : 'text-gray-400'}`}>
                                        {r.outcome === 'won' ? 'Won the trophy'
                                          : r.outcome === 'retained' ? 'Retained the trophy'
                                          : r.outcome === 'no_contest' ? 'No contest'
                                          : 'Did not win'}
                                      </p>
                                    )}
                                  </div>
                                  <div className="text-right flex-shrink-0">
                                    <p className="text-base font-black tabular-nums" style={{ color: SNZ_BLUE }}>
                                      {r.total_points}
                                    </p>
                                    <p className="text-xs text-gray-400">
                                      {r.fish_count} fish
                                      {r.bulk_weight_g > 0 && ` · ${(r.bulk_weight_g / 1000).toFixed(1)} kg`}
                                    </p>
                                  </div>
                                </div>
                              )
                            })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

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
