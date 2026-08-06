import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useMemberSession, MemberAuthGate } from '../components/MemberAuthGate'
import { useStripeCheckout } from '../hooks/useStripeCheckout'

const SNZ_BLUE = '#2B6CB0'
const SNZ_DARK = '#1e3a5f'
const PER_COMPETITOR_FEE = 50

const emptyCompetitor = {
  name: '', email: '', phone: '', club: '',
  gender: '', dob: '',
  emergency_contact: '', emergency_phone: '',
  fit_to_dive: false,
}

function PersonExtras({ label, shirt, setShirt, shirtQty, setShirtQty, mealQty, setMealQty, offersShirt, offersMeal, shirtFee, shirtAllowsMultiple, mealFee }) {
  if (!offersShirt && !offersMeal) return null
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
      <h3 className="text-sm font-black tracking-widest uppercase" style={{ color: SNZ_BLUE }}>{label} — Merch &amp; Meal (optional)</h3>

      {offersShirt && (
        <div className="border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="flex justify-between items-center">
            <p className="font-bold text-gray-900 text-sm">👕 Event T-Shirt</p>
            <p className="font-black text-gray-900 text-sm">${shirtFee}{shirtAllowsMultiple && shirtQty > 1 ? ` × ${shirtQty}` : ''}</p>
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
                  {['XS','S','M','L','XL','2XL','3XL'].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
          </div>
          {shirtAllowsMultiple && shirt.gender && shirt.size && (
            <div className="flex items-center gap-3">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Quantity</label>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setShirtQty(q => Math.max(1, q - 1))} disabled={shirtQty <= 1}
                  className="w-8 h-8 rounded-lg border border-gray-300 text-gray-600 font-bold text-lg flex items-center justify-center hover:bg-gray-50 disabled:opacity-30">−</button>
                <span className="w-8 text-center font-black text-gray-900">{shirtQty}</span>
                <button type="button" onClick={() => setShirtQty(q => q + 1)}
                  className="w-8 h-8 rounded-lg border border-gray-300 text-gray-600 font-bold text-lg flex items-center justify-center hover:bg-gray-50">+</button>
              </div>
            </div>
          )}
        </div>
      )}

      {offersMeal && (
        <div className="border border-gray-200 rounded-xl p-4">
          <div className="flex justify-between items-center mb-3">
            <p className="font-bold text-gray-900 text-sm">🍽️ Dinner Ticket</p>
            <p className="text-xs text-gray-400">${mealFee} each</p>
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
            {mealQty > 0 && <span className="text-sm font-bold text-gray-700 ml-2">${mealFee * mealQty}</span>}
          </div>
        </div>
      )}
    </div>
  )
}

function CompetitorForm({ label, data, onChange, required }) {
  const set = k => v => onChange({ ...data, [k]: v })
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
      <h3 className="font-black text-gray-900 mb-4 text-sm tracking-widest uppercase" style={{ color: SNZ_BLUE }}>{label}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-gray-600 mb-1">Full name {required && <span className="text-red-500">*</span>}</label>
          <input value={data.name} onChange={e => set('name')(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            placeholder="Full legal name" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Email {required && <span className="text-red-500">*</span>}</label>
          <input type="email" value={data.email} onChange={e => set('email')(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            placeholder="email@example.com" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Phone {required && <span className="text-red-500">*</span>}</label>
          <input value={data.phone} onChange={e => set('phone')(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            placeholder="+64 21 xxx xxxx" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Club</label>
          <input value={data.club} onChange={e => set('club')(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            placeholder="Club name (optional)" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Gender</label>
          <select value={data.gender} onChange={e => set('gender')(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
            <option value="">Prefer not to say</option>
            <option>Male</option><option>Female</option><option>Non-binary</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Date of birth</label>
          <input type="date" value={data.dob} onChange={e => set('dob')(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Emergency contact name {required && <span className="text-red-500">*</span>}</label>
          <input value={data.emergency_contact} onChange={e => set('emergency_contact')(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            placeholder="Full name" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Emergency contact phone {required && <span className="text-red-500">*</span>}</label>
          <input value={data.emergency_phone} onChange={e => set('emergency_phone')(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            placeholder="+64 21 xxx xxxx" />
        </div>
        <div className="sm:col-span-2">
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={data.fit_to_dive} onChange={e => set('fit_to_dive')(e.target.checked)}
              className="mt-0.5 w-5 h-5 flex-shrink-0" />
            <span className="text-sm text-gray-700 font-semibold">
              I confirm I am fit and able to dive safely, have no medical conditions that would prevent safe participation, and take full responsibility for my own safety. {required && <span className="text-red-500">*</span>}
            </span>
          </label>
        </div>
      </div>
    </div>
  )
}

export default function CatfishCullRegister() {
  const navigate = useNavigate()
  const { session, member, loading: memberLoading } = useMemberSession()
  const { checkout, loading: checkoutLoading, error: checkoutError } = useStripeCheckout()

  const [comp, setComp] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState([])
  const [done, setDone] = useState(false)
  const [paymentDone, setPaymentDone] = useState(false)
  const [teamName, setTeamName] = useState('')

  const [p1, setP1] = useState({ ...emptyCompetitor })
  const [p2, setP2] = useState({ ...emptyCompetitor })
  const [hasThird, setHasThird] = useState(false)
  const [p3, setP3] = useState({ ...emptyCompetitor })

  const [p2Checked, setP2Checked] = useState(false)
  const [p2Active, setP2Active] = useState(false)
  const [checkingP2, setCheckingP2] = useState(false)
  const [p3Checked, setP3Checked] = useState(false)
  const [p3Active, setP3Active] = useState(false)
  const [checkingP3, setCheckingP3] = useState(false)

  const [rulesAccepted, setRulesAccepted] = useState(false)

  const [shirt1, setShirt1] = useState({ gender: '', size: '' })
  const [shirtQty1, setShirtQty1] = useState(1)
  const [mealQty1, setMealQty1] = useState(0)
  const [shirt2, setShirt2] = useState({ gender: '', size: '' })
  const [shirtQty2, setShirtQty2] = useState(1)
  const [mealQty2, setMealQty2] = useState(0)

  useEffect(() => {
    supabase.from('competitions').select('*').ilike('name', '%catfish%2027%').maybeSingle()
      .then(({ data }) => { setComp(data); setLoading(false) })

    const params = new URLSearchParams(window.location.search)
    if (params.get('payment') === 'success') {
      const stripeSessionId = params.get('session_id')
      const verify = stripeSessionId
        ? fetch('/.netlify/functions/verify-checkout-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId: stripeSessionId }),
          }).catch(e => console.error('Payment verification failed:', e))
        : Promise.resolve()
      verify.then(() => {
        setDone(true)
        setPaymentDone(true)
        const saved = sessionStorage.getItem('snz_catfish_entry')
        if (saved) {
          try {
            const { teamName: tn } = JSON.parse(saved)
            if (tn) setTeamName(tn)
            sessionStorage.removeItem('snz_catfish_entry')
          } catch {}
        }
        window.history.replaceState({}, '', '/catfish/register')
      })
    }
  }, [])

  useEffect(() => {
    if (member) {
      setP1(p => ({
        ...p,
        name: member.name || p.name,
        email: member.email || p.email,
        phone: member.phone || p.phone,
        club: member.club || p.club,
        gender: member.gender || p.gender,
        dob: member.dob || p.dob,
        emergency_contact: member.emergency_contact || p.emergency_contact,
        emergency_phone: member.emergency_phone || p.emergency_phone,
        fit_to_dive: member.fit_to_dive || p.fit_to_dive,
      }))
    }
  }, [member])

  const checkMemberEmail = async (email, setActive, setChecking, setChecked) => {
    if (!email.trim()) return
    setChecking(true)
    try {
      const { data } = await supabase.from('members').select('*')
        .eq('email', email.trim().toLowerCase()).maybeSingle()
      setActive(!!(data && data.payment_status === 'paid' && data.membership_status === 'active'))
      setChecked(true)
    } finally {
      setChecking(false)
    }
  }

  const competitorCount = 2 + (hasThird ? 1 : 0)

  // Entry fee must respect the competition's own early-bird cutoff/pricing
  // (category_fees.Open) instead of a flat hardcoded amount — previously this
  // ignored early_bird entirely and always charged the standard rate.
  const isEarlyBird = comp?.early_bird_cutoff ? new Date() < new Date(comp.early_bird_cutoff) : false
  const openFee = comp?.category_fees?.Open || {}
  const perCompetitorCents = isEarlyBird && openFee.early_bird != null
    ? openFee.early_bird
    : (openFee.standard ?? comp?.entry_fee_cents ?? PER_COMPETITOR_FEE * 100)
  const entryFeeCents = competitorCount * perCompetitorCents

  const merchFees = comp?.category_fees?.merch
  const mealFee = comp?.category_fees?.meal?.price
  const offersShirt = !!merchFees?.shirt
  const offersMeal = mealFee > 0
  const shirtFee = merchFees?.shirt?.price
  const shirtAllowsMultiple = !!merchFees?.shirt?.allowMultiple

  const wantShirt1 = offersShirt && shirt1.gender && shirt1.size
  const wantShirt2 = offersShirt && shirt2.gender && shirt2.size
  const effShirtQty1 = shirtAllowsMultiple ? shirtQty1 : 1
  const effShirtQty2 = shirtAllowsMultiple ? shirtQty2 : 1
  const extrasCents = (wantShirt1 ? shirtFee * 100 * effShirtQty1 : 0)
    + (wantShirt2 ? shirtFee * 100 * effShirtQty2 : 0)
    + (offersMeal ? (mealQty1 + mealQty2) * mealFee * 100 : 0)
  const totalCents = entryFeeCents + extrasCents

  const validate = () => {
    const e = []
    if (!teamName.trim()) e.push('Team name is required')
    if (!p1.name.trim() || !p1.email.trim() || !p1.phone.trim()) e.push('Your name, email and phone are required')
    if (!p1.emergency_contact.trim() || !p1.emergency_phone.trim()) e.push('Your emergency contact details are required')
    if (!p1.fit_to_dive) e.push('You must confirm you are fit to dive')
    if (!p2.name.trim() || !p2.email.trim() || !p2.phone.trim()) e.push('Competitor 2 name, email and phone are required')
    if (!p2.emergency_contact.trim() || !p2.emergency_phone.trim()) e.push('Competitor 2 emergency contact details are required')
    if (!p2.fit_to_dive) e.push('Competitor 2 must confirm fitness to dive')
    if (!p2Checked || !p2Active) e.push('Competitor 2 must be an active SNZ member — click "Check membership"')
    if (hasThird) {
      if (!p3.name.trim() || !p3.email.trim() || !p3.phone.trim()) e.push('Competitor 3 name, email and phone are required')
      if (!p3.emergency_contact.trim() || !p3.emergency_phone.trim()) e.push('Competitor 3 emergency contact details are required')
      if (!p3.fit_to_dive) e.push('Competitor 3 must confirm fitness to dive')
      if (!p3Checked || !p3Active) e.push('Competitor 3 must be an active SNZ member — click "Check membership"')
    }
    if (!rulesAccepted) e.push('You must accept the Catfish Cull rules and conservation declaration')
    setErrors(e)
    return e.length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) { window.scrollTo({ top: 0, behavior: 'smooth' }); return }
    setSubmitting(true)
    try {
      const { data: p2Row } = await supabase.from('members').select('id')
        .eq('email', p2.email.trim().toLowerCase()).maybeSingle()
      const p3Row = hasThird
        ? (await supabase.from('members').select('id').eq('email', p3.email.trim().toLowerCase()).maybeSingle()).data
        : null

      const buildMerch = (wantShirt, shirt, shirtQty, mealQty) => {
        if (!wantShirt && mealQty <= 0) return null
        const merch = {}
        if (wantShirt) {
          if (shirtAllowsMultiple) merch.shirts = [{ gender: shirt.gender, size: shirt.size, qty: shirtQty }]
          else merch.shirt = { gender: shirt.gender, size: shirt.size }
        }
        if (mealQty > 0) merch.meal_qty = mealQty
        return merch
      }

      const { data: team, error: tErr } = await supabase.from('comp_teams').insert({
        competition_id: comp.id,
        team_name: teamName.trim(),
        category: 'Open',
        rules_accepted: true,
        waiver_accepted: true,
        acceptance_at: new Date().toISOString(),
        diver1_member_id: member?.id || null,
        diver2_member_id: p2Row?.id || null,
        diver2_email: p2.email.trim().toLowerCase(),
        status: 'pending_payment',
        entry_fee_cents: entryFeeCents,
        merch_d1: buildMerch(wantShirt1, shirt1, effShirtQty1, mealQty1),
        merch_d2: buildMerch(wantShirt2, shirt2, effShirtQty2, mealQty2),
      }).select('id').single()
      if (tErr) throw tErr

      const memberPayload = [
        { ...p1, team_id: team.id, competition_id: comp.id },
        { ...p2, team_id: team.id, competition_id: comp.id },
        ...(hasThird ? [{ ...p3, team_id: team.id, competition_id: comp.id }] : []),
      ]
      const { error: mErr } = await supabase.from('comp_team_members').insert(memberPayload)
      if (mErr) throw mErr

      if (member?.id) {
        await supabase.from('member_competitions').upsert({
          member_id: member.id, competition_id: comp.id, team_id: team.id, year: 2027
        }, { onConflict: 'member_id,competition_id' })
      }
      if (p2Row?.id) {
        await supabase.from('member_competitions').upsert({
          member_id: p2Row.id, competition_id: comp.id, team_id: team.id, year: 2027
        }, { onConflict: 'member_id,competition_id' })
      }
      if (p3Row?.id) {
        await supabase.from('member_competitions').upsert({
          member_id: p3Row.id, competition_id: comp.id, team_id: team.id, year: 2027
        }, { onConflict: 'member_id,competition_id' })
      }

      sessionStorage.setItem('snz_catfish_entry', JSON.stringify({ teamName: teamName.trim() }))

      const earlyBirdSuffix = isEarlyBird ? ' (early bird)' : ''
      const lineItems = [
        { name: `Entry fee — ${p1.name}${earlyBirdSuffix}`, amountCents: perCompetitorCents },
        { name: `Entry fee — ${p2.name}${earlyBirdSuffix}`, amountCents: perCompetitorCents },
        ...(hasThird ? [{ name: `Entry fee — ${p3.name}${earlyBirdSuffix}`, amountCents: perCompetitorCents }] : []),
        ...(wantShirt1 ? [{ name: `👕 T-Shirt (${p1.name}, ${shirt1.gender} ${shirt1.size})${effShirtQty1 > 1 ? ` × ${effShirtQty1}` : ''}`, amountCents: shirtFee * 100 * effShirtQty1 }] : []),
        ...(wantShirt2 ? [{ name: `👕 T-Shirt (${p2.name}, ${shirt2.gender} ${shirt2.size})${effShirtQty2 > 1 ? ` × ${effShirtQty2}` : ''}`, amountCents: shirtFee * 100 * effShirtQty2 }] : []),
        ...(offersMeal && mealQty1 > 0 ? [{ name: `🍽️ Dinner ticket × ${mealQty1} (${p1.name})`, amountCents: mealFee * 100 * mealQty1 }] : []),
        ...(offersMeal && mealQty2 > 0 ? [{ name: `🍽️ Dinner ticket × ${mealQty2} (${p2.name})`, amountCents: mealFee * 100 * mealQty2 }] : []),
      ]

      // checkout() swallows its own errors (sets the hook's `error` state
      // instead of throwing) and redirects the browser on success, so this
      // try block always completes normally either way — unlock the button
      // here rather than relying on the catch block below.
      await checkout({
        type: 'competition_entry',
        successPath: '/catfish/register',
        teamId: team.id,
        competitionId: comp.id,
        competitionName: comp.name,
        amountCents: totalCents,
        lineItems,
        memberEmail: member?.email || p1.email,
        memberName: member?.name || p1.name,
      })
      setSubmitting(false)
    } catch (err) {
      setErrors([err.message])
      window.scrollTo({ top: 0, behavior: 'smooth' })
      setSubmitting(false)
    }
  }

  if (loading || memberLoading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Loading…</div>
  if (!comp) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Catfish Cull 2027 not found.</div>

  if (done) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white border border-green-200 rounded-2xl p-8 text-center space-y-4">
        <div className="text-6xl">✅</div>
        <h1 className="text-2xl font-black text-gray-900">You're entered!</h1>
        <p className="text-gray-600 text-sm">
          {paymentDone ? <>Payment confirmed — <strong>{teamName || 'your team'}</strong> is registered for the Rosemergy Catfish Cull 2027.</> : 'Your entry is confirmed.'}
        </p>
        <p className="text-xs text-gray-400">Motuoapa, Lake Taupō · 13 February 2027</p>
        <button onClick={() => navigate('/catfish')}
          className="w-full py-3 rounded-xl font-black text-white text-sm" style={{ background: SNZ_BLUE }}>
          Back to Catfish Cull
        </button>
      </div>
    </div>
  )

  if (comp.status !== 'active') return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="text-center">
        <div className="text-4xl mb-3">🔒</div>
        <p className="font-bold text-gray-700">Registration is not open yet.</p>
        <button onClick={() => navigate('/catfish')} className="mt-4 text-sm underline" style={{ color: SNZ_BLUE }}>← Back to Catfish Cull</button>
      </div>
    </div>
  )

  if (!session) return (
    <div className="min-h-screen bg-gray-50">
      <div style={{ background: SNZ_DARK }} className="px-6 py-3 flex items-center border-b border-blue-900">
        <button onClick={() => navigate('/catfish')}
          className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
          ← Catfish Cull
        </button>
      </div>
      <div className="max-w-md mx-auto px-4 py-8">
        <MemberAuthGate message="You must be an active SNZ member to enter the Catfish Cull. Sign in or join — a small annual fee applies, takes 2 minutes." />
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div style={{ background: SNZ_DARK }} className="px-6 py-3 flex items-center border-b border-blue-900">
        <button onClick={() => navigate('/catfish')}
          className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
          ← Catfish Cull
        </button>
        <span className="text-white/50 mx-2">/</span>
        <span className="text-white font-bold text-sm">Register</span>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto p-6 space-y-5">
        <div>
          <h1 className="text-3xl font-black text-gray-900">Enter the Catfish Cull</h1>
          <p className="text-gray-500 text-sm mt-1">Motuoapa, Lake Taupō · 13 February 2027</p>
        </div>

        {errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-sm font-bold text-red-700 mb-2">Please fix the following:</p>
            <ul className="list-disc list-inside text-sm text-red-600 space-y-1">
              {errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        )}
        {checkoutError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{checkoutError}</div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm font-black text-blue-900">
            ${(perCompetitorCents / 100).toFixed(0)} per competitor{isEarlyBird && <span className="text-amber-600"> 🐦 Early bird</span>}
          </p>
          <p className="text-xs text-blue-700 mt-0.5">
            Pairs = ${(perCompetitorCents * 2 / 100).toFixed(0)} · Trios = ${(perCompetitorCents * 3 / 100).toFixed(0)} (groups of 3 welcome but ineligible for top prizes).
            {isEarlyBird && comp?.early_bird_cutoff && ` Early bird pricing until ${new Date(comp.early_bird_cutoff).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })}.`}
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <label className="block text-xs font-semibold text-gray-600 mb-1">Team name <span className="text-red-500">*</span></label>
          <input value={teamName} onChange={e => setTeamName(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            placeholder="e.g. The Whisker Whackers" required />
        </div>

        <CompetitorForm label="Competitor 1 (You)" data={p1} onChange={setP1} required />

        <PersonExtras label={p1.name || 'Competitor 1'}
          shirt={shirt1} setShirt={setShirt1} shirtQty={shirtQty1} setShirtQty={setShirtQty1}
          mealQty={mealQty1} setMealQty={setMealQty1}
          offersShirt={offersShirt} offersMeal={offersMeal} shirtFee={shirtFee}
          shirtAllowsMultiple={shirtAllowsMultiple} mealFee={mealFee} />

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-black tracking-widest uppercase mb-3" style={{ color: SNZ_BLUE }}>Competitor 2</h3>
          <p className="text-xs text-gray-400 mb-3">Must be an active SNZ member to enter as a team.</p>
          <div className="flex gap-2 mb-3">
            <button type="button" onClick={() => checkMemberEmail(p2.email, setP2Active, setCheckingP2, setP2Checked)}
              disabled={checkingP2 || !p2.email.trim()}
              className="px-4 py-2 rounded-lg text-sm font-bold border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition whitespace-nowrap">
              {checkingP2 ? 'Checking…' : 'Check membership'}
            </button>
            {p2Checked && (
              <span className={`text-xs font-bold px-3 py-2 rounded-lg ${p2Active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                {p2Active ? '✓ Active member' : '✗ Not an active member'}
              </span>
            )}
          </div>
          <CompetitorForm label="" data={p2} onChange={v => { setP2(v); setP2Checked(false) }} required />
        </div>

        <PersonExtras label={p2.name || 'Competitor 2'}
          shirt={shirt2} setShirt={setShirt2} shirtQty={shirtQty2} setShirtQty={setShirtQty2}
          mealQty={mealQty2} setMealQty={setMealQty2}
          offersShirt={offersShirt} offersMeal={offersMeal} shirtFee={shirtFee}
          shirtAllowsMultiple={shirtAllowsMultiple} mealFee={mealFee} />

        {!hasThird ? (
          <button type="button" onClick={() => setHasThird(true)}
            className="w-full py-3 rounded-xl font-bold text-sm border-2 border-dashed border-gray-300 text-gray-500 hover:border-gray-400 transition">
            + Add a 3rd competitor (team of 3 — ineligible for top prizes)
          </button>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-black tracking-widest uppercase" style={{ color: SNZ_BLUE }}>Competitor 3</h3>
              <button type="button" onClick={() => { setHasThird(false); setP3({ ...emptyCompetitor }); setP3Checked(false) }}
                className="text-xs font-bold text-red-500 hover:text-red-700">Remove</button>
            </div>
            <p className="text-xs text-amber-600 mb-3">⚠ Teams of 3 are welcome but not eligible for top prizes.</p>
            <div className="flex gap-2 mb-3">
              <button type="button" onClick={() => checkMemberEmail(p3.email, setP3Active, setCheckingP3, setP3Checked)}
                disabled={checkingP3 || !p3.email.trim()}
                className="px-4 py-2 rounded-lg text-sm font-bold border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition whitespace-nowrap">
                {checkingP3 ? 'Checking…' : 'Check membership'}
              </button>
              {p3Checked && (
                <span className={`text-xs font-bold px-3 py-2 rounded-lg ${p3Active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                  {p3Active ? '✓ Active member' : '✗ Not an active member'}
                </span>
              )}
            </div>
            <CompetitorForm label="" data={p3} onChange={v => { setP3(v); setP3Checked(false) }} required />
          </div>
        )}

        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-5">
          <h3 className="font-black text-red-800 text-sm mb-3">⚠ Rules &amp; Conservation Declaration</h3>
          <ul className="text-xs text-red-900 leading-relaxed space-y-1.5 list-disc list-inside mb-4">
            <li>Hawaiian slings and pole spears only — no spearguns</li>
            <li>Compete in pairs (or a group of 3), towing a float with a dive flag at all times while diving</li>
            <li>Only catfish score — it is illegal to shoot trout; kōura and eels belong to Ngāti Tūwharetoa and may not be taken</li>
            <li>Keep 200m away from fly fishers at all times</li>
            <li>All competitors are individually responsible for their own safety and fitness to dive</li>
          </ul>
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={rulesAccepted} onChange={e => setRulesAccepted(e.target.checked)}
              className="mt-0.5 w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-bold text-red-900">
              Every competitor on this team has read, understood, and agrees to the above. <span className="text-red-600">*</span>
            </span>
          </label>
        </div>

        <div className="bg-white border-2 border-gray-200 rounded-xl p-5 space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">Entry fee ({competitorCount} competitors)</span>
            <span className="font-bold text-gray-700">${(entryFeeCents / 100).toFixed(0)}</span>
          </div>
          {extrasCents > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Merch &amp; meal tickets</span>
              <span className="font-bold text-gray-700">${(extrasCents / 100).toFixed(0)}</span>
            </div>
          )}
          <div className="flex items-center justify-between pt-1.5 border-t border-gray-100">
            <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">Total</span>
            <span className="text-2xl font-black" style={{ color: SNZ_BLUE }}>${(totalCents / 100).toFixed(0)} NZD</span>
          </div>
        </div>

        <button type="submit" disabled={submitting || checkoutLoading}
          className="w-full py-4 rounded-xl font-black text-white text-base disabled:opacity-50"
          style={{ background: SNZ_BLUE }}>
          {submitting || checkoutLoading ? 'Processing…' : `Pay $${(totalCents / 100).toFixed(0)} & Enter →`}
        </button>
        <p className="text-xs text-gray-400 text-center">You'll be redirected to Stripe to complete your entry fee payment.</p>
      </form>
    </div>
  )
}
