import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useMemberSession, MemberAuthGate } from '../components/MemberAuthGate'

const SNZ_BLUE = '#2B6CB0'
const SNZ_DARK = '#1e3a5f'

const SUB_EVENTS = [
  {
    id: 'open', name: '2-Day Open Championship', emoji: '🏆',
    perDiver: false, baseFee: false, feeCents: 0,
    desc: 'The flagship 2-day pairs competition. Required for Super Diver.',
    earlyBird: true,
    color: '#2B6CB0', bgColor: '#eff6ff', borderColor: '#bfdbfe',
  },
  {
    id: 'womens', name: "Women's Championship", emoji: '🔱',
    perDiver: false, baseFee: false, feeCents: 0,
    desc: 'Per team — both divers must be women.',
    color: '#db2777', bgColor: '#fdf2f8', borderColor: '#fbcfe8',
  },
  {
    id: 'juniors', name: 'Junior Championship', emoji: '🌟',
    perDiver: false, baseFee: false, feeCents: 0,
    desc: 'Per team — select if either diver is under 18.',
    color: '#7c3aed', bgColor: '#faf5ff', borderColor: '#ddd6fe',
  },
  {
    id: 'goldenoldie', name: 'Golden Oldie', emoji: '🎖️',
    perDiver: false, baseFee: false, feeCents: 0,
    desc: 'Standalone boat competition on its own day. Both divers must be 60+. Species list confirmed prior to the event.',
    earlyBird: true,
    color: '#d97706', bgColor: '#fffbeb', borderColor: '#fde68a',
  },
  {
    id: 'under23', name: 'Under 23 Division', emoji: '🎯',
    perDiver: true, groupWithTeam: true, baseFee: false, feeCents: 0,
    desc: 'Individual — for divers aged 18–22 on the day of competition. Select for each eligible diver.',
    color: '#7c3aed', bgColor: '#faf5ff', borderColor: '#ddd6fe',
  },
  {
    id: 'photography', name: 'Snorkel Photography', emoji: '📸',
    perDiver: true, baseFee: false, feeCents: 0,
    desc: 'Individual — select for each diver who wants to enter. Required for Super Diver.',
    color: '#0891b2', bgColor: '#ecfeff', borderColor: '#a5f3fc',
  },
  {
    id: 'finswim', name: 'Fin Swimming', emoji: '🐟',
    perDiver: true, baseFee: false, feeCents: 0,
    desc: 'Individual — select for each diver who wants to enter. Required for Super Diver.',
    color: '#059669', bgColor: '#ecfdf5', borderColor: '#a7f3d0',
  },
]

// Resolve per-person fee for an event given DB fees + early bird status
function resolveFeeCents(eventId, categoryFees, isEarlyBird) {
  if (!categoryFees) return null // null = TBC
  const ev = categoryFees[eventId]
  if (!ev) return 0
  if (isEarlyBird && ev.early_bird != null) return ev.early_bird
  return ev.standard ?? 0
}

export default function NationalsRegister() {
  const navigate = useNavigate()
  const { member, session, loading: sessionLoading } = useMemberSession()

  // Competition + fee state
  const [comp, setComp] = useState(null)
  const [compLoading, setCompLoading] = useState(true)
  const [isEarlyBird, setIsEarlyBird] = useState(false)
  const [categoryFees, setCategoryFees] = useState(null)

  useEffect(() => {
    const fetchComp = async () => {
      const { data } = await supabase
        .from('competitions')
        .select('id, name, status, registration_cutoff, early_bird_cutoff, category_fees')
        .ilike('name', '%nationals%2027%')
        .maybeSingle()
      setComp(data)
      if (data) {
        setCategoryFees(data.category_fees || null)
        const now = new Date()
        setIsEarlyBird(data.early_bird_cutoff ? now < new Date(data.early_bird_cutoff) : false)
      }
      setCompLoading(false)
    }
    fetchComp()
  }, [])

  // Pre-fill emergency contact from member profile
  useEffect(() => {
    if (member?.emergency_contact) setEmergencyContact(member.emergency_contact)
    if (member?.emergency_phone) setEmergencyPhone(member.emergency_phone)
  }, [member])

  // Returning from Stripe — mark payment paid and status active
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('payment') === 'success') {
      const teamId = params.get('team')
      if (teamId) {
        supabase.from('comp_teams').update({
          payment_status: 'paid',
          status: 'active',
        }).eq('id', teamId).then(() => {
          window.history.replaceState({}, '', '/nationals/register')
          setSubmitted(true)
        })
      }
    }
    if (params.get('cancelled') === '1') {
      window.history.replaceState({}, '', '/nationals/register')
    }
  }, [])

  // Team
  const [teamName, setTeamName] = useState('')
  const [p2Email, setP2Email] = useState('')
  const [p2Member, setP2Member] = useState(null)
  const [checkingP2, setCheckingP2] = useState(false)
  const [p2Error, setP2Error] = useState('')

  // Per-team event selection: { juniors: bool, over60: bool }
  const [teamEvents, setTeamEvents] = useState({ open: false, womens: false, juniors: false, goldenoldie: false })

  // Per-diver event selection: { photography: { d1: bool, d2: bool }, finswim: { d1: bool, d2: bool } }
  const [diverEvents, setDiverEvents] = useState({
    photography: { d1: false, d2: false },
    finswim: { d1: false, d2: false },
    under23: { d1: false, d2: false },
  })

  // p2Status: null | 'active' | 'inactive' | 'not_found'
  const [p2Status, setP2Status] = useState(null)
  // Safety & compliance
  const [emergencyContact, setEmergencyContact] = useState('')
  const [emergencyPhone, setEmergencyPhone] = useState('')
  const [fitToDive, setFitToDive] = useState(false)
  const [rulesAck, setRulesAck] = useState(false)

  // Merch & meal
  const [jacket, setJacket] = useState({ gender: '', size: '' })
  const [shirt, setShirt] = useState({ gender: '', size: '' })
  const [mealQty, setMealQty] = useState(0)

  const [errors, setErrors] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  if (sessionLoading || compLoading) return null

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div style={{ background: SNZ_DARK }} className="px-6 py-3 flex items-center border-b border-blue-900">
          <button onClick={() => navigate('/nationals')}
            className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
            ← Nationals
          </button>
        </div>
        <div className="max-w-md mx-auto px-4 py-8">
          <MemberAuthGate message="You must be an active SNZ member to enter the Nationals." />
        </div>
      </div>
    )
  }

  const lookupP2 = async () => {
    if (!p2Email.trim()) return
    setCheckingP2(true)
    setP2Error('')
    setP2Member(null)
    setP2Status(null)
    const trimmed = p2Email.trim().toLowerCase()
    if (trimmed === member?.email?.toLowerCase()) {
      setP2Error('You cannot enter as both divers.')
      setCheckingP2(false)
      return
    }
    const { data } = await supabase.from('members')
      .select('id, name, email, membership_status, payment_status')
      .eq('email', trimmed)
      .maybeSingle()
    setCheckingP2(false)
    if (!data) {
      setP2Status('not_found')
      return
    }
    if (data.id === member?.id) { setP2Error('You cannot enter as both divers.'); return }
    const isActive = data.membership_status === 'active' || data.payment_status === 'paid'
    setP2Member(data)
    setP2Status(isActive ? 'active' : 'inactive')
  }

  // Registration not open yet
  if (comp && comp.status !== 'open') {
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

  // p2 is "confirmed" for form purposes if active, inactive, or not_found with an email entered
  const p2Ready = p2Status === 'active' || p2Status === 'inactive' || p2Status === 'not_found'

  // Calculate total fee (Person 1 only — per-team + d1 per-diver)
  // All events are per-person. Person 1 pays for their own selected events.
  const getFee = (eventId) => resolveFeeCents(eventId, categoryFees, isEarlyBird)

  const getMerchFee = (type) => {
    if (!categoryFees?.merch) return null
    return categoryFees.merch[type]?.price ?? null
  }
  const getMealFee = () => {
    if (!categoryFees?.meal) return null
    return categoryFees.meal.price ?? null
  }

  const calcTotal = () => {
    let total = 0
    SUB_EVENTS.forEach(e => {
      const fee = getFee(e.id)
      if (fee === null || fee === 0) return
      if (e.perDiver) {
        if (diverEvents[e.id]?.d1) total += fee
      } else {
        if (teamEvents[e.id]) total += fee
      }
    })
    // Merch (jacket)
    const jFee = getMerchFee('jacket')
    if (jFee && jacket.gender && jacket.size) total += jFee
    // Merch (shirt)
    const sFee = getMerchFee('shirt')
    if (sFee && shirt.gender && shirt.size) total += sFee
    // Meal
    const mFee = getMealFee()
    if (mFee && mealQty > 0) total += mFee * mealQty
    return total
  }

  // Person 2 pays for all events they are entered in
  const calcP2Total = () => {
    let total = 0
    SUB_EVENTS.forEach(e => {
      const fee = getFee(e.id)
      if (fee === null || fee === 0) return
      if (e.perDiver) {
        if (diverEvents[e.id]?.d2) total += fee
      } else {
        // For non-per-diver events, person 2 also pays their own fee
        if (teamEvents[e.id]) total += fee
      }
    })
    return total
  }

  const hasTBCFees = categoryFees === null

  const validate = () => {
    const e = []
    if (!teamName.trim()) e.push('Team name is required')
    if (!p2Email.trim()) e.push('Diver 2 email is required')
    if (!p2Ready) e.push('Click Look up to confirm your partner\'s email')
    if (p2Error) e.push(p2Error)
    const anyEventSelected = Object.values(teamEvents).some(v => v) || Object.values(diverEvents).some(d => d.d1 || d.d2)
    if (!anyEventSelected) e.push('Please select at least one event')
    if (!emergencyContact.trim()) e.push('Emergency contact name is required')
    if (!emergencyPhone.trim()) e.push('Emergency contact phone is required')
    if (!fitToDive) e.push('You must confirm you are fit to dive')
    if (!rulesAck) e.push('You must acknowledge the competition rules')
    setErrors(e)
    return e.length === 0
  }

  // Super Diver auto-qualifies if entered Open + Photography + FinSwim
  const superDiverD1 = teamEvents.open && diverEvents.photography.d1 && diverEvents.finswim.d1
  const superDiverD2 = teamEvents.open && diverEvents.photography.d2 && diverEvents.finswim.d2

  const handleSubmit = async () => {
    if (!validate()) { window.scrollTo({ top: 0, behavior: 'smooth' }); return }
    setSubmitting(true)
    try {
      // Find the Nationals 2027 competition row
      const { data: compCheck } = await supabase
        .from('competitions')
        .select('id, registration_cutoff')
        .ilike('name', '%nationals%2027%')
        .maybeSingle()

      if (!compCheck) throw new Error('Nationals 2027 registration is not yet open. Check back soon.')

      const nationalsEvents = {
        ...Object.fromEntries(Object.entries(teamEvents).filter(([, v]) => v)),
        photography_d1: diverEvents.photography.d1,
        photography_d2: diverEvents.photography.d2,
        finswim_d1: diverEvents.finswim.d1,
        finswim_d2: diverEvents.finswim.d2,
        under23_d1: diverEvents.under23?.d1 || false,
        under23_d2: diverEvents.under23?.d2 || false,
        superdiver_d1: superDiverD1,
        superdiver_d2: superDiverD2,
      }

      const isP2Active = p2Status === 'active'
      // Always pending_payment until Stripe confirms — never set active on insert
      const teamStatus = isP2Active ? 'pending_payment' : 'pending_diver2'

      // Insert comp_teams row
      const { data: team, error: teamErr } = await supabase.from('comp_teams').insert({
        competition_id: compCheck.id,
        team_name: teamName.trim(),
        diver1_member_id: session.user.id,
        diver2_member_id: isP2Active ? p2Member.id : null,
        diver2_email: p2Email.trim().toLowerCase(),
        diver2_accepted_at: isP2Active ? new Date().toISOString() : null,
        status: teamStatus,
        payment_status: 'pending',
        nationals_event: nationalsEvents,
        entry_fee_cents: totalCents,
        merch_d1: {
          jacket: jacket.gender && jacket.size ? jacket : null,
          shirt: shirt.gender && shirt.size ? shirt : null,
          meal_qty: mealQty > 0 ? mealQty : 0,
        },
      }).select().single()
      if (teamErr) throw teamErr

      // member_competitions for diver 1
      await supabase.from('member_competitions').upsert({
        member_id: session.user.id,
        competition_id: compCheck.id,
        team_id: team.id,
        year: 2027,
      }, { onConflict: 'member_id,competition_id' })

      // member_competitions for diver 2 if already a member
      if (isP2Active && p2Member?.id) {
        await supabase.from('member_competitions').upsert({
          member_id: p2Member.id,
          competition_id: compCheck.id,
          team_id: team.id,
          year: 2027,
        }, { onConflict: 'member_id,competition_id' })
      }

      // Always send invite email to partner regardless of status
      await fetch('/.netlify/functions/invite-member', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: p2Email.trim().toLowerCase(),
          invitedBy: member?.name || session.user.email,
          compName: 'SNZ Nationals 2027',
          teamId: team.id,
          teamName: teamName.trim(),
          nationals: true,
          isExistingMember: isP2Active,
          confirmUrl: `${window.location.origin}/nationals/confirm?team=${team.id}`,
        }),
      })

      // Stripe checkout for Person 1's entry fee
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
            teamId: team.id,
            competitionId: compCheck.id,
            competitionName: 'SNZ Nationals 2027',
          }),
        })
        const { url, error: stripeErr } = await res.json()
        if (stripeErr) throw new Error(stripeErr)
        window.location.href = url
        return // Stripe redirect — don't setSubmitted
      }

      // No fee (fees TBC) — just show success
      setSubmitted(true)
    } catch (err) {
      setErrors([err.message])
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setSubmitting(false)
    }
  }

  const totalCents = calcTotal()
  const p2TotalCents = calcP2Total()

  // Success screen
  if (submitted) {
    const isP2Active = p2Status === 'active'
    return (
      <div className="min-h-screen bg-gray-50">
        <div style={{ background: SNZ_DARK }} className="px-6 py-3 flex items-center border-b border-blue-900">
          <button onClick={() => navigate('/nationals')}
            className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
            ← Nationals
          </button>
        </div>
        <div className="max-w-md mx-auto px-4 py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-green-600 text-2xl">✓</span>
          </div>
          <h1 className="text-2xl font-black text-gray-900 mb-2">Registration submitted!</h1>
          <p className="text-gray-500 text-sm mb-6">
            {isP2Active
              ? `Your team is registered. Both you and ${p2Member?.name} are confirmed.`
              : `Your entry is in. An invitation has been sent to ${p2Email} to confirm their partnership and pay their entry fee.`}
          </p>
          {!isP2Active && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-left">
              <p className="text-sm font-black text-amber-800 mb-1">⏳ Awaiting partner confirmation</p>
              <p className="text-xs text-amber-700">Your team will show as pending until {p2Email} accepts the invitation. You can change your partner any time before entries close from your membership dashboard.</p>
            </div>
          )}
          <div className="flex flex-col gap-3">
            <button onClick={() => navigate('/membership')}
              className="w-full py-3 rounded-xl font-black text-white text-sm"
              style={{ background: SNZ_BLUE }}>
              View My Registrations →
            </button>
            <button onClick={() => navigate('/nationals')}
              className="w-full py-3 rounded-xl font-bold text-sm border border-gray-200 text-gray-600 hover:bg-white">
              Back to Nationals
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div style={{ background: SNZ_DARK }} className="px-6 py-3 flex items-center border-b border-blue-900">
        <button onClick={() => navigate('/nationals')}
          className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
          ← Nationals
        </button>
        <span className="text-white/50 mx-2">/</span>
        <span className="text-white font-bold text-sm">Register</span>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8 space-y-5">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Nationals Registration</h1>
          <p className="text-gray-500 text-sm mt-1">Tairua, Coromandel · 19–24 January 2027</p>
        </div>

        {errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            {errors.map((e, i) => <p key={i} className="text-sm text-red-700">• {e}</p>)}
          </div>
        )}

        {/* Team details */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
          <h2 className="font-black text-gray-900 text-sm uppercase tracking-widest" style={{ color: SNZ_BLUE }}>Team Details</h2>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Team Name *</label>
            <input value={teamName} onChange={e => setTeamName(e.target.value)}
              placeholder="Enter your team name"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>

          {/* Diver 1 */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
            <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-0.5">Diver 1 — You</p>
            <p className="font-bold text-gray-900 text-sm">{member?.name}</p>
            <p className="text-xs text-gray-500">{member?.email}</p>
          </div>

          {/* Diver 2 lookup */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Diver 2 Email *</label>
            <div className="flex gap-2">
              <input type="email" value={p2Email}
                onChange={e => { setP2Email(e.target.value); setP2Member(null); setP2Status(null); setP2Error('') }}
                placeholder="partner@email.com"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              <button onClick={lookupP2} disabled={checkingP2 || !p2Email.trim()}
                className="px-4 py-2.5 rounded-lg text-sm font-bold border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40">
                {checkingP2 ? '…' : 'Look up'}
              </button>
            </div>
            {p2Error && <p className="text-xs text-red-600 mt-1.5">{p2Error}</p>}

            {/* Active SNZ member */}
            {p2Status === 'active' && p2Member && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 mt-2">
                <p className="text-xs font-bold text-green-700 uppercase tracking-wide mb-0.5">✓ Active SNZ member</p>
                <p className="font-bold text-gray-900 text-sm">{p2Member.name}</p>
                <p className="text-xs text-gray-500">{p2Member.email}</p>
              </div>
            )}

            {/* Inactive member */}
            {p2Status === 'inactive' && p2Member && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mt-2">
                <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-0.5">⚠ Membership not current</p>
                <p className="font-bold text-gray-900 text-sm">{p2Member.name}</p>
                <p className="text-xs text-amber-700 mt-0.5">They're in our system but not currently active. An invite will be sent prompting them to renew and pay their entry fee.</p>
              </div>
            )}

            {/* Not in system */}
            {p2Status === 'not_found' && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mt-2">
                <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-0.5">📧 Not yet an SNZ member</p>
                <p className="text-xs text-blue-700">That email isn't in our system. An invitation will be sent to <strong>{p2Email}</strong> to join SNZ and pay their entry fee. Your registration will be pending until they confirm.</p>
              </div>
            )}
          </div>
        </div>

        {/* Event selection */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
          <div>
            <h2 className="font-black text-gray-900 text-sm uppercase tracking-widest" style={{ color: SNZ_BLUE }}>Select Events</h2>
            <p className="text-xs text-gray-400 mt-0.5">Pick and mix — enter any events you like. You only pay for what you choose.</p>
          </div>

          {/* All events rendered in array order */}
          {SUB_EVENTS.filter(e => !e.perDiver || e.groupWithTeam).map(ev => (
            ev.groupWithTeam ? (
              <div key={ev.id} className="border rounded-xl overflow-hidden" style={{ borderColor: '#e5e7eb' }}>
                <div className="px-3 py-2.5 flex items-center gap-3" style={{ background: ev.bgColor, borderBottom: `1px solid ${ev.borderColor}` }}>
                  <span className="text-xl">{ev.emoji}</span>
                  <div>
                    <p className="font-bold text-gray-900 text-sm">{ev.name}</p>
                    <p className="text-xs font-semibold" style={{ color: ev.color }}>👤 Individual — select for each eligible diver</p>
                  </div>
                </div>
                <div className="divide-y divide-gray-100">
                  <div className="px-3 py-2.5 flex items-center gap-3 cursor-pointer hover:bg-gray-50"
                    onClick={() => setDiverEvents(d => ({ ...d, under23: { ...d.under23, d1: !d.under23?.d1 } }))}>
                    <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-black text-blue-700 flex-shrink-0">1</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{member?.name || 'Diver 1'}</p>
                      {(() => { const f = getFee('under23'); return f === null ? <p className="text-xs text-gray-400">Fee TBC</p> : f === 0 ? <p className="text-xs text-gray-400">No additional fee</p> : <p className="text-xs text-gray-400">${(f/100).toFixed(2)}{isEarlyBird ? ' 🐦' : ''}</p> })()}
                    </div>
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition ${diverEvents.under23?.d1 ? 'border-transparent' : 'border-gray-300'}`}
                      style={diverEvents.under23?.d1 ? { background: ev.color } : {}}>
                      {diverEvents.under23?.d1 && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                  </div>
                  <div className={`px-3 py-2.5 flex items-center gap-3 ${p2Ready ? 'cursor-pointer hover:bg-gray-50' : 'opacity-40'}`}
                    onClick={() => p2Ready && setDiverEvents(d => ({ ...d, under23: { ...d.under23, d2: !d.under23?.d2 } }))}>
                    <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-black text-gray-600 flex-shrink-0">2</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">
                        {p2Status === 'active' ? p2Member?.name : p2Status === 'inactive' ? p2Member?.name : p2Status === 'not_found' ? p2Email : 'Confirm Diver 2 email first'}
                      </p>
                      {(() => { const f = getFee('under23'); return f === null ? <p className="text-xs text-gray-400">Fee TBC</p> : f === 0 ? <p className="text-xs text-gray-400">No additional fee</p> : <p className="text-xs text-gray-400">${(f/100).toFixed(2)}{isEarlyBird ? ' 🐦' : ''} — paid by Diver 2</p> })()}
                    </div>
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition ${diverEvents.under23?.d2 ? 'border-transparent' : 'border-gray-300'}`}
                      style={diverEvents.under23?.d2 ? { background: ev.color } : {}}>
                      {diverEvents.under23?.d2 && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
          /* Per-team events */
            <div key={ev.id} className="border rounded-xl p-3 flex items-center gap-3 cursor-pointer"
              style={{ borderColor: teamEvents[ev.id] ? ev.color : '#e5e7eb', background: teamEvents[ev.id] ? ev.bgColor : 'white' }}
              onClick={() => setTeamEvents(t => ({ ...t, [ev.id]: !t[ev.id] }))}>
              <span className="text-xl">{ev.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 text-sm">{ev.name}</p>
                <p className="text-xs text-gray-500">{ev.desc}</p>
                {(() => { const f = getFee(ev.id); return f === null ? <p className="text-xs text-gray-400 mt-0.5">Fee TBC</p> : f === 0 ? <p className="text-xs text-gray-400 mt-0.5">No additional fee</p> : <p className="text-xs font-bold mt-0.5" style={{ color: ev.color }}>${(f/100).toFixed(2)} per person{isEarlyBird ? <span className="ml-1 text-amber-600">🐦 Early bird</span> : ''}</p> })()}
              </div>
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition ${teamEvents[ev.id] ? 'border-transparent' : 'border-gray-300'}`}
                style={teamEvents[ev.id] ? { background: ev.color } : {}}>
                {teamEvents[ev.id] && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
            </div>
            )
          ))}

          {/* Per-diver events (photography, finswim) */}
          {SUB_EVENTS.filter(e => e.perDiver && !e.groupWithTeam).map(ev => (
            <div key={ev.id} className="border rounded-xl overflow-hidden" style={{ borderColor: '#e5e7eb' }}>
              <div className="px-3 py-2.5 flex items-center gap-3" style={{ background: ev.bgColor, borderBottom: `1px solid ${ev.borderColor}` }}>
                <span className="text-xl">{ev.emoji}</span>
                <div>
                  <p className="font-bold text-gray-900 text-sm">{ev.name}</p>
                  <p className="text-xs font-semibold" style={{ color: ev.color }}>👤 Individual — select per diver</p>
                </div>
              </div>
              <div className="divide-y divide-gray-100">
                {/* Diver 1 */}
                <div className="px-3 py-2.5 flex items-center gap-3 cursor-pointer hover:bg-gray-50"
                  onClick={() => setDiverEvents(d => ({ ...d, [ev.id]: { ...d[ev.id], d1: !d[ev.id].d1 } }))}>
                  <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-black text-blue-700 flex-shrink-0">1</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{member?.name || 'Diver 1'}</p>
                    {(() => { const f = getFee(ev.id); return f === null ? <p className="text-xs text-gray-400">Fee TBC</p> : f === 0 ? null : <p className="text-xs text-gray-400">${(f/100).toFixed(2)}{isEarlyBird ? ' 🐦' : ''}</p> })()}
                  </div>
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition ${diverEvents[ev.id]?.d1 ? 'border-transparent' : 'border-gray-300'}`}
                    style={diverEvents[ev.id]?.d1 ? { background: ev.color } : {}}>
                    {diverEvents[ev.id]?.d1 && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                </div>
                {/* Diver 2 */}
                <div className={`px-3 py-2.5 flex items-center gap-3 ${p2Ready ? 'cursor-pointer hover:bg-gray-50' : 'opacity-40'}`}
                  onClick={() => p2Ready && setDiverEvents(d => ({ ...d, [ev.id]: { ...d[ev.id], d2: !d[ev.id].d2 } }))}>
                  <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center text-xs font-black text-gray-600 flex-shrink-0">2</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {p2Status === 'active' ? p2Member?.name : p2Status === 'inactive' ? p2Member?.name : p2Status === 'not_found' ? p2Email : 'Confirm Diver 2 email first'}
                    </p>
                    {p2Status && p2Status !== 'active' && <p className="text-xs text-amber-600">Will be invited to confirm</p>}
                    {(() => { const f = getFee(ev.id); return f === null ? <p className="text-xs text-gray-400">Fee TBC</p> : f === 0 ? null : <p className="text-xs text-gray-400">${(f/100).toFixed(2)}{isEarlyBird ? ' 🐦' : ''} — paid by Diver 2</p> })()}
                  </div>
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition ${diverEvents[ev.id]?.d2 ? 'border-transparent' : 'border-gray-300'}`}
                    style={diverEvents[ev.id]?.d2 ? { background: ev.color } : {}}>
                    {diverEvents[ev.id]?.d2 && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Fee summary */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <h2 className="font-black text-gray-900 text-sm uppercase tracking-widest mb-3" style={{ color: SNZ_BLUE }}>Entry Summary</h2>
          {Object.values(teamEvents).every(v => !v) && Object.values(diverEvents).every(d => !d.d1 && !d.d2) ? (
            <p className="text-sm text-gray-400 italic">No events selected yet.</p>
          ) : (
            <div className="space-y-2 text-sm">
              {SUB_EVENTS.filter(e => !e.perDiver && !e.groupWithTeam && teamEvents[e.id]).map(ev => {
                const f = getFee(ev.id)
                return (
                  <div key={ev.id} className="flex justify-between">
                    <span className="text-gray-600">{ev.emoji} {ev.name} <span className="text-gray-400">· per person</span></span>
                    <span className="font-bold text-gray-900">{f === null ? 'TBC' : f === 0 ? 'Included' : `$${(f/100).toFixed(2)}`}</span>
                  </div>
                )
              })}
              {/* under23 summary */}
              {(diverEvents.under23?.d1 || diverEvents.under23?.d2) && (() => {
                const f = getFee('under23')
                const fStr = f === null ? 'TBC' : f === 0 ? 'Included' : `$${(f/100).toFixed(2)}`
                return (<>
                  {diverEvents.under23?.d1 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">🎯 Under 23 — {member?.name?.split(' ')[0]}</span>
                      <span className="font-bold text-gray-900">{fStr}</span>
                    </div>
                  )}
                  {diverEvents.under23?.d2 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">🎯 Under 23 — {p2Member?.name?.split(' ')[0] || p2Email.split('@')[0]} <span className="text-amber-600 text-xs">(paid by Diver 2)</span></span>
                      <span className="font-bold text-gray-400">{fStr}</span>
                    </div>
                  )}
                </>)
              })()}
              {SUB_EVENTS.filter(e => e.perDiver && !e.groupWithTeam).map(ev => {
                const f = getFee(ev.id)
                const fStr = f === null ? 'TBC' : f === 0 ? 'Included' : `$${(f/100).toFixed(2)}`
                return (<>
                  {diverEvents[ev.id]?.d1 && (
                    <div key={`${ev.id}-d1`} className="flex justify-between">
                      <span className="text-gray-600">{ev.emoji} {ev.name} — {member?.name?.split(' ')[0]}</span>
                      <span className="font-bold text-gray-900">{fStr}</span>
                    </div>
                  )}
                  {diverEvents[ev.id]?.d2 && (
                    <div key={`${ev.id}-d2`} className="flex justify-between">
                      <span className="text-gray-600">{ev.emoji} {ev.name} — {p2Member?.name?.split(' ')[0] || p2Email.split('@')[0]} <span className="text-amber-600 text-xs">(paid by Diver 2)</span></span>
                      <span className="font-bold text-gray-400">{fStr}</span>
                    </div>
                  )}
                </>)
              })}
              {/* Merch & meal summary lines */}
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
              <div className="border-t border-gray-100 pt-2 mt-2 space-y-1">
                <div className="flex justify-between">
                  <span className="font-black text-gray-900">Your total today</span>
                  <span className="font-black text-gray-900">{hasTBCFees ? 'TBC — fees not yet set' : totalCents > 0 ? `$${(totalCents/100).toFixed(2)} NZD` : '$0.00'}</span>
                </div>
                {p2TotalCents > 0 && (
                  <div className="flex justify-between">
                    <span className="text-xs text-gray-400">Diver 2 pays on confirmation</span>
                    <span className="text-xs text-gray-400">${(p2TotalCents/100).toFixed(2)} NZD</span>
                  </div>
                )}
              </div>
            </div>
          )}
          {isEarlyBird && <p className="text-xs text-amber-600 mt-2">🐦 Early bird pricing applied — entries close {comp?.early_bird_cutoff ? new Date(comp.early_bird_cutoff).toLocaleDateString('en-NZ', {day:'numeric',month:'short'}) : 'soon'}</p>}
          {!isEarlyBird && hasTBCFees && <p className="text-xs text-amber-600 mt-2">🐦 Early bird pricing coming — register early to save.</p>}
          {(superDiverD1 || superDiverD2) && (
            <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-xl px-3 py-2.5">
              <p className="text-xs font-black text-yellow-800">⭐ Super Diver eligible!</p>
              <p className="text-xs text-yellow-700 mt-0.5">
                {superDiverD1 && superDiverD2 ? 'Both divers qualify' : superDiverD1 ? (member?.name?.split(' ')[0] + ' qualifies') : ((p2Member?.name?.split(' ')[0] || 'Diver 2') + ' qualifies')} — entered Open, Photography &amp; Fin Swim.
              </p>
            </div>
          )}
        </div>

        {/* Partner pending notice */}
        {p2Ready && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <p className="text-sm font-black text-amber-800 mb-1">📧 Partner invite email</p>
            <p className="text-xs text-amber-700">
              {p2Status === 'active'
                ? `${p2Member?.name} will receive a confirmation email with their entry details and a link to pay their own entry fee.`
                : p2Status === 'not_found'
                  ? `${p2Email} will receive an email inviting them to join SNZ, pay their membership, and complete their entry.`
                  : `${p2Member?.name} will receive an email to renew their SNZ membership and pay their entry fee.`}
              {' '}You can change your partner any time before entries close.
            </p>
          </div>
        )}

        {/* Merch & Meal */}
        {(categoryFees?.merch || categoryFees?.meal) && (
          <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
            <div>
              <h2 className="font-black text-gray-900 text-sm uppercase tracking-widest" style={{ color: SNZ_BLUE }}>Merchandise & Meal</h2>
              <p className="text-xs text-gray-400 mt-0.5">Optional — ordered and paid for with your entry. Diver 2 can order their own when they confirm.</p>
            </div>

            {/* Jacket */}
            {categoryFees?.merch?.jacket && (
              <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-bold text-gray-900 text-sm">🧥 Event Jacket</p>
                    <p className="text-xs text-gray-400">SNZ Nationals 2027 jacket</p>
                  </div>
                  <p className="font-black text-gray-900 text-sm">${(categoryFees.merch.jacket.price/100).toFixed(2)}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Gender fit</label>
                    <select value={jacket.gender} onChange={e => setJacket(j => ({...j, gender: e.target.value}))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                      <option value="">No jacket</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                  {jacket.gender && (
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Size</label>
                      <select value={jacket.size} onChange={e => setJacket(j => ({...j, size: e.target.value}))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                        <option value="">Select size</option>
                        <option value="XS">XS</option><option value="S">S</option><option value="M">M</option><option value="L">L</option><option value="XL">XL</option><option value="2XL">2XL</option><option value="3XL">3XL</option><option value="4XL">4XL</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Shirt */}
            {categoryFees?.merch?.shirt && (
              <div className="border border-gray-200 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="font-bold text-gray-900 text-sm">👕 Event T-Shirt</p>
                    <p className="text-xs text-gray-400">SNZ Nationals 2027 t-shirt</p>
                  </div>
                  <p className="font-black text-gray-900 text-sm">${(categoryFees.merch.shirt.price/100).toFixed(2)}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Gender fit</label>
                    <select value={shirt.gender} onChange={e => setShirt(s => ({...s, gender: e.target.value}))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                      <option value="">No shirt</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </div>
                  {shirt.gender && (
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Size</label>
                      <select value={shirt.size} onChange={e => setShirt(s => ({...s, size: e.target.value}))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                        <option value="">Select size</option>
                        <option value="XS">XS</option><option value="S">S</option><option value="M">M</option><option value="L">L</option><option value="XL">XL</option><option value="2XL">2XL</option><option value="3XL">3XL</option><option value="4XL">4XL</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Prize giving meal */}
            {categoryFees?.meal && (
              <div className="border border-gray-200 rounded-xl p-4">
                <div className="flex justify-between items-center mb-3">
                  <div>
                    <p className="font-bold text-gray-900 text-sm">🍽️ Prize Giving Dinner</p>
                    <p className="text-xs text-gray-400">${(categoryFees.meal.price/100).toFixed(2)} per person — order for family &amp; friends too</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Tickets</label>
                  <div className="flex items-center gap-2">
                    <button type="button"
                      onClick={() => setMealQty(q => Math.max(0, q - 1))}
                      className="w-8 h-8 rounded-lg border border-gray-300 text-gray-600 font-bold text-lg flex items-center justify-center hover:bg-gray-50 disabled:opacity-30"
                      disabled={mealQty === 0}>−</button>
                    <span className="w-8 text-center font-black text-gray-900">{mealQty}</span>
                    <button type="button"
                      onClick={() => setMealQty(q => q + 1)}
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

        {/* Safety & Competitor Info */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
          <div>
            <h2 className="font-black text-gray-900 text-sm uppercase tracking-widest" style={{ color: SNZ_BLUE }}>Safety & Competitor Information</h2>
            <p className="text-xs text-gray-400 mt-0.5">Required for all competitors. Please read before submitting.</p>
          </div>

          {/* Competition info box */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
            <p className="text-xs font-black text-blue-900 uppercase tracking-wide">2027 Nationals — Key Info</p>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>📍 Tairua, Coromandel Peninsula · 19–24 January 2027</li>
              <li>⚠️ All competitors must attend the mandatory safety briefing before competing</li>
              <li>🤿 The Open Championship is a pairs event — no individual diving permitted</li>
              <li>📋 Full rules: <a href="https://www.spearfishingnz.co.nz/_files/ugd/b3c400_e310eb5a265b4259a4b3c18d2c9afb87.pdf" target="_blank" rel="noopener noreferrer" className="underline font-bold">SNZ Competition Rules PDF</a></li>
              <li>🎣 Eligible species list will be published prior to the event</li>
            </ul>
          </div>

          {/* Emergency contact */}
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

          {/* Fitness to dive */}
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={fitToDive} onChange={e => setFitToDive(e.target.checked)}
                className="mt-0.5 w-5 h-5 flex-shrink-0" />
              <span className="text-sm text-red-900 font-semibold">
                I confirm I am medically fit and able to participate safely in spearfishing competitions. I have no conditions that would prevent safe participation and I take full responsibility for my own safety. <span className="text-red-600">*</span>
              </span>
            </label>
          </div>

          {/* Rules acknowledgement */}
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

        {/* Submit */}
        <button onClick={handleSubmit}
          disabled={submitting || !teamName.trim() || !p2Ready}
          className="w-full py-3 rounded-xl font-black text-white text-sm disabled:opacity-40"
          style={{ background: SNZ_BLUE }}>
          {submitting ? 'Processing…' : !hasTBCFees && totalCents > 0 ? `Register & Pay $${(totalCents/100).toFixed(2)} NZD →` : 'Complete Registration →'}
        </button>
        {!hasTBCFees && totalCents > 0 && (
          <p className="text-xs text-gray-400 text-center">You will be redirected to Stripe to complete payment. Your partner will receive an invite to pay their own entry separately.</p>
        )}
        <p className="text-xs text-gray-400 text-center">Tairua, Coromandel · 19–24 January 2027</p>
      </div>
    </div>
  )
}

