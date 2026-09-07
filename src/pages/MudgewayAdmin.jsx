import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, setAdminSession, isMudgewayAdmin } from '../lib/supabase'
import { scoreTeam, determineOutcome } from '../lib/mudgewayScoring'

const SNZ_BLUE = '#2B6CB0'
const SNZ_DARK = '#1e3a5f'

const fmt = (d) => d ? new Date(d).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
const kg = (g) => (Number(g || 0) / 1000).toFixed(2)

const PENALTY_REASONS = [
  ['under_80_percent_min', 'Under 80% of minimum weight'],
  ['ineligible_species', 'Not on the fish list'],
  ['fisheries_breach', 'Breach of fisheries regs'],
  ['over_species_count', 'Over the allowable count'],
  ['other', 'Other'],
]

// ── Gate ─────────────────────────────────────────────────────────────────────
function Gate({ onOk }) {
  const [pwd, setPwd] = useState('')
  const [err, setErr] = useState('')
  const submit = (e) => {
    e.preventDefault()
    if (setAdminSession(pwd) && isMudgewayAdmin()) { onOk(); return }
    setErr('That password does not open Mudgeway admin.')
  }
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <form onSubmit={submit} className="max-w-sm w-full bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
        <div>
          <h1 className="text-xl font-black text-gray-900">Mudgeway Admin</h1>
          <p className="text-xs text-gray-400 mt-1">Weigh-in, results, and committee tools.</p>
        </div>
        <input type="password" value={pwd} onChange={e => { setPwd(e.target.value); setErr('') }}
          placeholder="Password" autoFocus
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
        {err && <p className="text-xs text-red-600">{err}</p>}
        <button type="submit" className="w-full py-2.5 rounded-xl font-black text-white text-sm" style={{ background: SNZ_BLUE }}>
          Unlock
        </button>
      </form>
    </div>
  )
}

// ── Fish list picker — same shape as the Nationals fish list ────────────────
// Mudgeway scores 100 pts per fish + 10 pts/kg for every species (rule 24.1),
// so unlike Nationals there are no per-species points. What the defender does
// control is the allowable count and any per-species minimum weight.
function FishListPicker({ event, existing, onClose, onSaved, toast }) {
  const [library, setLibrary] = useState([])
  const [libLoading, setLibLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState(() =>
    (existing || []).map(i => ({
      name: i.species_name,
      max_count: i.max_count ?? '',
      min_weight_g_override: i.min_weight_g_override ?? '',
    }))
  )

  useEffect(() => {
    supabase.from('comp_species_library').select('*').eq('active', true)
      .order('sort_order').order('name')
      .then(({ data }) => { setLibrary(data || []); setLibLoading(false) })
  }, [])

  const isOn = (name) => selected.some(s => s.name === name)
  const toggle = (name) => setSelected(s =>
    s.some(x => x.name === name) ? s.filter(x => x.name !== name)
                                 : [...s, { name, max_count: '', min_weight_g_override: '' }])
  const setField = (name, k, v) =>
    setSelected(s => s.map(x => x.name === name ? { ...x, [k]: v } : x))

  const save = async () => {
    setSaving(true)
    try {
      let listId = null
      const { data: existingList } = await supabase
        .from('mudgeway_fish_lists').select('id').eq('event_id', event.id).maybeSingle()
      if (existingList) {
        listId = existingList.id
        const { error } = await supabase.from('mudgeway_fish_list_items').delete().eq('fish_list_id', listId)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('mudgeway_fish_lists')
          .insert({ event_id: event.id, name: `${event.venue || 'Mudgeway'} fish list` })
          .select('id').single()
        if (error) throw error
        listId = data.id
      }
      if (selected.length > 0) {
        const { error } = await supabase.from('mudgeway_fish_list_items').insert(
          selected.map(s => ({
            fish_list_id: listId,
            species_name: s.name,
            max_count: s.max_count === '' ? null : Number(s.max_count),
            min_weight_g_override: s.min_weight_g_override === '' ? null : Number(s.min_weight_g_override),
          }))
        )
        if (error) throw error
      }
      toast(`Fish list saved — ${selected.length} species`)
      onSaved(); onClose()
    } catch (e) { toast(e.message, 'error') }
    finally { setSaving(false) }
  }

  const filtered = library.filter(s => s.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-2xl my-8 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-black text-gray-900">Fish List ({selected.length} selected)</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
        </div>
        <div className="p-6">
          <p className="text-xs text-gray-400 mb-3">
            Every species scores the same under rule 24.1 (100 pts + 10 pts/kg). Set an allowable
            count to make extras a −100 penalty under rule 23.6, and a minimum weight to override the
            event default of {event.min_fish_weight_g} g.
          </p>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search species…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-300" />
          {libLoading
            ? <div className="text-center py-8 text-gray-400">Loading species…</div>
            : <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-80 overflow-y-auto mb-4 pr-1">
                {filtered.map(s => {
                  const on = isOn(s.name)
                  const cur = selected.find(x => x.name === s.name)
                  return (
                    <div key={s.id} className={`relative rounded-xl border-2 overflow-hidden transition ${on ? 'border-blue-500' : 'border-gray-200 hover:border-gray-300'}`}>
                      <button type="button" onClick={() => toggle(s.name)} className="w-full text-left">
                        {s.photo_url
                          ? <img src={s.photo_url} alt={s.name} className="w-full h-24 object-cover" />
                          : <div className="w-full h-24 bg-gray-100 flex items-center justify-center text-4xl">🐟</div>}
                        <div className="p-1.5 text-xs font-semibold leading-tight">{s.name}</div>
                      </button>
                      {on && (
                        <div className="px-2 pb-2 space-y-1" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-400">max</span>
                            <input type="number" min="1" placeholder="∞" value={cur?.max_count ?? ''}
                              onChange={e => setField(s.name, 'max_count', e.target.value)}
                              className="w-12 border border-gray-300 rounded px-1 py-0.5 text-xs text-center" />
                            <span className="text-xs text-gray-400">allowed</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-400">min</span>
                            <input type="number" min="0" step="50" placeholder={event.min_fish_weight_g}
                              value={cur?.min_weight_g_override ?? ''}
                              onChange={e => setField(s.name, 'min_weight_g_override', e.target.value)}
                              className="w-16 border border-gray-300 rounded px-1 py-0.5 text-xs text-center" />
                            <span className="text-xs text-gray-400">g</span>
                          </div>
                        </div>
                      )}
                      {on && <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">✓</div>}
                    </div>
                  )
                })}
              </div>
          }
          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-300 text-sm font-bold text-gray-600">Cancel</button>
            <button type="button" onClick={save} disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
              style={{ background: SNZ_BLUE }}>
              {saving ? 'Saving…' : `Save Fish List (${selected.length})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Weigh-in for one event ───────────────────────────────────────────────────
function WeighIn({ event, onBack, toast }) {
  const [teams, setTeams] = useState([])
  const [fishList, setFishList] = useState([])
  const [rows, setRows] = useState([])
  const [busy, setBusy] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const [draft, setDraft] = useState({ team_id: '', species_name: '', weight_g: '', penalty_flag: false, penalty_reason: '' })
  const [cd, setCd] = useState({})   // team_id -> { adjustment, note, disqualified }
  const [showPicker, setShowPicker] = useState(false)
  const [ev, setEv] = useState(event)

  const load = useCallback(async () => {
    const [{ data: t }, { data: fl }, { data: w }, { data: res }] = await Promise.all([
      supabase.from('mudgeway_teams').select('id, club_id, role, clubs(name)').eq('event_id', event.id),
      supabase.from('mudgeway_fish_lists').select('id, mudgeway_fish_list_items(species_name, max_count, min_weight_g_override)').eq('event_id', event.id).maybeSingle(),
      supabase.from('mudgeway_weighin').select('*').eq('event_id', event.id).order('id'),
      supabase.from('mudgeway_results').select('team_id, confirmed_at').eq('event_id', event.id),
    ])
    setTeams(t || [])
    setFishList(fl?.mudgeway_fish_list_items || [])
    setRows(w || [])
    setConfirmed((res || []).some(r => r.confirmed_at))
    const { data: fresh } = await supabase.from('mudgeway_events').select('*').eq('id', event.id).maybeSingle()
    if (fresh) setEv(fresh)
  }, [event.id])

  useEffect(() => { load() }, [load])

  const addFish = async () => {
    if (!draft.team_id || !draft.species_name || draft.weight_g === '') return
    setBusy(true)
    const { error } = await supabase.from('mudgeway_weighin').insert({
      event_id: event.id,
      team_id: Number(draft.team_id),
      species_name: draft.species_name,
      weight_g: Number(draft.weight_g),
      is_over_8kg: Number(draft.weight_g) > 8000,
      penalty_flag: draft.penalty_flag,
      penalty_reason: draft.penalty_flag ? (draft.penalty_reason || 'other') : null,
    })
    setBusy(false)
    if (error) return toast(error.message, 'error')
    setDraft(d => ({ ...d, species_name: '', weight_g: '', penalty_flag: false, penalty_reason: '' }))
    load()
  }

  const removeFish = async (id) => {
    await supabase.from('mudgeway_weighin').delete().eq('id', id)
    load()
  }

  // Scores come from the one tested engine — never recomputed inline.
  const opts = { minWeightG: event.min_fish_weight_g, fishList }
  const scored = teams.map(t => ({
    team: t,
    score: scoreTeam(
      rows.filter(r => r.team_id === t.id),
      { ...opts, cdAdjustment: Number(cd[t.id]?.adjustment) || 0, disqualified: !!cd[t.id]?.disqualified }
    ),
  }))
  const defender = scored.find(s => s.team.role === 'defender')
  const challengers = scored.filter(s => s.team.role === 'challenger')

  let outcome = null
  if (defender && challengers.length > 0) {
    outcome = determineOutcome(
      { teamId: defender.team.id, clubId: defender.team.club_id, score: defender.score },
      challengers.map(c => ({ teamId: c.team.id, clubId: c.team.club_id, score: c.score })),
    )
  }

  const confirmResult = async () => {
    if (!outcome) return
    if (!window.confirm(
      `Confirm this result?\n\n${outcome.reason}\n\nThis moves the trophy if it changes hands, awards stars, and opens the 7-day dispute window.`
    )) return
    setBusy(true)
    const payload = {
      is_no_contest: outcome.isNoContest,
      trophy_moves_to: outcome.trophyMovesTo,
      stars_for: outcome.starsFor || [],
      results: scored.map(s => {
        const o = outcome.results.find(r => r.teamId === s.team.id)
        return {
          team_id: s.team.id,
          fish_count: s.score.fishCount,
          bulk_weight_g: s.score.bulkWeightG,
          species_points: s.score.speciesPoints,
          weight_points: s.score.weightPoints,
          penalty_points: s.score.penaltyPoints,
          cd_adjustment: s.score.cdAdjustment,
          cd_adjustment_note: cd[s.team.id]?.note || null,
          disqualified: s.score.disqualified,
          total_points: s.score.totalPoints,
          outcome: o?.outcome || null,
        }
      }),
    }
    const { data, error } = await supabase.rpc('confirm_mudgeway_result', {
      p_event_id: event.id, p_payload: payload, p_actor: null,
    })
    setBusy(false)
    if (error) return toast(error.message, 'error')
    if (!data?.ok) return toast(data?.error || 'Could not confirm', 'error')
    toast('Result confirmed')
    load()
  }

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="text-sm font-bold text-gray-500 hover:text-gray-700">← All events</button>

      <div>
        <h2 className="text-xl font-black text-gray-900">{event.venue || 'Mudgeway event'}</h2>
        <p className="text-sm text-gray-500">
          {fmt(event.event_date)} · {event.duration_hours}h · min {event.min_fish_weight_g}g
          {fishList.length > 0 ? ` · ${fishList.length} species on the list` : ' · no fish list set'}
        </p>
      </div>

      {confirmed && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-sm text-green-800 font-semibold">
          The result for this event has been confirmed.
        </div>
      )}

      {/* Fish list — rules 1.4 / 26.1 */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
          <div>
            <h3 className="font-black text-gray-900 text-sm">Fish list</h3>
            <p className="text-xs text-gray-400">
              {fishList.length > 0
                ? `${fishList.length} species${ev.published_at ? ' · published and locked' : ' · not published yet'}`
                : 'No species set — the event can’t be published until there is at least one.'}
            </p>
          </div>
          {!ev.published_at && !confirmed && (
            <button onClick={() => setShowPicker(true)}
              className="text-xs font-bold px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">
              {fishList.length > 0 ? 'Edit fish list' : '+ Build fish list'}
            </button>
          )}
        </div>

        {fishList.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-3">
            {fishList.map(f => (
              <span key={f.species_name} className="text-xs font-semibold px-2 py-1 rounded-lg bg-gray-50 border border-gray-200 text-gray-700">
                {f.species_name}
                {f.max_count != null && <span className="text-gray-400"> ×{f.max_count}</span>}
                {f.min_weight_g_override != null && <span className="text-gray-400"> ≥{f.min_weight_g_override}g</span>}
              </span>
            ))}
          </div>
        )}

        {!ev.published_at && (
          <button
            onClick={async () => {
              if (!window.confirm('Publish this event? The fish list and format variations lock, and challengers can then confirm their rosters.')) return
              const { data, error } = await supabase.rpc('publish_mudgeway_event', { p_event_id: ev.id, p_actor: null })
              if (error) return toast(error.message, 'error')
              if (!data?.ok) return toast(data?.error || 'Could not publish', 'error')
              toast('Event published — fish list locked'); load()
            }}
            className="w-full py-2.5 rounded-xl font-black text-white text-sm" style={{ background: SNZ_BLUE }}>
            Publish event
          </button>
        )}
      </div>

      {showPicker && (
        <FishListPicker event={ev} existing={fishList} toast={toast}
          onClose={() => setShowPicker(false)} onSaved={load} />
      )}

      {/* Add fish */}
      {!confirmed && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
          <h3 className="font-black text-gray-900 text-sm">Record a fish</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <select value={draft.team_id} onChange={e => setDraft(d => ({ ...d, team_id: e.target.value }))}
              className="border border-gray-300 rounded-lg px-2 py-2 text-sm">
              <option value="">Team…</option>
              {teams.map(t => <option key={t.id} value={t.id}>{t.clubs?.name} ({t.role})</option>)}
            </select>
            {fishList.length > 0 ? (
              <select value={draft.species_name} onChange={e => setDraft(d => ({ ...d, species_name: e.target.value }))}
                className="border border-gray-300 rounded-lg px-2 py-2 text-sm">
                <option value="">Species…</option>
                {fishList.map(f => <option key={f.species_name} value={f.species_name}>{f.species_name}</option>)}
              </select>
            ) : (
              <input value={draft.species_name} onChange={e => setDraft(d => ({ ...d, species_name: e.target.value }))}
                placeholder="Species" className="border border-gray-300 rounded-lg px-2 py-2 text-sm" />
            )}
            <input type="number" value={draft.weight_g} onChange={e => setDraft(d => ({ ...d, weight_g: e.target.value }))}
              placeholder="Weight (g)" className="border border-gray-300 rounded-lg px-2 py-2 text-sm" />
            <button onClick={addFish} disabled={busy}
              className="rounded-lg font-black text-white text-sm disabled:opacity-40" style={{ background: SNZ_BLUE }}>
              Add
            </button>
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-600 font-semibold">
            <input type="checkbox" checked={draft.penalty_flag}
              onChange={e => setDraft(d => ({ ...d, penalty_flag: e.target.checked }))} className="w-4 h-4" />
            Apply a penalty to this fish (rule 23.6, −100 pts)
          </label>
          {draft.penalty_flag && (
            <select value={draft.penalty_reason} onChange={e => setDraft(d => ({ ...d, penalty_reason: e.target.value }))}
              className="w-full border border-amber-300 rounded-lg px-2 py-2 text-sm bg-amber-50">
              <option value="">Reason…</option>
              {PENALTY_REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          )}
          {Number(draft.weight_g) > 8000 && (
            <p className="text-xs text-blue-700 font-semibold">
              Over 8 kg — rule 24.1c: this fish will contribute exactly 8 kg to the team weight.
            </p>
          )}
        </div>
      )}

      {/* Per-team scores */}
      {scored.map(({ team, score }) => (
        <div key={team.id} className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <div>
              <p className="font-black text-gray-900">{team.clubs?.name}</p>
              <p className="text-xs text-gray-400 uppercase tracking-wide font-bold">{team.role}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black" style={{ color: SNZ_BLUE }}>{score.totalPoints} pts</p>
              <p className="text-xs text-gray-400">
                {score.fishCount} fish · {kg(score.bulkWeightG)} kg
                {score.penaltyPoints !== 0 && <span className="text-red-600 font-bold"> · {score.penaltyPoints}</span>}
              </p>
            </div>
          </div>

          <div className="text-xs text-gray-500 mb-3">
            {score.speciesPoints} (fish) + {score.weightPoints} (weight)
            {score.penaltyPoints !== 0 && ` ${score.penaltyPoints} (penalties)`}
            {score.cdAdjustment !== 0 && ` ${score.cdAdjustment > 0 ? '+' : ''}${score.cdAdjustment} (CD)`}
            {score.disqualified && <span className="text-red-600 font-bold"> · DISQUALIFIED</span>}
          </div>

          <div className="space-y-1 mb-3">
            {rows.filter(r => r.team_id === team.id).map(r => {
              const penalised = score.penalties.some(p => p.species_name === r.species_name && p.weight_g === r.weight_g)
              return (
                <div key={r.id} className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg ${penalised ? 'bg-red-50' : 'bg-gray-50'}`}>
                  <span className="flex-1 font-semibold text-gray-700">{r.species_name}</span>
                  <span className="text-gray-500 tabular-nums">{r.weight_g} g</span>
                  {r.weight_g > 8000 && <span className="text-blue-600 font-bold">8kg cap</span>}
                  {penalised && <span className="text-red-600 font-bold">−100</span>}
                  {!confirmed && (
                    <button onClick={() => removeFish(r.id)} className="text-red-400 hover:text-red-600 font-bold">✕</button>
                  )}
                </div>
              )
            })}
            {rows.filter(r => r.team_id === team.id).length === 0 && (
              <p className="text-xs text-gray-400">No fish recorded.</p>
            )}
          </div>

          {!confirmed && (
            <div className="flex items-center gap-2 flex-wrap border-t border-gray-100 pt-3">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">CD (rule 25.1)</span>
              <input type="number" placeholder="±pts" value={cd[team.id]?.adjustment || ''}
                onChange={e => setCd(c => ({ ...c, [team.id]: { ...c[team.id], adjustment: e.target.value } }))}
                className="w-20 border border-gray-300 rounded-lg px-2 py-1 text-xs" />
              <input placeholder="Reason" value={cd[team.id]?.note || ''}
                onChange={e => setCd(c => ({ ...c, [team.id]: { ...c[team.id], note: e.target.value } }))}
                className="flex-1 min-w-[120px] border border-gray-300 rounded-lg px-2 py-1 text-xs" />
              <label className="flex items-center gap-1.5 text-xs font-bold text-red-600">
                <input type="checkbox" checked={!!cd[team.id]?.disqualified}
                  onChange={e => setCd(c => ({ ...c, [team.id]: { ...c[team.id], disqualified: e.target.checked } }))}
                  className="w-4 h-4" />
                DQ
              </label>
            </div>
          )}
        </div>
      ))}

      {/* Outcome */}
      {outcome && !confirmed && (
        <div className={`rounded-xl p-5 border-2 ${outcome.isNoContest ? 'bg-amber-50 border-amber-300' : 'bg-blue-50 border-blue-300'}`}>
          <h3 className="font-black text-gray-900 mb-1">Result</h3>
          <p className="text-sm text-gray-700 mb-3">{outcome.reason}</p>
          <button onClick={confirmResult} disabled={busy}
            className="w-full py-3 rounded-xl font-black text-white text-sm disabled:opacity-40"
            style={{ background: SNZ_BLUE }}>
            {busy ? 'Confirming…' : 'Confirm result'}
          </button>
          <p className="text-xs text-gray-500 mt-2 text-center">
            Moves the trophy if it changes hands, awards stars under rule 3.4, and opens the 7-day
            dispute window under rule 3.3.
          </p>
        </div>
      )}
      {!outcome && teams.length > 0 && (
        <p className="text-xs text-gray-400">
          A result needs one defender and at least one challenger on the event.
        </p>
      )}
    </div>
  )
}

// ── Committee tools ──────────────────────────────────────────────────────────
function Committee({ toast, onChanged }) {
  const [clubs, setClubs] = useState([])
  const [challenges, setChallenges] = useState([])
  const [reset, setReset] = useState({ club_id: '', reason: '' })
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const [{ data: c }, { data: ch }] = await Promise.all([
      supabase.from('clubs').select('id, name, is_affiliated, active').order('name'),
      supabase.from('mudgeway_challenges')
        .select('id, status, respond_by, submitted_at, challenger:challenger_club_id(name), defender:defender_club_id(name)')
        .order('submitted_at', { ascending: false }).limit(30),
    ])
    setClubs(c || []); setChallenges(ch || [])
  }, [])
  useEffect(() => { load() }, [load])

  const override = async (id, status) => {
    const reason = window.prompt(`Committee reason for setting challenge #${id} to "${status}":`)
    if (!reason) return
    const { data, error } = await supabase.rpc('mudgeway_committee_override', {
      p_entity: 'mudgeway_challenges', p_entity_id: id, p_status: status, p_reason: reason, p_actor: null,
    })
    if (error) return toast(error.message, 'error')
    if (!data?.ok) return toast(data?.error, 'error')
    toast(`Challenge #${id} set to ${status}`); load(); onChanged?.()
  }

  const doReset = async () => {
    if (!reset.club_id || !reset.reason.trim()) return
    setBusy(true)
    const { data, error } = await supabase.rpc('mudgeway_reset_holder', {
      p_club_id: Number(reset.club_id), p_reason: reset.reason, p_actor: null,
    })
    setBusy(false)
    if (error) return toast(error.message, 'error')
    if (!data?.ok) return toast(data?.error, 'error')
    toast('Holder reset'); setReset({ club_id: '', reason: '' }); onChanged?.()
  }

  const toggleClub = async (c, field) => {
    await supabase.from('clubs').update({ [field]: !c[field] }).eq('id', c.id)
    load()
  }

  return (
    <div className="space-y-5">
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-black text-gray-900 mb-1">Challenges</h3>
        <p className="text-xs text-gray-400 mb-3">
          Rule 2.1 — a challenge not swum within six weeks can be marked lapsed. Every override is logged.
        </p>
        <div className="space-y-2">
          {challenges.map(c => {
            const overdue = new Date() > new Date(c.respond_by) && c.status === 'submitted'
            return (
              <div key={c.id} className="flex items-center gap-2 flex-wrap border border-gray-100 rounded-lg px-3 py-2">
                <div className="flex-1 min-w-[180px]">
                  <p className="text-sm font-bold text-gray-900">
                    #{c.id} {c.challenger?.name} → {c.defender?.name}
                  </p>
                  <p className="text-xs text-gray-400">
                    Lodged {fmt(c.submitted_at)} · due {fmt(c.respond_by)}
                    {overdue && <span className="text-red-600 font-bold"> · overdue</span>}
                  </p>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{c.status}</span>
                {overdue && (
                  <button onClick={() => override(c.id, 'lapsed')}
                    className="text-xs font-bold px-2 py-1 rounded-lg border border-amber-300 text-amber-700 hover:bg-amber-50">
                    Mark lapsed
                  </button>
                )}
                {c.status !== 'cancelled' && c.status !== 'completed' && (
                  <button onClick={() => override(c.id, 'withdrawn')}
                    className="text-xs font-bold px-2 py-1 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">
                    Withdraw
                  </button>
                )}
              </div>
            )
          })}
          {challenges.length === 0 && <p className="text-xs text-gray-400">No challenges yet.</p>}
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-black text-gray-900 mb-1">Reset the holder</h3>
        <p className="text-xs text-gray-400 mb-3">
          For dormancy or correction — the rules are silent on this, so a reason is required and logged.
        </p>
        <div className="flex gap-2 flex-wrap">
          <select value={reset.club_id} onChange={e => setReset(r => ({ ...r, club_id: e.target.value }))}
            className="border border-gray-300 rounded-lg px-2 py-2 text-sm">
            <option value="">Club…</option>
            {clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input value={reset.reason} onChange={e => setReset(r => ({ ...r, reason: e.target.value }))}
            placeholder="Reason (required)"
            className="flex-1 min-w-[180px] border border-gray-300 rounded-lg px-2 py-2 text-sm" />
          <button onClick={doReset} disabled={busy || !reset.club_id || !reset.reason.trim()}
            className="px-4 rounded-lg font-black text-white text-sm disabled:opacity-40" style={{ background: '#b91c1c' }}>
            Reset
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h3 className="font-black text-gray-900 mb-1">Club register</h3>
        <p className="text-xs text-gray-400 mb-3">
          Only affiliated, active clubs can lodge a challenge.
        </p>
        <div className="space-y-1">
          {clubs.map(c => (
            <div key={c.id} className="flex items-center gap-3 px-3 py-2 border border-gray-100 rounded-lg">
              <span className="flex-1 text-sm font-semibold text-gray-800">{c.name}</span>
              <label className="flex items-center gap-1.5 text-xs font-bold text-gray-600">
                <input type="checkbox" checked={c.is_affiliated} onChange={() => toggleClub(c, 'is_affiliated')} className="w-4 h-4" />
                Affiliated
              </label>
              <label className="flex items-center gap-1.5 text-xs font-bold text-gray-600">
                <input type="checkbox" checked={c.active} onChange={() => toggleClub(c, 'active')} className="w-4 h-4" />
                Active
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Disputes ─────────────────────────────────────────────────────────────────
function Disputes({ toast }) {
  const [rows, setRows] = useState([])
  const load = useCallback(async () => {
    const { data } = await supabase.from('mudgeway_disputes')
      .select('*, clubs:raised_by_club_id(name), mudgeway_events(event_date, venue)')
      .order('raised_at', { ascending: false })
    setRows(data || [])
  }, [])
  useEffect(() => { load() }, [load])

  const decide = async (d) => {
    const decision = window.prompt('Committee decision:')
    if (!decision) return
    const { error } = await supabase.from('mudgeway_disputes')
      .update({ committee_decision: decision, decided_at: new Date().toISOString() }).eq('id', d.id)
    if (error) return toast(error.message, 'error')
    toast('Decision recorded'); load()
  }

  return (
    <div className="space-y-3">
      {rows.map(d => (
        <div key={d.id} className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
            <p className="text-sm font-black text-gray-900">
              {d.clubs?.name} · {d.mudgeway_events?.venue || 'event'} {fmt(d.mudgeway_events?.event_date)}
            </p>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${d.decided_at ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
              {d.decided_at ? 'Decided' : 'Open'}
            </span>
          </div>
          <p className="text-sm text-gray-700">{d.summary}</p>
          <p className="text-xs text-gray-400 mt-1">
            Raised {fmt(d.raised_at)} · window closes {fmt(d.closes_at)}
          </p>
          {d.committee_decision && (
            <div className="mt-2 bg-green-50 border border-green-200 rounded-lg p-2">
              <p className="text-xs font-bold text-green-800">Decision</p>
              <p className="text-xs text-green-800">{d.committee_decision}</p>
            </div>
          )}
          {!d.decided_at && (
            <button onClick={() => decide(d)}
              className="mt-2 text-xs font-bold px-3 py-1.5 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">
              Record decision
            </button>
          )}
        </div>
      ))}
      {rows.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No disputes raised.</p>}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function MudgewayAdmin() {
  const navigate = useNavigate()
  const [authed, setAuthed] = useState(isMudgewayAdmin())
  const [tab, setTab] = useState('events')
  const [events, setEvents] = useState([])
  const [selected, setSelected] = useState(null)
  const [toastMsg, setToastMsg] = useState(null)

  const toast = (msg, type = 'success') => { setToastMsg({ msg, type }); setTimeout(() => setToastMsg(null), 3000) }

  const loadEvents = useCallback(async () => {
    const { data } = await supabase.from('mudgeway_events')
      .select('*, clubs:defender_club_id(name), mudgeway_results(confirmed_at)')
      .order('event_date', { ascending: false })
    setEvents(data || [])
  }, [])
  useEffect(() => { if (authed) loadEvents() }, [authed, loadEvents])

  if (!authed) return <Gate onOk={() => setAuthed(true)} />

  return (
    <div className="min-h-screen bg-gray-50">
      <div style={{ background: SNZ_DARK }} className="px-6 py-3 flex items-center border-b border-blue-900">
        <button onClick={() => navigate('/mudgeway')}
          className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
          ← Mudgeway
        </button>
        <span className="text-white/50 mx-2">/</span>
        <span className="text-white font-bold text-sm">Admin</span>
      </div>

      {toastMsg && (
        <div className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl text-sm font-bold text-white shadow-lg ${toastMsg.type === 'error' ? 'bg-red-600' : 'bg-gray-900'}`}>
          {toastMsg.msg}
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 py-6">
        {!selected && (
          <div className="flex gap-1.5 mb-5 flex-wrap">
            {[['events', 'Events & weigh-in'], ['committee', 'Committee'], ['disputes', 'Disputes']].map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)}
                className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition ${tab === k ? 'text-white border-transparent' : 'bg-white border-gray-200 text-gray-600'}`}
                style={tab === k ? { background: SNZ_BLUE } : {}}>
                {l}
              </button>
            ))}
          </div>
        )}

        {selected
          ? <WeighIn event={selected} onBack={() => { setSelected(null); loadEvents() }} toast={toast} />
          : tab === 'events' ? (
            <div className="space-y-2">
              {events.map(e => {
                const done = (e.mudgeway_results || []).some(r => r.confirmed_at)
                return (
                  <button key={e.id} onClick={() => setSelected(e)}
                    className="w-full text-left bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3 hover:border-gray-300">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-gray-900">{e.venue || 'Untitled event'}</p>
                      <p className="text-xs text-gray-400">
                        {fmt(e.event_date)} · defended by {e.clubs?.name}
                        {!e.published_at && ' · unpublished'}
                      </p>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${done ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-blue-700'}`}>
                      {done ? 'Result in' : 'Weigh-in'}
                    </span>
                  </button>
                )
              })}
              {events.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No events scheduled yet.</p>}
            </div>
          ) : tab === 'committee' ? <Committee toast={toast} onChanged={loadEvents} />
          : <Disputes toast={toast} />}
      </div>
    </div>
  )
}
