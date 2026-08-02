import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMemberSession } from '../components/MemberAuthGate'

const SNZ_BLUE = '#2B6CB0'
const SNZ_DARK = '#1e3a5f'
const DRAFT_KEY = 'snz_near_miss_draft'

// ── Option sets — exact values from snz-near-miss-brief.md ──────────────────
const TIME_BAND = [
  { value: 'last_month', label: 'Within the last month' },
  { value: '1_6_months', label: '1–6 months ago' },
  { value: '6_12_months', label: '6–12 months ago' },
  { value: '1_2_years', label: '1–2 years ago' },
  { value: '2_5_years', label: '2–5 years ago' },
  { value: 'over_5_years', label: 'More than 5 years ago' },
]

const REGIONS = [
  'Northland', 'Auckland – Hauraki Gulf', 'Auckland – West Coast', 'Coromandel & Mercury Bay',
  'Bay of Plenty', 'East Cape & Gisborne', "Hawke's Bay", 'Taranaki', 'Whanganui–Manawatū',
  'Wellington & Wairarapa', 'Nelson & Tasman', 'Marlborough Sounds', 'West Coast (South Island)',
  'Canterbury', 'Otago', 'Southland & Fiordland', 'Chatham Islands', 'Other',
]

const DISTANCE_FROM_SHORE = [
  { value: 'under_50m', label: 'Less than 50 m from shore or rocks' },
  { value: '50_200m', label: '50–200 m' },
  { value: '200_500m', label: '200–500 m' },
  { value: 'over_500m', label: 'More than 500 m' },
  { value: 'unsure', label: 'Not sure' },
]

export const OUTCOME = [
  { value: 'close_pass', label: "A vessel passed close at speed — I was not hurt and it didn't come within touching distance" },
  { value: 'evasive_action', label: 'A vessel passed within a few metres at speed — I had to take evasive action' },
  { value: 'gear_contact', label: 'A vessel made contact with my float, float line or gear' },
  { value: 'contact_no_injury', label: 'A vessel made physical contact with me — no injury or minor only' },
  { value: 'injury_treated', label: 'A vessel struck me causing injury requiring medical treatment' },
  { value: 'serious_injury', label: 'A vessel struck me causing serious injury (hospitalisation, surgery, lasting effects)' },
  { value: 'other', label: 'Other' },
]

const CLOSEST_DISTANCE = [
  { value: 'under_2m', label: 'Under 2 m' },
  { value: '2_5m', label: '2–5 m' },
  { value: '5_10m', label: '5–10 m' },
  { value: '10_20m', label: '10–20 m' },
  { value: 'over_20m', label: 'Over 20 m' },
  { value: 'unsure', label: 'Not sure' },
]

const VESSEL_SPEED = [
  { value: 'under_5kt', label: 'At or under 5 knots (walking pace)' },
  { value: 'slow_over_5kt', label: 'Slow but clearly over 5 knots' },
  { value: 'planing', label: 'On the plane / at cruising speed' },
  { value: 'planing_manoeuvring', label: 'At speed and manoeuvring or turning' },
  { value: 'unsure', label: 'Not sure' },
]

const DIVER_POSITION = [
  { value: 'surface_resting', label: 'On the surface, resting or breathing up' },
  { value: 'surface_swimming', label: 'On the surface, swimming or transiting' },
  { value: 'descending_ascending', label: 'Descending or ascending' },
  { value: 'on_bottom', label: 'On the bottom' },
  { value: 'boarding', label: 'Boarding or leaving a vessel' },
  { value: 'other', label: 'Other' },
]

const VISIBILITY_GEAR = [
  { value: 'flag_float', label: 'Dive flag flying (Flag A) on my float' },
  { value: 'flag_vessel', label: 'Dive flag flying on a vessel' },
  { value: 'float_no_flag', label: 'Surface float or buoy, no flag' },
  { value: 'bright_gear', label: 'Brightly coloured float or gear' },
  { value: 'hi_vis', label: 'High-visibility fins, hood, snorkel or wetsuit panels' },
  { value: 'none', label: 'None of the above' },
  { value: 'unsure', label: "Not sure / can't recall" },
]
const VISIBILITY_EXCLUSIVE = ['none', 'unsure']

const VESSEL_SAW_YOU = [
  { value: 'no_reaction', label: 'No — no change in speed or course at all' },
  { value: 'too_late', label: 'It changed course or slowed, but far too late' },
  { value: 'slowed_uncomfortable', label: 'It saw me and slowed appropriately, but I was still uncomfortable' },
  { value: 'responded_properly', label: 'Yes, and it responded properly — including this as a good example' },
  { value: 'unsure', label: 'Not sure' },
]

const VESSEL_TYPE = [
  { value: 'trailer_under_6m', label: 'Trailer boat under 6 m' },
  { value: 'trailer_6_8m', label: 'Trailer boat 6–8 m' },
  { value: 'launch', label: 'Larger launch or motor yacht' },
  { value: 'pwc', label: 'Jet ski or PWC' },
  { value: 'charter_commercial', label: 'Charter or commercial vessel' },
  { value: 'sail_under_power', label: 'Sailing vessel under power' },
  { value: 'paddlecraft', label: 'Paddlecraft (kayak, SUP, etc.)' },
  { value: 'unsure', label: 'Not sure' },
  { value: 'other', label: 'Other' },
]

const REPORTED_TO = [
  { value: 'not_reported', label: "No — I didn't report it to anyone" },
  { value: 'harbourmaster', label: 'Harbourmaster' },
  { value: 'maritime_nz', label: 'Maritime New Zealand' },
  { value: 'police', label: 'Police' },
  { value: 'club', label: 'My club' },
  { value: 'social_media', label: 'Posted about it on social media only' },
  { value: 'friends_family', label: 'Told friends or family only' },
  { value: 'other', label: 'Other' },
]
const REPORTED_TO_EXCLUSIVE = ['not_reported']

export const NOT_REPORTED_REASONS = [
  { value: 'nothing_would_come_of_it', label: "Didn't think anything would come of it" },
  { value: 'didnt_know_who', label: "Didn't know who to report it to" },
  { value: 'no_vessel_details', label: "Didn't have the boat's registration or identifying details" },
  { value: 'not_serious_enough', label: "Didn't think it was serious enough" },
  { value: 'process_hassle', label: "Couldn't be bothered with the process" },
  { value: 'fear_backlash', label: 'Worried about backlash or confrontation' },
  { value: 'assumed_someone_else', label: 'Assumed someone else would report it' },
  { value: 'other', label: 'Other' },
]

const REPORT_OUTCOME = [
  { value: 'nothing', label: "Nothing that I'm aware of" },
  { value: 'contacted_no_action', label: 'I was contacted but nothing further happened' },
  { value: 'investigated_no_action', label: 'An investigation happened but no action was taken' },
  { value: 'warning', label: 'A warning was issued' },
  { value: 'infringement', label: 'An infringement notice / fine was issued' },
  { value: 'court', label: 'It went to court' },
  { value: 'unknown', label: "Don't know" },
]
const FORMAL_REPORT_CHANNELS = ['harbourmaster', 'maritime_nz', 'police']

const INJURY_LEVEL = [
  { value: 'none', label: 'None' },
  { value: 'minor_untreated', label: 'Minor, not treated' },
  { value: 'gp_ae', label: 'Treated by GP or A&E' },
  { value: 'hospital', label: 'Hospital admission' },
  { value: 'lasting', label: 'Lasting or permanent effects' },
  { value: 'prefer_not_say', label: 'Prefer not to say' },
]

const YEARS_EXPERIENCE = [
  { value: 'under_2', label: 'Under 2 years' },
  { value: '2_5', label: '2–5 years' },
  { value: '5_10', label: '5–10 years' },
  { value: '10_20', label: '10–20 years' },
  { value: 'over_20', label: 'Over 20 years' },
]

const DAYS_PER_YEAR = [
  { value: 'under_10', label: 'Under 10 days' },
  { value: '10_25', label: '10–25 days' },
  { value: '25_50', label: '25–50 days' },
  { value: '50_100', label: '50–100 days' },
  { value: 'over_100', label: 'Over 100 days' },
]

const CLUB_MEMBER = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'unsure', label: 'Not sure' },
]

const CONTACT_CONSENT = [
  { value: 'named', label: "Yes — you can contact me, and I'd be willing to be named or speak publicly if it helps" },
  { value: 'confidential', label: 'Yes — you can contact me, but keep my details confidential' },
  { value: 'anonymous', label: 'No — please treat this as anonymous' },
]

const STEP_TITLES = ['When and where', 'What happened', 'Visibility', 'Did anyone find out?', 'About you']

const emptyForm = {
  time_band: '', approx_month_year: '', region: '', location_name: '', distance_from_shore: '',
  latitude: null, longitude: null,
  outcome: '', closest_distance: '', vessel_speed: '', diver_position: '',
  visibility_gear: [], vessel_saw_you: '', vessel_type: '',
  reported_to: [], not_reported_reasons: [], report_outcome: '', injury_level: '',
  years_experience: '', days_per_year: '', club_member: '', free_text: '',
  contact_consent: '', contact_email: '', data_use_consent: false,
}

// ── Shared field UI, matching the pill-button idiom from CompRegister.jsx's MerchSection ──
function PillGroup({ name, options, value, onChange, multi, exclusive }) {
  const selected = multi ? (value || []) : value
  const isSelected = (v) => multi ? selected.includes(v) : selected === v

  const toggle = (v) => {
    if (!multi) { onChange(v); return }
    const cur = value || []
    if (exclusive?.includes(v)) {
      // Selecting an exclusive option (e.g. "none"/"not_reported") clears everything else.
      onChange(cur.includes(v) ? [] : [v])
      return
    }
    // Selecting a non-exclusive option clears any exclusive selection.
    const withoutExclusive = cur.filter(c => !exclusive?.includes(c))
    onChange(withoutExclusive.includes(v) ? withoutExclusive.filter(c => c !== v) : [...withoutExclusive, v])
  }

  return (
    <div className="flex flex-col gap-2">
      {options.map(opt => (
        <button key={opt.value} type="button" onClick={() => toggle(opt.value)}
          data-testid={`opt-${name}-${opt.value}`}
          className={`text-left px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition ${
            isSelected(opt.value) ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
          }`}>
          {opt.label}
        </button>
      ))}
    </div>
  )
}

function FieldLabel({ children, required }) {
  return (
    <label className="block text-sm font-bold text-gray-800 mb-2">
      {children} {required && <span className="text-red-500">*</span>}
    </label>
  )
}

function FieldError({ error }) {
  if (!error) return null
  return <p className="text-xs text-red-600 mt-1.5" role="alert">{error}</p>
}

export default function NearMissReport() {
  const navigate = useNavigate()
  const { session, member } = useMemberSession()

  const [step, setStep] = useState(1)
  const [form, setForm] = useState(emptyForm)
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [geoStatus, setGeoStatus] = useState('idle') // idle | locating | done | error
  const honeypotRef = useRef(null)
  const formStartedAt = useRef(Date.now())
  const restoredRef = useRef(false)
  const prefilledRef = useRef(false)

  // Restore an in-progress draft on mount (survives accidental reload/back-nav).
  useEffect(() => {
    if (restoredRef.current) return
    restoredRef.current = true
    try {
      const saved = sessionStorage.getItem(DRAFT_KEY)
      if (saved) {
        const { form: savedForm, step: savedStep } = JSON.parse(saved)
        if (savedForm) setForm(f => ({ ...f, ...savedForm }))
        if (savedStep) setStep(savedStep)
      }
    } catch {}
  }, [])

  // Persist the draft on every change.
  useEffect(() => {
    if (!restoredRef.current) return
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ form, step }))
  }, [form, step])

  // Optional prefill for signed-in members — only fields with a genuine,
  // reliable value crosswalk. member.region/experience use different
  // option sets than this survey's region/years_experience fields (finer
  // regional split, skill-level vs. years-of-experience), so those are
  // deliberately left for the user to fill in rather than silently mapped
  // to a value that might not actually match.
  useEffect(() => {
    if (prefilledRef.current || !member) return
    prefilledRef.current = true
    setForm(f => ({
      ...f,
      contact_email: f.contact_email || member.email || '',
      club_member: f.club_member || 'yes',
    }))
  }, [member])

  const set = (key) => (value) => setForm(f => ({ ...f, [key]: value }))

  const useMyLocation = () => {
    if (!navigator.geolocation) { setGeoStatus('error'); return }
    setGeoStatus('locating')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm(f => ({ ...f, latitude: +pos.coords.latitude.toFixed(6), longitude: +pos.coords.longitude.toFixed(6) }))
        setGeoStatus('done')
      },
      () => setGeoStatus('error'),
      { timeout: 10000 }
    )
  }

  const validateStep = (n) => {
    const e = {}
    if (n === 1) {
      if (!form.time_band) e.time_band = 'Required'
      if (!form.region) e.region = 'Required'
      if (!form.location_name.trim()) e.location_name = 'Required'
      if (!form.distance_from_shore) e.distance_from_shore = 'Required'
    }
    if (n === 2) {
      if (!form.outcome) e.outcome = 'Required'
      if (!form.closest_distance) e.closest_distance = 'Required'
      if (!form.vessel_speed) e.vessel_speed = 'Required'
      if (!form.diver_position) e.diver_position = 'Required'
    }
    if (n === 3) {
      if (form.visibility_gear.length === 0) e.visibility_gear = 'Select at least one option'
      if (!form.vessel_saw_you) e.vessel_saw_you = 'Required'
      if (!form.vessel_type) e.vessel_type = 'Required'
    }
    if (n === 4) {
      if (form.reported_to.length === 0) e.reported_to = 'Select at least one option'
      if (form.reported_to.includes('not_reported') && form.not_reported_reasons.length === 0) {
        e.not_reported_reasons = 'Select at least one reason'
      }
      const formalReport = form.reported_to.some(r => FORMAL_REPORT_CHANNELS.includes(r))
      if (formalReport && !form.report_outcome) e.report_outcome = 'Required'
      if (!form.injury_level) e.injury_level = 'Required'
    }
    if (n === 5) {
      if (!form.contact_consent) e.contact_consent = 'Required'
      if ((form.contact_consent === 'named' || form.contact_consent === 'confidential') && !form.contact_email.trim()) {
        e.contact_email = 'Required for this consent choice'
      }
      if (!form.data_use_consent) e.data_use_consent = 'Required to submit'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const next = () => { if (validateStep(step)) { setStep(s => Math.min(5, s + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }) } }
  const back = () => { setStep(s => Math.max(1, s - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  const handleSubmit = async () => {
    if (!validateStep(5)) return
    setSubmitting(true)
    setSubmitError('')
    try {
      const res = await fetch('/.netlify/functions/near-miss-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          user_id: session?.user?.id || null,
          submitted_as_member: !!session,
          honeypot: honeypotRef.current?.value || '',
          form_started_at: formStartedAt.current,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Submission failed')
      sessionStorage.removeItem(DRAFT_KEY)
      navigate('/near-miss/thanks')
    } catch (err) {
      setSubmitError(err.message)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setSubmitting(false)
    }
  }

  const showNotReportedReasons = form.reported_to.includes('not_reported')
  const showReportOutcome = form.reported_to.some(r => FORMAL_REPORT_CHANNELS.includes(r))
  const showContactEmail = form.contact_consent === 'named' || form.contact_consent === 'confidential'

  return (
    <div className="min-h-screen bg-gray-50">
      <div style={{ background: SNZ_DARK }} className="px-6 py-3 flex items-center justify-between border-b border-blue-900">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
            ← SNZ Hub
          </button>
          <span className="text-white/50 mx-2">/</span>
          <span className="text-white font-bold text-sm">Vessel Near-Miss Survey</span>
        </div>
        <button onClick={() => navigate('/admin/near-miss')}
          className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
          ⚙ Admin
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-black text-gray-900">SNZ Vessel Near-Miss Survey</h1>
        <p className="text-gray-500 text-sm mt-1 mb-1">
          Most near-misses are never reported to anyone — that means the official record badly
          understates the risk. You don't need to be an SNZ member. About 3 minutes, mostly tick-boxes.
        </p>
        {member && (
          <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mt-3">
            Signed in as {member.name} — we've prefilled what we can. You can still submit this anonymously.
          </p>
        )}

        {/* Progress */}
        <div className="flex gap-2 my-6">
          {[1, 2, 3, 4, 5].map(s => (
            <div key={s} className={`h-1.5 flex-1 rounded-full transition ${s <= step ? 'bg-blue-500' : 'bg-gray-200'}`} />
          ))}
        </div>
        <p className="text-xs text-gray-400 mb-4">Step {step} of 5 — {STEP_TITLES[step - 1]}</p>

        {submitError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-sm text-red-700">{submitError}</div>
        )}

        <form onSubmit={e => { e.preventDefault(); step === 5 ? handleSubmit() : next() }}
          className="bg-white border border-gray-200 rounded-2xl p-6 space-y-5">

          {/* Honeypot — visually hidden, excluded from tab order, never filled by a real user */}
          <input ref={honeypotRef} type="text" name="website" tabIndex={-1} autoComplete="off"
            className="absolute -left-[9999px] w-px h-px overflow-hidden" aria-hidden="true" />

          {step === 1 && (
            <fieldset className="space-y-5">
              <legend className="sr-only">When and where</legend>
              <div>
                <FieldLabel required>When did this happen?</FieldLabel>
                <PillGroup name="time_band" options={TIME_BAND} value={form.time_band} onChange={set('time_band')} />
                <FieldError error={errors.time_band} />
              </div>
              <div>
                <FieldLabel>Approximate month/year (optional)</FieldLabel>
                <input value={form.approx_month_year} onChange={e => set('approx_month_year')(e.target.value)}
                  placeholder="e.g. March 2026"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <div>
                <FieldLabel required>Region</FieldLabel>
                <select value={form.region} onChange={e => set('region')(e.target.value)}
                  onBlur={() => validateStep(1)} data-testid="field-region"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                  <option value="">Select…</option>
                  {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <FieldError error={errors.region} />
              </div>
              <div>
                <FieldLabel required>Location</FieldLabel>
                <p className="text-xs text-gray-400 mb-1.5">
                  Be as specific as you can — a point, bay, island or reef name. This is the most useful single thing you can give us.
                </p>
                <input value={form.location_name} onChange={e => set('location_name')(e.target.value)}
                  onBlur={() => validateStep(1)} data-testid="field-location-name"
                  placeholder="e.g. Leigh, Goat Island"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                <FieldError error={errors.location_name} />
                <button type="button" onClick={useMyLocation} disabled={geoStatus === 'locating'}
                  className="mt-2 text-xs font-bold text-blue-700 hover:underline disabled:opacity-50">
                  {geoStatus === 'locating' ? 'Locating…' : geoStatus === 'done' ? '✓ Location added' : '📍 Use my current location (optional)'}
                </button>
                {geoStatus === 'error' && <p className="text-xs text-gray-400 mt-1">Couldn't get your location — no problem, the location name above is what matters most.</p>}
              </div>
              <div>
                <FieldLabel required>Distance from shore</FieldLabel>
                <PillGroup name="distance_from_shore" options={DISTANCE_FROM_SHORE} value={form.distance_from_shore} onChange={set('distance_from_shore')} />
                <FieldError error={errors.distance_from_shore} />
              </div>
            </fieldset>
          )}

          {step === 2 && (
            <fieldset className="space-y-5">
              <legend className="sr-only">What happened</legend>
              <div>
                <FieldLabel required>What happened?</FieldLabel>
                <PillGroup name="outcome" options={OUTCOME} value={form.outcome} onChange={set('outcome')} />
                <FieldError error={errors.outcome} />
              </div>
              <div>
                <FieldLabel required>Closest distance the vessel came to you</FieldLabel>
                <PillGroup name="closest_distance" options={CLOSEST_DISTANCE} value={form.closest_distance} onChange={set('closest_distance')} />
                <FieldError error={errors.closest_distance} />
              </div>
              <div>
                <FieldLabel required>Vessel speed</FieldLabel>
                <PillGroup name="vessel_speed" options={VESSEL_SPEED} value={form.vessel_speed} onChange={set('vessel_speed')} />
                <FieldError error={errors.vessel_speed} />
              </div>
              <div>
                <FieldLabel required>Where were you at the time?</FieldLabel>
                <PillGroup name="diver_position" options={DIVER_POSITION} value={form.diver_position} onChange={set('diver_position')} />
                <FieldError error={errors.diver_position} />
              </div>
            </fieldset>
          )}

          {step === 3 && (
            <fieldset className="space-y-5">
              <legend className="sr-only">Visibility</legend>
              <div>
                <FieldLabel required>What visibility gear did you have? (select all that apply)</FieldLabel>
                <PillGroup name="visibility_gear" options={VISIBILITY_GEAR} value={form.visibility_gear} onChange={set('visibility_gear')} multi exclusive={VISIBILITY_EXCLUSIVE} />
                <FieldError error={errors.visibility_gear} />
              </div>
              <div>
                <FieldLabel required>Did the vessel appear to see you?</FieldLabel>
                <PillGroup name="vessel_saw_you" options={VESSEL_SAW_YOU} value={form.vessel_saw_you} onChange={set('vessel_saw_you')} />
                <FieldError error={errors.vessel_saw_you} />
              </div>
              <div>
                <FieldLabel required>Type of vessel</FieldLabel>
                <PillGroup name="vessel_type" options={VESSEL_TYPE} value={form.vessel_type} onChange={set('vessel_type')} />
                <FieldError error={errors.vessel_type} />
              </div>
            </fieldset>
          )}

          {step === 4 && (
            <fieldset className="space-y-5">
              <legend className="sr-only">Did anyone find out?</legend>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
                This section matters more than any other. The official record only contains incidents
                someone reported. We need to know how much is missing from it.
              </div>
              <div>
                <FieldLabel required>Did you report this to anyone? (select all that apply)</FieldLabel>
                <PillGroup name="reported_to" options={REPORTED_TO} value={form.reported_to} onChange={set('reported_to')} multi exclusive={REPORTED_TO_EXCLUSIVE} />
                <FieldError error={errors.reported_to} />
              </div>
              {showNotReportedReasons && (
                <div data-testid="block-not-reported-reasons">
                  <FieldLabel required>Why didn't you report it? (select all that apply)</FieldLabel>
                  <PillGroup name="not_reported_reasons" options={NOT_REPORTED_REASONS} value={form.not_reported_reasons} onChange={set('not_reported_reasons')} multi />
                  <FieldError error={errors.not_reported_reasons} />
                </div>
              )}
              {showReportOutcome && (
                <div data-testid="block-report-outcome">
                  <FieldLabel required>What happened after you reported it?</FieldLabel>
                  <PillGroup name="report_outcome" options={REPORT_OUTCOME} value={form.report_outcome} onChange={set('report_outcome')} />
                  <FieldError error={errors.report_outcome} />
                </div>
              )}
              <div>
                <FieldLabel required>Injury level</FieldLabel>
                <PillGroup name="injury_level" options={INJURY_LEVEL} value={form.injury_level} onChange={set('injury_level')} />
                <FieldError error={errors.injury_level} />
              </div>
            </fieldset>
          )}

          {step === 5 && (
            <fieldset className="space-y-5">
              <legend className="sr-only">About you</legend>
              <div>
                <FieldLabel>Years of experience</FieldLabel>
                <PillGroup name="years_experience" options={YEARS_EXPERIENCE} value={form.years_experience} onChange={set('years_experience')} />
              </div>
              <div>
                <FieldLabel>Days in the water per year</FieldLabel>
                <PillGroup name="days_per_year" options={DAYS_PER_YEAR} value={form.days_per_year} onChange={set('days_per_year')} />
              </div>
              <div>
                <FieldLabel>SNZ club member?</FieldLabel>
                <PillGroup name="club_member" options={CLUB_MEMBER} value={form.club_member} onChange={set('club_member')} />
              </div>
              <div>
                <FieldLabel>Anything else you'd like to add? (optional)</FieldLabel>
                <textarea value={form.free_text} onChange={e => set('free_text')(e.target.value)} rows={4}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                <p className="text-xs text-gray-400 mt-1.5">
                  Please don't name individuals or vessel owners. We're building a picture of a pattern, not a case against any person.
                </p>
              </div>
              <div>
                <FieldLabel required>Can we contact you about this report?</FieldLabel>
                <PillGroup name="contact_consent" options={CONTACT_CONSENT} value={form.contact_consent} onChange={set('contact_consent')} />
                <FieldError error={errors.contact_consent} />
              </div>
              {showContactEmail && (
                <div data-testid="block-contact-email">
                  <FieldLabel required>Contact email</FieldLabel>
                  <input type="email" value={form.contact_email} onChange={e => set('contact_email')(e.target.value)}
                    onBlur={() => validateStep(5)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  <FieldError error={errors.contact_email} />
                </div>
              )}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" checked={form.data_use_consent} onChange={e => set('data_use_consent')(e.target.checked)}
                    className="mt-0.5 w-5 h-5 flex-shrink-0" />
                  <span className="text-sm text-gray-700 font-semibold">
                    I confirm this account is accurate to the best of my recollection, and I understand SNZ may
                    use anonymised, aggregated data from this survey in submissions to harbourmasters, Maritime
                    New Zealand, local government and the media. <span className="text-red-500">*</span>
                  </span>
                </label>
                <FieldError error={errors.data_use_consent} />
              </div>
            </fieldset>
          )}

          <div className="flex gap-3 pt-2">
            {step > 1 && (
              <button type="button" onClick={back}
                className="flex-1 py-3 rounded-xl border border-gray-300 font-bold text-gray-600 text-sm">← Back</button>
            )}
            <button type="submit" disabled={submitting} data-testid="step-continue"
              className="flex-1 py-3 rounded-xl font-black text-white text-sm disabled:opacity-50"
              style={{ background: SNZ_BLUE }}>
              {step < 5 ? 'Continue →' : submitting ? 'Submitting…' : 'Submit Report'}
            </button>
          </div>
        </form>

        <p className="text-xs text-gray-400 text-center mt-4">
          One entry per incident — if you've had more than one, please come back and submit again.
        </p>
      </div>
    </div>
  )
}
