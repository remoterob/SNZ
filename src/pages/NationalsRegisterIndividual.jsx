import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useMemberSession, MemberAuthGate } from '../components/MemberAuthGate'

const SNZ_BLUE = '#2B6CB0'
const SNZ_DARK = '#1e3a5f'

// Events available for individual entry (Open excluded - pairs only;
// Silver Oldie excluded - auto-qualifies from Open; Golden Oldie excluded - pair event)
const INDIVIDUAL_EVENTS = [
  {
    id: 'womens', name: "Women's Championship", emoji: '🔱',
    desc: 'Entry for women competing individually with a safety diver.',
    earlyBird: true,
    color: '#db2777', bgColor: '#fdf2f8', borderColor: '#fbcfe8',
  },
  {
    id: 'juniors', name: 'Junior Championship', emoji: '🌟',
    desc: 'Individual entry for junior competitors (under 18).',
    earlyBird: true,
    color: '#7c3aed', bgColor: '#faf5ff', borderColor: '#ddd6fe',
  },
  {
    id: 'photography', name: 'Snorkel Photography', emoji: '📸',
    desc: 'Individual photography event.',
    earlyBird: true,
    color: '#0891b2', bgColor: '#ecfeff', borderColor: '#a5f3fc',
  },
  {
    id: 'finswim', name: 'Fin Swimming', emoji: '🐟',
    desc: 'Individual fin swimming event.',
    earlyBird: true,
    color: '#059669', bgColor: '#ecfdf5', borderColor: '#a7f3d0',
  },
  {
    id: 'under23', name: 'Under 23 Division', emoji: '🎯',
    desc: 'For divers aged 18–22 on the day of competition.',
    earlyBird: true,
    color: '#7c3aed', bgColor: '#faf5ff', borderColor: '#ddd6fe',
  },
]

function resolveFeeCents(eventId, categoryFees, isEarlyBird) {
  if (!categoryFees) return null
  const ev = categoryFees[eventId]
  if (!ev) return 0
  if (isEarlyBird && ev.early_bird != null) return ev.early_bird
  return ev.standard ?? 0
}

export default function NationalsRegisterIndividual() {
  const navigate = useNavigate()
  const { session, member } = useMemberSession()

  const [comp, setComp] = useState(null)
  const [categoryFees, setCategoryFees] = useState(null)
  const [earlyBirdCutoff, setEarlyBirdCutoff] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Selected events
  const [selected, setSelected] = useState({}) // { womens: true, photography: true }

  // Safety diver (optional)
  const [safetyName, setSafetyName] = useState('')
  const [safetyContact, setSafetyContact] = useState('')

  // Merch & meal
  const [jacket, setJacket] = useState({ gender: '', size: '' })
  const [shirt, setShirt] = useState({ gender: '', size: '' })
  const [mealQty, setMealQty] = useState(0)

  // Safety & compliance
  const [emergencyContact, setEmergencyContact] = useState('')
  const [emergencyPhone, setEmergencyPhone] = useState('')
  const [fitToDive, setFitToDive] = useState(false)
  const [rulesAck, setRulesAck] = useState(false)

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('competitions')
        .select('*')
        .ilike('name', '%nationals%2027%')
        .maybeSingle()
      if (data) {
        setComp(data)
        setCategoryFees(data.category_fees || null)
        setEarlyBirdCutoff(data.early_bird_cutoff || null)
      }
      setLoading(false)
    })()
  }, [])

  // Pre-fill emergency contact from member profile
  useEffect(() => {
    if (member?.emergency_contact && !emergencyContact) setEmergencyContact(member.emergency_contact)
    if (member?.emergency_phone && !emergencyPhone) setEmergencyPhone(member.emergency_phone)
  }, [member])

  const isEarlyBird = earlyBirdCutoff ? new Date() < new Date(earlyBirdCutoff) : false

  const getFee = (eventId) => resolveFeeCents(eventId, categoryFees, isEarlyBird)

  const hasAnySelection = Object.values(selected).some(v => v)
  const hasTBCFees = categoryFees === null

  const getMerchFee = (type) => categoryFees?.merch?.[type]?.price ?? null
  const getMealFee = () => categoryFees?.meal?.price ?? null

  const totalCents = INDIVIDUAL_EVENTS.reduce((sum, e) => {
    if (!selected[e.id]) return sum
    const fee = getFee(e.id)
    return sum + (fee || 0)
  }, 0)
    + (getMerchFee('jacket') && jacket.gender && jacket.size ? getMerchFee('jacket') : 0)
    + (getMerchFee('shirt') && shirt.gender && shirt.size ? getMerchFee('shirt') : 0)
    + (getMealFee() && mealQty > 0 ? getMealFee() * mealQty : 0)

  const fmtCents = (c) => c == null ? 'TBC' : `$${(c / 100).toFixed(2)}`

  const handleSubmit = async () => {
    setError('')

    // Validate
    const errs = []
    if (!hasAnySelection) errs.push('Select at least one event')
    if (!emergencyContact.trim()) errs.push('Emergency contact name is required')
    if (!emergencyPhone.trim()) errs.push('Emergency contact phone is required')
    if (!fitToDive) errs.push('You must confirm you are fit to dive')
    if (!rulesAck) errs.push('You must acknowledge the competition rules')
    if (hasTBCFees) errs.push('Entry fees have not been finalised yet')
    if (errs.length) { setError(errs.join(' · ')); return }

    setSubmitting(true)
    try {
      // Update member emergency contact
      await supabase.from('members').update({
        emergency_contact: emergencyContact.trim(),
        emergency_phone: emergencyPhone.trim(),
      }).eq('id', session.user.id)

      // Build nationals_event metadata including safety diver info
      const nationalsEvent = {
        ...selected,
        is_individual: true,
        safety_diver_name: safetyName.trim() || null,
        safety_diver_contact: safetyContact.trim() || null,
      }

      const teamName = `Individual - ${member?.name || session.user.email}`

      // Insert as pending_payment; flip to active after Stripe success
      const { data: team, error: insertErr } = await supabase
        .from('comp_teams')
        .insert({
          competition_id: comp.id,
          team_name: teamName,
          diver1_member_id: session.user.id,
          diver1_email: session.user.email,
          diver1_accepted_at: new Date().toISOString(),
          diver2_member_id: null,
          status: 'pending_payment',
          nationals_event: nationalsEvent,
          entry_fee_cents: totalCents,
          merch_d1: {
            jacket: jacket.gender && jacket.size ? jacket : null,
            shirt: shirt.gender && shirt.size ? shirt : null,
            meal_qty: mealQty > 0 ? mealQty : 0,
          },
        })
        .select('id')
        .single()

      if (insertErr) throw insertErr

      // Redirect to Stripe checkout
      const res = await fetch('/.netlify/functions/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'nationals_entry',
          amountCents: totalCents,
          memberId: session.user.id,
          memberEmail: session.user.email,
          memberName: member?.name || session.user.email,
          teamId: team.id,
          competitionId: comp.id,
          competitionName: comp.name,
        }),
      })
      const { url } = await res.json()
      if (!url) throw new Error('Failed to create checkout session')
      window.location.href = url
    } catch (e) {
      setError(e.message)
      setSubmitting(false)
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>
  if (!comp) return <div className="min-h-screen flex items-center justify-center text-gray-400">Competition not found.</div>

  if (comp.status !== 'open') {
    return (
      <div className="min-h-screen bg-gray-50">
        <div style={{ background: SNZ_DARK }} className="px-6 py-3 flex items-center border-b border-blue-900">
          <button onClick={() => navigate('/nationals')}
            className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
            ← Nationals
          </button>
        </div>
        <div className="max-w-md mx-auto px-4 py-12 text-center">
          <p className="text-4xl mb-4">🔒</p>
          <h1 className="text-xl font-black text-gray-900 mb-2">Registration not yet open</h1>
          <p className="text-gray-500 text-sm">Entries for the 2027 Nationals will open soon. Make sure your SNZ membership is active so you're ready to register the moment entries open.</p>
          <button onClick={() => navigate('/nationals')} className="mt-6 px-5 py-2.5 rounded-xl font-bold text-white text-sm" style={{ background: SNZ_BLUE }}>
            Back to Nationals
          </button>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <MemberAuthGate
        title="Sign in to register"
        message="Please sign in or create your SNZ account to register for Nationals."
      />
    )
  }

  // Handle Stripe return
  const params = new URLSearchParams(window.location.search)
  if (params.get('payment') === 'success' && params.get('team')) {
    return <SuccessScreen teamId={params.get('team')} navigate={navigate} />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div style={{ background: SNZ_DARK }} className="px-6 py-3 flex items-center border-b border-blue-900">
        <button onClick={() => navigate('/nationals')}
          className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
          ← Nationals
        </button>
        <span className="text-white/50 mx-2">/</span>
        <span className="text-white font-bold text-sm">Individual Entry</span>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
        <div>
          <h1 className="text-3xl font-black text-gray-900">Individual Event Entry</h1>
          <p className="text-gray-500 text-sm mt-1">
            For competitors entering specific events without a pairs partner. Enter one or more events below.
          </p>
        </div>

        {isEarlyBird && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
            🐦 <strong>Early bird pricing active</strong> — register before {new Date(earlyBirdCutoff).toLocaleDateString('en-NZ')} for discounted rates.
          </div>
        )}

        {hasTBCFees && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-800">
            ℹ️ Event fees are being finalised. Please check back shortly.
          </div>
        )}

        {/* Event selection */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
          <div>
            <h2 className="font-black text-gray-900 text-sm uppercase tracking-widest" style={{ color: SNZ_BLUE }}>Select Events</h2>
            <p className="text-xs text-gray-400 mt-0.5">Tick each event you want to enter.</p>
          </div>

          <div className="space-y-2">
            {INDIVIDUAL_EVENTS.map(e => {
              const fee = getFee(e.id)
              const isSelected = !!selected[e.id]
              return (
                <button key={e.id} onClick={() => setSelected(s => ({ ...s, [e.id]: !s[e.id] }))}
                  className={`w-full text-left rounded-xl border-2 p-4 transition ${isSelected ? 'border-opacity-100 shadow-sm' : 'border-gray-200 hover:border-gray-300'}`}
                  style={isSelected ? { borderColor: e.color, background: e.bgColor } : {}}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl flex-shrink-0">{e.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-black text-gray-900 text-sm">{e.name}</div>
                      <p className="text-xs text-gray-500 mt-0.5">{e.desc}</p>
                      {fee != null && fee > 0 && (
                        <p className="text-sm font-bold mt-1" style={{ color: e.color }}>
                          {fmtCents(fee)} {isEarlyBird && e.earlyBird && <span className="text-xs text-amber-600 ml-1">🐦 Early bird</span>}
                        </p>
                      )}
                      {fee === 0 && <p className="text-xs text-gray-500 mt-1">No additional fee</p>}
                      {fee == null && <p className="text-xs text-gray-400 mt-1">Fee TBC</p>}
                    </div>
                    <div className={`w-5 h-5 rounded border-2 flex-shrink-0 ${isSelected ? 'border-transparent' : 'border-gray-300'}`}
                      style={isSelected ? { background: e.color } : {}}>
                      {isSelected && <svg className="w-full h-full text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          {hasAnySelection && totalCents > 0 && (
            <div className="border-t border-gray-100 pt-3 mt-4 flex items-center justify-between">
              <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">Total</span>
              <span className="text-2xl font-black" style={{ color: SNZ_BLUE }}>{fmtCents(totalCents)}</span>
            </div>
          )}
        </div>

        {/* Safety diver (optional) */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
          <div>
            <h2 className="font-black text-gray-900 text-sm uppercase tracking-widest" style={{ color: SNZ_BLUE }}>Safety Diver / Observer</h2>
            <p className="text-xs text-gray-400 mt-0.5">Optional — name the person who will be with you in the water (can be added or changed later).</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Name (optional)</label>
              <input value={safetyName} onChange={e => setSafetyName(e.target.value)}
                placeholder="Full name"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Contact (optional)</label>
              <input value={safetyContact} onChange={e => setSafetyContact(e.target.value)}
                placeholder="Phone or email"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>
        </div>

        {/* Merch & Meal */}
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
                    <p className="text-xs text-gray-400">SNZ Nationals 2027 jacket</p>
                  </div>
                  <p className="font-black text-gray-900 text-sm">${(categoryFees.merch.jacket.price / 100).toFixed(2)}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Gender fit</label>
                    <select value={jacket.gender} onChange={e => setJacket(j => ({ ...j, gender: e.target.value }))}
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
                        {['XS','S','M','L','XL','2XL','3XL','4XL'].map(s => <option key={s} value={s}>{s}</option>)}
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
                    <p className="text-xs text-gray-400">SNZ Nationals 2027 t-shirt</p>
                  </div>
                  <p className="font-black text-gray-900 text-sm">${(categoryFees.merch.shirt.price / 100).toFixed(2)}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Gender fit</label>
                    <select value={shirt.gender} onChange={e => setShirt(s => ({ ...s, gender: e.target.value }))}
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
                        {['XS','S','M','L','XL','2XL','3XL','4XL'].map(s => <option key={s} value={s}>{s}</option>)}
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
                    <p className="text-xs text-gray-400">${(categoryFees.meal.price / 100).toFixed(2)} per person — order for family &amp; friends too</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Tickets</label>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => setMealQty(q => Math.max(0, q - 1))} disabled={mealQty === 0}
                      className="w-8 h-8 rounded-lg border border-gray-300 text-gray-600 font-bold text-lg flex items-center justify-center hover:bg-gray-50 disabled:opacity-30">−</button>
                    <span className="w-8 text-center font-black text-gray-900">{mealQty}</span>
                    <button type="button" onClick={() => setMealQty(q => q + 1)}
                      className="w-8 h-8 rounded-lg border border-gray-300 text-gray-600 font-bold text-lg flex items-center justify-center hover:bg-gray-50">+</button>
                  </div>
                  {mealQty > 0 && (
                    <span className="text-sm font-bold text-gray-700 ml-2">${(categoryFees.meal.price * mealQty / 100).toFixed(2)}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

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
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <button onClick={handleSubmit} disabled={submitting || !hasAnySelection || totalCents === 0}
          className="w-full py-3.5 rounded-xl font-black text-white text-base disabled:opacity-40"
          style={{ background: SNZ_BLUE }}>
          {submitting ? 'Processing…' : totalCents > 0 ? `Pay ${fmtCents(totalCents)} & Register` : 'Register'}
        </button>

        <p className="text-xs text-gray-400 text-center">
          You'll be redirected to Stripe to complete your entry fee payment.
        </p>
      </div>
    </div>
  )
}

// ── Success screen after Stripe return ──────────────────────────────────────
function SuccessScreen({ teamId, navigate }) {
  useEffect(() => {
    // Mark team as paid + active
    (async () => {
      await supabase.from('comp_teams').update({
        status: 'active',
        diver2_payment_status: 'paid', // individual entries don't have a diver 2, but mark as paid to close loop
      }).eq('id', teamId)
    })()
  }, [teamId])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white border border-green-200 rounded-2xl p-8 text-center space-y-4">
        <div className="text-6xl">✅</div>
        <h1 className="text-2xl font-black text-gray-900">You're registered!</h1>
        <p className="text-gray-600 text-sm">
          Your entry is confirmed. We'll send more info about the event schedule closer to the date.
        </p>
        <p className="text-xs text-gray-400">
          See you in Tairua, 19–24 January 2027.
        </p>
        <button onClick={() => navigate('/nationals')}
          className="w-full py-3 rounded-xl font-black text-white text-sm" style={{ background: SNZ_BLUE }}>
          Back to Nationals
        </button>
      </div>
    </div>
  )
}
