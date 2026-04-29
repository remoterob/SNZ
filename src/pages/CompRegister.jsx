import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useMemberSession, MemberAuthGate } from '../components/MemberAuthGate'
import { useStripeCheckout } from '../hooks/useStripeCheckout'

const SNZ_BLUE = '#2B6CB0'
const SNZ_LOGO = import.meta.env.VITE_SNZ_LOGO_URL || null

const CATEGORIES = ['Open', 'Mens', 'Womens', 'Mixed', 'Junior']

const emptyMember = {
  name: '', email: '', phone: '', club: '',
  gender: '', dob: '',
  emergency_contact: '', emergency_phone: '',
  fit_to_dive: false
}

function MemberForm({ index, data, onChange, label }) {
  const set = k => v => onChange({ ...data, [k]: v })
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
      <h3 className="font-black text-gray-900 mb-4 text-sm tracking-widest uppercase" style={{ color: SNZ_BLUE }}>{label}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-gray-600 mb-1">Full name <span className="text-red-500">*</span></label>
          <input value={data.name} onChange={e => set('name')(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            placeholder="Full legal name" required />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Email <span className="text-red-500">*</span></label>
          <input type="email" value={data.email} onChange={e => set('email')(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            placeholder="email@example.com" required />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Phone <span className="text-red-500">*</span></label>
          <input value={data.phone} onChange={e => set('phone')(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            placeholder="+64 21 xxx xxxx" required />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Club</label>
          <input value={data.club} onChange={e => set('club')(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            placeholder="Club name" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Gender <span className="text-red-500">*</span></label>
          <select value={data.gender} onChange={e => set('gender')(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" required>
            <option value="">Select…</option>
            <option>Male</option><option>Female</option><option>Non-binary</option><option>Prefer not to say</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Date of birth <span className="text-red-500">*</span></label>
          <input type="date" value={data.dob} onChange={e => set('dob')(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" required />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Emergency contact name <span className="text-red-500">*</span></label>
          <input value={data.emergency_contact} onChange={e => set('emergency_contact')(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            placeholder="Full name" required />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Emergency contact phone <span className="text-red-500">*</span></label>
          <input value={data.emergency_phone} onChange={e => set('emergency_phone')(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            placeholder="+64 21 xxx xxxx" required />
        </div>
        <div className="sm:col-span-2">
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={data.fit_to_dive} onChange={e => set('fit_to_dive')(e.target.checked)}
              className="mt-0.5 w-5 h-5 flex-shrink-0" />
            <span className="text-sm text-gray-700 font-semibold">
              I confirm that I am fit and able to dive safely, have no medical conditions that would prevent safe participation, and take full responsibility for my own safety. <span className="text-red-500">*</span>
            </span>
          </label>
        </div>
      </div>
    </div>
  )
}


function MemberBadge() {
  const { member, session } = useMemberSession()
  const navigate = useNavigate()
  if (!session) return (
    <button onClick={() => navigate('/membership/login')}
      className="flex items-center gap-1.5 text-white/70 hover:text-white text-xs font-semibold transition px-2 py-1 rounded-lg hover:bg-white/10">
      Sign in
    </button>
  )
  return (
    <button onClick={() => navigate('/membership/dashboard')}
      className="flex items-center gap-2 bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
      <div className="w-6 h-6 rounded-full bg-white/30 flex items-center justify-center text-white font-black text-xs flex-shrink-0">
        {member?.name?.[0]?.toUpperCase() || '?'}
      </div>
      <div className="text-left hidden sm:block">
        <div className="text-white font-bold text-xs leading-tight">{member?.name || 'Member'}</div>
        <div className="text-blue-200 text-xs leading-tight">{member?.member_number || 'SNZ Member'}</div>
      </div>
    </button>
  )
}


// ── Merch Selection Component ─────────────────────────────────────────────────
function MerchSection({ comp, merch, setMerch, isMerchLate }) {
  const types = comp.merch_types || []
  const sizes = comp.merch_sizes || []
  const divers = [
    { key: '1', label: 'Diver 1' },
    { key: '2', label: 'Diver 2' },
  ]

  const setDiverMerch = (diverKey, field, value) => {
    setMerch(m => ({
      ...m,
      [diverKey]: { ...(m[diverKey] || {}), [field]: value }
    }))
  }

  const typeLabel = t => t === 'tshirt' ? 'T-Shirt' : 'Jacket'

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5">
      <h3 className="text-sm font-black tracking-widest uppercase mb-1" style={{ color: '#2B6CB0' }}>Merchandise</h3>
      <p className="text-xs text-gray-400 mb-4">Select a garment for each diver — optional.</p>

      {isMerchLate && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-3 mb-4 text-xs text-amber-800">
          <strong>⚠ Merch cutoff has passed.</strong> We will capture your request but cannot guarantee you will receive it. If we order extras we will let you know.
        </div>
      )}

      {divers.map(({ key, label }) => (
        <div key={key} className="mb-5">
          <p className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">{label}</p>

          {/* Garment type */}
          <div className="flex gap-2 flex-wrap mb-3">
            <button type="button"
              onClick={() => setDiverMerch(key, 'type', null)}
              className={`px-3 py-1.5 rounded-lg border-2 text-xs font-bold transition ${!merch[key]?.type ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
              No merch
            </button>
            {types.map(t => (
              <button key={t} type="button"
                onClick={() => setDiverMerch(key, 'type', t)}
                className={`px-3 py-1.5 rounded-lg border-2 text-xs font-bold transition ${merch[key]?.type === t ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                {typeLabel(t)}
              </button>
            ))}
          </div>

          {/* Size — only shown once garment selected */}
          {merch[key]?.type && (
            <div>
              <p className="text-xs text-gray-500 mb-2">Size</p>
              <div className="flex gap-2 flex-wrap">
                {sizes.map(size => (
                  <button key={size} type="button"
                    onClick={() => setDiverMerch(key, 'size', size)}
                    className={`px-3 py-1.5 rounded-lg border-2 text-xs font-bold transition ${merch[key]?.size === size ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                    {size}
                  </button>
                ))}
              </div>
              {!merch[key]?.size && (
                <p className="text-xs text-red-500 mt-1">Please select a size</p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

export default function CompRegister() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [comp, setComp] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [errors, setErrors] = useState([])

  const { session, member, loading: memberLoading } = useMemberSession()
  const { checkout, loading: checkoutLoading, error: checkoutError } = useStripeCheckout()
  const [diver2EmailChecked, setDiver2EmailChecked] = useState(false)
  const [diver2IsExistingMember, setDiver2IsExistingMember] = useState(false)
  const [checkingDiver2, setCheckingDiver2] = useState(false)

  const [teamName, setTeamName] = useState('')
  const [category, setCategory] = useState('Open')
  const [boatName, setBoatName] = useState('')
  const [boatDetails, setBoatDetails] = useState('')
  const [p1, setP1] = useState({ ...emptyMember })
  const [p2, setP2] = useState({ ...emptyMember })
  const [teamId, setTeamId] = useState(null)
  const [teamPhotoUrl, setTeamPhotoUrl] = useState(null)
  const [initialTeamStatus, setInitialTeamStatus] = useState('pending_diver2')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [rulesAccepted, setRulesAccepted] = useState(false)
  const [merch, setMerch] = useState({}) // key: '1'|'2' → { type, size }
  const isMerchLate = comp?.merch_cutoff ? new Date() > new Date(comp.merch_cutoff) : false
  const [waiverAccepted, setWaiverAccepted] = useState(false)
  const [showRules, setShowRules] = useState(false)
  const [pendingPhoto, setPendingPhoto] = useState(null)

  useEffect(() => {
    supabase.from('competitions').select('*').eq('id', id).single()
      .then(({ data }) => { setComp(data); setLoading(false) })
    // Handle return from Stripe
    const params = new URLSearchParams(window.location.search)
    if (params.get('payment') === 'success') {
      setDone(true) // show success screen
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [id])

  // Pre-fill Diver 1 from member profile
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
      // Team name left blank — user must enter their own
    }
  }, [member])

  const checkDiver2Email = async () => {
    if (!p2.email.trim()) return
    setCheckingDiver2(true)
    try {
      const { data } = await supabase.from('members').select('*')
        .eq('email', p2.email.trim().toLowerCase()).maybeSingle()
      // Must be an active paid member
      const isActive = data && data.payment_status === 'paid' && data.membership_status === 'active'
      if (isActive) {
        setDiver2IsExistingMember(true)
        setP2(p => ({
          ...p,
          name: data.name || p.name,
          email: data.email,
          phone: data.phone || p.phone,
          club: data.club || p.club,
          gender: data.gender || p.gender,
          dob: data.dob || p.dob,
          emergency_contact: data.emergency_contact || p.emergency_contact,
          emergency_phone: data.emergency_phone || p.emergency_phone,
          fit_to_dive: data.fit_to_dive || p.fit_to_dive,
        }))
      } else {
        setDiver2IsExistingMember(false)
        setP2(p => ({ ...emptyMember, email: p2.email.trim() }))
      }
      setDiver2EmailChecked(true)
    } catch(err) { console.error(err) }
    finally { setCheckingDiver2(false) }
  }

  const validate = () => {
    const e = []
    // Merch validation — size required if garment selected
    if (merch['1']?.type && !merch['1']?.size) e.push('Please select a size for Diver 1 merchandise')
    if (merch['2']?.type && !merch['2']?.size) e.push('Please select a size for Diver 2 merchandise')
    if (!rulesAccepted) e.push('You must read and accept the SNZ competition rules')
    if (!waiverAccepted) e.push('Both divers must accept the assumption of risk declaration')
    if (!teamName.trim()) e.push('Team name is required')
    if (p2.email.trim() && !diver2IsExistingMember) e.push('Your partner must be an active SNZ member before you can register as a team')
    if (!p1.name.trim()) e.push('Diver 1 name is required')
    if (!p1.email.trim()) e.push('Diver 1 email is required')
    if (!p1.phone.trim()) e.push('Diver 1 phone is required')
    if (!p1.gender) e.push('Diver 1 gender is required')
    if (!p1.dob) e.push('Diver 1 date of birth is required')
    if (!p1.emergency_contact.trim()) e.push('Diver 1 emergency contact is required')
    if (!p1.emergency_phone.trim()) e.push('Diver 1 emergency phone is required')
    if (!p1.fit_to_dive) e.push('Diver 1 must confirm fitness to dive')
    if (!p2.name.trim()) e.push('Diver 2 name is required')
    if (!p2.email.trim()) e.push('Diver 2 email is required')
    if (!p2.phone.trim()) e.push('Diver 2 phone is required')
    if (!p2.gender) e.push('Diver 2 gender is required')
    if (!p2.dob) e.push('Diver 2 date of birth is required')
    if (!p2.emergency_contact.trim()) e.push('Diver 2 emergency contact is required')
    if (!p2.emergency_phone.trim()) e.push('Diver 2 emergency phone is required')
    if (!p2.fit_to_dive) e.push('Diver 2 must confirm fitness to dive')
    setErrors(e)
    return e.length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) { window.scrollTo({ top: 0, behavior: 'smooth' }); return }
    setSubmitting(true)
    try {
      // If entry fee applies, hold as pending_payment until Stripe confirms
      const initialStatus = entryFeeCents > 0 ? 'pending_payment' : 'active'

      // Look up diver2 member id before insert
      let diver2MemberId = null
      if (p2.email?.trim()) {
        const { data: d2 } = await supabase.from('members')
          .select('id').eq('email', p2.email.trim().toLowerCase()).maybeSingle()
        diver2MemberId = d2?.id || null
      }

      const { data: team, error: tErr } = await supabase
        .from('comp_teams').insert({
          competition_id: parseInt(id),
          team_name: teamName.trim(),
          category,
          rules_accepted: true,
          waiver_accepted: true,
          acceptance_at: new Date().toISOString(),
          diver1_member_id: member?.id || null,
          diver2_member_id: diver2MemberId,
          diver2_email: p2.email?.trim().toLowerCase() || null,
          status: initialStatus,
          boat_name: boatName.trim() || null,
          boat_details: boatDetails.trim() || null,
        }).select('id').single()
      if (tErr) throw tErr

      const memberPayload = [
        { ...p1, team_id: team.id, competition_id: parseInt(id),
          merch_type: merch['1']?.type || null, merch_size: merch['1']?.size || null,
          merch_late: !!(merch['1']?.type && isMerchLate) },
        ...(p2.name ? [{ ...p2, team_id: team.id, competition_id: parseInt(id),
          merch_type: merch['2']?.type || null, merch_size: merch['2']?.size || null,
          merch_late: !!(merch['2']?.type && isMerchLate) }] : [])
      ]
      const { error: mErr } = await supabase.from('comp_team_members').insert(memberPayload)
      if (mErr) throw mErr

      // Link member_competitions for Diver 1
      if (member?.id) {
        await supabase.from('member_competitions').upsert({
          member_id: member.id, competition_id: parseInt(id), team_id: team.id, year: 2026
        }, { onConflict: 'member_id,competition_id' })
      }

      // Link Diver 2 member_competitions
      if (diver2MemberId) {
        await supabase.from('member_competitions').upsert({
          member_id: diver2MemberId, competition_id: parseInt(id), team_id: team.id, year: 2026
        }, { onConflict: 'member_id,competition_id' })
      }
      setTeamId(team.id)
      setInitialTeamStatus(initialStatus)
      // Upload pending photo if one was selected before registration
      if (pendingPhoto) {
        const ext = pendingPhoto.name.split('.').pop().toLowerCase().replace('heic','jpg')
        const path = `competitions/${id}/teams/${team.id}.${ext}`
        try {
          await supabase.storage.from('snz-media').remove([path])
          const { error: upErr } = await supabase.storage.from('snz-media').upload(path, pendingPhoto, { contentType: pendingPhoto.type })
          if (!upErr) {
            const { data: { publicUrl } } = supabase.storage.from('snz-media').getPublicUrl(path)
            await supabase.from('comp_teams').update({ team_photo_url: publicUrl }).eq('id', team.id)
            setTeamPhotoUrl(publicUrl)
          }
        } catch(e) { console.warn('Photo upload failed', e) }
        setPendingPhoto(null)
      }
      setDone(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setErrors([err.message])
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Loading…</div>
  if (!comp) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Competition not found.</div>
  if (comp.status !== 'active') return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="text-center">
        <div className="text-4xl mb-3">🔒</div>
        <p className="font-bold text-gray-700">Registration is not open for this competition.</p>
        <button onClick={() => navigate(`/competitions/${id}`)} className="mt-4 text-sm underline" style={{ color: SNZ_BLUE }}>← Back to competition</button>
      </div>
    </div>
  )

  const uploadTeamPhoto = async (file) => {
    if (!teamId) return
    setUploadingPhoto(true)
    try {
      const ext = file.name.split('.').pop().toLowerCase().replace('heic','jpg').replace('heif','jpg')
      const path = `competitions/${id}/teams/${teamId}.${ext}`
      await supabase.storage.from('snz-media').remove([path])
      const { error } = await supabase.storage.from('snz-media').upload(path, file, { contentType: file.type })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('snz-media').getPublicUrl(path)
      await supabase.from('comp_teams').update({ team_photo_url: publicUrl }).eq('id', teamId)
      setTeamPhotoUrl(publicUrl)
    } catch (err) { alert('Photo upload failed: ' + err.message) }
    finally { setUploadingPhoto(false) }
  }

  // Category-specific entry fee
  const entryFeeCents = (() => {
    if (!comp) return 0
    const catFees = comp.category_fees || {}
    if (category && catFees[category] != null) return catFees[category]
    return comp.entry_fee_cents || 0  // fallback to single fee
  })()

  if (done) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white border border-gray-200 rounded-2xl p-8 text-center shadow-sm">
        {entryFeeCents > 0 ? (
          <>
            <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
              <span className="text-amber-600 text-2xl">⏳</span>
            </div>
            <h1 className="text-2xl font-black text-gray-900 mb-2">Almost there!</h1>
            <p className="text-gray-500 text-sm mb-1"><strong>{teamName}</strong> is entered for <strong>{comp.name}</strong>.</p>
            <p className="text-gray-400 text-sm mb-4">Complete payment below to confirm your registration.</p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <span className="text-green-600 text-2xl font-black">✓</span>
            </div>
            <h1 className="text-2xl font-black text-gray-900 mb-2">Team Registered!</h1>
            <p className="text-gray-500 text-sm mb-1"><strong>{teamName}</strong> is confirmed for <strong>{comp.name}</strong>.</p>
            <p className="text-gray-500 text-sm mb-6">Good luck out there!</p>
          </>
        )}

        {teamPhotoUrl && (
          <div className="mb-5">
            <img src={teamPhotoUrl} alt="Team" className="w-24 h-24 object-cover rounded-xl mx-auto border-2 border-green-300" />
            <p className="text-xs text-green-600 font-semibold mt-2">✓ Team photo saved</p>
          </div>
        )}

        {entryFeeCents > 0 && teamId ? (
          // Entry fee required — show payment prompt, no skip
          <div className="w-full">
            <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-5 mb-4 text-left">
              <p className="font-black text-amber-900 mb-1">Payment required to confirm your spot</p>
              <p className="text-sm text-amber-800 mb-4">
                Your registration is <strong>pending</strong> until the entry fee of <strong>${(entryFeeCents / 100).toFixed(2)} NZD</strong> is paid.
              </p>
              {checkoutError && <p className="text-xs text-red-600 mb-2">{checkoutError}</p>}
              <button
                onClick={() => checkout({
                  type: 'competition_entry',
                  teamId,
                  competitionId: id,
                  competitionName: comp.name,
                  amountCents: entryFeeCents,
                  memberEmail: member?.email || p1.email,
                  memberName: member?.name || p1.name,
                })}
                disabled={checkoutLoading}
                className="w-full py-3 rounded-xl font-black text-white text-sm disabled:opacity-50"
                style={{ background: '#d97706' }}>
                {checkoutLoading ? 'Redirecting to payment…' : `Pay $${(entryFeeCents / 100).toFixed(2)} NZD now →`}
              </button>
            </div>
          </div>
        ) : (
          // Free comp — fully confirmed, go to competition
          <button onClick={() => navigate(`/competitions/${id}`)}
            className="w-full py-3 rounded-xl font-bold text-white text-sm"
            style={{ background: SNZ_BLUE }}>View Competition →</button>
        )}
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <div style={{ background: SNZ_BLUE }} className="px-6 py-3 flex items-center justify-between border-b border-blue-700">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(`/competitions/${id}`)} className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">← {comp.name}</button>
          <span className="text-blue-200 text-sm opacity-75">/ Register</span>
        </div>
        <MemberBadge />
      </div>

      <header className="border-b border-gray-200 px-6 py-5 bg-white flex items-center gap-4">
        {SNZ_LOGO && <img src={SNZ_LOGO} alt="SNZ" className="h-10 w-auto object-contain" />}
        <div>
          <h1 className="text-2xl font-black text-gray-900">Team Registration</h1>
          <p className="text-xs text-gray-400">{comp.name}</p>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto p-6 space-y-5">
        {errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-sm font-bold text-red-700 mb-2">Please fix the following:</p>
            <ul className="list-disc list-inside text-sm text-red-600 space-y-1">
              {errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        )}

        {/* Membership auth gate for Diver 1 */}
        {!member && !memberLoading && (
          <MemberAuthGate message="You must be an SNZ member to enter a competition. Sign in or join — a small annual fee applies, takes 2 minutes." />
        )}
        {memberLoading && <div className="text-center py-4 text-gray-400 text-sm">Checking membership…</div>}

        {/* Team details — only show if Diver 1 is authenticated */}
        {member && <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <div className="w-7 h-7 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-black flex-shrink-0">✓</div>
          <div>
            <p className="text-sm font-bold text-green-800">Signed in as {member.name}</p>
            <p className="text-xs text-green-600">SNZ Member · {member.member_number} · Your details have been pre-filled below</p>
          </div>
        </div>}

        {member && <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-black tracking-widest uppercase mb-4 pb-3 border-b border-gray-100" style={{ color: SNZ_BLUE }}>Team Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Team name <span className="text-red-500">*</span></label>
              <input value={teamName} onChange={e => setTeamName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                placeholder="e.g. The Reef Runners" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Category <span className="text-red-500">*</span></label>
              <select value={category} onChange={e => setCategory(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                {(comp.categories?.length > 0 ? comp.categories : CATEGORIES).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Boat name</label>
              <input value={boatName} onChange={e => setBoatName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                placeholder="e.g. Sea Breeze" maxLength={80} />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Boat details</label>
              <input value={boatDetails} onChange={e => setBoatDetails(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                placeholder="e.g. 5m aluminium, reg. NZ1234" maxLength={200} />
            </div>
          </div>
        </div>}

        {member && <MemberForm index={1} label="Diver 1 (You)" data={p1} onChange={setP1} />}
        {member && (
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-black tracking-widest uppercase mb-3" style={{ color: SNZ_BLUE }}>Diver 2 — Partner</h3>
            <p className="text-xs text-gray-400 mb-3">Both divers must be active SNZ members to register as a team.</p>
            <div className="flex gap-2 mb-3 flex-wrap">
              <input type="email"
                value={p2.email} onChange={e => { setP2(p => ({...p, email: e.target.value})); setDiver2EmailChecked(false); setDiver2IsExistingMember(false) }}
                placeholder="Partner's email address"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              <button type="button" onClick={checkDiver2Email} disabled={checkingDiver2 || !p2.email.trim()}
                className="px-4 py-2 rounded-lg text-sm font-bold border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40 transition whitespace-nowrap">
                {checkingDiver2 ? 'Checking…' : 'Look up'}
              </button>
            </div>

            {diver2EmailChecked && diver2IsExistingMember && (
              <div className="mb-3">
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2 mb-3">
                  <span className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white text-xs font-black flex-shrink-0">✓</span>
                  <p className="text-sm font-bold text-green-800">Active SNZ member — details pre-filled, edit if needed</p>
                </div>
                <MemberForm index={2} label="Diver 2" data={p2} onChange={setP2} />
              </div>
            )}

            {diver2EmailChecked && !diver2IsExistingMember && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <p className="font-bold text-red-800 text-sm mb-1">⚠ Not an active SNZ member</p>
                <p className="text-xs text-red-700 mb-3">
                  <strong>{p2.email}</strong> is not registered as an active SNZ member. Both divers must have a current paid membership before a team can be registered.
                </p>
                <p className="text-xs text-red-600">
                  Ask your partner to sign up at <a href="/membership/signup" target="_blank" className="underline font-semibold">spearfishingnz.netlify.app/membership/signup</a> and pay their membership fee, then come back and complete your team registration.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Team photo — shown after first submit if teamId exists, or always as optional pre-submit */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-sm font-black tracking-widest uppercase mb-1 pb-3 border-b border-gray-100" style={{ color: SNZ_BLUE }}>Team Photo <span className="text-gray-400 font-normal normal-case tracking-normal text-xs">(optional)</span></h2>
          <p className="text-xs text-gray-400 mb-4 mt-2">Upload a photo of your team — shown on the leaderboard and social media exports.</p>
          <div className="flex items-center gap-4">
            {teamPhotoUrl
              ? <img src={teamPhotoUrl} alt="Team" className="w-20 h-20 rounded-xl object-cover border-2 border-green-300 flex-shrink-0" />
              : <div className="w-20 h-20 rounded-xl bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center text-3xl flex-shrink-0">👥</div>
            }
            <div>
              <label className={`cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold border-2 border-gray-300 hover:border-blue-400 transition ${uploadingPhoto ? 'opacity-50' : ''}`}>
                {uploadingPhoto ? '⏳ Uploading…' : teamPhotoUrl ? '📷 Replace photo' : '📷 Upload team photo'}
                <input type="file" accept="image/*" className="hidden" disabled={uploadingPhoto || (!teamId && submitting)}
                  onChange={e => e.target.files[0] && (teamId ? uploadTeamPhoto(e.target.files[0]) : setPendingPhoto(e.target.files[0]))} />
              </label>
              {pendingPhoto && !teamId && <p className="text-xs text-amber-600 mt-1.5">✓ Photo selected — will upload when you register</p>}
              {teamPhotoUrl && <p className="text-xs text-green-600 mt-1.5">✓ Photo uploaded</p>}
            </div>
          </div>
        </div>

        {/* Merch selection */}
        {member && comp?.merch_enabled && (comp.merch_types||[]).length > 0 && (
          <MerchSection comp={comp} merch={merch} setMerch={setMerch} isMerchLate={isMerchLate} />
        )}

        {member && <>{/* SNZ Rules acceptance */}
        <div className="bg-white border-2 border-gray-200 rounded-xl overflow-hidden">
          <button type="button" onClick={() => setShowRules(r => !r)}
            className="w-full flex items-center justify-between px-5 py-4 text-left">
            <div>
              <p className="font-black text-gray-900 text-sm">SNZ Competition Rules</p>
              <p className="text-xs text-gray-400 mt-0.5">Spearfishing New Zealand Official Rules &amp; Guidelines (July 2024)</p>
            </div>
            <span className="text-gray-400 text-lg ml-3">{showRules ? '▲' : '▼'}</span>
          </button>
          {showRules && (
            <div className="border-t border-gray-100 px-5 py-4 bg-gray-50 text-xs text-gray-700 leading-relaxed space-y-3 max-h-72 overflow-y-auto">
              <p className="font-bold text-gray-900">Part A: Competitor Eligibility</p>
              <p>1.1 The competition is open to individuals who satisfy the Competition Director as to their ability to compete.</p>
              <p>1.2 Competitors under the age of 16 may compete with the approval of the Competition Director, who will assess the suitability of the team.</p>
              <p>1.3 All competitors are individually and solely responsible to ensure they are medically fit and capable of participating.</p>
              <p>1.4 Every competitor must attend all competition briefings and verify attendance at roll-call or sign-in.</p>

              <p className="font-bold text-gray-900 pt-1">Equipment Requirements</p>
              <p>Each competitor may carry a speargun, pole spear, or Hawaiian sling loaded by muscular force only. Cartridge type, compressed gas guns and power heads are not permitted.</p>
              <p>Each pair must carry: a compliant float (minimum 10 litres, bright colour, fitted with a dive flag of at least 15×20cm, self-righting), a knife, and an Orange Safety Sausage or Smoke Flare.</p>
              <p>Flashers, flasher rigs, and fish attraction devices may not be used.</p>

              <p className="font-bold text-gray-900 pt-1">Competitor Behaviour</p>
              <p>Competitors may not assist or interfere with other teams. Assisted ascents and descents are not permitted. All government, MPI (Fisheries) and Maritime Safety Authority rules and regulations must be observed at all times.</p>
              <p>Behaviour that brings Spearfishing NZ into disrepute may result in penalties determined by the SNZ Executive.</p>

              <p className="font-bold text-gray-900 pt-1">Hypoxic Blackout Protocol</p>
              <p>Any competitor who suffers a shallow water blackout or hypoxic loss of motor control must immediately leave the water, notify the Competition Director and safety boat, and commence a stand-down period. Before returning to competition the competitor must complete a one-week stand-down, obtain a physician's written clearance, and have the Competition Director's approval.</p>

              <p className="font-bold text-gray-900 pt-1">Speargun Safety</p>
              <p>No loaded spearguns are permitted on boats. No spare spearguns may be carried loaded on floats or hanging vertically from floats. Competitors must not point a loaded speargun at another competitor. Tip protectors are recommended when spearguns are not in use.</p>

              <p className="font-bold text-gray-900 pt-1">Disputes</p>
              <p>Any dispute must be submitted in writing to the Competition Director within four hours of the completion of competition on that day, and no later than one hour after results are announced. The Disputes Committee's decision is final. Further appeals may be made to the SNZ Committee.</p>
            </div>
          )}
          <div className="px-5 py-3 border-t border-gray-100">
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={rulesAccepted} onChange={e => setRulesAccepted(e.target.checked)}
                className="mt-0.5 w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-semibold text-gray-700">
                I have read and agree to abide by the Spearfishing New Zealand Competition Rules &amp; Guidelines. <span className="text-red-500">*</span>
              </span>
            </label>
          </div>
        </div>

        {/* Assumption of Risk waiver */}
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-5">
          <h3 className="font-black text-red-800 text-sm mb-3">⚠ Assumption of Risk &amp; Waiver of Liability</h3>
          <div className="text-xs text-red-900 leading-relaxed space-y-2 mb-4">
            <p>Spearfishing is a hazardous breath-hold activity conducted in an open water marine environment. Participation involves inherent risks including but not limited to:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>Shallow water blackout, hypoxia, and drowning</li>
              <li>Injury from spearguns, spear shafts, and sharp fish spines</li>
              <li>Boat strike, marine hazards, and adverse weather or sea conditions</li>
              <li>Injury from marine life including sharks</li>
              <li>Physical exhaustion, dehydration, and medical events</li>
            </ul>
            <p className="pt-1">By registering, each competitor confirms that:</p>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>They are participating voluntarily and accept full personal responsibility for their own safety and wellbeing</li>
              <li>They are aware of the risks and hazards of spearfishing and accept those risks</li>
              <li>They are medically fit and capable of safely participating (rule 1.3)</li>
              <li>They have not suffered a shallow water blackout or hypoxic episode in the preceding four weeks without physician clearance</li>
              <li>They will comply with all safety instructions from the Competition Director and safety personnel</li>
              <li>They will not hold Spearfishing New Zealand Inc, the organising club, or any officials liable for any injury, loss, or damage arising from their participation, to the fullest extent permitted by New Zealand law</li>
            </ul>
            <p className="pt-1 font-semibold">This declaration applies to both registered divers. By ticking the box below both divers are confirming their agreement.</p>
          </div>
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" checked={waiverAccepted} onChange={e => setWaiverAccepted(e.target.checked)}
              className="mt-0.5 w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-bold text-red-900">
              Both {p1.name || 'Diver 1'}{p2.name ? ` and ${p2.name}` : ' and Diver 2'} have read, understood, and accept this assumption of risk and waiver of liability. <span className="text-red-600">*</span>
            </span>
          </label>
        </div>

        <button type="submit" disabled={submitting || !rulesAccepted || !waiverAccepted}
          className="w-full py-4 rounded-xl font-black text-white text-base disabled:opacity-50"
          style={{ background: SNZ_BLUE }}>
          {submitting ? 'Registering…' : 'Register Team'}
        </button></>}
      </form>
    </div>
  )
}
