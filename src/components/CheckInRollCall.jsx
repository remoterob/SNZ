import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'

const SNZ_BLUE = '#2B6CB0'

// Nationals events a team can be checked in for. Women's and Silver Oldie are
// derived sub-divisions of the Open, so they check in with it rather than
// separately. Individual events count the team as entered if either diver is.
export const NATIONALS_CHECKIN_EVENTS = [
  { id: 'open',        label: '🏆 Open' },
  { id: 'juniors',     label: '🌟 Juniors' },
  { id: 'goldenoldie', label: '🎖️ Golden Oldie' },
  { id: 'under23',     label: '🎯 Under 23' },
  { id: 'photography', label: '📸 Photography' },
  { id: 'finswim',     label: '🐟 Fin Swim' },
]

const PER_DIVER_EVENTS = new Set(['under23', 'photography', 'finswim'])

export function teamInNationalsEvent(team, eventId) {
  const ev = team?.nationals_event || {}
  if (PER_DIVER_EVENTS.has(eventId)) return !!(ev[`${eventId}_d1`] || ev[`${eventId}_d2`])
  return !!ev[eventId]
}

const PHASES = [
  { id: 'pre',  label: 'Pre-event',  verb: 'Checked in', blurb: 'Roll call before they go out' },
  { id: 'post', label: 'Post-event', verb: 'Back',       blurb: 'Head count — everyone accounted for' },
]

const MAX_EVENT_DAYS = 7

/**
 * Days an event runs, from competitions.event_dates: { start, end }.
 * Most events have a start only and run for one day; the Nationals Open spans
 * two, so each day needs its own pre/post roll call.
 */
export function eventDayList(eventDates, eventId) {
  const d = eventDates?.[eventId]
  const single = [{ day: 1, date: d?.start || null }]
  if (!d?.start || !d?.end) return single
  const start = new Date(`${d.start}T00:00:00`)
  const end = new Date(`${d.end}T00:00:00`)
  if (isNaN(start) || isNaN(end) || end <= start) return single
  const days = []
  for (let i = 0; i < MAX_EVENT_DAYS; i++) {
    const cur = new Date(start)
    cur.setDate(start.getDate() + i)
    if (cur > end) break
    // Format from local parts, not toISOString() — NZDT is UTC+13 in January,
    // so going via UTC would roll every date back a day.
    const mm = String(cur.getMonth() + 1).padStart(2, '0')
    const dd = String(cur.getDate()).padStart(2, '0')
    days.push({ day: i + 1, date: `${cur.getFullYear()}-${mm}-${dd}` })
  }
  return days.length ? days : single
}

const dayLabel = (d) => {
  if (!d.date) return `Day ${d.day}`
  const dt = new Date(`${d.date}T00:00:00`)
  if (isNaN(dt)) return `Day ${d.day}`
  return `Day ${d.day} · ${dt.toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short' })}`
}

/**
 * Team-level roll call. One tap per team per (event, phase).
 *
 * `events` is a list of { id, label }. Single-event comps pass a single
 * { id: 'main' } entry and the event selector hides itself.
 * `teamsForEvent` optionally filters which teams appear under an event.
 */
export default function CheckInRollCall({
  competitionId,
  teams,
  members,
  events = [{ id: 'main', label: 'Check-in' }],
  eventDates,
  teamsForEvent,
  showToast,
  renderTeamExtra,
}) {
  const [eventKey, setEventKey] = useState(events[0]?.id || 'main')
  const [phase, setPhase] = useState('pre')
  const [day, setDay] = useState(1)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyTeamId, setBusyTeamId] = useState(null)

  const days = useMemo(() => eventDayList(eventDates, eventKey), [eventDates, eventKey])
  const isMultiDay = days.length > 1

  // A day that exists for one event may not for the next — snap back to day 1
  // rather than leaving the roll call pointed at a day this event doesn't have.
  useEffect(() => {
    if (!days.some(d => d.day === day)) setDay(1)
  }, [days, day])

  const load = useCallback(async () => {
    if (!competitionId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('comp_checkins')
      .select('id, team_id, event_key, phase, day, checked_in_at')
      .eq('competition_id', competitionId)
    if (error) showToast?.(error.message, 'error')
    setRows(data || [])
    setLoading(false)
  }, [competitionId, showToast])

  useEffect(() => { load() }, [load])

  // team_id -> row, for the currently selected event + phase + day
  const current = useMemo(() => {
    const m = new Map()
    for (const r of rows) {
      if (r.event_key === eventKey && r.phase === phase && (r.day ?? 1) === day) m.set(r.team_id, r)
    }
    return m
  }, [rows, eventKey, phase, day])

  // Who went out on *this* day — lets the post-event list show only the teams
  // that actually checked in that morning.
  const preSet = useMemo(() => {
    const s = new Set()
    for (const r of rows) {
      if (r.event_key === eventKey && r.phase === 'pre' && (r.day ?? 1) === day) s.add(r.team_id)
    }
    return s
  }, [rows, eventKey, day])

  const visibleTeams = useMemo(() => {
    const base = teamsForEvent ? teams.filter(t => teamsForEvent(t, eventKey)) : teams
    // Post-event only makes sense for teams that checked in beforehand, but
    // don't hide anyone who somehow got checked back in without a pre row.
    if (phase === 'post') {
      const went = base.filter(t => preSet.has(t.id) || current.has(t.id))
      return went.length ? went : base
    }
    return base
  }, [teams, teamsForEvent, eventKey, phase, preSet, current])

  const toggle = async (team) => {
    const existing = current.get(team.id)
    setBusyTeamId(team.id)
    try {
      if (existing) {
        const { error } = await supabase.from('comp_checkins').delete().eq('id', existing.id)
        if (error) throw error
        setRows(rs => rs.filter(r => r.id !== existing.id))
      } else {
        const { data, error } = await supabase.from('comp_checkins')
          .insert({ competition_id: competitionId, team_id: team.id, event_key: eventKey, phase, day })
          .select('id, team_id, event_key, phase, day, checked_in_at')
          .single()
        if (error) throw error
        setRows(rs => [...rs, data])
      }
      // Keep the legacy comp_teams.checked_in flag in step for the main
      // pre-event check-in — CheckInDisplay and comp-copilot still read it.
      if (eventKey === 'main' && phase === 'pre' && day === 1) {
        await supabase.from('comp_teams').update(
          existing ? { checked_in: false, checked_in_at: null }
                   : { checked_in: true, checked_in_at: new Date().toISOString() }
        ).eq('id', team.id)
      }
    } catch (e) {
      showToast?.(e.message, 'error')
      load()
    } finally {
      setBusyTeamId(null)
    }
  }

  const checkAllRemaining = async () => {
    const remaining = visibleTeams.filter(t => !current.has(t.id))
    if (!remaining.length) return
    if (!window.confirm(`Check in all ${remaining.length} remaining team${remaining.length > 1 ? 's' : ''}?`)) return
    const { data, error } = await supabase.from('comp_checkins')
      .insert(remaining.map(t => ({ competition_id: competitionId, team_id: t.id, event_key: eventKey, phase, day })))
      .select('id, team_id, event_key, phase, day, checked_in_at')
    if (error) { showToast?.(error.message, 'error'); return }
    setRows(rs => [...rs, ...(data || [])])
    showToast?.(`${remaining.length} team${remaining.length > 1 ? 's' : ''} checked in`)
  }

  const checkedCount = visibleTeams.filter(t => current.has(t.id)).length
  const phaseMeta = PHASES.find(p => p.id === phase)
  const allIn = visibleTeams.length > 0 && checkedCount === visibleTeams.length

  return (
    <div className="space-y-4">
      {/* Phase toggle */}
      <div className="flex gap-2">
        {PHASES.map(p => (
          <button key={p.id} onClick={() => setPhase(p.id)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-black border-2 transition ${
              phase === p.id ? 'text-white border-transparent' : 'border-gray-200 text-gray-500 hover:border-gray-300 bg-white'
            }`}
            style={phase === p.id ? { background: p.id === 'post' ? '#7c3aed' : SNZ_BLUE } : {}}>
            {p.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-gray-400 -mt-2">{phaseMeta?.blurb}</p>

      {/* Event selector — hidden for single-event comps */}
      {events.length > 1 && (
        <div className="flex gap-1.5 flex-wrap">
          {events.map(ev => {
            const n = (teamsForEvent ? teams.filter(t => teamsForEvent(t, ev.id)) : teams).length
            // Count against the day currently selected where that event has one,
            // so a multi-day event's tally matches the list underneath it.
            const evDays = eventDayList(eventDates, ev.id)
            const evDay = evDays.some(d => d.day === day) ? day : 1
            const done = rows.filter(r => r.event_key === ev.id && r.phase === phase && (r.day ?? 1) === evDay).length
            return (
              <button key={ev.id} onClick={() => setEventKey(ev.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold border transition ${
                  eventKey === ev.id ? 'text-white border-transparent' : 'text-gray-600 border-gray-300 hover:bg-gray-50 bg-white'
                }`}
                style={eventKey === ev.id ? { background: SNZ_BLUE } : {}}>
                {ev.label} <span className={eventKey === ev.id ? 'text-blue-100' : 'text-gray-400'}>{done}/{n}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Day selector — only for events that run more than one day */}
      {isMultiDay && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
          <p className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-2">
            {events.find(e => e.id === eventKey)?.label || 'This event'} runs {days.length} days — check in each day separately
          </p>
          <div className="flex gap-2 flex-wrap">
            {days.map(d => {
              const dPre = rows.filter(r => r.event_key === eventKey && r.phase === 'pre' && (r.day ?? 1) === d.day).length
              const dPost = rows.filter(r => r.event_key === eventKey && r.phase === 'post' && (r.day ?? 1) === d.day).length
              const out = dPre - dPost
              return (
                <button key={d.day} onClick={() => setDay(d.day)}
                  className={`px-3 py-2 rounded-lg text-xs font-bold border-2 transition ${
                    day === d.day ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  }`}
                  style={day === d.day ? { background: SNZ_BLUE } : {}}>
                  {dayLabel(d)}
                  {out > 0 && (
                    <span className={`ml-2 px-1.5 py-0.5 rounded-full ${day === d.day ? 'bg-white/25' : 'bg-amber-100 text-amber-700'}`}>
                      {out} out
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="bg-white border-2 border-blue-100 rounded-xl p-4 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <p className="font-black text-gray-900 text-lg">
            {checkedCount} <span className="text-gray-400 font-normal text-base">/ {visibleTeams.length} {phase === 'post' ? 'back' : 'checked in'}</span>
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {visibleTeams.length - checkedCount} {phase === 'post' ? 'still out' : 'still to arrive'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex gap-1.5 flex-wrap max-w-[220px]">
            {visibleTeams.map(t => (
              <div key={t.id} className={`w-3 h-3 rounded-full ${current.has(t.id) ? (phase === 'post' ? 'bg-purple-500' : 'bg-green-400') : 'bg-gray-200'}`} title={t.team_name} />
            ))}
          </div>
          {checkedCount < visibleTeams.length && (
            <button onClick={checkAllRemaining}
              className="px-3 py-2 rounded-lg text-xs font-bold border border-gray-300 text-gray-600 hover:bg-gray-50 whitespace-nowrap">
              Check in all
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10 text-gray-400 text-sm">Loading check-ins…</div>
      ) : visibleTeams.length === 0 ? (
        <div className="text-center py-12 bg-white border border-gray-200 rounded-xl text-gray-400">
          {phase === 'post' ? 'No teams checked in for this event yet.' : 'No teams entered in this event.'}
        </div>
      ) : (
        <div className="space-y-2">
          {visibleTeams.map((t, i) => {
            const row = current.get(t.id)
            const isIn = !!row
            const mems = (members || []).filter(m => m.team_id === t.id)
            const roll = mems.length
              ? mems.map(m => m.name).filter(Boolean).join(' & ')
              : [t._d1?.name, t._d2?.name].filter(Boolean).join(' & ')
            const missingPre = phase === 'post' && !preSet.has(t.id)
            // The row is a plain div, not a button: renderTeamExtra can hold
            // its own controls (e.g. the boat <select>) and nesting those
            // inside a button would break them. Both the info area and the
            // pill toggle, so the tap target stays large.
            return (
              <div key={t.id}
                className={`flex items-center gap-3 p-3 rounded-xl border-2 transition ${
                  busyTeamId === t.id ? 'opacity-50' : ''
                } ${
                  isIn
                    ? (phase === 'post' ? 'border-purple-400 bg-purple-50' : 'border-green-400 bg-green-50')
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}>
                <button type="button" onClick={() => toggle(t)} disabled={busyTeamId === t.id}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left">
                  <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-black text-gray-500 flex-shrink-0">{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-gray-900 text-sm">{t.team_name}</p>
                      {t.status === 'pending_payment' && (
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 border border-red-200">Unpaid</span>
                      )}
                      {missingPre && (
                        <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">No pre check-in</span>
                      )}
                    </div>
                    {roll && <p className="text-xs text-gray-500 truncate">{roll}</p>}
                    {isIn && (
                      <p className={`text-xs font-semibold ${phase === 'post' ? 'text-purple-600' : 'text-green-600'}`}>
                        ✓ {phaseMeta?.verb} {new Date(row.checked_in_at).toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                </button>

                {renderTeamExtra?.(t)}

                <button type="button" onClick={() => toggle(t)} disabled={busyTeamId === t.id}
                  className={`flex-shrink-0 px-3 py-2 rounded-lg text-xs font-black min-w-[76px] text-center ${
                    isIn
                      ? (phase === 'post' ? 'bg-purple-100 text-purple-700 border border-purple-300' : 'bg-green-100 text-green-700 border border-green-300')
                      : 'text-white'
                  }`} style={isIn ? {} : { background: SNZ_BLUE }}>
                  {busyTeamId === t.id ? '…' : isIn ? (phase === 'post' ? '✓ Back' : '✓ In') : (phase === 'post' ? 'Back' : 'Check In')}
                </button>
              </div>
            )
          })}
        </div>
      )}

      <div className={`rounded-xl p-4 text-center font-black text-lg border-2 ${
        allIn ? 'bg-green-50 border-green-300 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-500'
      }`}>
        {allIn
          ? (phase === 'post' ? '✓ Everyone accounted for' : '✓ All teams checked in')
          : `${visibleTeams.length - checkedCount} ${phase === 'post' ? 'still out on the water' : 'still to check in'}`}
      </div>
    </div>
  )
}
