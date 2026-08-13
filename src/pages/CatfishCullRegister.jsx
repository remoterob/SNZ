import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useMemberSession, MemberAuthGate } from '../components/MemberAuthGate'
import { useStripeCheckout } from '../hooks/useStripeCheckout'

const SNZ_BLUE = '#2B6CB0'
const SNZ_DARK = '#1e3a5f'
const PER_COMPETITOR_FEE = 50

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

// Partner slot — email + membership lookup, mirroring the Nationals Diver 2
// pattern. Non-members are allowed through here (they get an invite to join)
// rather than blocking the entry, which is what the old form did.
function PartnerLookup({ slot, email, setEmail, status, partner, checking, onLookup, error, onRemove }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-sm font-black tracking-widest uppercase" style={{ color: SNZ_BLUE }}>Competitor {slot}</h3>
        {onRemove && (
          <button type="button" onClick={onRemove} className="text-xs font-bold text-red-500 hover:text-red-700">Remove</button>
        )}
      </div>
      <p className="text-xs text-gray-400 mb-3">
        Enter their email and look them up. They'll get an invite to confirm their own details — you don't need to fill these in for them.
      </p>

      <div className="flex gap-2">
        <input type="email" value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="partner@email.com"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
        <button type="button" onClick={onLookup} disabled={checking || !email.trim()}
          className="px-4 py-2.5 rounded-lg text-sm font-bold border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 whitespace-nowrap">
          {checking ? '…' : 'Check membership'}
        </button>
      </div>

      {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}

      {status === 'active' && partner && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 mt-2">
          <p className="text-xs font-bold text-green-700 uppercase tracking-wide mb-0.5">✓ Active SNZ member</p>
          <p className="font-bold text-gray-900 text-sm">{partner.name}</p>
          <p className="text-xs text-gray-500">{partner.email}</p>
          <p className="text-xs text-green-700 mt-1">They'll get an email to sign in and confirm their details.</p>
        </div>
      )}

      {status === 'inactive' && partner && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mt-2">
          <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-0.5">⚠ Membership not current</p>
          <p className="font-bold text-gray-900 text-sm">{partner.name}</p>
          <p className="text-xs text-amber-700 mt-0.5">They're in our system but not currently active. We'll email them to renew their membership and confirm their details.</p>
        </div>
      )}

      {status === 'not_found' && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mt-2">
          <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-0.5">📧 Not yet an SNZ member</p>
          <p className="text-xs text-blue-700">
            That email isn't in our system. We'll email <strong>{email}</strong> inviting them to join SNZ and confirm their entry. Your team stays pending until they do.
          </p>
        </div>
      )}
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

  // Competitor 1 is always the signed-in member — only the safety fields that
  // may be missing from their profile are collected here.
  const [emergencyContact, setEmergencyContact] = useState('')
  const [emergencyPhone, setEmergencyPhone] = useState('')
  const [fitToDive, setFitToDive] = useState(false)

  // Partner slots
  const [p2Email, setP2Email] = useState('')
  const [p2Status, setP2Status] = useState(null) // null | 'active' | 'inactive' | 'not_found'
  const [p2Member, setP2Member] = useState(null)
  const [checkingP2, setCheckingP2] = useState(false)
  const [p2Error, setP2Error] = useState('')

  const [hasThird, setHasThird] = useState(false)
  const [p3Email, setP3Email] = useState('')
  const [p3Status, setP3Status] = useState(null)
  const [p3Member, setP3Member] = useState(null)
  const [checkingP3, setCheckingP3] = useState(false)
  const [p3Error, setP3Error] = useState('')

  const [rulesAccepted, setRulesAccepted] = useState(false)

  const [shirt1, setShirt1] = useState({ gender: '', size: '' })
  const [shirtQty1, setShirtQty1] = useState(1)
  const [mealQty1, setMealQty1] = useState(0)
  const [shirt2, setShirt2] = useState({ gender: '', size: '' })
  const [shirtQty2, setShirtQty2] = useState(1)
  const [mealQty2, setMealQty2] = useState(0)
  const [shirt3, setShirt3] = useState({ gender: '', size: '' })
  const [shirtQty3, setShirtQty3] = useState(1)
  const [mealQty3, setMealQty3] = useState(0)

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

  // Pre-fill safety fields from the member's profile
  useEffect(() => {
    if (member?.emergency_contact) setEmergencyContact(member.emergency_contact)
    if (member?.emergency_phone) setEmergencyPhone(member.emergency_phone)
    if (member?.fit_to_dive) setFitToDive(true)
  }, [member])

  const lookupPartner = async (email, { setStatus, setPartner, setChecking, setError, otherEmail }) => {
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) return
    setChecking(true)
    setError('')
    setPartner(null)
    setStatus(null)
    try {
      if (trimmed === member?.email?.toLowerCase()) {
        setError('You cannot enter yourself as a partner.')
        return
      }
      if (otherEmail && trimmed === otherEmail.trim().toLowerCase()) {
        setError('That competitor has already been added to this team.')
        return
      }
      const { data } = await supabase.from('members')
        .select('id, name, email, membership_status, payment_status')
        .eq('email', trimmed)
        .maybeSingle()
      if (!data) { setStatus('not_found'); return }
      if (data.id === member?.id) { setError('You cannot enter yourself as a partner.'); return }
      const isActive = data.membership_status === 'active' || data.payment_status === 'paid'
      setPartner(data)
      setStatus(isActive ? 'active' : 'inactive')
    } finally {
      setChecking(false)
    }
  }

  const competitorCount = 2 + (hasThird ? 1 : 0)

  // Entry fee respects the competition's own early-bird cutoff/pricing
  // (category_fees.Open) instead of a flat hardcoded amount.
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
  const wantShirt3 = hasThird && offersShirt && shirt3.gender && shirt3.size
  const effShirtQty1 = shirtAllowsMultiple ? shirtQty1 : 1
  const effShirtQty2 = shirtAllowsMultiple ? shirtQty2 : 1
  const effShirtQty3 = shirtAllowsMultiple ? shirtQty3 : 1
  const effMealQty3 = hasThird ? mealQty3 : 0
  const extrasCents = (wantShirt1 ? shirtFee * 100 * effShirtQty1 : 0)
    + (wantShirt2 ? shirtFee * 100 * effShirtQty2 : 0)
    + (wantShirt3 ? shirtFee * 100 * effShirtQty3 : 0)
    + (offersMeal ? (mealQty1 + mealQty2 + effMealQty3) * mealFee * 100 : 0)
  const totalCents = entryFeeCents + extrasCents

  // A partner slot is ready once it's been looked up — any of the three
  // outcomes is valid, since non-members now get invited rather than blocked.
  const p2Ready = ['active', 'inactive', 'not_found'].includes(p2Status) && !p2Error
  const p3Ready = ['active', 'inactive', 'not_found'].includes(p3Status) && !p3Error

  const validate = () => {
    const e = []
    if (!teamName.trim()) e.push('Team name is required')
    if (!emergencyContact.trim() || !emergencyPhone.trim()) e.push('Your emergency contact details are required')
    if (!fitToDive) e.push('You must confirm you are fit to dive')
    if (!p2Email.trim()) e.push('Competitor 2 email is required')
    else if (!p2Ready) e.push('Click "Check membership" to confirm Competitor 2')
    if (hasThird) {
      if (!p3Email.trim()) e.push('Competitor 3 email is required')
      else if (!p3Ready) e.push('Click "Check membership" to confirm Competitor 3')
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

      // Diver 1 pays for the whole team, so the team is only waiting on the
      // partners' own confirmations — not their money.
      const allPartnersActive = p2Status === 'active' && (!hasThird || p3Status === 'active')

      const { data: team, error: tErr } = await supabase.from('comp_teams').insert({
        competition_id: comp.id,
        team_name: teamName.trim(),
        category: 'Open',
        rules_accepted: true,
        waiver_accepted: true,
        acceptance_at: new Date().toISOString(),
        diver1_member_id: member?.id || null,
        diver2_member_id: p2Status === 'active' ? p2Member.id : null,
        diver2_email: p2Email.trim().toLowerCase(),
        diver3_member_id: hasThird && p3Status === 'active' ? p3Member.id : null,
        diver3_email: hasThird ? p3Email.trim().toLowerCase() : null,
        status: allPartnersActive ? 'pending_payment' : 'pending_diver2',
        entry_fee_cents: entryFeeCents,
        merch_d1: buildMerch(wantShirt1, shirt1, effShirtQty1, mealQty1),
        merch_d2: buildMerch(wantShirt2, shirt2, effShirtQty2, mealQty2),
        merch_d3: hasThird ? buildMerch(wantShirt3, shirt3, effShirtQty3, mealQty3) : null,
      }).select('id').single()
      if (tErr) throw tErr

      // Only Diver 1's roster row is created here — partners supply their own
      // details (and create their row) when they confirm.
      const { error: mErr } = await supabase.from('comp_team_members').insert([{
        team_id: team.id,
        competition_id: comp.id,
        name: member?.name || '',
        email: member?.email || session.user.email,
        phone: member?.phone || '',
        club: member?.club || '',
        gender: member?.gender || '',
        dob: member?.dob || null,
        emergency_contact: emergencyContact.trim(),
        emergency_phone: emergencyPhone.trim(),
        fit_to_dive: fitToDive,
      }])
      if (mErr) throw mErr

      // Save safety details back to the profile so they prefill next time
      await supabase.from('members').update({
        emergency_contact: emergencyContact.trim(),
        emergency_phone: emergencyPhone.trim(),
        fit_to_dive: fitToDive,
      }).eq('id', member.id)

      await supabase.from('member_competitions').upsert({
        member_id: member.id, competition_id: comp.id, team_id: team.id, year: 2027
      }, { onConflict: 'member_id,competition_id' })

      if (p2Status === 'active' && p2Member?.id) {
        await supabase.from('member_competitions').upsert({
          member_id: p2Member.id, competition_id: comp.id, team_id: team.id, year: 2027
        }, { onConflict: 'member_id,competition_id' })
      }
      if (hasThird && p3Status === 'active' && p3Member?.id) {
        await supabase.from('member_competitions').upsert({
          member_id: p3Member.id, competition_id: comp.id, team_id: team.id, year: 2027
        }, { onConflict: 'member_id,competition_id' })
      }

      // Invite each partner to confirm. Entry fees are already covered by
      // Diver 1, so these are confirmation-only links.
      const invites = [
        { email: p2Email.trim().toLowerCase(), slot: 2, active: p2Status === 'active' },
        ...(hasThird ? [{ email: p3Email.trim().toLowerCase(), slot: 3, active: p3Status === 'active' }] : []),
      ]
      await Promise.all(invites.map(inv =>
        fetch('/.netlify/functions/invite-member', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({
            email: inv.email,
            invitedBy: member?.name || session.user.email,
            compName: comp.name,
            teamId: team.id,
            teamName: teamName.trim(),
            isExistingMember: inv.active,
            confirmUrl: `${window.location.origin}/catfish/confirm?team=${team.id}&slot=${inv.slot}`,
          }),
        }).catch(err => console.error('Invite failed for', inv.email, err))
      ))

      await supabase.from('comp_teams')
        .update({ diver2_invite_sent: true, ...(hasThird ? { diver3_invite_sent: true } : {}) })
        .eq('id', team.id)

      sessionStorage.setItem('snz_catfish_entry', JSON.stringify({ teamName: teamName.trim() }))

      const earlyBirdSuffix = isEarlyBird ? ' (early bird)' : ''
      const p2Label = p2Member?.name || p2Email.trim()
      const p3Label = p3Member?.name || p3Email.trim()
      const lineItems = [
        { name: `Entry fee — ${member?.name || 'Competitor 1'}${earlyBirdSuffix}`, amountCents: perCompetitorCents },
        { name: `Entry fee — ${p2Label}${earlyBirdSuffix}`, amountCents: perCompetitorCents },
        ...(hasThird ? [{ name: `Entry fee — ${p3Label}${earlyBirdSuffix}`, amountCents: perCompetitorCents }] : []),
        ...(wantShirt1 ? [{ name: `👕 T-Shirt (${member?.name || 'Competitor 1'}, ${shirt1.gender} ${shirt1.size})${effShirtQty1 > 1 ? ` × ${effShirtQty1}` : ''}`, amountCents: shirtFee * 100 * effShirtQty1 }] : []),
        ...(wantShirt2 ? [{ name: `👕 T-Shirt (${p2Label}, ${shirt2.gender} ${shirt2.size})${effShirtQty2 > 1 ? ` × ${effShirtQty2}` : ''}`, amountCents: shirtFee * 100 * effShirtQty2 }] : []),
        ...(wantShirt3 ? [{ name: `👕 T-Shirt (${p3Label}, ${shirt3.gender} ${shirt3.size})${effShirtQty3 > 1 ? ` × ${effShirtQty3}` : ''}`, amountCents: shirtFee * 100 * effShirtQty3 }] : []),
        ...(offersMeal && mealQty1 > 0 ? [{ name: `🍽️ Dinner ticket × ${mealQty1} (${member?.name || 'Competitor 1'})`, amountCents: mealFee * 100 * mealQty1 }] : []),
        ...(offersMeal && mealQty2 > 0 ? [{ name: `🍽️ Dinner ticket × ${mealQty2} (${p2Label})`, amountCents: mealFee * 100 * mealQty2 }] : []),
        ...(offersMeal && effMealQty3 > 0 ? [{ name: `🍽️ Dinner ticket × ${effMealQty3} (${p3Label})`, amountCents: mealFee * 100 * effMealQty3 }] : []),
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
        memberEmail: member?.email || session.user.email,
        memberName: member?.name || '',
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
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-left">
          <p className="text-sm font-black text-amber-800 mb-1">⏳ Awaiting your teammates</p>
          <p className="text-xs text-amber-700">
            Their entry fees are already paid. We've emailed each of them a link to sign in, confirm their details and accept the rules — your team shows as pending until they do.
          </p>
        </div>
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

  // Competitor 1 must be a current member before they can register a team
  const isActiveMember = member?.membership_status === 'active' || member?.payment_status === 'paid'
  if (!isActiveMember) return (
    <div className="min-h-screen bg-gray-50">
      <div style={{ background: SNZ_DARK }} className="px-6 py-3 flex items-center border-b border-blue-900">
        <button onClick={() => navigate('/catfish')}
          className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
          ← Catfish Cull
        </button>
      </div>
      <div className="max-w-md mx-auto px-6 py-12 text-center">
        <div className="text-4xl mb-3">🤿</div>
        <h1 className="text-xl font-black text-gray-900 mb-2">Active Membership Required</h1>
        <p className="text-gray-500 text-sm mb-6">
          Your SNZ membership isn't currently active, so you can't register a team yet. Renew your membership and you'll be able to enter straight away.
        </p>
        <button onClick={() => navigate('/membership')}
          className="px-5 py-2.5 rounded-xl font-bold text-sm text-white" style={{ background: SNZ_BLUE }}>
          Go to My Membership
        </button>
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
          <p className="text-xs text-blue-700 mt-1.5 font-semibold">You pay for the whole team — your teammates just confirm their own details.</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <label className="block text-xs font-semibold text-gray-600 mb-1">Team name <span className="text-red-500">*</span></label>
          <input value={teamName} onChange={e => setTeamName(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            placeholder="e.g. The Whisker Whackers" required />
        </div>

        {/* Competitor 1 — the signed-in member */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h3 className="text-sm font-black tracking-widest uppercase" style={{ color: SNZ_BLUE }}>Competitor 1 (You)</h3>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
            <p className="font-bold text-gray-900 text-sm">{member?.name}</p>
            <p className="text-xs text-gray-500">{member?.email}</p>
            <p className="text-xs text-green-700 font-semibold mt-0.5">✓ Active SNZ member</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Emergency contact name <span className="text-red-500">*</span></label>
              <input value={emergencyContact} onChange={e => setEmergencyContact(e.target.value)}
                placeholder="Full name"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Emergency contact phone <span className="text-red-500">*</span></label>
              <input value={emergencyPhone} onChange={e => setEmergencyPhone(e.target.value)}
                placeholder="+64 21 xxx xxxx"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={fitToDive} onChange={e => setFitToDive(e.target.checked)}
              className="mt-0.5 w-5 h-5 flex-shrink-0" />
            <span className="text-sm text-gray-700 font-semibold">
              I confirm I am fit and able to dive safely, have no medical conditions that would prevent safe participation, and take full responsibility for my own safety. <span className="text-red-500">*</span>
            </span>
          </label>
        </div>

        <PersonExtras label={member?.name || 'Competitor 1'}
          shirt={shirt1} setShirt={setShirt1} shirtQty={shirtQty1} setShirtQty={setShirtQty1}
          mealQty={mealQty1} setMealQty={setMealQty1}
          offersShirt={offersShirt} offersMeal={offersMeal} shirtFee={shirtFee}
          shirtAllowsMultiple={shirtAllowsMultiple} mealFee={mealFee} />

        <PartnerLookup slot={2} email={p2Email}
          setEmail={v => { setP2Email(v); setP2Status(null); setP2Member(null); setP2Error('') }}
          status={p2Status} partner={p2Member} checking={checkingP2} error={p2Error}
          onLookup={() => lookupPartner(p2Email, {
            setStatus: setP2Status, setPartner: setP2Member, setChecking: setCheckingP2,
            setError: setP2Error, otherEmail: hasThird ? p3Email : '',
          })} />

        <PersonExtras label={p2Member?.name || 'Competitor 2'}
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
          <>
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5">
              <p className="text-xs text-amber-700">⚠ Teams of 3 are welcome but not eligible for top prizes.</p>
            </div>
            <PartnerLookup slot={3} email={p3Email}
              setEmail={v => { setP3Email(v); setP3Status(null); setP3Member(null); setP3Error('') }}
              status={p3Status} partner={p3Member} checking={checkingP3} error={p3Error}
              onLookup={() => lookupPartner(p3Email, {
                setStatus: setP3Status, setPartner: setP3Member, setChecking: setCheckingP3,
                setError: setP3Error, otherEmail: p2Email,
              })}
              onRemove={() => {
                setHasThird(false); setP3Email(''); setP3Status(null); setP3Member(null); setP3Error('')
                setShirt3({ gender: '', size: '' }); setShirtQty3(1); setMealQty3(0)
              }} />
            <PersonExtras label={p3Member?.name || 'Competitor 3'}
              shirt={shirt3} setShirt={setShirt3} shirtQty={shirtQty3} setShirtQty={setShirtQty3}
              mealQty={mealQty3} setMealQty={setMealQty3}
              offersShirt={offersShirt} offersMeal={offersMeal} shirtFee={shirtFee}
              shirtAllowsMultiple={shirtAllowsMultiple} mealFee={mealFee} />
          </>
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
              I have read, understood, and agree to the above. Each teammate will confirm the same when they accept their invite. <span className="text-red-600">*</span>
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
        <p className="text-xs text-gray-400 text-center">You'll be redirected to Stripe to complete your team's entry fee payment.</p>
      </form>
    </div>
  )
}
