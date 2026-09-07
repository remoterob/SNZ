import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useMemberSession, MemberAuthGate } from '../components/MemberAuthGate'

const SNZ_BLUE = '#2B6CB0'
const SNZ_DARK = '#1e3a5f'

const norm = (s) => (s || '').trim().toLowerCase()

export default function MudgewayChallenge() {
  const navigate = useNavigate()
  const { session, member, loading: sessionLoading } = useMemberSession()

  const [clubs, setClubs] = useState([])
  const [holder, setHolder] = useState(null)
  const [clubId, setClubId] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)   // { ok, rule, error, warnings, challenge_id }
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const [{ data: cl }, { data: h }] = await Promise.all([
        supabase.from('clubs').select('id, name, is_affiliated, active')
          .eq('active', true).order('name'),
        supabase.from('mudgeway_holder_history')
          .select('club_id, held_from, clubs(name)').is('held_until', null).maybeSingle(),
      ])
      setClubs(cl || [])
      setHolder(h || null)
      setLoading(false)
    })()
  }, [])

  // Best-effort match of the member's free-text club against the register.
  useEffect(() => {
    if (clubId || !member?.club || clubs.length === 0) return
    const hit = clubs.find(c => norm(c.name) === norm(member.club))
    if (hit) setClubId(String(hit.id))
  }, [member, clubs, clubId])

  const submit = async () => {
    if (!clubId) return
    setSubmitting(true)
    setResult(null)
    const { data, error } = await supabase.rpc('submit_mudgeway_challenge', {
      p_challenger_club_id: Number(clubId),
      p_submitted_by: member?.id || null,
      p_message: message || null,
    })
    setSubmitting(false)
    if (error) { setResult({ ok: false, rule: '—', error: error.message }); return }
    setResult(data)
  }

  const holderName = holder?.clubs?.name
  const chosen = clubs.find(c => String(c.id) === clubId)

  const Header = () => (
    <div style={{ background: SNZ_DARK }} className="px-6 py-3 flex items-center border-b border-blue-900">
      <button onClick={() => navigate('/mudgeway')}
        className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
        ← Mudgeway
      </button>
      <span className="text-white/50 mx-2">/</span>
      <span className="text-white font-bold text-sm">Lodge a Challenge</span>
    </div>
  )

  if (sessionLoading || loading) {
    return <div className="min-h-screen bg-gray-50"><Header />
      <div className="text-center py-16 text-gray-400 text-sm">Loading…</div></div>
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50"><Header />
        <div className="max-w-md mx-auto px-4 py-8">
          <MemberAuthGate message="Sign in to lodge a Mudgeway challenge on behalf of your club." />
        </div>
      </div>
    )
  }

  // Success
  if (result?.ok) {
    return (
      <div className="min-h-screen bg-gray-50"><Header />
        <div className="max-w-md mx-auto px-4 py-10">
          <div className="bg-white border border-green-200 rounded-2xl p-8 text-center space-y-4">
            <div className="text-5xl">🏆</div>
            <h1 className="text-2xl font-black text-gray-900">Challenge lodged</h1>
            <p className="text-gray-600 text-sm">
              <strong>{chosen?.name}</strong> has challenged <strong>{holderName}</strong> for the
              Mudgeway Trophy. It sits in the queue in order of receipt, and the holder has six weeks
              to set a date and venue.
            </p>
            <p className="text-xs text-gray-400">Challenge #{result.challenge_id}</p>

            {(result.warnings || []).length > 0 && (
              <div className="text-left space-y-2">
                {result.warnings.map((w, i) => (
                  <div key={i} className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <p className="text-xs font-black text-amber-800 uppercase tracking-wide mb-1">Rule {w.rule}</p>
                    <p className="text-xs text-amber-800">{w.message}</p>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-left">
              <p className="text-xs text-blue-800">
                Rule 2.1 requires challenges to be in writing. This record is that writing — but
                until automatic notices are switched on, please also let the SNZ secretary know at{' '}
                <a href="mailto:secretary@spearfishingnz.co.nz" className="underline font-semibold">
                  secretary@spearfishingnz.co.nz</a>.
              </p>
            </div>

            <button onClick={() => navigate('/mudgeway')}
              className="w-full py-3 rounded-xl font-black text-white text-sm" style={{ background: SNZ_BLUE }}>
              Back to the Mudgeway
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50"><Header />
      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Challenge for the Mudgeway</h1>
          {holderName ? (
            <p className="text-gray-500 text-sm mt-1">
              <strong>{holderName}</strong> currently hold the trophy. They set the date, venue,
              competition area and fish list, and must be beaten on the day to give it up.
            </p>
          ) : (
            <p className="text-gray-500 text-sm mt-1">No current holder is recorded.</p>
          )}
        </div>

        {result && !result.ok && (
          <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4">
            <p className="text-xs font-black text-red-700 uppercase tracking-wide mb-1">
              {result.rule && result.rule !== '—' ? `Rule ${result.rule}` : 'Cannot lodge'}
            </p>
            <p className="text-sm text-red-800">{result.error}</p>
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
              Challenging club <span className="text-red-400">*</span>
            </label>
            <select value={clubId} onChange={e => { setClubId(e.target.value); setResult(null) }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
              <option value="">Select your club…</option>
              {clubs.filter(c => c.id !== holder?.club_id).map(c => (
                <option key={c.id} value={c.id} disabled={!c.is_affiliated}>
                  {c.name}{c.is_affiliated ? '' : ' (not affiliated)'}
                </option>
              ))}
            </select>
            {member?.club && !clubs.some(c => norm(c.name) === norm(member.club)) && (
              <p className="text-xs text-amber-600 mt-1.5">
                Your profile lists “{member.club}”, which isn’t on the club register yet. Pick the
                right club above, or ask the secretary to add it.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
              Message to the holder <span className="text-gray-400 font-normal normal-case">(optional)</span>
            </label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3}
              placeholder="Anything you'd like to say — preferred dates, who to contact, and so on."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-xs font-black text-blue-900 mb-1.5">Before you lodge</p>
          <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside leading-relaxed">
            <li>Challenges are swum in the order they’re received (rule 2.1).</li>
            <li>The holder has six weeks from receipt to set a date (rule 2.1).</li>
            <li>Your team will be 3–6 pairs, and every competitor must be a financial SNZ member (rules 1.5, 3.1).</li>
            <li>A club that has just lost the trophy can’t challenge again for a month (rule 2.5).</li>
          </ul>
        </div>

        <button onClick={submit} disabled={submitting || !clubId}
          className="w-full py-3.5 rounded-xl font-black text-white text-base disabled:opacity-40"
          style={{ background: SNZ_BLUE }}>
          {submitting ? 'Lodging…' : 'Lodge Challenge →'}
        </button>
      </div>
    </div>
  )
}
