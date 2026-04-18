import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useMemberSession, MemberAuthGate } from '../components/MemberAuthGate'

const SNZ_BLUE = '#2B6CB0'
const SNZ_DARK = '#1e3a5f'
const SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL']

const EVENT_LABELS = {
  open: { label: '🏆 2-Day Open Championship', individual: false },
  womens: { label: "🔱 Women's Championship", individual: false },
  juniors: { label: '🌟 Junior Championship', individual: false },
  goldenoldie: { label: '🎖️ Golden Oldie', individual: false },
  silveroldie: { label: '🥈 Silver Oldie', individual: false },
  photography_d2: { label: '📸 Snorkel Photography', individual: true },
  finswim_d2: { label: '🐟 Fin Swimming', individual: true },
  under23_d2: { label: '🎯 Under 23 Division', individual: true },
  superdiver_d2: { label: '⭐ Super Diver', individual: false },
}

function resolveFeeCents(eventId, categoryFees, isEarlyBird) {
  if (!categoryFees) return null
  // Strip _d2 suffix for fee lookup
  const key = eventId.replace('_d2', '')
  const ev = categoryFees[key]
  if (!ev) return 0
  if (isEarlyBird && ev.early_bird != null) return ev.early_bird
  return ev.standard ?? 0
}

export default function NationalsConfirm() {
  const navigate = useNavigate()
  const location = useLocation()
  const { session, member, loading: sessionLoading } = useMemberSession()

  const [team, setTeam] = useState(null)
  const [comp, setComp] = useState(null)
  const [d1Member, setD1Member] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Safety & compliance
  const [emergencyContact, setEmergencyContact] = useState('')
  const [emergencyPhone, setEmergencyPhone] = useState('')
  const [fitToDive, setFitToDive] = useState(false)
  const [rulesAck, setRulesAck] = useState(false)
  const [safetyError, setSafetyError] = useState('')

  // Pre-fill emergency contact from member profile
  useEffect(() => {
    if (member?.emergency_contact) setEmergencyContact(member.emergency_contact)
    if (member?.emergency_phone) setEmergencyPhone(member.emergency_phone)
  }, [member])

  // Diver 2's own selections
  const [myEvents, setMyEvents] = useState({
    photography_d2: false,
    finswim_d2: false,
    under23_d2: false,
  })
  const [jacket, setJacket] = useState({ gender: '', size: '' })
  const [shirt, setShirt] = useState({ gender: '', size: '' })
  const [mealQty, setMealQty] = useState(0)

  const params = new URLSearchParams(location.search)
  const teamId = params.get('team')

  // Handle Stripe return
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    if (p.get('payment') === 'success' && teamId) {
      supabase.from('comp_teams').update({
        diver2_payment_status: 'paid',
        status: 'active',
        diver2_member_id: session?.user?.id || null,
        diver2_accepted_at: new Date().toISOString(),
      }).eq('id', teamId).then(() => {
        window.history.replaceState({}, '', `/nationals/confirm?team=${teamId}`)
        setSubmitted(true)
      })
    }
  }, [session])

  // Fetch team and comp
  useEffect(() => {
    if (!teamId) { setError('No team ID provided.'); setLoading(false); return }
    const fetchTeam = async () => {
      const { data: teamData, error: teamErr } = await supabase
        .from('comp_teams').select('*').eq('id', teamId).maybeSingle()
      if (teamErr || !teamData) { setError('Team not found.'); setLoading(false); return }
      setTeam(teamData)

      // Fetch comp
      const { data: compData } = await supabase
        .from('competitions').select('*').eq('id', teamData.competition_id).maybeSingle()
      setComp(compData)

      // Fetch diver 1
      if (teamData.diver1_member_id) {
        const { data: d1 } = await supabase.from('members')
          .select('name, email').eq('id', teamData.diver1_member_id).maybeSingle()
        setD1Member(d1)
      }

      // Pre-populate D2's existing selections from nationals_event
      const ev = teamData.nationals_event || {}
      setMyEvents({
        photography_d2: !!ev.photography_d2,
        finswim_d2: !!ev.finswim_d2,
        under23_d2: !!ev.under23_d2,
      })

      // Pre-populate existing merch_d2 if any
      const m2 = teamData.merch_d2 || {}
      if (m2.jacket) setJacket(m2.jacket)
      if (m2.shirt) setShirt(m2.shirt)
      if (m2.meal_qty) setMealQty(m2.meal_qty)

      setLoading(false)
    }
    fetchTeam()
  }, [teamId])

  if (sessionLoading || loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-400 text-sm">Loading…</p>
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="text-center">
        <p className="text-4xl mb-3">⚠️</p>
        <p className="font-black text-gray-900 mb-2">Something went wrong</p>
        <p className="text-gray-500 text-sm mb-4">{error}</p>
        <button onClick={() => navigate('/nationals')}
          className="px-4 py-2 rounded-xl font-bold text-white text-sm"
          style={{ background: SNZ_BLUE }}>Back to Nationals</button>
      </div>
    </div>
  )

  // Already confirmed
  if (team?.diver2_payment_status === 'paid' && !submitted) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-sm w-full text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <span className="text-green-600 text-2xl">✓</span>
        </div>
        <h1 className="text-2xl font-black text-gray-900 mb-2">Already confirmed!</h1>
        <p className="text-gray-500 text-sm mb-6">Your entry for <strong>{team.team_name}</strong> at SNZ Nationals 2027 is confirmed and paid.</p>
        <button onClick={() => navigate('/membership')}
          className="w-full py-3 rounded-xl font-black text-white text-sm" style={{ background: SNZ_BLUE }}>
          View My Membership →
        </button>
      </div>
    </div>
  )

  // Success screen
  if (submitted) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-sm w-full text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <span className="text-green-600 text-2xl">✓</span>
        </div>
        <h1 className="text-2xl font-black text-gray-900 mb-2">You're confirmed!</h1>
        <p className="text-gray-500 text-sm mb-2">
          You're registered for <strong>{team?.team_name}</strong> at SNZ Nationals 2027 in Tairua, Coromandel.
        </p>
        <p className="text-gray-400 text-sm mb-6">19–24 January 2027</p>
        <div className="flex flex-col gap-3">
          <button onClick={() => navigate('/membership')}
            className="w-full py-3 rounded-xl font-black text-white text-sm" style={{ background: SNZ_BLUE }}>
            View My Registrations →
          </button>
          <button onClick={() => navigate('/nationals')}
            className="w-full py-2.5 rounded-xl font-bold text-sm border border-gray-200 text-gray-600 hover:bg-white">
            Back to Nationals
          </button>
        </div>
      </div>
    </div>
  )

  // Not signed in — must sign in or create account
  if (!session) return (
    <div className="min-h-screen bg-gray-50">
      <div style={{ background: SNZ_DARK }} className="px-6 py-3 flex items-center border-b border-blue-900">
        <button onClick={() => navigate('/nationals')}
          className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
          ← Nationals
        </button>
      </div>
      <div className="max-w-md mx-auto px-4 py-8">
        {team && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 mb-6">
            <p className="font-black text-blue-900 mb-1">You've been invited to team up!</p>
            <p className="text-sm text-blue-800">
              <strong>{d1Member?.name || 'Your partner'}</strong> has registered you for{' '}
              <strong>{team.team_name}</strong> at SNZ Nationals 2027.
            </p>
            <p className="text-xs text-blue-600 mt-2">Sign in or create your SNZ account to confirm and pay your entry.</p>
          </div>
        )}
        <MemberAuthGate message="Sign in to confirm your Nationals entry and pay your fee." />
      </div>
    </div>
  )

  // Signed in — show review and pay page
  const categoryFees = comp?.category_fees || null
  const isEarlyBird = comp?.early_bird_cutoff ? new Date() < new Date(comp.early_bird_cutoff) : false
  const entriesClosed = comp?.registration_cutoff ? new Date() > new Date(comp.registration_cutoff) : false

  const getFee = (eventId) => resolveFeeCents(eventId, categoryFees, isEarlyBird)
  const getMerchFee = (type) => categoryFees?.merch?.[type]?.price ?? null
  const getMealFee = () => categoryFees?.meal?.price ?? null

  // Team events Diver 1 entered for the team (read-only for D2)
  const teamEvents = team?.nationals_event || {}
  const teamEventEntries = Object.entries(EVENT_LABELS)
    .filter(([key, ev]) => !ev.individual && teamEvents[key])

  // D2's own events (can toggle)
  const individualEventKeys = ['photography_d2', 'finswim_d2', 'under23_d2']

  // Calculate D2's total
  const calcTotal = () => {
    let total = 0
    // Team events — D2 pays their share
    teamEventEntries.forEach(([key]) => {
      const f = getFee(key)
      if (f) total += f
    })
    // Individual events D2 selected
    individualEventKeys.forEach(key => {
      if (myEvents[key]) {
        const f = getFee(key)
        if (f) total += f
      }
    })
    // Merch
    const jFee = getMerchFee('jacket')
    if (jFee && jacket.gender && jacket.size) total += jFee
    const sFee = getMerchFee('shirt')
    if (sFee && shirt.gender && shirt.size) total += sFee
    const mFee = getMealFee()
    if (mFee && mealQty > 0) total += mFee * mealQty
    return total
  }

  const handleConfirm = async () => {
    setSafetyError('')
    // Validate safety fields
    const errs = []
    if (!emergencyContact.trim()) errs.push('Emergency contact name is required')
    if (!emergencyPhone.trim()) errs.push('Emergency contact phone is required')
    if (!fitToDive) errs.push('You must confirm you are fit to dive')
    if (!rulesAck) errs.push('You must acknowledge the competition rules')
    if (errs.length) { setSafetyError(errs.join(' · ')); return }
    setSubmitting(true)
    setError('')
    try {
      // Update team with D2's event selections and merch
      const updatedEvents = {
        ...teamEvents,
        photography_d2: myEvents.photography_d2,
        finswim_d2: myEvents.finswim_d2,
        under23_d2: myEvents.under23_d2,
        // Auto superdiver D2 if Open + Photo + FinSwim
        superdiver_d2: !!(teamEvents.open && myEvents.photography_d2 && myEvents.finswim_d2),
      }

      const merch_d2 = {
        jacket: jacket.gender && jacket.size ? jacket : null,
        shirt: shirt.gender && shirt.size ? shirt : null,
        meal_qty: mealQty,
      }

      // Save emergency contact to member profile
      await supabase.from('members').update({
        emergency_contact: emergencyContact.trim(),
        emergency_phone: emergencyPhone.trim(),
      }).eq('id', session.user.id)

      const { error: updateErr } = await supabase.from('comp_teams').update({
        diver2_member_id: session.user.id,
        diver2_accepted_at: new Date().toISOString(),
        nationals_event: updatedEvents,
        merch_d2,
      }).eq('id', teamId)
      if (updateErr) throw updateErr

      // Also link to member_competitions
      await supabase.from('member_competitions').upsert({
        member_id: session.user.id,
        competition_id: team.competition_id,
        team_id: teamId,
        year: 2027,
      }, { onConflict: 'member_id,competition_id' })

      const totalCents = calcTotal()

      if (totalCents > 0) {
        const res = await fetch('/.netlify/functions/create-checkout-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'nationals_entry',
            amountCents: totalCents,
            memberId: session.user.id,
            memberEmail: session.user.email,
            memberName: member?.name || '',
            teamId,
            competitionId: team.competition_id,
            competitionName: 'SNZ Nationals 2027',
          }),
        })
        const { url, error: stripeErr } = await res.json()
        if (stripeErr) throw new Error(stripeErr)
        window.location.href = url
        return
      }

      // No fee (waived / TBC) — just confirm
      await supabase.from('comp_teams').update({
        diver2_payment_status: 'paid',
        status: 'active',
      }).eq('id', teamId)
      setSubmitted(true)
    } catch (e) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const totalCents = calcTotal()
  const hasTBCFees = categoryFees === null
  const superDiverD2 = !!(teamEvents.open && myEvents.photography_d2 && myEvents.finswim_d2)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div style={{ background: SNZ_DARK }} className="px-6 py-3 flex items-center border-b border-blue-900">
        <button onClick={() => navigate('/nationals')}
          className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
          ← Nationals
        </button>
        <span className="text-white/50 mx-2">/</span>
        <span className="text-white font-bold text-sm">Confirm Entry</span>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8 space-y-5">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Confirm Your Entry</h1>
          <p className="text-gray-500 text-sm mt-1">Tairua, Coromandel · 19–24 January 2027</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">• {error}</div>
        )}

        {entriesClosed && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
            <p className="font-black text-red-800 text-sm">Entries are closed</p>
            <p className="text-xs text-red-600 mt-0.5">The registration deadline has passed. Contact SNZ if you have questions.</p>
          </div>
        )}

        {/* Invitation info */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
          <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-1">Your Invitation</p>
          <p className="font-black text-gray-900">{team?.team_name}</p>
          <p className="text-sm text-gray-600 mt-0.5">
            Registered by <strong>{d1Member?.name || 'your partner'}</strong>
          </p>
          <p className="text-xs text-gray-400 mt-1">You are Diver 2 on this team.</p>
        </div>

        {/* Team events — read only */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
          <div>
            <h2 className="font-black text-gray-900 text-sm uppercase tracking-widest" style={{ color: SNZ_BLUE }}>Team Events</h2>
            <p className="text-xs text-gray-400 mt-0.5">Selected by your partner — you pay your own share of each.</p>
          </div>
          {teamEventEntries.length === 0 && (
            <p className="text-sm text-gray-400 italic">No team events selected.</p>
          )}
          {teamEventEntries.map(([key, ev]) => {
            const f = getFee(key)
            return (
              <div key={key} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <span className="text-sm text-gray-800">{ev.label}</span>
                <span className="text-sm font-bold text-gray-900">
                  {f === null ? 'TBC' : f === 0 ? 'Free' : `$${(f/100).toFixed(2)}`}
                  {isEarlyBird && f > 0 && <span className="ml-1 text-xs text-amber-600">🐦</span>}
                </span>
              </div>
            )
          })}
        </div>

        {/* Individual events — Diver 2 can toggle */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
          <div>
            <h2 className="font-black text-gray-900 text-sm uppercase tracking-widest" style={{ color: SNZ_BLUE }}>Your Individual Events</h2>
            <p className="text-xs text-gray-400 mt-0.5">Add or remove these for yourself.</p>
          </div>
          {[
            { key: 'photography_d2', label: '📸 Snorkel Photography', desc: 'Required for Super Diver.' },
            { key: 'finswim_d2', label: '🐟 Fin Swimming', desc: 'Required for Super Diver.' },
            { key: 'under23_d2', label: '🎯 Under 23 Division', desc: 'Ages 18–22 on day of competition.' },
          ].map(ev => {
            const f = getFee(ev.key)
            const selected = myEvents[ev.key]
            return (
              <div key={ev.key}
                className="border rounded-xl p-3 flex items-center gap-3 cursor-pointer"
                style={{ borderColor: selected ? SNZ_BLUE : '#e5e7eb', background: selected ? '#eff6ff' : 'white' }}
                onClick={() => setMyEvents(m => ({ ...m, [ev.key]: !m[ev.key] }))}>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 text-sm">{ev.label}</p>
                  <p className="text-xs text-gray-500">{ev.desc}</p>
                  {f === null ? <p className="text-xs text-gray-400 mt-0.5">Fee TBC</p>
                    : f === 0 ? <p className="text-xs text-gray-400 mt-0.5">No fee</p>
                    : <p className="text-xs font-bold mt-0.5" style={{ color: SNZ_BLUE }}>${(f/100).toFixed(2)}{isEarlyBird ? ' 🐦' : ''}</p>}
                </div>
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition ${selected ? 'border-transparent' : 'border-gray-300'}`}
                  style={selected ? { background: SNZ_BLUE } : {}}>
                  {selected && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
              </div>
            )
          })}
          {superDiverD2 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-2.5">
              <p className="text-xs font-black text-yellow-800">⭐ Super Diver eligible!</p>
              <p className="text-xs text-yellow-700 mt-0.5">You've entered Open, Photography & Fin Swim.</p>
            </div>
          )}
        </div>

        {/* Merch */}
        {(categoryFees?.merch || categoryFees?.meal) && (
          <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
            <div>
              <h2 className="font-black text-gray-900 text-sm uppercase tracking-widest" style={{ color: SNZ_BLUE }}>Merchandise & Meal</h2>
              <p className="text-xs text-gray-400 mt-0.5">Optional — ordered and paid for with your entry.</p>
            </div>

            {categoryFees?.merch?.jacket && (
              <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-bold text-gray-900 text-sm">🧥 Event Jacket</p>
                    <p className="text-xs text-gray-400">SNZ Nationals 2027</p>
                  </div>
                  <p className="font-black text-gray-900 text-sm">${(categoryFees.merch.jacket.price/100).toFixed(2)}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Gender fit</label>
                    <select value={jacket.gender} onChange={e => setJacket(j => ({ ...j, gender: e.target.value, size: '' }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                      <option value="">No jacket</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                  {jacket.gender && (
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Size</label>
                      <select value={jacket.size} onChange={e => setJacket(j => ({ ...j, size: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                        <option value="">Select size</option>
                        {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            )}

            {categoryFees?.merch?.shirt && (
              <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-bold text-gray-900 text-sm">👕 Event T-Shirt</p>
                    <p className="text-xs text-gray-400">SNZ Nationals 2027</p>
                  </div>
                  <p className="font-black text-gray-900 text-sm">${(categoryFees.merch.shirt.price/100).toFixed(2)}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Gender fit</label>
                    <select value={shirt.gender} onChange={e => setShirt(s => ({ ...s, gender: e.target.value, size: '' }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                      <option value="">No shirt</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                  {shirt.gender && (
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Size</label>
                      <select value={shirt.size} onChange={e => setShirt(s => ({ ...s, size: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                        <option value="">Select size</option>
                        {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            )}

            {categoryFees?.meal && (
              <div className="border border-gray-200 rounded-xl p-4">
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <p className="font-bold text-gray-900 text-sm">🍽️ Prize Giving Dinner</p>
                    <p className="text-xs text-gray-400">${(categoryFees.meal.price/100).toFixed(2)} per person — family &amp; friends welcome</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Tickets</label>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setMealQty(q => Math.max(0, q - 1))}
                      disabled={mealQty === 0}
                      className="w-8 h-8 rounded-lg border border-gray-300 text-gray-600 font-bold text-lg flex items-center justify-center hover:bg-gray-50 disabled:opacity-30">−</button>
                    <span className="w-8 text-center font-black text-gray-900">{mealQty}</span>
                    <button type="button" onClick={() => setMealQty(q => q + 1)}
                      className="w-8 h-8 rounded-lg border border-gray-300 text-gray-600 font-bold text-lg flex items-center justify-center hover:bg-gray-50">+</button>
                  </div>
                  {mealQty > 0 && <span className="text-sm font-bold text-gray-700">${(categoryFees.meal.price * mealQty / 100).toFixed(2)}</span>}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Summary */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <h2 className="font-black text-gray-900 text-sm uppercase tracking-widest mb-3" style={{ color: SNZ_BLUE }}>Your Total</h2>
          <div className="space-y-2 text-sm">
            {teamEventEntries.map(([key, ev]) => {
              const f = getFee(key)
              return (
                <div key={key} className="flex justify-between">
                  <span className="text-gray-600">{ev.label}</span>
                  <span className="font-bold text-gray-900">{f === null ? 'TBC' : f === 0 ? 'Free' : `$${(f/100).toFixed(2)}`}</span>
                </div>
              )
            })}
            {individualEventKeys.filter(k => myEvents[k]).map(key => {
              const f = getFee(key)
              return (
                <div key={key} className="flex justify-between">
                  <span className="text-gray-600">{EVENT_LABELS[key]?.label}</span>
                  <span className="font-bold text-gray-900">{f === null ? 'TBC' : f === 0 ? 'Free' : `$${(f/100).toFixed(2)}`}</span>
                </div>
              )
            })}
            {jacket.gender && jacket.size && getMerchFee('jacket') && (
              <div className="flex justify-between">
                <span className="text-gray-600">🧥 Jacket ({jacket.gender} {jacket.size})</span>
                <span className="font-bold text-gray-900">${(getMerchFee('jacket')/100).toFixed(2)}</span>
              </div>
            )}
            {shirt.gender && shirt.size && getMerchFee('shirt') && (
              <div className="flex justify-between">
                <span className="text-gray-600">👕 T-Shirt ({shirt.gender} {shirt.size})</span>
                <span className="font-bold text-gray-900">${(getMerchFee('shirt')/100).toFixed(2)}</span>
              </div>
            )}
            {mealQty > 0 && getMealFee() && (
              <div className="flex justify-between">
                <span className="text-gray-600">🍽️ Prize Giving Dinner × {mealQty}</span>
                <span className="font-bold text-gray-900">${(getMealFee() * mealQty / 100).toFixed(2)}</span>
              </div>
            )}
            <div className="border-t border-gray-100 pt-2 mt-2 flex justify-between">
              <span className="font-black text-gray-900">Total</span>
              <span className="font-black text-gray-900">
                {hasTBCFees ? 'TBC — fees not yet set' : totalCents > 0 ? `$${(totalCents/100).toFixed(2)} NZD` : '$0.00'}
              </span>
            </div>
          </div>
          {isEarlyBird && comp?.early_bird_cutoff && (
            <p className="text-xs text-amber-600 mt-2">🐦 Early bird pricing — closes {new Date(comp.early_bird_cutoff).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long' })}</p>
          )}
        </div>

        {/* Safety & Compliance */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
          <div>
            <h2 className="font-black text-gray-900 text-sm uppercase tracking-widest" style={{ color: SNZ_BLUE }}>Safety & Competitor Information</h2>
            <p className="text-xs text-gray-400 mt-0.5">Required for all competitors.</p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-1">
            <p className="text-xs font-black text-blue-900 uppercase tracking-wide">2027 Nationals — Key Info</p>
            <ul className="text-xs text-blue-800 space-y-1 mt-1">
              <li>📍 Tairua, Coromandel Peninsula · 19–24 January 2027</li>
              <li>⚠️ Mandatory safety briefing required before competing</li>
              <li>🤿 The Open Championship — no individual diving permitted</li>
              <li>📋 Full rules: <a href="https://www.spearfishingnz.co.nz/_files/ugd/b3c400_e310eb5a265b4259a4b3c18d2c9afb87.pdf" target="_blank" rel="noopener noreferrer" className="underline font-bold">SNZ Competition Rules PDF</a></li>
            </ul>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Emergency Contact Name *</label>
              <input value={emergencyContact} onChange={e => setEmergencyContact(e.target.value)}
                placeholder="Full name"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Emergency Contact Phone *</label>
              <input value={emergencyPhone} onChange={e => setEmergencyPhone(e.target.value)}
                placeholder="+64 21 xxx xxxx"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={fitToDive} onChange={e => setFitToDive(e.target.checked)}
                className="mt-0.5 w-5 h-5 flex-shrink-0" />
              <span className="text-sm text-red-900 font-semibold">
                I confirm I am medically fit and able to participate safely in spearfishing competitions. I have no conditions that would prevent safe participation and I take full responsibility for my own safety. <span className="text-red-600">*</span>
              </span>
            </label>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={rulesAck} onChange={e => setRulesAck(e.target.checked)}
                className="mt-0.5 w-5 h-5 flex-shrink-0" />
              <span className="text-sm text-gray-800 font-semibold">
                I have read and agree to comply with the <a href="https://www.spearfishingnz.co.nz/_files/ugd/b3c400_e310eb5a265b4259a4b3c18d2c9afb87.pdf" target="_blank" rel="noopener noreferrer" className="underline" style={{ color: SNZ_BLUE }}>SNZ Competition Rules</a>. I understand that breaches may result in disqualification. <span className="text-red-600">*</span>
              </span>
            </label>
          </div>

          {safetyError && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{safetyError}</div>
          )}
        </div>

        {/* Confirm button */}
        {!entriesClosed && (
          <button onClick={handleConfirm} disabled={submitting}
            className="w-full py-3 rounded-xl font-black text-white text-sm disabled:opacity-40"
            style={{ background: SNZ_BLUE }}>
            {submitting ? 'Processing…'
              : !hasTBCFees && totalCents > 0
                ? `Confirm & Pay $${(totalCents/100).toFixed(2)} NZD →`
                : 'Confirm Entry →'}
          </button>
        )}
        {!hasTBCFees && totalCents > 0 && (
          <p className="text-xs text-gray-400 text-center">You will be redirected to Stripe to complete payment securely.</p>
        )}
        <p className="text-xs text-gray-400 text-center">Tairua, Coromandel · 19–24 January 2027</p>
      </div>
    </div>
  )
}
