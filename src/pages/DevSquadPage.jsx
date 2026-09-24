import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useMemberSession } from '../components/MemberAuthGate'
import { notify } from '../utils/toasts'

const SNZ_BLUE = '#2B6CB0'
const SNZ_DARK = '#1e3a5f'

// Fish Bingo's species board doubles as the species checklist. Two kinds of
// row there aren't species and must not appear: the community challenges, and
// the weight-graded variants (a diver who has shot a Kingfish ticks Kingfish,
// regardless of size).
const NON_SPECIES_SLUGS = ['Beginner', 'rescue', 'Dishes', 'kingfish-over-30kg', 'snapper-over-10kg']

const MAX_COMPETITIONS = 8

const COMMITMENT_OPTIONS = [
  { value: 'yes',     label: 'Yes — I can meet all of the commitments above' },
  { value: 'partial', label: 'Partially — I can meet some but not all' },
  { value: 'no',      label: 'Not right now — but I\'d like to be considered in future' },
]

const blankComp = () => ({ name: '', year: '', placing: '', partner: '' })
const blankTrip = () => ({ location: '', when: '', duration: '' })

// ── Small presentational helpers ──────────────────────────────────────────────

function Section({ title, hint, children }) {
  return (
    <section className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6">
      <h2 className="font-black text-gray-900 text-lg">{title}</h2>
      {hint && <p className="text-sm text-gray-500 mt-1 mb-4 leading-relaxed">{hint}</p>}
      <div className={hint ? '' : 'mt-4'}>{children}</div>
    </section>
  )
}

function Field({ label, required, hint, children }) {
  return (
    <div>
      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

const inputCls =
  'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300'

// ── Info content ──────────────────────────────────────────────────────────────

function Intro({ onApply }) {
  return (
    <>
      <div style={{ background: `linear-gradient(135deg, ${SNZ_DARK} 0%, ${SNZ_BLUE} 100%)` }}
        className="rounded-2xl px-6 py-10 sm:py-12 text-center">
        <p className="text-blue-200 text-xs font-bold tracking-widest uppercase mb-3">Spearfishing New Zealand</p>
        <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-4">
          NZ Diver Development Squad
        </h1>
        <p className="text-blue-100 text-base leading-relaxed max-w-xl mx-auto">
          Identifying and developing the divers who will represent New Zealand on the world stage.
          Applications are open now.
        </p>
        <button onClick={onApply}
          className="mt-7 px-6 py-3 rounded-xl font-black text-sm bg-white hover:opacity-90 transition"
          style={{ color: SNZ_DARK }}>
          Apply for the Squad →
        </button>
      </div>

      <Section title="Why we're doing this">
        <div className="text-sm text-gray-600 leading-relaxed space-y-3">
          <p>
            New Zealand has a long history of punching above its weight in spearfishing on the world
            stage. While we may be a small country, the calibre of our divers has consistently seen
            us competing alongside the best in the world.
          </p>
          <p>
            Most recently, at the 2025 World Champs, <strong className="text-gray-900">Dwane Herbert placed 3rd</strong>,
            following <strong className="text-gray-900">Alex Edwards' 2nd place</strong> finish in 2023. This is a
            tradition Spearfishing New Zealand is passionate about continuing and supporting.
          </p>
          <p>
            The NZ Diver Development Squad exists to identify the best up-and-coming divers from
            across New Zealand, and to develop and support those already performing at the highest
            level. Over the next six months the squad will undertake focused training and development
            to help each diver reach their full potential.
          </p>
        </div>
      </Section>

      <Section title="Squad training & development"
        hint="Specialised theory and practical sessions focused on spearfishing and competition diving.">
        <ul className="grid sm:grid-cols-2 gap-2.5">
          {[
            'Competition diving strategy',
            'Advanced spearfishing techniques',
            'Detailed fish species & hunting knowledge',
            'Researching and diving new countries and locations',
          ].map(t => (
            <li key={t} className="flex items-start gap-2.5 bg-gray-50 border border-gray-100 rounded-lg px-3.5 py-2.5">
              <span className="font-black mt-0.5" style={{ color: SNZ_BLUE }}>✓</span>
              <span className="text-sm text-gray-700">{t}</span>
            </li>
          ))}
        </ul>
        <div className="mt-3 rounded-lg px-4 py-3 border" style={{ background: '#eff6ff', borderColor: '#bfdbfe' }}>
          <p className="text-sm font-bold" style={{ color: SNZ_DARK }}>
            Plus a 4-day intensive training boot camp leading into the 2027 Nationals in Tairua, Coromandel.
          </p>
        </div>
      </Section>

      <Section title="What we need from squad members"
        hint="To get the most out of the programme, squad members will need to commit to:">
        <ul className="space-y-2.5">
          {[
            'Online evening training sessions every 2–3 weeks between November and February.',
            'Attending the 4-day training boot camp, followed by the 2027 Nationals in Tairua, Coromandel — 16–25 January 2027.',
            'Self-funding any travel and accommodation associated with squad events and competitions.',
            'Attending at least one additional competition from: North Island Champs, Far North Champs, or South Island Champs.',
          ].map(t => (
            <li key={t} className="flex items-start gap-2.5">
              <span className="text-gray-300 font-black mt-0.5">•</span>
              <span className="text-sm text-gray-600 leading-relaxed">{t}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Who we're looking for">
        <div className="text-sm text-gray-600 leading-relaxed space-y-3">
          <p>
            This squad is <strong className="text-gray-900">not simply about selecting the current best divers</strong> in
            New Zealand. We're looking to identify divers who show the greatest potential to develop
            into future top-level competitors.
          </p>
          <p>We're particularly interested in divers who demonstrate some or all of the following:</p>
        </div>
        <ul className="grid sm:grid-cols-2 gap-2.5 mt-3">
          {[
            'Strong competition results, including regular top-5 finishes',
            'A high level of diving ability, including depth and bottom times',
            'Spearfishing ability and hunting skills',
            'A demonstrated ability to learn, improve and adapt',
            'The commitment and drive to develop their skills',
            'A medium to long term commitment to competitive spearfishing',
          ].map(t => (
            <li key={t} className="flex items-start gap-2.5 bg-gray-50 border border-gray-100 rounded-lg px-3.5 py-2.5">
              <span className="font-black mt-0.5" style={{ color: SNZ_BLUE }}>✓</span>
              <span className="text-sm text-gray-700">{t}</span>
            </li>
          ))}
        </ul>
        <div className="mt-4 text-sm text-gray-600 leading-relaxed space-y-3">
          <p>
            The squad is open to both <strong className="text-gray-900">male and female divers aged 16 and over</strong>.
            You do not need to be one of the current top divers in New Zealand to apply — we want to
            see what potential you have.
          </p>
          <p>
            As this is the first year, we're running a more simplified selection process so we can
            establish and develop the programme. If it proves successful we'll look to run Women's
            and Junior Development Squads in parallel alongside the main squad.
          </p>
        </div>
      </Section>

      <Section title="Selection process">
        <ol className="space-y-3">
          {[
            'Complete the application form, providing as much relevant sporting and diving information as possible.',
            'Suitable applicants will be invited to a video call interview with the selection panel.',
            'Shortlisted applicants will be invited to the Invitational Trials, held in Coromandel in late November 2026.',
            'Following the trials, the final squad will be selected by the selection panel.',
          ].map((t, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 rounded-full text-white text-xs font-black flex items-center justify-center mt-0.5"
                style={{ background: SNZ_BLUE }}>{i + 1}</span>
              <span className="text-sm text-gray-600 leading-relaxed">{t}</span>
            </li>
          ))}
        </ol>
        <p className="text-sm text-gray-500 leading-relaxed mt-4">
          All stages are assessed by the selection panel, which includes representatives from the
          Spearfishing New Zealand Committee. The panel will consider competition results, diving
          ability, experience, potential and performance throughout the process.
        </p>
      </Section>
    </>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DevSquadPage() {
  const navigate = useNavigate()
  const { session, member } = useMemberSession()

  const [species, setSpecies] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const [f, setF] = useState({
    full_name: '', dob: '', email: '', phone: '', suburb_city: '',
    max_depth_m: '', comfortable_depth_m: '',
    max_breath_hold_sec: '', comfortable_breath_hold_sec: '',
    has_commercial_experience: false, commercial_details: '',
    nz_locations: '',
    commitment_level: '', commitment_notes: '',
    medically_fit: false, health_disclosure: '',
  })
  const [comps, setComps] = useState([blankComp()])
  const [trips, setTrips] = useState([blankTrip()])
  const [picked, setPicked] = useState(() => new Set())

  const set = (k, v) => setF(prev => ({ ...prev, [k]: v }))

  useEffect(() => {
    supabase.from('bingo_species').select('name, slug, display_order')
      .eq('is_active', true).order('display_order')
      .then(({ data }) => setSpecies((data || []).filter(s => !NON_SPECIES_SLUGS.includes(s.slug))))
  }, [])

  // Sign-in is optional — when we do have a member, save them retyping what
  // we already hold.
  useEffect(() => {
    if (!member && !session) return
    setF(prev => ({
      ...prev,
      full_name: prev.full_name || member?.name || '',
      email: prev.email || member?.email || session?.user?.email || '',
      phone: prev.phone || member?.phone || '',
      dob: prev.dob || member?.dob || '',
    }))
  }, [member, session])

  const toggleSpecies = (name) => setPicked(s => {
    const n = new Set(s)
    n.has(name) ? n.delete(name) : n.add(name)
    return n
  })

  const setComp = (i, k, v) => setComps(c => c.map((row, idx) => idx === i ? { ...row, [k]: v } : row))
  const setTrip = (i, k, v) => setTrips(t => t.map((row, idx) => idx === i ? { ...row, [k]: v } : row))

  const age = useMemo(() => {
    if (!f.dob) return null
    const d = new Date(f.dob)
    if (isNaN(d)) return null
    const now = new Date()
    let a = now.getFullYear() - d.getFullYear()
    const before = now.getMonth() < d.getMonth() ||
      (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())
    if (before) a--
    return a
  }, [f.dob])

  const missing = []
  if (!f.full_name.trim()) missing.push('Name')
  if (!f.dob) missing.push('Date of birth')
  if (!f.email.trim()) missing.push('Email')
  if (!f.phone.trim()) missing.push('Contact number')
  if (!f.suburb_city.trim()) missing.push('Suburb & city')
  if (!f.commitment_level) missing.push('Commitment to the squad')
  if (!f.medically_fit) missing.push('Medical fitness declaration')
  const tooYoung = age != null && age < 16
  const canSubmit = missing.length === 0 && !tooYoung && !submitting

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (!canSubmit) {
      setError(tooYoung
        ? 'The squad is open to divers aged 16 and over.'
        : `Please complete: ${missing.join(', ')}.`)
      return
    }
    setSubmitting(true)
    try {
      const num = v => (v === '' || v == null ? null : Number(v))
      const { error: insErr } = await supabase.from('dev_squad_applications').insert({
        user_id: session?.user?.id || null,
        submitted_as_member: !!session,
        full_name: f.full_name.trim(),
        dob: f.dob,
        email: f.email.trim(),
        phone: f.phone.trim(),
        suburb_city: f.suburb_city.trim(),
        max_depth_m: num(f.max_depth_m),
        comfortable_depth_m: num(f.comfortable_depth_m),
        max_breath_hold_sec: num(f.max_breath_hold_sec),
        comfortable_breath_hold_sec: num(f.comfortable_breath_hold_sec),
        competitions: comps.filter(c => c.name.trim() || c.year || c.placing.trim()),
        has_commercial_experience: f.has_commercial_experience,
        commercial_details: f.has_commercial_experience ? (f.commercial_details.trim() || null) : null,
        nz_locations: f.nz_locations.trim() || null,
        overseas_experience: trips.filter(t => t.location.trim() || t.when.trim() || t.duration.trim()),
        species_shot: [...picked],
        commitment_level: f.commitment_level,
        commitment_notes: f.commitment_notes.trim() || null,
        medically_fit: f.medically_fit,
        health_disclosure: f.health_disclosure.trim() || null,
      })
      if (insErr) throw insErr
      setDone(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setError(err.message || String(err))
      notify('Could not submit your application.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div style={{ background: SNZ_DARK }} className="px-4 sm:px-6 py-3 flex items-center justify-between gap-2">
        <button onClick={() => navigate('/')}
          className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
          ← SNZ Hub
        </button>
        <span className="text-white/70 text-xs font-semibold hidden sm:block">🤿 Diver Development Squad</span>
        <button onClick={() => navigate('/admin/dev-squad')}
          className="text-xs font-bold text-white bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
          ⚙ Admin
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {done ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-8 sm:p-10 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
              <span className="text-green-600 text-3xl">✓</span>
            </div>
            <h1 className="text-2xl font-black text-gray-900 mb-2">Application received</h1>
            <p className="text-gray-500 text-sm leading-relaxed max-w-md mx-auto mb-6">
              Thanks {f.full_name.split(' ')[0] || 'for applying'} — your application for the NZ Diver
              Development Squad is in. The selection panel reviews every application, and suitable
              applicants will be invited to a video call interview.
            </p>
            <button onClick={() => navigate('/')}
              className="px-5 py-2.5 rounded-xl font-bold text-sm text-white"
              style={{ background: SNZ_BLUE }}>
              Back to SNZ Hub
            </button>
          </div>
        ) : (
          <>
            {!showForm && <Intro onApply={() => setShowForm(true)} />}

            {showForm && (
              <form onSubmit={submit} className="space-y-4">
                <div style={{ background: `linear-gradient(135deg, ${SNZ_DARK} 0%, ${SNZ_BLUE} 100%)` }}
                  className="rounded-2xl px-6 py-7">
                  <h1 className="text-2xl font-black text-white">Squad Application</h1>
                  <p className="text-blue-100 text-sm mt-1">
                    Give us as much relevant sporting and diving information as you can.
                  </p>
                  {!session && (
                    <p className="text-blue-200 text-xs mt-3">
                      You don't need an account to apply.{' '}
                      <button type="button" onClick={() => navigate('/membership/login?redirect=/dev-squad')}
                        className="underline font-semibold text-white">Sign in</button>{' '}
                      if you're an SNZ member and we'll fill in what we already know.
                    </p>
                  )}
                </div>

                <Section title="Personal details">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Full name" required>
                      <input className={inputCls} value={f.full_name}
                        onChange={e => set('full_name', e.target.value)} />
                    </Field>
                    <Field label="Date of birth" required
                      hint={tooYoung ? undefined : age != null ? `Age ${age}` : 'Open to divers aged 16 and over'}>
                      <input type="date" className={inputCls} value={f.dob}
                        onChange={e => set('dob', e.target.value)} />
                      {tooYoung && (
                        <p className="text-xs text-red-500 mt-1 font-semibold">
                          The squad is open to divers aged 16 and over.
                        </p>
                      )}
                    </Field>
                    <Field label="Email address" required>
                      <input type="email" className={inputCls} value={f.email}
                        onChange={e => set('email', e.target.value)} />
                    </Field>
                    <Field label="Contact number" required>
                      <input type="tel" className={inputCls} value={f.phone}
                        onChange={e => set('phone', e.target.value)} />
                    </Field>
                    <div className="sm:col-span-2">
                      <Field label="Suburb & city" required>
                        <input className={inputCls} value={f.suburb_city}
                          onChange={e => set('suburb_city', e.target.value)}
                          placeholder="e.g. Devonport, Auckland" />
                      </Field>
                    </div>
                  </div>
                </Section>

                <Section title="Current diving ability"
                  hint="Please give us your current ability, not your personal bests from years ago.">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <Field label="Max depth (m)">
                      <input type="number" min="0" step="0.5" className={inputCls} value={f.max_depth_m}
                        onChange={e => set('max_depth_m', e.target.value)} />
                    </Field>
                    <Field label="Comfortable depth (m)" hint="With roughly 10–20 seconds bottom time">
                      <input type="number" min="0" step="0.5" className={inputCls} value={f.comfortable_depth_m}
                        onChange={e => set('comfortable_depth_m', e.target.value)} />
                    </Field>
                    <Field label="Max breath-hold (seconds)">
                      <input type="number" min="0" className={inputCls} value={f.max_breath_hold_sec}
                        onChange={e => set('max_breath_hold_sec', e.target.value)} />
                    </Field>
                    <Field label="Comfortable breath-hold (seconds)" hint="While diving, with 10–20 seconds bottom time">
                      <input type="number" min="0" className={inputCls} value={f.comfortable_breath_hold_sec}
                        onChange={e => set('comfortable_breath_hold_sec', e.target.value)} />
                    </Field>
                  </div>
                </Section>

                <Section title="Competition experience"
                  hint={`Up to ${MAX_COMPETITIONS} competitions you've competed in over the last 5 years.`}>
                  <div className="space-y-3">
                    {comps.map((c, i) => (
                      <div key={i} className="border border-gray-200 rounded-xl p-3 sm:p-4">
                        <div className="flex items-center justify-between mb-2.5">
                          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                            Competition {i + 1}
                          </span>
                          {comps.length > 1 && (
                            <button type="button" onClick={() => setComps(list => list.filter((_, idx) => idx !== i))}
                              className="text-xs font-bold text-red-500 hover:bg-red-50 px-2 py-1 rounded-lg">
                              Remove
                            </button>
                          )}
                        </div>
                        <div className="grid sm:grid-cols-2 gap-3">
                          <input className={inputCls} placeholder="Competition name"
                            value={c.name} onChange={e => setComp(i, 'name', e.target.value)} />
                          <input type="number" min="1990" max="2100" className={inputCls} placeholder="Year"
                            value={c.year} onChange={e => setComp(i, 'year', e.target.value)} />
                          <input className={inputCls} placeholder="Placing (e.g. 3rd)"
                            value={c.placing} onChange={e => setComp(i, 'placing', e.target.value)} />
                          <input className={inputCls} placeholder="Who you competed with"
                            value={c.partner} onChange={e => setComp(i, 'partner', e.target.value)} />
                        </div>
                      </div>
                    ))}
                  </div>
                  {comps.length < MAX_COMPETITIONS && (
                    <button type="button" onClick={() => setComps(c => [...c, blankComp()])}
                      className="mt-3 text-sm font-bold px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">
                      + Add another competition
                    </button>
                  )}
                </Section>

                <Section title="Commercial experience">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4" checked={f.has_commercial_experience}
                      onChange={e => set('has_commercial_experience', e.target.checked)} />
                    <span className="text-sm text-gray-700">
                      I have commercial fishing or diving experience
                    </span>
                  </label>
                  {f.has_commercial_experience && (
                    <div className="mt-3">
                      <Field label="Tell us about it" hint="Type of work, and how long you were involved.">
                        <textarea className={`${inputCls} min-h-[90px] resize-y`} value={f.commercial_details}
                          onChange={e => set('commercial_details', e.target.value)} />
                      </Field>
                    </div>
                  )}
                </Section>

                <Section title="Diving experience & locations">
                  <Field label="Where have you spearfished around New Zealand?">
                    <textarea className={`${inputCls} min-h-[80px] resize-y`} value={f.nz_locations}
                      onChange={e => set('nz_locations', e.target.value)}
                      placeholder="e.g. Hauraki Gulf, Bay of Islands, Wellington south coast…" />
                  </Field>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mt-5 mb-2">
                    Overseas spearfishing experience
                  </p>
                  <div className="space-y-3">
                    {trips.map((t, i) => (
                      <div key={i} className="border border-gray-200 rounded-xl p-3 sm:p-4">
                        <div className="flex items-center justify-between mb-2.5">
                          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Trip {i + 1}</span>
                          {trips.length > 1 && (
                            <button type="button" onClick={() => setTrips(l => l.filter((_, idx) => idx !== i))}
                              className="text-xs font-bold text-red-500 hover:bg-red-50 px-2 py-1 rounded-lg">
                              Remove
                            </button>
                          )}
                        </div>
                        <div className="grid sm:grid-cols-3 gap-3">
                          <input className={inputCls} placeholder="Where?"
                            value={t.location} onChange={e => setTrip(i, 'location', e.target.value)} />
                          <input className={inputCls} placeholder="When?"
                            value={t.when} onChange={e => setTrip(i, 'when', e.target.value)} />
                          <input className={inputCls} placeholder="How long?"
                            value={t.duration} onChange={e => setTrip(i, 'duration', e.target.value)} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={() => setTrips(t => [...t, blankTrip()])}
                    className="mt-3 text-sm font-bold px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">
                    + Add another trip
                  </button>
                </Section>

                <Section title="Species list"
                  hint="Select every species you've shot while spearfishing in New Zealand.">
                  {species.length === 0 ? (
                    <p className="text-sm text-gray-400">Loading species…</p>
                  ) : (
                    <>
                      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                        <span className="text-sm font-bold" style={{ color: SNZ_BLUE }}>
                          {picked.size} of {species.length} selected
                        </span>
                        {picked.size > 0 && (
                          <button type="button" onClick={() => setPicked(new Set())}
                            className="text-xs font-bold px-3 py-1.5 rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50">
                            Clear all
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                        {species.map(s => {
                          const on = picked.has(s.name)
                          return (
                            <button key={s.slug} type="button" onClick={() => toggleSpecies(s.name)}
                              className={`flex items-center gap-2 text-left px-3 py-2 rounded-lg border-2 transition text-sm ${
                                on ? 'border-blue-500 bg-blue-50 font-semibold text-blue-900'
                                   : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                              <span className={`w-4 h-4 rounded flex-shrink-0 flex items-center justify-center text-[11px] font-black ${
                                on ? 'text-white' : 'border border-gray-300'}`}
                                style={on ? { background: SNZ_BLUE } : {}}>
                                {on ? '✓' : ''}
                              </span>
                              <span className="truncate">{s.name}</span>
                            </button>
                          )
                        })}
                      </div>
                    </>
                  )}
                </Section>

                <Section title="Commitment to the squad"
                  hint="Do you have the time and financial ability to meet the squad commitments — training sessions, competitions, travel and accommodation?">
                  <div className="space-y-2">
                    {COMMITMENT_OPTIONS.map(o => (
                      <label key={o.value}
                        className={`flex items-start gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition ${
                          f.commitment_level === o.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                        <input type="radio" name="commitment" className="mt-0.5 w-4 h-4 flex-shrink-0"
                          checked={f.commitment_level === o.value}
                          onChange={() => set('commitment_level', o.value)} />
                        <span className="text-sm text-gray-700">{o.label}</span>
                      </label>
                    ))}
                  </div>
                  <div className="mt-3 rounded-lg px-4 py-3 border text-sm"
                    style={{ background: '#eff6ff', borderColor: '#bfdbfe', color: '#1e40af' }}>
                    If you can't meet all of these right now, please still apply. We'll keep your
                    information on record and may be able to consider you for future opportunities.
                  </div>
                  <div className="mt-4">
                    <Field label="Anything else you'd like the panel to know?">
                      <textarea className={`${inputCls} min-h-[80px] resize-y`} value={f.commitment_notes}
                        onChange={e => set('commitment_notes', e.target.value)} />
                    </Field>
                  </div>
                </Section>

                <Section title="Medical declaration">
                  <label className="flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition"
                    style={{ borderColor: f.medically_fit ? '#86efac' : '#fecaca', background: f.medically_fit ? '#f0fdf4' : '#fef2f2' }}>
                    <input type="checkbox" className="mt-0.5 w-5 h-5 flex-shrink-0" checked={f.medically_fit}
                      onChange={e => set('medically_fit', e.target.checked)} />
                    <span className="text-sm font-semibold" style={{ color: f.medically_fit ? '#166534' : '#7f1d1d' }}>
                      I confirm I am medically fit and able to participate safely in spearfishing and
                      freediving activities. I have no conditions that would prevent safe
                      participation and I take full responsibility for my own safety.{' '}
                      <span className="text-red-500">*</span>
                    </span>
                  </label>
                  <div className="mt-4">
                    <Field label="Physical or mental health matters the panel should be aware of"
                      hint="Optional, and treated in confidence — seen only by the selection panel. Tell us anything that may affect your training, diving or travel.">
                      <textarea className={`${inputCls} min-h-[90px] resize-y`} value={f.health_disclosure}
                        onChange={e => set('health_disclosure', e.target.value)} />
                    </Field>
                  </div>
                </Section>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>
                )}

                <div className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6">
                  <button type="submit" disabled={!canSubmit}
                    className="w-full py-3.5 rounded-xl font-black text-white text-sm disabled:opacity-40 transition"
                    style={{ background: SNZ_BLUE }}>
                    {submitting ? 'Submitting…' : 'Submit Application'}
                  </button>
                  {missing.length > 0 && (
                    <p className="text-xs text-gray-400 mt-2.5 text-center">
                      Still needed: {missing.join(', ')}
                    </p>
                  )}
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  )
}
