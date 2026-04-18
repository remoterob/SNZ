import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useMemberSession, MemberAuthGate } from '../components/MemberAuthGate'

const SNZ_BLUE = '#2B6CB0'
const SNZ_LOGO = import.meta.env.VITE_SNZ_LOGO_URL || null

// The 9 required photos — key matches DB column name
const REQUIRED_PHOTOS = [
  { key: 'photo_applicant_with_fish',  label: 'Applicant with fish at time of capture' },
  { key: 'photo_applicant_on_scales',  label: 'Applicant with fish on scales' },
  { key: 'photo_fish_on_scales',       label: 'Fish on scales with weight clearly showing' },
  { key: 'photo_species_diagnostic',   label: 'Species diagnostic photo(s)' },
  { key: 'photo_length_under',         label: 'Fish length — tape measure under fish' },
  { key: 'photo_height',               label: 'Fish height with tape measure' },
  { key: 'photo_length_over',          label: 'Fish length — tape measure over fish' },
  { key: 'photo_girth',                label: 'Fish girth with tape measure' },
  { key: 'photo_scales_sticker',       label: 'Certification sticker on scales' },
]

function Field({ label, required, hint, children }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {hint && <p className="text-xs text-gray-400 mb-1">{hint}</p>}
      {children}
    </div>
  )
}

function Input({ value, onChange, type = 'text', placeholder, required, className = '' }) {
  return (
    <input
      type={type} value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder} required={required}
      className={`w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-300 ${className}`}
    />
  )
}

function Textarea({ value, onChange, placeholder, rows = 4, required }) {
  return (
    <textarea
      value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} rows={rows} required={required}
      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-300 resize-y"
    />
  )
}

function Section({ title, children }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 mb-5">
      <h2 className="text-sm font-black tracking-widest uppercase mb-5 pb-3 border-b border-gray-100" style={{ color: SNZ_BLUE }}>{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
    </div>
  )
}

function FullRow({ children }) {
  return <div className="sm:col-span-2">{children}</div>
}

// Single photo upload slot
function PhotoSlot({ photoKey, label, url, uploading, onUpload, onRemove }) {
  return (
    <div className="flex flex-col gap-2">
      <label className="block text-xs font-bold text-gray-600 leading-snug">{label}</label>

      {url ? (
        // Uploaded — show thumbnail + remove
        <div className="relative group">
          <img
            src={url}
            alt={label}
            className="w-full h-28 object-cover rounded-xl border-2 border-green-400"
          />
          <div className="absolute top-1.5 right-1.5 flex gap-1">
            <a href={url} target="_blank" rel="noopener noreferrer"
              className="w-7 h-7 rounded-full bg-black/50 text-white text-xs flex items-center justify-center hover:bg-black/70"
              title="View full size"
            >🔍</a>
            <button type="button" onClick={onRemove}
              className="w-7 h-7 rounded-full bg-black/50 text-white text-xs flex items-center justify-center hover:bg-red-600"
              title="Remove"
            >✕</button>
          </div>
          <div className="absolute bottom-1.5 left-1.5 bg-green-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">✓ Uploaded</div>
        </div>
      ) : (
        // Not uploaded — upload button
        <label className={`relative flex flex-col items-center justify-center w-full h-28 rounded-xl border-2 border-dashed cursor-pointer transition
          ${uploading ? 'border-blue-300 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50'}`}>
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
              <span className="text-xs text-blue-500 font-semibold">Uploading…</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1.5 text-center px-2">
              <span className="text-2xl">📷</span>
              <span className="text-xs text-gray-500 font-semibold">Tap to upload</span>
              <span className="text-xs text-gray-400">JPG, PNG, HEIC</span>
            </div>
          )}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={e => e.target.files[0] && onUpload(photoKey, e.target.files[0])}
          />
        </label>
      )}
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

export default function RecordApplication() {
  const navigate = useNavigate()
  const { session, member, loading: sessionLoading } = useMemberSession()
  const [showAuthGate, setShowAuthGate] = useState(false)
  const [step, setStep] = useState(1) // 1=form, 2=success
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState({})
  const [appId, setAppId] = useState(null)       // set after initial insert, used for photo paths
  const [photoUrls, setPhotoUrls] = useState({})  // key → public url
  const [uploading, setUploading] = useState({})  // key → bool

  const [form, setForm] = useState({
    app_types: ['Open'],  // multiselect array
    full_name: '', birth_date: '', postal_address: '',
    telephone: '', cell_phone: '', email: '',
    common_name: '', scientific_name: '',
    weight_kg: '', length_cm: '', girth_cm: '', height_cm: '',
    date_speared: '', location: '', hunt_description: '',
    scales_location: '', scales_manufacturer: '', scales_certified_date: '',
    weighmaster_name: '', weighmaster_address: '', weighmaster_phone: '', weighmaster_email: '', weighmaster_weight_kg: '', weighmaster_signed: false,
    witness_name: '', witness_address: '', witness_phone: '', witness_email: '', witness_signed: false,
    declaration_agreed: false,
  })

  const set = key => val => setForm(f => ({ ...f, [key]: val }))

  // Pre-fill form from member profile when session loads
  useEffect(() => {
    if (!member) return
    setForm(f => ({
      ...f,
      full_name: member.name || f.full_name,
      email: member.email || f.email,
      cell_phone: member.phone || f.cell_phone,
      birth_date: member.dob || f.birth_date,
      // Club used as postal address hint if no address set
    }))
  }, [member])

  const validate = () => {
    const e = {}
    if (!form.full_name.trim()) e.full_name = 'Required'
    if (!form.email.trim()) e.email = 'Required'
    if (!form.postal_address.trim()) e.postal_address = 'Required'
    if (!form.common_name.trim()) e.common_name = 'Required'
    if (!form.weight_kg || isNaN(parseFloat(form.weight_kg))) e.weight_kg = 'Required — must be a number'
    if (!form.date_speared.trim()) e.date_speared = 'Required'
    if (!form.location.trim()) e.location = 'Required'
    if (!form.declaration_agreed) e.declaration_agreed = 'You must agree to the declaration'
    if (form.app_types.includes('Junior') && !form.birth_date.trim()) e.birth_date = 'Required for Junior applications'
    if (form.app_types.length === 0) e.app_types = 'Please select at least one category'
    if (Object.keys(photoUrls).length < 9) e.photos = 'All 9 photos are required before submitting'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  // Upload a single photo — creates the DB row first if needed
  const handlePhotoUpload = async (photoKey, file) => {
    setUploading(u => ({ ...u, [photoKey]: true }))
    try {
      // Create the application row on first photo upload if not yet inserted
      let id = appId
      if (!id) {
        const payload = {
          ...form,
          app_type: form.app_types.join(', '),
          weight_kg: parseFloat(form.weight_kg) || null,
          length_cm: parseFloat(form.length_cm) || null,
          girth_cm: parseFloat(form.girth_cm) || null,
          height_cm: parseFloat(form.height_cm) || null,
          status: 'draft',
        }
        delete payload.app_types
        const { data, error } = await supabase
          .from('record_applications')
          .insert(payload)
          .select('id')
          .single()
        if (error) throw error
        id = data.id
        setAppId(id)
      }

      // Upload to storage
      const ext = file.name.split('.').pop().toLowerCase().replace('heic', 'jpg')
      const path = `applications/${id}/${photoKey}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('snz-media')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (upErr) throw upErr

      const { data: { publicUrl } } = supabase.storage.from('snz-media').getPublicUrl(path)

      // Save URL back to the DB row
      const { error: dbErr } = await supabase
        .from('record_applications')
        .update({ [photoKey]: publicUrl })
        .eq('id', id)
      if (dbErr) throw dbErr

      setPhotoUrls(p => ({ ...p, [photoKey]: publicUrl }))
    } catch (err) {
      alert('Upload failed: ' + err.message)
      console.error(err)
    } finally {
      setUploading(u => ({ ...u, [photoKey]: false }))
    }
  }

  const handleRemovePhoto = async (photoKey) => {
    setPhotoUrls(p => { const n = { ...p }; delete n[photoKey]; return n })
    if (appId) {
      await supabase.from('record_applications').update({ [photoKey]: null }).eq('id', appId)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!session || sessionLoading) { setShowAuthGate(true); return }
    if (!validate()) { window.scrollTo({ top: 0, behavior: 'smooth' }); return }
    setSubmitting(true)
    try {
      const payload = {
        ...form,
        app_type: form.app_types.join(', '),
        weight_kg: parseFloat(form.weight_kg) || null,
        length_cm: parseFloat(form.length_cm) || null,
        girth_cm: parseFloat(form.girth_cm) || null,
        height_cm: parseFloat(form.height_cm) || null,
        status: 'submitted',
        ...photoUrls,
      }
      delete payload.app_types
      if (appId) {
        // Update existing draft row
        const { error } = await supabase.from('record_applications').update(payload).eq('id', appId)
        if (error) throw error
      } else {
        const { error } = await supabase.from('record_applications').insert(payload)
        if (error) throw error
      }
      setStep(2)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      console.error(err)
      alert('Submission failed: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const uploadedCount = Object.keys(photoUrls).length
  // ── Success screen ──
  if (step === 2) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-gray-200 rounded-2xl p-8 text-center shadow-sm">
          <div className="text-5xl mb-4">🐟</div>
          <h1 className="text-2xl font-black text-gray-900 mb-3">Application Submitted!</h1>
          <p className="text-gray-500 text-sm leading-relaxed mb-3">
            Your record claim has been received. The SNZ Records Keeper will be in touch at <strong>{form.email}</strong>.
          </p>
          <p className="text-green-600 text-sm font-semibold mb-3">
            ✓ All 9 photos submitted with your application
          </p>
          <p className="text-xs text-gray-400 mb-6">Applications are reviewed within 30 days. There is no charge for record applications.</p>
          <button
            onClick={() => navigate('/records')}
            className="w-full py-3 rounded-xl font-bold text-white text-sm"
            style={{ background: SNZ_BLUE }}
          >Back to NZ Records</button>
        </div>
      </div>
    )
  }

  // ── Main form ──
  return (
    <div className="min-h-screen bg-gray-50">
      <div style={{ background: SNZ_BLUE }} className="px-6 py-3 flex items-center justify-between border-b border-blue-700">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/records')} className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">← NZ Records</button>
          <span className="text-blue-200 text-sm opacity-75">/ Record Application</span>
        </div>
        <MemberBadge />
      </div>
      <header className="border-b border-gray-200 px-6 py-5 bg-white flex items-center gap-4">
        {SNZ_LOGO && <img src={SNZ_LOGO} alt="Spearfishing NZ" className="h-10 w-auto object-contain" />}
        <div>
          <h1 className="text-2xl font-black text-gray-900">NZ Record Application</h1>
          <p className="text-xs text-gray-400 tracking-wider">New Zealand Spearfishing Records · v2018</p>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="max-w-2xl mx-auto p-6">

        {/* Validation summary */}
        {Object.keys(errors).length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5">
            <p className="text-sm font-bold text-red-700 mb-2">Please fix the following:</p>
            <ul className="list-disc list-inside text-sm text-red-600 space-y-1">
              {Object.entries(errors).map(([k, v]) => <li key={k}>{v}</li>)}
            </ul>
          </div>
        )}

        {/* Rules */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-5">
          <p className="text-xs font-black tracking-widest uppercase mb-3" style={{ color: SNZ_BLUE }}>Rules for New Zealand Spearfishing Records</p>
          <p className="text-xs text-gray-500 italic mb-3">Records are a privilege — it is the responsibility of the applicant to prove the claim.</p>
          <ol className="text-xs text-gray-700 space-y-2 list-none">
            <li><span className="font-bold text-gray-500 mr-1">1.</span>Fish may only be speared while freediving. No artificial breathing apparatus is allowed.</li>
            <li><span className="font-bold text-gray-500 mr-1">2.</span>Fish must be free-swimming, unrestrained by nets, traps, lines or other devices.</li>
            <li><span className="font-bold text-gray-500 mr-1">3.</span>A speargun must be loaded by the diver's muscle power only. Powerheads are prohibited.</li>
            <li><span className="font-bold text-gray-500 mr-1">4.</span>Any fish speared must be fought and subdued by the diver, in the water and unassisted.</li>
            <li><span className="font-bold text-gray-500 mr-1">5.</span>Fish must be weighed on up-to-date certified scales. These can be found at game fishing clubs, butchers, greengrocers, dairies etc.</li>
            <li><span className="font-bold text-gray-500 mr-1">6.</span>Weights must be recorded to the nearest 10 g for fish up to 10 kg, nearest 50 g for 10–25 kg, and nearest 100 g for fish over 25 kg.</li>
            <li><span className="font-bold text-gray-500 mr-1">7.</span>Each claim must be accompanied by measurements and clear photos showing diagnostic features and including a tape measure or ruler for scale.</li>
            <li><span className="font-bold text-gray-500 mr-1">8.</span><strong>All fish must be kept whole and frozen</strong> until the species, size and weight can be verified by a local representative. The Records Keeper will advise who this is. Note that this may take some time to arrange.</li>
            <li><span className="font-bold text-gray-500 mr-1">9.</span>Records must be claimed within 3 months of the date of capture.</li>
            <li><span className="font-bold text-gray-500 mr-1">10.</span>Juniors will be under 18 years of age. A junior or women's record can also be claimed as an open record.</li>
            <li><span className="font-bold text-gray-500 mr-1">11.</span>After a satisfactory referee report is received and the claim is considered valid, the record will initially be awarded as provisional. After publication on the SNZ website, a 30-day period is allowed for any question or dispute.</li>
            <li><span className="font-bold text-gray-500 mr-1">12.</span>In the event of any dispute, the Records Keeper and SNZ Committee will be the final arbiters in the acceptance of a record.</li>
            <li><span className="font-bold text-gray-500 mr-1">13.</span>There is no charge for record applications.</li>
            <li><span className="font-bold text-gray-500 mr-1">14.</span>All nine photos must be uploaded through this form — the form cannot be submitted without them.</li>
          </ol>
        </div>

        {/* KEEP THE FISH warning */}
        <div className="rounded-xl p-5 mb-5 flex items-start gap-4" style={{ background: '#7f1d1d', border: '2px solid #ef4444' }}>
          <span className="text-4xl flex-shrink-0 mt-0.5">⚠️</span>
          <div>
            <p className="text-white font-black text-lg uppercase tracking-wide leading-tight mb-1">Keep the fish!</p>
            <p className="text-red-100 text-sm leading-relaxed">
              <strong>Do not dispose of, fillet, or consume the fish</strong> until you have been formally advised by the SNZ Records Keeper.
              The fish must be kept whole and frozen so the species, size, and weight can be verified by a local representative.
            </p>
          </div>
        </div>

        {/* Measurement diagram */}
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-5">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-xs font-black tracking-widest uppercase" style={{ color: SNZ_BLUE }}>Guidance on fish measurements and technical terms</p>
          </div>
          <img
            src="https://zodqgekuackcrqyzluoo.supabase.co/storage/v1/object/public/snz-media/awards/Records%20Fish%20pic.png"
            alt="Guidance on fish measurements and technical terms"
            className="w-full"
          />
        </div>

        {/* Application type — multiselect */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-5">
          <h2 className="text-sm font-black tracking-widest uppercase mb-1 pb-3 border-b border-gray-100" style={{ color: SNZ_BLUE }}>Application For</h2>
          <p className="text-xs text-gray-400 mb-4 mt-3">Select all that apply — a catch can qualify for multiple categories.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { id: 'Open', desc: 'Largest verified record for the species — open to all divers' },
              { id: "Women\'s", desc: 'Largest verified record speared by a woman' },
              { id: 'Junior', desc: 'Largest verified record speared by a diver 18 or under' },
              { id: 'Meritorious Fish', desc: 'An exceptional or unusual catch worthy of recognition — not a weight record' },
            ].map(({ id, desc }) => {
              const selected = form.app_types.includes(id)
              const toggle = () => {
                const next = selected
                  ? form.app_types.filter(t => t !== id)
                  : [...form.app_types, id]
                setForm(f => ({ ...f, app_types: next }))
              }
              return (
                <button
                  key={id}
                  type="button"
                  onClick={toggle}
                  className="flex items-start gap-3 p-4 rounded-xl border-2 text-left transition"
                  style={selected
                    ? { borderColor: SNZ_BLUE, background: '#eff6ff' }
                    : { borderColor: '#e5e7eb', background: '#fff' }}
                >
                  <div className="flex-shrink-0 mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition"
                    style={selected
                      ? { background: SNZ_BLUE, borderColor: SNZ_BLUE }
                      : { background: '#fff', borderColor: '#d1d5db' }}>
                    {selected && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{id} {id !== 'Meritorious Fish' ? 'Record' : ''}</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-snug">{desc}</p>
                  </div>
                </button>
              )
            })}
          </div>
          {form.app_types.length === 0 && (
            <p className="text-xs text-red-500 mt-3">Please select at least one category.</p>
          )}
        </div>

        {/* Personal details */}
        <Section title="Personal Details">
          <FullRow>
            <Field label="Full name" required>
              <Input value={form.full_name} onChange={set('full_name')} placeholder="Your full name" required />
              {errors.full_name && <p className="text-xs text-red-500 mt-1">{errors.full_name}</p>}
            </Field>
          </FullRow>
          {form.app_types.includes('Junior') && (
            <FullRow>
              <Field label="Date of birth" required hint="Applicant must be 18 or under at time of capture">
                <Input value={form.birth_date} onChange={set('birth_date')} placeholder="DD/MM/YYYY" required />
                {errors.birth_date && <p className="text-xs text-red-500 mt-1">{errors.birth_date}</p>}
              </Field>
            </FullRow>
          )}
          <FullRow>
            <Field label="Postal address" required>
              <Textarea value={form.postal_address} onChange={set('postal_address')} placeholder="Street, City, Postcode" rows={2} required />
              {errors.postal_address && <p className="text-xs text-red-500 mt-1">{errors.postal_address}</p>}
            </Field>
          </FullRow>
          <Field label="Telephone"><Input value={form.telephone} onChange={set('telephone')} placeholder="Landline" /></Field>
          <Field label="Cell phone"><Input value={form.cell_phone} onChange={set('cell_phone')} placeholder="Mobile" /></Field>
          <FullRow>
            <Field label="Email" required>
              <Input value={form.email} onChange={set('email')} type="email" placeholder="you@example.com" required />
              {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
            </Field>
          </FullRow>
        </Section>

        {/* Species */}
        <Section title="Species">
          <Field label="Common name" required>
            <Input value={form.common_name} onChange={set('common_name')} placeholder="e.g. Kingfish" required />
            {errors.common_name && <p className="text-xs text-red-500 mt-1">{errors.common_name}</p>}
          </Field>
          <Field label="Scientific name" hint="Optional but encouraged">
            <Input value={form.scientific_name} onChange={set('scientific_name')} placeholder="e.g. Seriola lalandi" />
          </Field>
        </Section>

        {/* Measurements */}
        <Section title="Measurements">
          <Field label="Weight (kg)" required hint="To 2 decimal places, e.g. 12.50">
            <Input value={form.weight_kg} onChange={set('weight_kg')} placeholder="0.00" />
            {errors.weight_kg && <p className="text-xs text-red-500 mt-1">{errors.weight_kg}</p>}
          </Field>
          <Field label="Length (cm)"><Input value={form.length_cm} onChange={set('length_cm')} placeholder="Fork or standard length" /></Field>
          <Field label="Girth at pectoral fin (cm)"><Input value={form.girth_cm} onChange={set('girth_cm')} placeholder="cm" /></Field>
          <Field label="Height at pectoral fin (cm)"><Input value={form.height_cm} onChange={set('height_cm')} placeholder="cm" /></Field>
        </Section>

        {/* ── Photos ── */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-5">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100 mb-5">
            <h2 className="text-sm font-black tracking-widest uppercase" style={{ color: SNZ_BLUE }}>
              Photos — All Nine Required
            </h2>
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
              uploadedCount === 9 ? 'bg-green-100 text-green-700' :
              uploadedCount > 0  ? 'bg-amber-100 text-amber-700' :
                                   'bg-gray-100 text-gray-500'
            }`}>{uploadedCount}/9 uploaded</span>
          </div>
          <p className="text-xs text-gray-500 mb-5 leading-relaxed">
            Upload each photo directly — they are saved immediately as you go. Label files with your surname, fish name, and year
            (e.g. <span className="font-mono bg-gray-100 px-1 rounded">Harrison_Kingfish_2025.jpg</span>).
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {REQUIRED_PHOTOS.map(({ key, label }) => (
              <PhotoSlot
                key={key}
                photoKey={key}
                label={label}
                url={photoUrls[key]}
                uploading={!!uploading[key]}
                onUpload={handlePhotoUpload}
                onRemove={() => handleRemovePhoto(key)}
              />
            ))}
          </div>
          {uploadedCount < 9 && (
            <p className="text-xs text-red-400 mt-4 font-semibold">
              All 9 photos must be uploaded before you can submit your application.
            </p>
          )}
        </div>

        {/* Event */}
        <Section title="Event Details">
          <Field label="Date speared" required>
            <Input value={form.date_speared} onChange={set('date_speared')} placeholder="DD/MM/YYYY" required />
            {errors.date_speared && <p className="text-xs text-red-500 mt-1">{errors.date_speared}</p>}
          </Field>
          <Field label="Location" required>
            <Input value={form.location} onChange={set('location')} placeholder="e.g. Three Kings Islands" required />
            {errors.location && <p className="text-xs text-red-500 mt-1">{errors.location}</p>}
          </Field>
          <FullRow>
            <Field label="Full description of hunt and capture" hint="Include conditions, depth, method, etc.">
              <Textarea value={form.hunt_description} onChange={set('hunt_description')} placeholder="Describe the hunt and capture in detail..." rows={5} />
            </Field>
          </FullRow>
        </Section>

        {/* Scales */}
        <Section title="Scales Details">
          <Field label="Location of scales">
            <Input value={form.scales_location} onChange={set('scales_location')} placeholder="e.g. Whangarei Game Fishing Club" />
          </Field>
          <Field label="Manufacturer"><Input value={form.scales_manufacturer} onChange={set('scales_manufacturer')} placeholder="e.g. Marel" /></Field>
          <Field label="Date last certified"><Input value={form.scales_certified_date} onChange={set('scales_certified_date')} placeholder="DD/MM/YYYY" /></Field>
        </Section>

        {/* Weighmaster */}
        <Section title="Weighmaster Details">
          <Field label="Full name"><Input value={form.weighmaster_name} onChange={set('weighmaster_name')} placeholder="Weighmaster's full name" /></Field>
          <Field label="Weight recorded by weighmaster (kg)" hint="To 2 decimal places — must match certified scales">
            <Input value={form.weighmaster_weight_kg} onChange={set('weighmaster_weight_kg')} placeholder="0.00" />
          </Field>
          <Field label="Email"><Input value={form.weighmaster_email} onChange={set('weighmaster_email')} type="email" placeholder="weighmaster@example.com" /></Field>
          <Field label="Phone"><Input value={form.weighmaster_phone} onChange={set('weighmaster_phone')} placeholder="Phone number" /></Field>
          <FullRow>
            <Field label="Address"><Textarea value={form.weighmaster_address} onChange={set('weighmaster_address')} placeholder="Weighmaster's address" rows={2} /></Field>
          </FullRow>
        </Section>

        {/* Witness */}
        <Section title="Witness Details">
          <Field label="Full name"><Input value={form.witness_name} onChange={set('witness_name')} placeholder="Witness's full name" /></Field>
          <Field label="Email"><Input value={form.witness_email} onChange={set('witness_email')} type="email" placeholder="witness@example.com" /></Field>
          <FullRow>
            <Field label="Address"><Textarea value={form.witness_address} onChange={set('witness_address')} placeholder="Witness's address" rows={2} /></Field>
          </FullRow>
          <Field label="Phone"><Input value={form.witness_phone} onChange={set('witness_phone')} placeholder="Phone number" /></Field>
          <FullRow>
            <div className="flex items-center gap-3 pt-1">
              <input type="checkbox" id="witness_signed" checked={form.witness_signed} onChange={e => set('witness_signed')(e.target.checked)} className="w-4 h-4" />
              <label htmlFor="witness_signed" className="text-sm text-gray-700">Witness confirms the fish was speared according to the rules for New Zealand spearfishing records</label>
            </div>
          </FullRow>
        </Section>

        {/* Declaration */}
        <div className="bg-white border-2 rounded-xl p-6 mb-6 transition"
          style={{ borderColor: form.declaration_agreed ? SNZ_BLUE : '#e5e7eb' }}>
          <h2 className="text-sm font-black tracking-widest uppercase mb-4 pb-3 border-b border-gray-100" style={{ color: SNZ_BLUE }}>Declaration</h2>
          <p className="text-sm text-gray-600 leading-relaxed mb-4">
            I confirm that this fish was speared according to the rules for New Zealand spearfishing records and that all information
            supplied is correct. I acknowledge that the burden of proof rests entirely with me.
          </p>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.declaration_agreed}
              onChange={e => set('declaration_agreed')(e.target.checked)}
              className="mt-0.5 w-5 h-5 rounded border-gray-300 flex-shrink-0"
            />
            <span className="text-sm font-semibold text-gray-700">I agree to the above declaration and confirm all details are accurate.</span>
          </label>
          {errors.declaration_agreed && <p className="text-xs text-red-500 mt-2">{errors.declaration_agreed}</p>}
        </div>

        {/* Photo progress — hard block */}
        {errors.photos && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5">
            <p className="text-sm text-red-700 font-semibold">⛔ {errors.photos}</p>
          </div>
        )}
        {uploadedCount < 9 && !errors.photos && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-5">
            <p className="text-sm text-amber-700 font-semibold">
              📷 {uploadedCount}/9 photos uploaded — {9 - uploadedCount} still required before you can submit
            </p>
          </div>
        )}

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-xs text-gray-500 leading-relaxed">
          <strong className="text-gray-700">After submitting:</strong> Your application and all 9 photos are sent directly to the SNZ Records Keeper for review. There is no charge. You will be contacted at the email address provided.
        </div>

        {/* Membership gate — shows inline login/signup if not authenticated */}
        {showAuthGate && !session && (
          <div className="mb-4">
            <MemberAuthGate message="An SNZ membership is required to submit a record claim. Sign in or join free to continue." />
          </div>
        )}

        <button
          type={session && !sessionLoading ? 'submit' : 'button'}
          onClick={!session ? () => setShowAuthGate(true) : undefined}
          disabled={sessionLoading || submitting || (session && uploadedCount < 9)}
          className="w-full py-4 rounded-xl font-black text-white text-base tracking-wide transition disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: sessionLoading ? '#9ca3af' : !session ? '#6b7280' : uploadedCount === 9 ? SNZ_BLUE : '#9ca3af' }}
        >
          {sessionLoading ? 'Checking membership…'
            : submitting ? 'Submitting…'
            : !session ? '🔒 Sign In to Submit'
            : uploadedCount < 9 ? `Upload all 9 photos to submit (${uploadedCount}/9 done)`
            : 'Submit Application — 9/9 Photos Attached ✓'}
        </button>
      </form>
    </div>
  )
}
