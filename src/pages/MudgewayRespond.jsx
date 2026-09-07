import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useMemberSession, MemberAuthGate } from '../components/MemberAuthGate'

const SNZ_BLUE = '#2B6CB0'
const SNZ_DARK = '#1e3a5f'

const norm = (s) => (s || '').trim().toLowerCase()
const fmt = (d) => d ? new Date(d).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'
const addDays = (n) => {
  const d = new Date(); d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

export default function MudgewayRespond() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { session, member, loading: sessionLoading } = useMemberSession()

  const [challenge, setChallenge] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState(null)          // null | 'refuse' | 'schedule'
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [done, setDone] = useState(null)

  const [reason, setReason] = useState('')
  const [form, setForm] = useState({
    event_date: '', venue: '', area: '', start_time: '08:00',
    duration_hours: 6, min_weight_g: 500, gutted_min_g: '', format_notes: '',
    override_reason: '',
  })
  const set = k => v => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('mudgeway_challenges')
        .select('*, challenger:challenger_club_id(name), defender:defender_club_id(name)')
        .eq('id', id).maybeSingle()
      setChallenge(data || null)
      setLoading(false)
    })()
  }, [id])

  // No per-user roles exist in the Hub, so "is this the defending club?" is
  // approximated by the member's own club. This is a UI guard, not a security
  // boundary — the rules themselves are enforced server-side.
  const isDefenderMember = challenge && member?.club &&
    norm(member.club) === norm(challenge.defender?.name)

  const doRefuse = async () => {
    setBusy(true); setResult(null)
    const { data, error } = await supabase.rpc('refuse_mudgeway_challenge', {
      p_challenge_id: Number(id), p_reason: reason, p_actor: member?.id || null,
    })
    setBusy(false)
    if (error) return setResult({ ok: false, rule: '—', error: error.message })
    if (data?.ok) return setDone({ kind: 'refused' })
    setResult(data)
  }

  const doSchedule = async () => {
    setBusy(true); setResult(null)
    const { data, error } = await supabase.rpc('schedule_mudgeway_event', {
      p_challenge_id: Number(id),
      p_event_date: form.event_date,
      p_venue: form.venue || null,
      p_area: form.area || null,
      p_start_time: form.start_time || null,
      p_duration_hours: Number(form.duration_hours),
      p_min_weight_g: Number(form.min_weight_g) || 500,
      p_gutted_min_g: form.gutted_min_g ? Number(form.gutted_min_g) : null,
      p_format_notes: form.format_notes || null,
      p_actor: member?.id || null,
      p_override_reason: form.override_reason || null,
    })
    setBusy(false)
    if (error) return setResult({ ok: false, rule: '—', error: error.message })
    if (data?.ok) return setDone({ kind: 'scheduled', ...data })
    setResult(data)
  }

  const Header = () => (
    <div style={{ background: SNZ_DARK }} className="px-6 py-3 flex items-center border-b border-blue-900">
      <button onClick={() => navigate('/mudgeway')}
        className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
        ← Mudgeway
      </button>
      <span className="text-white/50 mx-2">/</span>
      <span className="text-white font-bold text-sm">Respond to Challenge</span>
    </div>
  )

  if (sessionLoading || loading) {
    return <div className="min-h-screen bg-gray-50"><Header />
      <div className="text-center py-16 text-gray-400 text-sm">Loading…</div></div>
  }
  if (!session) {
    return <div className="min-h-screen bg-gray-50"><Header />
      <div className="max-w-md mx-auto px-4 py-8">
        <MemberAuthGate message="Sign in to respond to a Mudgeway challenge." />
      </div></div>
  }
  if (!challenge) {
    return <div className="min-h-screen bg-gray-50"><Header />
      <div className="text-center py-16 text-gray-400 text-sm">Challenge not found.</div></div>
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gray-50"><Header />
        <div className="max-w-md mx-auto px-4 py-10">
          <div className="bg-white border border-green-200 rounded-2xl p-8 text-center space-y-4">
            <div className="text-5xl">{done.kind === 'refused' ? '✋' : '📅'}</div>
            <h1 className="text-2xl font-black text-gray-900">
              {done.kind === 'refused' ? 'Challenge refused' : 'Challenge scheduled'}
            </h1>
            <p className="text-gray-600 text-sm">
              {done.kind === 'refused'
                ? 'The refusal has been recorded against the challenge with your written reason.'
                : done.attached_to_existing
                  ? 'This challenger has been added to your existing event on that date — both clubs will swim on the same day (rule 2.3).'
                  : 'The event has been created. Add the fish list, then publish it to lock the details and notify the challengers.'}
            </p>
            {(done.warnings || []).map((w, i) => (
              <div key={i} className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-left">
                <p className="text-xs font-black text-amber-800 uppercase tracking-wide mb-1">Rule {w.rule}</p>
                <p className="text-xs text-amber-800">{w.message}</p>
              </div>
            ))}
            <button onClick={() => navigate('/mudgeway')}
              className="w-full py-3 rounded-xl font-black text-white text-sm" style={{ background: SNZ_BLUE }}>
              Back to the Mudgeway
            </button>
          </div>
        </div>
      </div>
    )
  }

  const overdue = new Date() > new Date(challenge.respond_by)
  const beyondDeadline = form.event_date && new Date(form.event_date) > new Date(challenge.respond_by)

  return (
    <div className="min-h-screen bg-gray-50"><Header />
      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">

        <div>
          <h1 className="text-2xl font-black text-gray-900">
            {challenge.challenger?.name} have challenged
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            Lodged {fmt(challenge.submitted_at)} · to be swum by{' '}
            <strong className={overdue ? 'text-red-600' : ''}>{fmt(challenge.respond_by)}</strong>
            {overdue && ' — overdue'}
          </p>
          {challenge.message && (
            <div className="bg-white border border-gray-200 rounded-xl p-3 mt-3">
              <p className="text-xs text-gray-400 font-bold uppercase tracking-wide mb-1">Their message</p>
              <p className="text-sm text-gray-700">{challenge.message}</p>
            </div>
          )}
        </div>

        {challenge.status !== 'submitted' && (
          <div className="bg-gray-100 border border-gray-200 rounded-xl p-4 text-sm text-gray-600">
            This challenge is <strong>{challenge.status}</strong> — no further response is needed.
          </div>
        )}

        {!isDefenderMember && challenge.status === 'submitted' && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-xs text-amber-800">
              Your profile doesn’t list you as a member of <strong>{challenge.defender?.name}</strong>,
              who hold the trophy. Only the defending club should respond — carry on only if you’re
              acting for them or for the committee.
            </p>
          </div>
        )}

        {result && !result.ok && (
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
            <p className="text-xs font-black text-red-700 uppercase tracking-wide mb-1">
              {result.rule && result.rule !== '—' ? `Rule ${result.rule}` : 'Cannot continue'}
            </p>
            <p className="text-sm text-red-800">{result.error}</p>
          </div>
        )}

        {challenge.status === 'submitted' && !mode && (
          <div className="space-y-3">
            <button onClick={() => setMode('schedule')}
              className="w-full py-4 rounded-xl font-black text-white text-base" style={{ background: SNZ_BLUE }}>
              Accept &amp; set a date →
            </button>
            <button onClick={() => setMode('refuse')}
              disabled={!challenge.counts_toward_refusal_limit}
              className="w-full py-3 rounded-xl font-bold text-sm border-2 border-gray-200 text-gray-600 bg-white disabled:opacity-50 disabled:cursor-not-allowed">
              Refuse this challenge
            </button>
            {!challenge.counts_toward_refusal_limit && (
              <p className="text-xs text-gray-400 text-center leading-relaxed">
                Rule 2.4 — a challenge can only be refused once the same club has already placed two
                challenges this season and you’ve held the trophy throughout. That doesn’t apply here,
                so this challenge must be accepted.
              </p>
            )}
          </div>
        )}

        {mode === 'refuse' && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <h2 className="font-black text-gray-900">Refuse under rule 2.4</h2>
            <p className="text-xs text-gray-500">
              A refusal must be in writing. This reason is recorded against the challenge and shown to
              the challenging club.
            </p>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={4}
              placeholder="Why is this challenge being refused?"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            <div className="flex gap-2">
              <button onClick={() => { setMode(null); setResult(null) }}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm border border-gray-300 text-gray-600">Back</button>
              <button onClick={doRefuse} disabled={busy || !reason.trim()}
                className="flex-1 py-2.5 rounded-xl font-black text-white text-sm disabled:opacity-40"
                style={{ background: '#b91c1c' }}>
                {busy ? 'Recording…' : 'Confirm refusal'}
              </button>
            </div>
          </div>
        )}

        {mode === 'schedule' && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <h2 className="font-black text-gray-900">Set the date and conditions</h2>
            <p className="text-xs text-gray-500">
              As holder you set the date, venue, competition area and fish list (rules 2.2, 1.4).
            </p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Date *</label>
                <input type="date" value={form.event_date} min={addDays(0)}
                  onChange={e => set('event_date')(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Start time</label>
                <input type="time" value={form.start_time} onChange={e => set('start_time')(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
            </div>

            {beyondDeadline && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-xs font-black text-red-700 uppercase tracking-wide mb-1">Rule 2.1</p>
                <p className="text-xs text-red-800 mb-2">
                  That date is beyond the six-week deadline of {fmt(challenge.respond_by)}. The
                  committee must record why.
                </p>
                <input value={form.override_reason} onChange={e => set('override_reason')(e.target.value)}
                  placeholder="Committee reason for the later date"
                  className="w-full border border-red-300 rounded-lg px-2.5 py-2 text-sm bg-white" />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Venue *</label>
              <input value={form.venue} onChange={e => set('venue')(e.target.value)}
                placeholder="e.g. Tairua, Coromandel"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Competition area</label>
              <textarea value={form.area} onChange={e => set('area')(e.target.value)} rows={2}
                placeholder="Describe the boundaries of the competition area."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Hours</label>
                <select value={form.duration_hours} onChange={e => set('duration_hours')(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm">
                  {[4, 4.5, 5, 5.5, 6].map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Min (g)</label>
                <input type="number" value={form.min_weight_g} onChange={e => set('min_weight_g')(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Gutted (g)</label>
                <input type="number" value={form.gutted_min_g} onChange={e => set('gutted_min_g')(e.target.value)}
                  placeholder="450"
                  className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm" />
              </div>
            </div>
            <p className="text-xs text-gray-400 -mt-2">
              Rule 1.3: 4–6 hours. Rules 23.1–23.2: 500 g minimum, or 450 g gutted/gilled at the CD’s discretion.
            </p>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
                Format variations <span className="text-gray-400 font-normal normal-case">(rule 1.4, optional)</span>
              </label>
              <textarea value={form.format_notes} onChange={e => set('format_notes')(e.target.value)} rows={2}
                placeholder="Any variation to the standard format. Published with the fish list and locked once you publish."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>

            <div className="flex gap-2">
              <button onClick={() => { setMode(null); setResult(null) }}
                className="flex-1 py-2.5 rounded-xl font-bold text-sm border border-gray-300 text-gray-600">Back</button>
              <button onClick={doSchedule} disabled={busy || !form.event_date || !form.venue.trim()}
                className="flex-1 py-2.5 rounded-xl font-black text-white text-sm disabled:opacity-40"
                style={{ background: SNZ_BLUE }}>
                {busy ? 'Saving…' : 'Schedule it'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
