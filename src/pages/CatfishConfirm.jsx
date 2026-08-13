import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useMemberSession, MemberAuthGate } from '../components/MemberAuthGate'

const SNZ_BLUE = '#2B6CB0'
const SNZ_DARK = '#1e3a5f'

// Diver 1 pays the whole team's entry when they register, so this page is
// confirmation-only — no Stripe step. The partner signs in, supplies their own
// safety details and accepts the rules, which is what Diver 1 used to (badly)
// fill in on their behalf.
export default function CatfishConfirm() {
  const navigate = useNavigate()
  const location = useLocation()
  const { session, member, loading: sessionLoading } = useMemberSession()

  const [team, setTeam] = useState(null)
  const [comp, setComp] = useState(null)
  const [d1Member, setD1Member] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const [emergencyContact, setEmergencyContact] = useState('')
  const [emergencyPhone, setEmergencyPhone] = useState('')
  const [phone, setPhone] = useState('')
  const [fitToDive, setFitToDive] = useState(false)
  const [rulesAck, setRulesAck] = useState(false)

  const params = new URLSearchParams(location.search)
  const teamId = params.get('team')
  const slotParam = params.get('slot')

  useEffect(() => {
    if (member?.emergency_contact) setEmergencyContact(member.emergency_contact)
    if (member?.emergency_phone) setEmergencyPhone(member.emergency_phone)
    if (member?.phone) setPhone(member.phone)
    if (member?.fit_to_dive) setFitToDive(true)
  }, [member])

  useEffect(() => {
    if (!teamId) { setError('No team ID provided.'); setLoading(false); return }
    const fetchTeam = async () => {
      const { data: teamData, error: teamErr } = await supabase
        .from('comp_teams').select('*').eq('id', teamId).maybeSingle()
      if (teamErr || !teamData) { setError('Team not found.'); setLoading(false); return }
      setTeam(teamData)

      const { data: compData } = await supabase
        .from('competitions').select('*').eq('id', teamData.competition_id).maybeSingle()
      setComp(compData)

      if (teamData.diver1_member_id) {
        const { data: d1 } = await supabase.from('members')
          .select('name, email').eq('id', teamData.diver1_member_id).maybeSingle()
        setD1Member(d1)
      }
      setLoading(false)
    }
    fetchTeam()
  }, [teamId])

  // Which slot is this person? Prefer an explicit match on their own email or
  // an already-linked member id, and fall back to the ?slot= hint from the
  // invite link — so a forwarded link can't silently claim the wrong seat.
  const resolveSlot = () => {
    if (!team || !session) return null
    const myEmail = (session.user.email || '').toLowerCase()
    if (team.diver2_member_id === session.user.id) return 2
    if (team.diver3_member_id === session.user.id) return 3
    if ((team.diver2_email || '').toLowerCase() === myEmail) return 2
    if ((team.diver3_email || '').toLowerCase() === myEmail) return 3
    if (slotParam === '2' && !team.diver2_member_id) return 2
    if (slotParam === '3' && !team.diver3_member_id) return 3
    return null
  }

  const slot = resolveSlot()
  const alreadyConfirmed = slot === 2 ? !!team?.diver2_accepted_at
    : slot === 3 ? !!team?.diver3_accepted_at
    : false

  const handleConfirm = async () => {
    setError('')
    const errs = []
    if (!phone.trim()) errs.push('Phone number is required')
    if (!emergencyContact.trim()) errs.push('Emergency contact name is required')
    if (!emergencyPhone.trim()) errs.push('Emergency contact phone is required')
    if (!fitToDive) errs.push('You must confirm you are fit to dive')
    if (!rulesAck) errs.push('You must accept the rules and conservation declaration')
    if (errs.length) { setError(errs.join(' · ')); return }
    if (!slot) { setError('This invitation does not match your account.'); return }

    setSubmitting(true)
    try {
      // Keep the member profile current — these prefill next time
      await supabase.from('members').update({
        phone: phone.trim(),
        emergency_contact: emergencyContact.trim(),
        emergency_phone: emergencyPhone.trim(),
        fit_to_dive: fitToDive,
      }).eq('id', session.user.id)

      // Roster row for this competitor. Guarded so a re-submit (back button,
      // double click) updates rather than duplicating the entry.
      const rosterRow = {
        team_id: team.id,
        competition_id: team.competition_id,
        name: member?.name || '',
        email: session.user.email,
        phone: phone.trim(),
        club: member?.club || '',
        gender: member?.gender || '',
        dob: member?.dob || null,
        emergency_contact: emergencyContact.trim(),
        emergency_phone: emergencyPhone.trim(),
        fit_to_dive: fitToDive,
      }
      const { data: existingRow } = await supabase.from('comp_team_members')
        .select('id').eq('team_id', team.id).eq('email', session.user.email).maybeSingle()
      if (existingRow) {
        await supabase.from('comp_team_members').update(rosterRow).eq('id', existingRow.id)
      } else {
        const { error: rErr } = await supabase.from('comp_team_members').insert([rosterRow])
        if (rErr) throw rErr
      }

      const now = new Date().toISOString()
      const teamPatch = slot === 2
        ? { diver2_member_id: session.user.id, diver2_accepted_at: now }
        : { diver3_member_id: session.user.id, diver3_accepted_at: now }

      // Team goes active once every seat has confirmed and Diver 1 has paid.
      const otherConfirmed = slot === 2
        ? (!team.diver3_email || !!team.diver3_accepted_at)
        : !!team.diver2_accepted_at
      if (otherConfirmed && team.payment_status === 'paid') teamPatch.status = 'active'

      const { error: updErr } = await supabase.from('comp_teams').update(teamPatch).eq('id', team.id)
      if (updErr) throw updErr

      await supabase.from('member_competitions').upsert({
        member_id: session.user.id,
        competition_id: team.competition_id,
        team_id: team.id,
        year: 2027,
      }, { onConflict: 'member_id,competition_id' })

      setSubmitted(true)
    } catch (e) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const Header = () => (
    <div style={{ background: SNZ_DARK }} className="px-6 py-3 flex items-center border-b border-blue-900">
      <button onClick={() => navigate('/catfish')}
        className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
        ← Catfish Cull
      </button>
      <span className="text-white/50 mx-2">/</span>
      <span className="text-white font-bold text-sm">Confirm Entry</span>
    </div>
  )

  if (sessionLoading || loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-400 text-sm">Loading…</p>
    </div>
  )

  if (error && !team) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="text-center">
        <p className="text-4xl mb-3">⚠️</p>
        <p className="font-black text-gray-900 mb-2">Something went wrong</p>
        <p className="text-gray-500 text-sm mb-4">{error}</p>
        <button onClick={() => navigate('/catfish')}
          className="px-4 py-2 rounded-xl font-bold text-white text-sm" style={{ background: SNZ_BLUE }}>
          Back to Catfish Cull
        </button>
      </div>
    </div>
  )

  if (submitted) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-sm w-full text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <span className="text-green-600 text-2xl">✓</span>
        </div>
        <h1 className="text-2xl font-black text-gray-900 mb-2">You're confirmed!</h1>
        <p className="text-gray-500 text-sm mb-2">
          You're in <strong>{team?.team_name}</strong> for the Rosemergy Catfish Cull 2027.
        </p>
        <p className="text-gray-400 text-sm mb-6">Motuoapa, Lake Taupō · 13 February 2027</p>
        <div className="flex flex-col gap-3">
          <button onClick={() => navigate('/membership')}
            className="w-full py-3 rounded-xl font-black text-white text-sm" style={{ background: SNZ_BLUE }}>
            View My Registrations →
          </button>
          <button onClick={() => navigate('/catfish')}
            className="w-full py-2.5 rounded-xl font-bold text-sm border border-gray-200 text-gray-600 hover:bg-white">
            Back to Catfish Cull
          </button>
        </div>
      </div>
    </div>
  )

  // Not signed in — invite landing
  if (!session) return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-md mx-auto px-4 py-8">
        {team && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 mb-6">
            <p className="font-black text-blue-900 mb-1">You've been entered in the Catfish Cull!</p>
            <p className="text-sm text-blue-800">
              <strong>{d1Member?.name || 'Your teammate'}</strong> has entered you in{' '}
              <strong>{team.team_name}</strong> for the Rosemergy Catfish Cull 2027.
            </p>
            <p className="text-xs text-blue-600 mt-2">
              Your entry fee is already paid. Sign in or create your SNZ account to confirm your details.
            </p>
          </div>
        )}
        <MemberAuthGate message="Sign in to confirm your Catfish Cull entry." />
      </div>
    </div>
  )

  if (alreadyConfirmed) return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-sm mx-auto px-6 py-12 text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <span className="text-green-600 text-2xl">✓</span>
        </div>
        <h1 className="text-2xl font-black text-gray-900 mb-2">Already confirmed!</h1>
        <p className="text-gray-500 text-sm mb-6">
          Your place in <strong>{team.team_name}</strong> for the Catfish Cull 2027 is confirmed.
        </p>
        <button onClick={() => navigate('/membership')}
          className="w-full py-3 rounded-xl font-black text-white text-sm" style={{ background: SNZ_BLUE }}>
          View My Registrations →
        </button>
      </div>
    </div>
  )

  if (!slot) return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="max-w-md mx-auto px-6 py-12 text-center">
        <div className="text-4xl mb-3">🤔</div>
        <h1 className="text-xl font-black text-gray-900 mb-2">This invite isn't for this account</h1>
        <p className="text-gray-500 text-sm mb-6">
          You're signed in as <strong>{session.user.email}</strong>, which doesn't match either teammate on{' '}
          <strong>{team?.team_name}</strong>. Sign in with the address the invite was sent to, or ask{' '}
          {d1Member?.name || 'your teammate'} to update it.
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
      <Header />
      <div className="max-w-lg mx-auto px-4 py-8 space-y-5">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Confirm Your Entry</h1>
          <p className="text-gray-500 text-sm mt-1">Motuoapa, Lake Taupō · 13 February 2027</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
          <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-1">Your Invitation</p>
          <p className="font-black text-gray-900">{team?.team_name}</p>
          <p className="text-sm text-gray-600 mt-0.5">
            Entered by <strong>{d1Member?.name || 'your teammate'}</strong>
          </p>
          <p className="text-xs text-gray-400 mt-1">You are Competitor {slot} on this team.</p>
          <p className="text-xs text-blue-700 mt-2 font-semibold">
            ✓ Your entry fee has already been paid by {d1Member?.name?.split(' ')[0] || 'your teammate'} — nothing to pay here.
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
          <div>
            <h2 className="font-black text-gray-900 text-sm uppercase tracking-widest" style={{ color: SNZ_BLUE }}>Your Details</h2>
            <p className="text-xs text-gray-400 mt-0.5">Required for all competitors.</p>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
            <p className="font-bold text-gray-900 text-sm">{member?.name}</p>
            <p className="text-xs text-gray-500">{session.user.email}</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Phone <span className="text-red-500">*</span></label>
            <input value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="+64 21 xxx xxxx"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
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
            <input type="checkbox" checked={rulesAck} onChange={e => setRulesAck(e.target.checked)}
              className="mt-0.5 w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-bold text-red-900">
              I have read, understood, and agree to the above. <span className="text-red-600">*</span>
            </span>
          </label>
        </div>

        <button onClick={handleConfirm} disabled={submitting}
          className="w-full py-4 rounded-xl font-black text-white text-base disabled:opacity-50"
          style={{ background: SNZ_BLUE }}>
          {submitting ? 'Confirming…' : 'Confirm My Entry →'}
        </button>
        <p className="text-xs text-gray-400 text-center">Motuoapa, Lake Taupō · 13 February 2027</p>
      </div>
    </div>
  )
}
