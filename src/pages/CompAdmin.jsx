import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import CompCopilotFAB from './CompCopilotFAB'

const SNZ_BLUE = '#2B6CB0'
const SNZ_LOGO = import.meta.env.VITE_SNZ_LOGO_URL || null
const CATEGORIES_ALL = ['Open','Mens','Womens','Mixed','Junior']

// ── Scoring ───────────────────────────────────────────────────────────────────
function calcPoints(fish, weightKg, mode) {
  if (mode === 'bingo') return fish.points || 100
  // Standard: base species points + weight bonus capped at max_weight_kg
  const base = fish.points || 100
  const cap = parseFloat(fish.max_weight_kg) || 8
  const bonus = Math.min(cap * 10, Math.floor((parseFloat(weightKg) || 0) * 10))
  return base + bonus
}

// Standard mode: bulk weight of all non-separately-weighed fish: 10pts/kg, no cap
function calcBulkBonus(bulkKg) {
  return Math.floor((parseFloat(bulkKg) || 0) * 10)
}


// ── Sponsor Bar ───────────────────────────────────────────────────────────────
function SponsorBar({ comp }) {
  const sponsors = [comp?.sponsor1_url, comp?.sponsor2_url, comp?.sponsor3_url].filter(Boolean)
  if (!sponsors.length) return null
  return (
    <div className="bg-white border-t border-gray-100 px-6 py-5">
      <div className="max-w-5xl mx-auto">
        <p className="text-xs font-bold tracking-widest uppercase text-gray-400 text-center mb-3">Proudly Sponsored By</p>
        <div className="flex items-center justify-center gap-8 flex-wrap">
          {sponsors.map((url, i) => (
            <img key={i} src={url} alt={`Sponsor ${i+1}`}
              className="h-12 max-w-32 object-contain opacity-80 hover:opacity-100 transition" />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Sponsor Upload Slot ───────────────────────────────────────────────────────
function SponsorUploadSlot({ label, url, compId, onUploaded, onRemoved, showToast }) {
  const [uploading, setUploading] = useState(false)

  const upload = async (file) => {
    setUploading(true)
    try {
      const ext = file.name.split('.').pop().toLowerCase()
      const slug = label.toLowerCase().replace(' ', '')
      const path = `competitions/${compId}/${slug}.${ext}`
      await supabase.storage.from('snz-media').remove([path])
      const { error } = await supabase.storage.from('snz-media').upload(path, file, { contentType: file.type })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('snz-media').getPublicUrl(path)
      await onUploaded(`${publicUrl}?t=${Date.now()}`)
      showToast(`${label} uploaded`)
    } catch (err) { showToast(err.message, 'error') }
    finally { setUploading(false) }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="w-full h-20 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden">
        {url
          ? <img src={url} alt={label} className="h-full w-full object-contain p-2" />
          : <span className="text-xs text-gray-400">{label}</span>
        }
      </div>
      <div className="flex gap-1.5">
        <label className={`cursor-pointer text-xs font-bold px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition ${uploading ? 'opacity-50' : ''}`}>
          {uploading ? 'Uploading…' : url ? '📷 Replace' : '📷 Upload'}
          <input type="file" accept="image/*" className="hidden" disabled={uploading}
            onChange={e => e.target.files[0] && upload(e.target.files[0])} />
        </label>
        {url && (
          <button onClick={async () => {
            await supabase.from('competitions').update({ [label.toLowerCase().replace(' ','') + '_url']: null }).eq('id', compId)
            onRemoved()
            showToast(`${label} removed`)
          }} className="text-xs font-bold px-2 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50">✕</button>
        )}
      </div>
    </div>
  )
}

// ── Compliance Gate ──────────────────────────────────────────────────────────
function ComplianceGate({ comp, onAccepted, showToast }) {
  const [checks, setChecks] = useState({
    snz_rules: false,
    safety_boat: false,
    briefing: false,
    first_aid: false,
    fisheries: false,
    incident_plan: false,
  })
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  const allChecked = Object.values(checks).every(Boolean) && name.trim()

  const toggle = k => setChecks(c => ({ ...c, [k]: !c[k] }))

  const submit = async () => {
    if (!allChecked) return
    setSaving(true)
    const { error } = await supabase.from('competitions').update({
      compliance_accepted: true,
      compliance_accepted_at: new Date().toISOString(),
      compliance_accepted_by: name.trim(),
      status: 'active',
    }).eq('id', comp.id)
    if (error) { showToast(error.message, 'error'); setSaving(false); return }
    showToast('Compliance accepted — competition is now Active')
    onAccepted()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.75)' }}>
      <div className="bg-white rounded-2xl w-full max-w-xl my-8 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-gray-100" style={{ background: SNZ_BLUE }}>
          <h2 className="font-black text-white text-lg">Organiser Compliance Declaration</h2>
          <p className="text-blue-200 text-xs mt-1">Required before this competition can be made Active. This confirms the event meets SNZ standards and is eligible to operate under the SNZ insurance policy.</p>
        </div>

        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">

          {/* SNZ Rules */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <p className="text-xs font-black tracking-widest uppercase" style={{ color: SNZ_BLUE }}>Competition Rules &amp; Guidelines</p>
              <a href="https://www.spearfishingnz.co.nz/_files/ugd/b3c400_e310eb5a265b4259a4b3c18d2c9afb87.pdf"
                target="_blank" rel="noopener noreferrer"
                className="text-xs font-bold px-2.5 py-1 rounded-lg border border-blue-300 text-blue-600 hover:bg-blue-50 whitespace-nowrap flex-shrink-0 transition"
                onClick={e => e.stopPropagation()}>
                📄 View Rules PDF
              </a>
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={checks.snz_rules} onChange={() => toggle('snz_rules')} className="mt-0.5 w-5 h-5 flex-shrink-0" />
              <span className="text-sm text-gray-700">
                <strong>This competition will be run in accordance with the Spearfishing New Zealand Competition Rules &amp; Guidelines (July 2024).</strong> I have read these rules and confirm the event is structured to comply with them, including eligibility requirements, equipment rules, competitor behaviour standards, and dispute resolution procedures.
              </span>
            </label>
          </div>

          {/* Safety Boat */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <p className="text-xs font-black tracking-widest uppercase mb-3" style={{ color: SNZ_BLUE }}>Safety Boat (SNZ Rules Part E)</p>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={checks.safety_boat} onChange={() => toggle('safety_boat')} className="mt-0.5 w-5 h-5 flex-shrink-0" />
              <span className="text-sm text-gray-700">
                <strong>A safety patrol boat will be present and visible to competitors at all times during the competition.</strong> The safety boat will be equipped with first aid equipment, oxygen, and operated by a person competent in shallow water blackout response. Where the competition area requires it, two safety boats will be provided so that the full area is covered.
              </span>
            </label>
            <p className="text-xs text-gray-400 mt-2 ml-8">Note: Where competitors are confirmed to remain close to shore and can safely swim ashore, a written risk assessment confirming this is an acceptable alternative must be on file with the Competition Director.</p>
          </div>

          {/* Safety Briefing */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <p className="text-xs font-black tracking-widest uppercase mb-3" style={{ color: SNZ_BLUE }}>Pre-Competition Safety Briefing</p>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={checks.briefing} onChange={() => toggle('briefing')} className="mt-0.5 w-5 h-5 flex-shrink-0" />
              <span className="text-sm text-gray-700">
                <strong>A compulsory safety briefing and roll call will be conducted before the competition begins.</strong> All competitors must attend and confirm their attendance. The briefing will cover the competition area, hazards, emergency procedures, hypoxic blackout protocol, speargun safety, and MPI/Maritime rules. The Competition Director will not compete.
              </span>
            </label>
          </div>

          {/* First Aid */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <p className="text-xs font-black tracking-widest uppercase mb-3" style={{ color: SNZ_BLUE }}>First Aid &amp; Emergency Response</p>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={checks.first_aid} onChange={() => toggle('first_aid')} className="mt-0.5 w-5 h-5 flex-shrink-0" />
              <span className="text-sm text-gray-700">
                <strong>A first aid kit and oxygen supply will be available on or near the water during the competition.</strong> At least one person present has current first aid training. Emergency services contact numbers and the competition area address/coordinates will be available to all officials. A plan of action for accidents and emergencies has been prepared.
              </span>
            </label>
          </div>

          {/* MPI / Fisheries */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <p className="text-xs font-black tracking-widest uppercase mb-3" style={{ color: SNZ_BLUE }}>Fisheries &amp; Maritime Compliance</p>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={checks.fisheries} onChange={() => toggle('fisheries')} className="mt-0.5 w-5 h-5 flex-shrink-0" />
              <span className="text-sm text-gray-700">
                <strong>The competition will operate within all applicable MPI (Fisheries), Maritime NZ, and local authority rules and regulations.</strong> Where fish are to be auctioned or donated to a community organisation, the required MPI permit has been or will be obtained prior to the event.
              </span>
            </label>
          </div>

          {/* Incident reporting */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <p className="text-xs font-black tracking-widest uppercase mb-3" style={{ color: SNZ_BLUE }}>Incident Reporting</p>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" checked={checks.incident_plan} onChange={() => toggle('incident_plan')} className="mt-0.5 w-5 h-5 flex-shrink-0" />
              <span className="text-sm text-gray-700">
                <strong>Any safety incidents or near misses will be reported to Spearfishing New Zealand within 48 hours.</strong> Any incidents requiring police, Maritime NZ, Worksafe, or MPI notification will be reported to those authorities as required, and SNZ will be notified. Complete incident reports will be forwarded to SNZ for their records.
              </span>
            </label>
          </div>

          {/* Signatory */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-xs font-black tracking-widest uppercase mb-2" style={{ color: SNZ_BLUE }}>Authorised Signatory</p>
            <p className="text-xs text-gray-600 mb-3">By entering your name and submitting, you confirm that you are authorised to make these declarations on behalf of the organising club, and that you have read and accept all of the above obligations.</p>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="Full name of Competition Director / Club representative"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            <p className="text-xs text-gray-400 mt-2">This declaration will be recorded with a timestamp against this competition for compliance purposes.</p>
          </div>

          <button onClick={submit} disabled={!allChecked || saving}
            className="w-full py-4 rounded-xl font-black text-white text-sm disabled:opacity-40 transition"
            style={{ background: allChecked ? '#16a34a' : '#9ca3af' }}>
            {saving ? 'Submitting…' : !allChecked ? 'Complete all declarations above to continue' : '✓ Accept All Obligations &amp; Make Competition Active'}
          </button>

          <p className="text-xs text-center text-gray-400">This competition is being run under the SNZ competition framework. The SNZ public liability insurance policy (Vero, $2M) applies to events run in compliance with SNZ rules and guidelines.</p>
        </div>
      </div>
    </div>
  )
}

// ── Auth gate ────────────────────────────────────────────────────────────────
function AuthGate({ comp, onAuth }) {
  const [pwd, setPwd] = useState('')
  const [err, setErr] = useState('')
  const check = () => {
    if (btoa(pwd) === comp.club_password || pwd === import.meta.env.VITE_ADMIN_PASSWORD) {
      sessionStorage.setItem(`comp_admin_${comp.id}`, '1')
      onAuth()
    } else {
      setErr('Incorrect password')
      setPwd('')
    }
  }
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-sm w-full bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
        <div className="text-center mb-6">
          {SNZ_LOGO && <img src={SNZ_LOGO} alt="SNZ" className="h-12 mx-auto mb-3 object-contain" />}
          <h1 className="text-xl font-black text-gray-900">Competition Admin</h1>
          <p className="text-sm text-gray-400 mt-1">{comp.name}</p>
        </div>
        {err && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-600 mb-4">{err}</div>}
        <input type="password" value={pwd} onChange={e => setPwd(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && check()}
          placeholder="Enter admin password"
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-300" />
        <button onClick={check} className="w-full py-3 rounded-xl font-bold text-white text-sm" style={{ background: SNZ_BLUE }}>Login</button>
      </div>
    </div>
  )
}

// ── Fish picker modal ────────────────────────────────────────────────────────
function FishPickerModal({ comp, existing, onClose, onSaved }) {
  const [library, setLibrary] = useState([])
  const [libLoading, setLibLoading] = useState(true)
  // selected: array of { slug, count } — allows multiples
  const [selected, setSelected] = useState(() =>
    existing.reduce((acc, f) => {
      const ex = acc.find(x => x.slug === f.species_slug)
      if (ex) { ex.count = (ex.count || 1) + 1 }
      else acc.push({ slug: f.species_slug, count: f.max_count || 1 })
      return acc
    }, [])
  )
  const [custom, setCustom] = useState(existing.filter(f => !f.species_slug.startsWith('custom-') ? false : true))
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [uploading, setUploading] = useState(null)
  const [weighSep, setWeighSep] = useState(() => {
    // Init from existing fish that have weigh_separately set
    const m = {}
    existing.filter(f => f.weigh_separately).forEach(f => { m[f.species_slug] = true })
    return m
  })

  const getWeighSep = (slug) => !!weighSep[slug]
  const toggleWeighSep = (slug) => setWeighSep(w => ({ ...w, [slug]: !w[slug] }))

  useEffect(() => {
    supabase.from('comp_species_library').select('*').eq('active', true).order('sort_order').order('name')
      .then(({ data }) => { setLibrary(data || []); setLibLoading(false) })
  }, [])

  const isSelected = (slug) => selected.find(x => x.slug === slug)
  const getCount = (slug) => selected.find(x => x.slug === slug)?.count || 0

  const toggle = (slug) => {
    setSelected(s => {
      const ex = s.find(x => x.slug === slug)
      return ex ? s.filter(x => x.slug !== slug) : [...s, { slug, count: 1 }]
    })
  }

  const setCount = (slug, count) => {
    const n = Math.max(1, Math.min(10, parseInt(count) || 1))
    setSelected(s => s.map(x => x.slug === slug ? { ...x, count: n } : x))
  }

  const filtered = library.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase())
  )

  const addCustom = () => {
    const name = prompt('Enter fish species name:')
    if (!name?.trim()) return
    const slug = `custom-${Date.now()}`
    setCustom(c => [...c, { species_name: name.trim(), species_slug: slug, photo_url: null, points: 100, max_weight_kg: 8, allow_multiples: false, max_count: 1 }])
    setSelected(s => [...s, slug])
  }

  const uploadCustomPhoto = async (slug, file) => {
    setUploading(slug)
    try {
      const ext = file.name.split('.').pop().toLowerCase()
      const path = `competitions/${comp.id}/fish/${slug}.${ext}`
      await supabase.storage.from('snz-media').remove([path])
      const { error } = await supabase.storage.from('snz-media').upload(path, file, { contentType: file.type })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('snz-media').getPublicUrl(path)
      setCustom(c => c.map(f => f.species_slug === slug ? { ...f, photo_url: publicUrl } : f))
    } catch (err) { alert(err.message) }
    finally { setUploading(null) }
  }

  const save = async () => {
    setSaving(true)
    try {
      await supabase.from('comp_fish').delete().eq('competition_id', comp.id)
      const rows = []
      let order = 0
      for (const { slug, count } of selected) {
        const lib = library.find(s => s.slug === slug)
        const cust = custom.find(f => f.species_slug === slug)
        if (!lib && !cust) continue
        rows.push({
          competition_id: comp.id,
          species_name: lib ? lib.name : cust.species_name,
          species_slug: slug,
          photo_url: lib ? lib.photo_url : cust.photo_url,
          points: cust?.points ?? 100,
          max_weight_kg: cust?.max_weight_kg ?? 8,
          allow_multiples: count > 1,
          max_count: count || 1,
          weigh_separately: weighSep[slug] || false,
          sort_order: order++,
        })
      }
      if (rows.length > 0) await supabase.from('comp_fish').insert(rows)
      onSaved()
      onClose()
    } catch (err) { alert(err.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-2xl my-8 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-black text-gray-900">Fish List ({selected.length} selected)</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
        </div>
        <div className="p-6">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search species…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-300" />
          {libLoading
            ? <div className="text-center py-8 text-gray-400">Loading species…</div>
            : <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-96 overflow-y-auto mb-4 pr-1">
                {filtered.map(s => {
                  const on = !!isSelected(s.slug)
                  const cnt = getCount(s.slug)
                  return (
                    <div key={s.slug} className={`relative rounded-xl border-2 overflow-hidden transition ${on ? 'border-blue-500' : 'border-gray-200 hover:border-gray-300'}`}>
                      <button type="button" onClick={() => toggle(s.slug)} className="w-full text-left">
                        {s.photo_url
                          ? <img src={s.photo_url} alt={s.name} className="w-full h-24 object-cover" />
                          : <div className="w-full h-24 bg-gray-100 flex items-center justify-center text-4xl">🐟</div>
                        }
                        <div className="p-1.5 text-xs font-semibold leading-tight">{s.name}</div>
                      </button>
                      {on && (
                        <div className="px-2 pb-2 space-y-1">
                          <div className="flex items-center gap-1">
                            <span className="text-xs text-gray-500">×</span>
                            <input type="number" min="1" max="10" value={cnt}
                              onClick={e => e.stopPropagation()}
                              onChange={e => setCount(s.slug, e.target.value)}
                              className="w-12 border border-gray-300 rounded px-1.5 py-0.5 text-xs font-bold text-center focus:outline-none focus:ring-1 focus:ring-blue-300" />
                            <span className="text-xs text-gray-400">fish</span>
                          </div>

                        </div>
                      )}
                      {on && <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">✓</div>}
                    </div>
                  )
                })}
              </div>
          }

          {custom.length > 0 && (
            <div className="mb-4">
              <h4 className="text-xs font-bold tracking-widest uppercase text-gray-400 mb-2">Custom Species</h4>
              {custom.map(f => (
                <div key={f.species_slug} className={`flex items-center gap-3 p-3 rounded-xl border-2 mb-2 ${selected.includes(f.species_slug) ? 'border-blue-400 bg-blue-50' : 'border-gray-200'}`}>
                  <button type="button" onClick={() => toggle(f.species_slug)}
                    className={`w-5 h-5 rounded flex-shrink-0 border-2 flex items-center justify-center ${selected.includes(f.species_slug) ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300'}`}>
                    {selected.includes(f.species_slug) && '✓'}
                  </button>
                  <div className="flex-1">
                    <p className="text-sm font-bold">{f.species_name}</p>
                    <div className="flex gap-3 mt-1">
                      <label className="text-xs text-gray-500">Points:
                        <input type="number" value={f.points} onChange={e => setCustom(c => c.map(x => x.species_slug === f.species_slug ? { ...x, points: parseInt(e.target.value)||100 } : x))}
                          className="ml-1 w-16 border border-gray-300 rounded px-1 py-0.5 text-xs" />
                      </label>
                      {comp.scoring_mode === 'standard' && (
                        <label className="text-xs text-gray-500">Max kg:
                          <input type="number" value={f.max_weight_kg} onChange={e => setCustom(c => c.map(x => x.species_slug === f.species_slug ? { ...x, max_weight_kg: parseFloat(e.target.value)||8 } : x))}
                            className="ml-1 w-14 border border-gray-300 rounded px-1 py-0.5 text-xs" />
                        </label>
                      )}
                      <label className="text-xs text-gray-500 flex items-center gap-1">
                        <input type="checkbox" checked={f.allow_multiples} onChange={e => setCustom(c => c.map(x => x.species_slug === f.species_slug ? { ...x, allow_multiples: e.target.checked } : x))} />
                        Multiples
                        {f.allow_multiples && <input type="number" min="1" max="10" value={f.max_count}
                          onChange={e => setCustom(c => c.map(x => x.species_slug === f.species_slug ? { ...x, max_count: parseInt(e.target.value)||1 } : x))}
                          className="w-10 border border-gray-300 rounded px-1 py-0.5 text-xs ml-1" />}
                      </label>
                    </div>
                  </div>
                  <label className="cursor-pointer text-xs text-blue-600 hover:underline">
                    {uploading === f.species_slug ? 'Uploading…' : f.photo_url ? '📷 Change' : '📷 Add photo'}
                    <input type="file" accept="image/*" className="hidden"
                      onChange={e => e.target.files[0] && uploadCustomPhoto(f.species_slug, e.target.files[0])} />
                  </label>
                </div>
              ))}
            </div>
          )}

          <button type="button" onClick={addCustom}
            className="w-full py-2 rounded-lg border-2 border-dashed border-gray-300 text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition mb-4">
            + Add custom species
          </button>

          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-300 text-sm font-bold text-gray-600">Cancel</button>
            <button type="button" onClick={save} disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
              style={{ background: SNZ_BLUE }}>
              {saving ? 'Saving…' : `Save Fish List (${selected.length})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main CompAdmin ───────────────────────────────────────────────────────────
export default function CompAdmin() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [comp, setComp] = useState(null)
  const [authed, setAuthed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('setup')
  const [fish, setFish] = useState([])
  const [teams, setTeams] = useState([])
  // Only paid/free teams appear in weigh-in and leaderboard
  const activeTeams = teams.filter(t => t.status !== 'pending_payment')
  const [members, setMembers] = useState([])
  const [weighins, setWeighins] = useState([])
  const [showFishPicker, setShowFishPicker] = useState(false)
  const [showCompliance, setShowCompliance] = useState(false)
  const [toast, setToast] = useState(null)
  const [saving, setSaving] = useState(false)

  const showToast = (msg, type='success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }

  const fetchAll = async () => {
    try {
      const [c, f, t, m, w] = await Promise.all([
        supabase.from('competitions').select('*').eq('id', id).single(),
        supabase.from('comp_fish').select('*').eq('competition_id', id).order('sort_order'),
        supabase.from('comp_teams').select('*').eq('competition_id', id).order('registered_at'),
        supabase.from('comp_team_members').select('*').eq('competition_id', id),
        supabase.from('comp_weighins').select('*').eq('competition_id', id),
      ])
      if (c.data) setComp(c.data)
      setFish(f.data || [])
      setTeams(t.data || [])
      setMembers(m.data || [])
      setWeighins(w.data || [])
      if (sessionStorage.getItem(`comp_admin_${id}`)) setAuthed(true)
    } catch(err) {
      console.error('fetchAll error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchAll() }, [id])

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>
  if (!comp) return <div className="min-h-screen flex items-center justify-center text-gray-400">Competition not found.</div>
  if (!authed) return <AuthGate comp={comp} onAuth={() => setAuthed(true)} />

  return (
    <div className="min-h-screen bg-gray-50">
      <CompCopilotFAB competitionId={id} competitionName={comp?.name} />
      {toast && <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-semibold shadow-lg ${toast.type === 'error' ? 'bg-red-600 text-white' : 'bg-green-600 text-white'}`}>{toast.msg}</div>}
      {showFishPicker && <FishPickerModal comp={comp} existing={fish} onClose={() => setShowFishPicker(false)} onSaved={() => { fetchAll(); showToast('Fish list saved') }} />}
      {showCompliance && <ComplianceGate comp={comp} showToast={showToast} onAccepted={() => { setShowCompliance(false); fetchAll() }} />}

      <div style={{ background: SNZ_BLUE }} className="px-6 py-3 flex items-center justify-between border-b border-blue-700">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(`/competitions/${id}`)} className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">← Public View</button>
          <span className="text-blue-200 text-sm opacity-75">/ Admin</span>
        </div>
        <button onClick={() => { sessionStorage.removeItem(`comp_admin_${id}`); setAuthed(false) }}
          className="text-xs text-blue-200 hover:text-white transition">Sign out</button>
      </div>

      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-gray-900">{comp.name}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-xs text-gray-400">Competition Admin · {comp.club_name}</p>
              {comp.compliance_accepted && (
                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-300">✓ SNZ Compliant</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {['draft','active','closed'].map(s => (
              <button key={s} onClick={async () => {
                // Require compliance gate before going active
                if (s === 'active' && !comp.compliance_accepted) {
                  setShowCompliance(true)
                  return
                }
                await supabase.from('competitions').update({ status: s }).eq('id', id)
                setComp(c => ({ ...c, status: s }))
                showToast(`Status → ${s}`)
              }}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border-2 transition ${comp.status === s ? (s==='active'?'border-green-400 bg-green-50 text-green-700':s==='closed'?'border-gray-400 bg-gray-100 text-gray-600':'border-amber-400 bg-amber-50 text-amber-700') : 'border-gray-200 text-gray-400 hover:border-gray-300'}`}>
                {s}
              </button>
            ))}
            <button
              onClick={() => {
                const url = `${window.location.origin}/c/${id}`
                if (navigator.share) {
                  navigator.share({ title: comp.name, text: `Register for ${comp.name}`, url })
                } else {
                  navigator.clipboard.writeText(url)
                  showToast('Link copied to clipboard!')
                }
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-bold border-2 border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100 transition"
              title="Share competitor link"
            >🔗 Share Link</button>
          </div>
        </div>
      </header>

      <div className="bg-white border-b border-gray-200 px-6">
        <div className="max-w-5xl mx-auto flex gap-0.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {[['setup','Setup'],['fish',`Fish (${fish.length})`],['teams',`Teams (${teams.length})`],['weighin','Weigh-in'],['leaderboard','Leaderboard'],['socials','📸 Socials']].map(([tid,tlabel]) => (
            <button key={tid} onClick={() => setTab(tid)}
              className={`py-3 px-4 text-sm font-bold border-b-2 transition whitespace-nowrap ${tab===tid?'border-blue-600 text-blue-700':'border-transparent text-gray-400 hover:text-gray-600'}`}>
              {tlabel}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-6">
        {tab === 'setup' && <SetupTab comp={comp} setComp={setComp} onSave={fetchAll} showToast={showToast} />}
        {tab === 'fish' && <FishTab fish={fish} comp={comp} onOpenPicker={() => setShowFishPicker(true)} />}
        {tab === 'teams' && <TeamsTab teams={teams} members={members} weighins={weighins} comp={comp} onRefresh={fetchAll} showToast={showToast} />}
        {tab === 'weighin' && <WeighInTab comp={comp} teams={activeTeams} members={members} fish={fish} weighins={weighins} onRefresh={fetchAll} showToast={showToast} />}
        {tab === 'leaderboard' && <AdminLeaderboard comp={comp} teams={activeTeams} weighins={weighins} fish={fish} />}
        {tab === 'socials' && <SocialsTab comp={comp} teams={activeTeams} members={members} weighins={weighins} />}
      </div>
      <SponsorBar comp={comp} />
    </div>
  )
}

// ── Setup Tab ────────────────────────────────────────────────────────────────
function SetupTab({ comp, setComp, onSave, showToast }) {
  const [form, setForm] = useState({ ...comp })
  const [saving, setSaving] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const set = k => v => setForm(f => ({ ...f, [k]: v }))

  const uploadCoverImage = async (file) => {
    setUploadingCover(true)
    try {
      const ext = file.name.split('.').pop().toLowerCase()
      const path = `competitions/${comp.id}/cover.${ext}`
      await supabase.storage.from('snz-media').remove([path])
      const { error } = await supabase.storage.from('snz-media').upload(path, file, { contentType: file.type })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('snz-media').getPublicUrl(path)
      set('cover_image_url')(publicUrl)
      await supabase.from('competitions').update({ cover_image_url: publicUrl }).eq('id', comp.id)
      setComp(c => ({ ...c, cover_image_url: publicUrl }))
      showToast('Cover image uploaded')
    } catch (err) { showToast(err.message, 'error') }
    finally { setUploadingCover(false) }
  }

  const save = async () => {
    setSaving(true)
    const { id, created_at, ...rest } = form
    const { error } = await supabase.from('competitions').update(rest).eq('id', comp.id)
    if (error) showToast(error.message, 'error')
    else { showToast('Saved'); setComp(form); onSave() }
    setSaving(false)
  }

  const toggleCat = (cat) => {
    const cur = form.categories || []
    set('categories')(cur.includes(cat) ? cur.filter(c => c !== cat) : [...cur, cat])
  }

  return (
    <div className="space-y-5">
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-sm font-black tracking-widest uppercase mb-4 pb-3 border-b border-gray-100" style={{ color: SNZ_BLUE }}>Competition Details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Cover image */}
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Cover Image</label>
            <div className="flex items-start gap-4">
              {form.cover_image_url
                ? <img src={form.cover_image_url} alt="Cover" className="w-40 h-24 object-cover rounded-xl border border-gray-200 flex-shrink-0" />
                : <div className="w-40 h-24 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-gray-400 text-sm flex-shrink-0">No image</div>
              }
              <div>
                <label className={`cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold border-2 border-gray-300 hover:border-blue-400 transition ${uploadingCover ? 'opacity-50' : ''}`}>
                  {uploadingCover ? '⏳ Uploading…' : form.cover_image_url ? '📷 Replace image' : '📷 Upload cover image'}
                  <input type="file" accept="image/*" className="hidden" disabled={uploadingCover}
                    onChange={e => e.target.files[0] && uploadCoverImage(e.target.files[0])} />
                </label>
                <p className="text-xs text-gray-400 mt-1.5">Shown as the hero banner on the competition page and deep link. Landscape (16:9) works best.</p>
                {form.cover_image_url && (
                  <button type="button" onClick={async () => {
                    await supabase.from('competitions').update({ cover_image_url: null }).eq('id', comp.id)
                    set('cover_image_url')(null)
                    setComp(c => ({ ...c, cover_image_url: null }))
                    showToast('Cover image removed')
                  }} className="block mt-1.5 text-xs text-red-500 hover:underline">Remove image</button>
                )}
              </div>
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Competition Name</label>
            <input value={form.name||''} onChange={e => set('name')(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Club Name</label>
            <input value={form.club_name||''} onChange={e => set('club_name')(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Location</label>
            <input value={form.location||''} onChange={e => set('location')(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Start Date</label>
            <input type="date" value={form.date_start||''} onChange={e => set('date_start')(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">End Date</label>
            <input type="date" value={form.date_end||''} onChange={e => set('date_end')(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Registration Cutoff</label>
            <p className="text-xs text-gray-400 mb-1">Deadline for buddy changes and withdrawals</p>
            <input type="date" value={form.registration_cutoff||''} onChange={e => set('registration_cutoff')(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Details / Description</label>
            <textarea value={form.details||''} onChange={e => set('details')(e.target.value)} rows={4}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-y" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Event Info <span className="text-gray-400 font-normal normal-case tracking-normal">(launch site, parking, briefing time, safety etc.)</span></label>
            <textarea value={form.event_info||''} onChange={e => set('event_info')(e.target.value)} rows={4}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-y"
              placeholder="e.g. Launch from Sandspit Wharf. Briefing at 6:30am. All teams must check in before 7am..." />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Rules</label>
            <textarea value={form.rules||''} onChange={e => set('rules')(e.target.value)} rows={6}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-y" />
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-sm font-black tracking-widest uppercase mb-4 pb-3 border-b border-gray-100" style={{ color: SNZ_BLUE }}>Scoring Mode</h3>
        <div className="flex gap-3 flex-wrap">
          <button type="button" onClick={() => set('scoring_mode')('standard')}
            className={`flex-1 p-4 rounded-xl border-2 text-left text-sm font-semibold transition ${form.scoring_mode==='standard'?'border-blue-500 bg-blue-50 text-blue-700':'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
            ⚖ Standard (100pts + 10pts/kg up to 8kg)
          </button>
          <div className="flex-1 p-4 rounded-xl border-2 border-gray-100 bg-gray-50 text-left opacity-60 cursor-not-allowed">
            <p className="text-sm font-semibold text-gray-400">📸 Self Weighing with Pic</p>
            <p className="text-xs text-gray-400 mt-1">Coming soon</p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-sm font-black tracking-widest uppercase mb-4 pb-3 border-b border-gray-100" style={{ color: SNZ_BLUE }}>Categories</h3>
        <div className="flex flex-wrap gap-3">
          {CATEGORIES_ALL.map(cat => {
            const on = (form.categories||[]).includes(cat)
            return (
              <button key={cat} type="button" onClick={() => toggleCat(cat)}
                className={`px-4 py-2 rounded-lg text-sm font-bold border-2 transition ${on?'border-blue-500 bg-blue-50 text-blue-700':'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                {cat}
              </button>
            )
          })}
        </div>
        <p className="text-xs text-gray-400 mt-2">Select all divisions this competition runs. Leaderboard will show separate rankings per division.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
        <h3 className="text-sm font-black tracking-widest uppercase pb-3 border-b border-gray-100" style={{ color: SNZ_BLUE }}>Settings</h3>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={!!form.public_leaderboard} onChange={e => set('public_leaderboard')(e.target.checked)} className="w-5 h-5" />
          <div>
            <p className="text-sm font-semibold text-gray-700">Live public leaderboard</p>
            <p className="text-xs text-gray-400">Show leaderboard publicly during the competition (not just after it closes)</p>
          </div>
        </label>
        <div className="border-t border-gray-100 pt-4 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Entry Fees by Category (NZD)</label>
            <p className="text-xs text-gray-400">$0 = free. Min $1.00 if charging. Competitors pay via Stripe after registering.</p>
          </div>

          {/* Early bird cutoff */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <span className="text-amber-500 text-lg flex-shrink-0 mt-0.5">🐦</span>
              <div className="flex-1">
                <label className="block text-xs font-bold text-amber-800 uppercase tracking-wider mb-1">Early Bird Cutoff Date</label>
                <p className="text-xs text-amber-700 mb-2">Early bird prices apply until end of this date. Leave blank to disable.</p>
                <input type="date"
                  value={form.early_bird_cutoff ? form.early_bird_cutoff.slice(0, 10) : ''}
                  onChange={e => set('early_bird_cutoff')(e.target.value || null)}
                  className="border border-amber-300 bg-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300" />
                {form.early_bird_cutoff && (
                  <p className="text-xs text-amber-600 mt-1.5 font-semibold">
                    Regular pricing from {new Date(form.early_bird_cutoff + 'T23:59:59').toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Fee grid */}
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_110px_110px] gap-3 items-center">
              <span className="text-xs font-bold text-gray-400 uppercase tracking-wide">Category</span>
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wide text-center">Standard</span>
              <span className="text-xs font-bold text-amber-500 uppercase tracking-wide text-center">🐦 Early Bird</span>
            </div>
            {(form.categories || ['Open']).map(cat => {
              const fees = form.category_fees || {}
              const feeVal = fees[cat]
              const stdCents = typeof feeVal === 'object' && feeVal !== null ? (feeVal.standard || 0) : (feeVal || 0)
              const ebCents  = typeof feeVal === 'object' && feeVal !== null ? (feeVal.early_bird ?? null) : null

              const setStd = (c) => {
                const cur = fees[cat]
                const existing = typeof cur === 'object' && cur !== null ? cur : {}
                set('category_fees')({ ...fees, [cat]: { ...existing, standard: c } })
              }
              const setEb = (c) => {
                const cur = fees[cat]
                const existing = typeof cur === 'object' && cur !== null ? cur : { standard: stdCents }
                set('category_fees')({ ...fees, [cat]: c != null ? { ...existing, early_bird: c } : { standard: existing.standard } })
              }

              return (
                <div key={cat} className="grid grid-cols-[1fr_110px_110px] gap-3 items-center">
                  <span className="text-sm font-bold text-gray-700">{cat}</span>

                  {/* Standard price */}
                  <div className="flex items-center gap-1">
                    <span className="text-gray-400 font-bold text-sm">$</span>
                    <input type="number" min="0" step="1"
                      value={stdCents > 0 ? stdCents / 100 : ''}
                      placeholder="0"
                      onChange={e => setStd(Math.round(parseFloat(e.target.value || 0) * 100))}
                      onBlur={e => { const c = Math.round(parseFloat(e.target.value || 0) * 100); if (c > 0 && c < 100) setStd(100) }}
                      className="flex-1 min-w-0 border border-gray-300 rounded-lg px-2 py-1.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-300"
                      style={{ MozAppearance: 'textfield', WebkitAppearance: 'none' }} />
                  </div>

                  {/* Early bird price */}
                  <div className="flex items-center gap-1">
                    <span className="text-amber-400 font-bold text-sm">$</span>
                    <input type="number" min="0" step="1"
                      value={ebCents != null && ebCents > 0 ? ebCents / 100 : ''}
                      placeholder="—"
                      onChange={e => {
                        if (!e.target.value) { setEb(null); return }
                        setEb(Math.round(parseFloat(e.target.value) * 100))
                      }}
                      onBlur={e => {
                        if (!e.target.value) return
                        const c = Math.round(parseFloat(e.target.value) * 100)
                        if (c > 0 && c < 100) setEb(100)
                      }}
                      className="flex-1 min-w-0 border border-amber-200 rounded-lg px-2 py-1.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-300 bg-amber-50/50"
                      style={{ MozAppearance: 'textfield', WebkitAppearance: 'none' }} />
                  </div>
                </div>
              )
            })}
          </div>
          <p className="text-xs text-gray-400">Amounts in NZD. Early bird price applies until end of cutoff date — leave blank to charge standard price for all entries.</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-sm font-black tracking-widest uppercase mb-4 pb-3 border-b border-gray-100" style={{ color: SNZ_BLUE }}>Sponsors</h3>
        <p className="text-xs text-gray-400 mb-4">Upload up to 3 sponsor logos — shown at the bottom of all competition screens. Use transparent PNG or white-background images for best results.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[['sponsor1_url','Sponsor 1'],['sponsor2_url','Sponsor 2'],['sponsor3_url','Sponsor 3']].map(([key, label]) => (
            <SponsorUploadSlot key={key} label={label} url={form[key]} compId={comp.id}
              onUploaded={url => { set(key)(url); setComp(c => ({ ...c, [key]: url })) }}
              onRemoved={() => { set(key)(null); setComp(c => ({ ...c, [key]: null })) }}
              showToast={showToast} />
          ))}
        </div>
      </div>

      {/* Merch */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <h3 className="text-sm font-black tracking-widest uppercase mb-4 pb-3 border-b border-gray-100" style={{ color: SNZ_BLUE }}>Merchandise</h3>
        <label className="flex items-center gap-3 cursor-pointer mb-4">
          <input type="checkbox" checked={!!form.merch_enabled} onChange={e => set('merch_enabled')(e.target.checked)} className="w-5 h-5" />
          <div>
            <p className="text-sm font-semibold text-gray-700">Offer merchandise with this competition</p>
            <p className="text-xs text-gray-400">Competitors can select garments and sizes when registering</p>
          </div>
        </label>

        {form.merch_enabled && (
          <div className="space-y-4 pt-3 border-t border-gray-100">
            {/* Merch types */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Garment Types</label>
              <div className="flex gap-3 flex-wrap">
                {['jacket','tshirt'].map(type => {
                  const selected = (form.merch_types || []).includes(type)
                  return (
                    <label key={type} className={`flex items-center gap-2 cursor-pointer px-4 py-2 rounded-xl border-2 transition ${selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <input type="checkbox" className="hidden" checked={selected}
                        onChange={() => {
                          const cur = form.merch_types || []
                          set('merch_types')(selected ? cur.filter(t => t !== type) : [...cur, type])
                        }} />
                      <span className="text-sm font-bold capitalize text-gray-700">{type === 'tshirt' ? 'T-Shirt' : 'Jacket'}</span>
                    </label>
                  )
                })}
              </div>
            </div>

            {/* Merch sizes */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Available Sizes</label>
              <div className="flex gap-2 flex-wrap">
                {['XS','S','M','L','XL','2XL','3XL'].map(size => {
                  const selected = (form.merch_sizes || []).includes(size)
                  return (
                    <label key={size} className={`cursor-pointer px-3 py-1.5 rounded-lg border-2 text-sm font-bold transition ${selected ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                      <input type="checkbox" className="hidden" checked={selected}
                        onChange={() => {
                          const cur = form.merch_sizes || []
                          const order = ['XS','S','M','L','XL','2XL','3XL']
                          const next = selected ? cur.filter(s => s !== size) : [...cur, size]
                          set('merch_sizes')(next.sort((a,b) => order.indexOf(a) - order.indexOf(b)))
                        }} />
                      {size}
                    </label>
                  )
                })}
              </div>
            </div>

            {/* Merch cutoff */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Order Cutoff Date</label>
              <p className="text-xs text-gray-400 mb-2">Orders after this date are flagged as late and cannot be guaranteed</p>
              <input type="date" value={form.merch_cutoff || ''} onChange={e => set('merch_cutoff')(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>
        )}
      </div>

      <button onClick={save} disabled={saving}
        className="w-full py-3 rounded-xl font-black text-white text-sm disabled:opacity-50"
        style={{ background: SNZ_BLUE }}>
        {saving ? 'Saving…' : 'Save Competition'}
      </button>
    </div>
  )
}

// ── Fish Tab ─────────────────────────────────────────────────────────────────
function FishTab({ fish, comp, onOpenPicker }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{fish.length} species on the fish list</p>
        <button onClick={onOpenPicker}
          className="px-4 py-2 rounded-lg text-sm font-bold text-white"
          style={{ background: SNZ_BLUE }}>Edit Fish List</button>
      </div>
      {fish.length === 0 && (
        <div className="text-center py-12 bg-gray-50 rounded-xl text-gray-400">
          <div className="text-4xl mb-2">🐟</div>
          <p>No fish added yet. Click Edit Fish List to get started.</p>
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 sm:gap-3">
        {fish.map(f => (
          <div key={f.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            {f.photo_url
              ? <img src={f.photo_url} alt={f.species_name} className="w-full h-28 object-cover" />
              : <div className="w-full h-28 bg-gray-50 flex items-center justify-center text-3xl">🐟</div>}
            <div className="p-3">
              <p className="font-bold text-sm text-gray-900">{f.species_name}</p>
              <p className="text-xs text-gray-400">
                {comp.scoring_mode === 'standard' ? `${f.points||100}pts + weight` : `${f.points}pts`}
              </p>
              {f.allow_multiples && <p className="text-xs text-blue-500">Up to {f.max_count}×</p>}
              {comp.scoring_mode === 'standard' && f.weigh_separately && (
                <p className="text-xs text-amber-700 font-bold mt-0.5">⚖ Weigh separately</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Team Edit Modal ────────────────────────────────────────────────────────────
const emptyMember = { name:'', email:'', phone:'', club:'', gender:'', dob:'', emergency_contact:'', emergency_phone:'', fit_to_dive:false }

// ── Member Section (outside TeamModal to prevent remount on keystroke) ────────
function MemberSection({ label, data, setField }) {
  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
      <h4 className="text-xs font-black tracking-widest uppercase mb-3" style={{ color: SNZ_BLUE }}>{label}</h4>
      <div className="grid grid-cols-2 gap-3">
        {[['name','Full Name',true],['email','Email',false],['phone','Phone',false],['club','Club',false]].map(([k,lbl,req]) => (
          <div key={k} className={k==='name'?'col-span-2':''}>
            <label className="block text-xs font-semibold text-gray-500 mb-1">{lbl}{req&&<span className="text-red-400"> *</span>}</label>
            <input value={data[k]||''} onChange={e => setField(k)(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
        ))}
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Gender</label>
          <select value={data.gender||''} onChange={e => setField('gender')(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
            <option value="">—</option>
            {['Male','Female','Non-binary','Prefer not to say'].map(g => <option key={g}>{g}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Date of Birth</label>
          <input type="date" value={data.dob||''} onChange={e => setField('dob')(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Emergency Contact</label>
          <input value={data.emergency_contact||''} onChange={e => setField('emergency_contact')(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1">Emergency Phone</label>
          <input value={data.emergency_phone||''} onChange={e => setField('emergency_phone')(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
        </div>
        <div className="col-span-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={!!data.fit_to_dive} onChange={e => setField('fit_to_dive')(e.target.checked)} className="w-4 h-4" />
            <span className="text-xs font-semibold text-gray-600">Confirmed fit to dive</span>
          </label>
        </div>
      </div>
    </div>
  )
}

function TeamModal({ comp, team, members: existingMembers, onClose, onSaved, showToast }) {
  const isNew = !team
  const [teamName, setTeamName] = useState(team?.team_name || '')
  const [category, setCategory] = useState(team?.category || (comp.categories?.[0] || 'Open'))
  const [boatName, setBoatName] = useState(team?.boat_name || '')
  const [boatDetails, setBoatDetails] = useState(team?.boat_details || '')
  const [p1, setP1] = useState(existingMembers?.[0] ? { ...existingMembers[0] } : { ...emptyMember })
  const [p2, setP2] = useState(existingMembers?.[1] ? { ...existingMembers[1] } : { ...emptyMember })
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoUrl, setPhotoUrl] = useState(team?.team_photo_url || null)
  const [pendingPhoto, setPendingPhoto] = useState(null)
  const [pendingPhotoPreview, setPendingPhotoPreview] = useState(null)

  const set1 = k => v => setP1(m => ({ ...m, [k]: v }))
  const set2 = k => v => setP2(m => ({ ...m, [k]: v }))

  const uploadTeamPhoto = async (file, targetId) => {
    const tid = targetId || team?.id
    if (!tid) return
    setUploadingPhoto(true)
    try {
      const ext = file.name.split('.').pop().toLowerCase().replace('heic','jpg')
      await supabase.storage.from('snz-media').remove([`competitions/${comp.id}/teams/${tid}.${ext}`])
      const { error } = await supabase.storage.from('snz-media').upload(
        `competitions/${comp.id}/teams/${tid}.${ext}`, file, { contentType: file.type }
      )
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('snz-media').getPublicUrl(
        `competitions/${comp.id}/teams/${tid}.${ext}`
      )
      const bustUrl = `${publicUrl}?t=${Date.now()}`
      await supabase.from('comp_teams').update({ team_photo_url: bustUrl }).eq('id', tid)
      setPhotoUrl(bustUrl)
      if (!targetId) showToast('Photo uploaded')
    } catch(err) { showToast(err.message, 'error') }
    finally { setUploadingPhoto(false) }
  }

  const handlePhotoSelect = (file) => {
    if (isNew) {
      setPendingPhoto(file)
      setPendingPhotoPreview(URL.createObjectURL(file))
    } else {
      uploadTeamPhoto(file)
    }
  }

  const save = async () => {
    if (!teamName.trim()) { showToast('Team name required', 'error'); return }
    if (!p1.name.trim()) { showToast('Diver 1 name required', 'error'); return }
    setSaving(true)
    try {
      let teamId = team?.id
      if (isNew) {
        const { data, error } = await supabase.from('comp_teams')
          .insert({ competition_id: comp.id, team_name: teamName.trim(), category,
            boat_name: boatName.trim() || null, boat_details: boatDetails.trim() || null })
          .select('id').single()
        if (error) throw error
        teamId = data.id
        if (pendingPhoto) await uploadTeamPhoto(pendingPhoto, teamId)
      } else {
        const { error } = await supabase.from('comp_teams')
          .update({ team_name: teamName.trim(), category,
            boat_name: boatName.trim() || null, boat_details: boatDetails.trim() || null })
          .eq('id', teamId)
        if (error) throw error
      }

      // Upsert members
      for (const [idx, mem] of [[0, p1], [1, p2]]) {
        if (!mem.name.trim()) continue
        const existing = existingMembers?.[idx]
        const payload = { ...mem, team_id: teamId, competition_id: comp.id }
        delete payload.id
        delete payload.created_at
        if (existing?.id) {
          await supabase.from('comp_team_members').update(payload).eq('id', existing.id)
        } else {
          await supabase.from('comp_team_members').insert(payload)
        }
      }
      onSaved()
      onClose()
    } catch(err) { showToast(err.message, 'error') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto" style={{ background:'rgba(0,0,0,0.6)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-xl my-8 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-black text-gray-900">{isNew ? 'Add Team' : 'Edit Team'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
        </div>
        <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">

          {/* Team details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Team Name <span className="text-red-400">*</span></label>
              <input value={teamName} onChange={e => setTeamName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                placeholder="e.g. The Reef Runners" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                {(comp.categories?.length > 0 ? comp.categories : CATEGORIES_ALL).map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Team Photo</label>
              <div className="flex items-center gap-2">
                {(photoUrl || pendingPhotoPreview)
                  ? <img src={pendingPhotoPreview || photoUrl} alt="team" className="w-10 h-10 rounded-full object-cover border border-gray-200" />
                  : <div className="w-10 h-10 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center text-lg">👥</div>
                }
                <label className="cursor-pointer text-xs font-bold px-2.5 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">
                  {uploadingPhoto ? '…' : (photoUrl || pendingPhotoPreview) ? '📷 Replace' : '📷 Upload'}
                  <input type="file" accept="image/*" className="hidden" disabled={uploadingPhoto}
                    onChange={e => e.target.files[0] && handlePhotoSelect(e.target.files[0])} />
                </label>
                {isNew && pendingPhotoPreview && <span className="text-xs text-gray-400 italic">saves on submit</span>}
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Boat Name</label>
              <input value={boatName} onChange={e => setBoatName(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                placeholder="e.g. Sea Breeze" maxLength={80} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Boat Details</label>
              <input value={boatDetails} onChange={e => setBoatDetails(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                placeholder="e.g. 5m aluminium, reg. NZ1234" maxLength={200} />
            </div>
          </div>

          <MemberSection label="Diver 1" data={p1} setField={set1} />
          <MemberSection label="Diver 2" data={p2} setField={set2} />

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-300 text-sm font-bold text-gray-600">Cancel</button>
            <button onClick={save} disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
              style={{ background: SNZ_BLUE }}>
              {saving ? 'Saving…' : isNew ? 'Add Team' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Teams Tab ─────────────────────────────────────────────────────────────────
function TeamsTab({ teams, members, weighins, comp, onRefresh, showToast }) {
  const [editingTeam, setEditingTeam] = useState(null)  // team object or 'new'
  const [expandedTeam, setExpandedTeam] = useState(null)

  const exportMerch = () => {
    const rows = [['Team', 'Category', 'Diver', 'Email', 'Garment', 'Size', 'Late Order', 'Registered']]
    const esc = v => { const s = String(v||''); return s.includes(',') ? `"${s}"` : s }
    teams.forEach(t => {
      const mems = members.filter(m => m.team_id === t.id)
      mems.forEach(m => {
        if (m.merch_type && m.merch_size) {
          rows.push([
            t.team_name, t.category, m.name, m.email,
            m.merch_type === 'tshirt' ? 'T-Shirt' : 'Jacket',
            m.merch_size,
            m.merch_late ? 'YES - LATE' : 'No',
            new Date(t.registered_at || t.created_at).toLocaleDateString('en-NZ')
          ].map(esc).join(','))
        }
      })
    })
    if (rows.length === 1) { alert('No merch orders found'); return }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${comp.name.replace(/\s+/g,'-')}-merch-orders.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const exportCSV = () => {
    const rows = [['Team', 'Category', 'Boat Name', 'Boat Details', 'Registered', 'Diver 1', 'Email 1', 'Phone 1', 'Club 1', 'Gender 1', 'DOB 1', 'Emergency 1', 'Emergency Phone 1', 'Fit 1', 'Diver 2', 'Email 2', 'Phone 2', 'Club 2', 'Gender 2', 'DOB 2', 'Emergency 2', 'Emergency Phone 2', 'Fit 2']]
    teams.forEach(t => {
      const mems = members.filter(m => m.team_id === t.id)
      const [m1, m2] = [mems[0] || {}, mems[1] || {}]
      const esc = v => { const s = String(v||''); return s.includes(',') ? `"${s}"` : s }
      rows.push([t.team_name, t.category, t.boat_name, t.boat_details, new Date(t.registered_at).toLocaleDateString('en-NZ'),
        m1.name, m1.email, m1.phone, m1.club, m1.gender, m1.dob, m1.emergency_contact, m1.emergency_phone, m1.fit_to_dive ? 'Yes' : 'No',
        m2.name, m2.email, m2.phone, m2.club, m2.gender, m2.dob, m2.emergency_contact, m2.emergency_phone, m2.fit_to_dive ? 'Yes' : 'No',
      ].map(esc).join(','))
    })
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${comp.name.replace(/\s+/g,'-')}-teams.csv`
    a.click()
    URL.revokeObjectURL(a.href)
    showToast(`Exported ${teams.length} teams`)
  }

  const deleteTeam = async (teamId) => {
    if (!confirm('Delete this team? This also removes their weigh-in data.')) return
    await supabase.from('comp_weighins').delete().eq('team_id', teamId)
    await supabase.from('comp_team_members').delete().eq('team_id', teamId)
    await supabase.from('comp_teams').delete().eq('id', teamId)
    onRefresh()
    showToast('Team deleted')
  }

  return (
    <div>
      {editingTeam && (
        <TeamModal
          comp={comp}
          team={editingTeam === 'new' ? null : editingTeam}
          members={editingTeam === 'new' ? [] : members.filter(m => m.team_id === editingTeam.id)}
          onClose={() => setEditingTeam(null)}
          onSaved={() => { onRefresh(); setEditingTeam(null); showToast(editingTeam === 'new' ? 'Team added' : 'Team updated') }}
          showToast={showToast}
        />
      )}

      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm text-gray-500">{teams.length} teams registered</p>
          {teams.filter(t => t.status === 'pending_payment').length > 0 && (
            <span className="text-xs font-black px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-300">
              ⚠ {teams.filter(t => t.status === 'pending_payment').length} unpaid
            </span>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setEditingTeam('new')}
            className="px-4 py-2 rounded-lg text-sm font-bold text-white"
            style={{ background: SNZ_BLUE }}>+ Add Team</button>
          <button onClick={exportCSV}
            className="px-4 py-2 rounded-lg text-sm font-bold border border-gray-300 text-gray-700 hover:bg-gray-50 transition">
            ↓ Export CSV
          </button>
          {comp.merch_enabled && (
            <button onClick={exportMerch}
              className="px-4 py-2 rounded-lg text-sm font-bold border border-purple-300 text-purple-700 hover:bg-purple-50 transition">
              ↓ Merch Orders
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {teams.map(t => {
          const mems = members.filter(m => m.team_id === t.id)
          const isExpanded = expandedTeam === t.id
          return (
            <div key={t.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
              <div className="flex items-center gap-3 px-4 py-3">
                {/* Team photo */}
                {t.team_photo_url
                  ? <img src={t.team_photo_url} alt={t.team_name} className="w-10 h-10 rounded-full object-cover border border-gray-200 flex-shrink-0" />
                  : <div className="w-10 h-10 rounded-full bg-gray-100 border-2 border-dashed border-gray-200 flex items-center justify-center text-lg flex-shrink-0">👥</div>
                }
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-gray-900 text-sm">{t.team_name}</span>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">{t.category}</span>
                    {t.status === 'pending_payment' && (
                      <span className="text-xs font-black px-2 py-0.5 rounded-full bg-red-100 text-red-700 border border-red-300 uppercase tracking-wide">⚠ Unpaid</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{mems.map(m => m.name).join(' & ') || 'No members'}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => setExpandedTeam(isExpanded ? null : t.id)}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold border border-gray-300 text-gray-500 hover:bg-gray-50">
                    {isExpanded ? 'Hide' : 'Details'}
                  </button>
                  <button onClick={() => setEditingTeam(t)}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold border border-gray-300 text-gray-700 hover:bg-gray-50">Edit</button>
                  <button onClick={() => deleteTeam(t.id)}
                    className="px-2.5 py-1 rounded-lg text-xs font-bold border border-red-200 text-red-500 hover:bg-red-50">Delete</button>
                </div>
              </div>

              {/* Expanded member details */}
              {isExpanded && (
                <div className="border-t border-gray-100 px-4 py-4 bg-gray-50">
                  {(t.boat_name || t.boat_details) && (
                    <div className="mb-3 bg-white rounded-xl border border-gray-200 p-3 text-xs text-gray-600">
                      <p className="text-xs font-black tracking-widest uppercase mb-2" style={{ color: SNZ_BLUE }}>Boat</p>
                      {t.boat_name && <p><span className="font-semibold text-gray-700">Name:</span> {t.boat_name}</p>}
                      {t.boat_details && <p><span className="font-semibold text-gray-700">Details:</span> {t.boat_details}</p>}
                    </div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {mems.map((m, i) => (
                      <div key={m.id} className="bg-white rounded-xl border border-gray-200 p-3">
                        <p className="text-xs font-black tracking-widest uppercase mb-2" style={{ color: SNZ_BLUE }}>Diver {i+1}</p>
                        <div className="space-y-1 text-xs text-gray-600">
                          {m.name && <p><span className="font-semibold text-gray-700">Name:</span> {m.name}</p>}
                          {m.email && <p><span className="font-semibold text-gray-700">Email:</span> {m.email}</p>}
                          {m.phone && <p><span className="font-semibold text-gray-700">Phone:</span> {m.phone}</p>}
                          {m.club && <p><span className="font-semibold text-gray-700">Club:</span> {m.club}</p>}
                          {m.gender && <p><span className="font-semibold text-gray-700">Gender:</span> {m.gender}</p>}
                          {m.dob && <p><span className="font-semibold text-gray-700">DOB:</span> {m.dob}</p>}
                          {m.emergency_contact && <p><span className="font-semibold text-gray-700">Emergency:</span> {m.emergency_contact} {m.emergency_phone}</p>}
                          <p><span className="font-semibold text-gray-700">Fit to dive:</span> {m.fit_to_dive ? '✓ Yes' : '✗ Not confirmed'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {teams.length === 0 && (
          <div className="text-center py-12 bg-white border border-gray-200 rounded-xl text-gray-400">
            No teams yet — add one manually or share the registration link.
          </div>
        )}
      </div>
    </div>
  )
}

// ── Weigh-in Tab ─────────────────────────────────────────────────────────────
function WeighInTab({ comp, teams, members, fish, weighins: initialWeighins, onRefresh, showToast }) {
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [weights, setWeights] = useState({})  // key: `${fishId}-${instance}` → kg value
  const [teamCatchPhotoUrl, setTeamCatchPhotoUrl] = useState(null)
  const [uploadingCatch, setUploadingCatch] = useState(false)
  const [saving, setSaving] = useState(false)
  const [localWeighins, setLocalWeighins] = useState(initialWeighins)

  const refreshWeighins = async () => {
    const { data } = await supabase.from('comp_weighins').select('*').eq('competition_id', comp.id)
    setLocalWeighins(data || [])
  }

  const teamWeighins = localWeighins.filter(w => w.team_id === selectedTeam?.id)

  const getWeight = (fishId, instance=1) => {
    const existing = teamWeighins.find(w => w.fish_id === fishId && w.instance === instance)
    return existing ? existing.weight_kg : (weights[`${fishId}-${instance}`] ?? '')
  }

  const setWeight = (fishId, instance, val) => {
    setWeights(w => ({ ...w, [`${fishId}-${instance}`]: val }))
  }

  const uploadCatchPhoto = async (file) => {
    if (!selectedTeam) return
    setUploadingCatch(true)
    try {
      const ext = file.name.split('.').pop().toLowerCase().replace('heic','jpg').replace('heif','jpg')
      const path = `competitions/${comp.id}/catches/${selectedTeam.id}.${ext}`
      await supabase.storage.from('snz-media').remove([path])
      const { error } = await supabase.storage.from('snz-media').upload(path, file, { contentType: file.type })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('snz-media').getPublicUrl(path)
      setTeamCatchPhotoUrl(publicUrl)
      // Update all existing localWeighins for this team with the catch photo
      if (teamWeighins.length > 0) {
        await supabase.from('comp_weighins').update({ catch_photo_url: publicUrl })
          .eq('competition_id', comp.id).eq('team_id', selectedTeam.id)
        await refreshWeighins()
        showToast('Catch photo saved')
      } else {
        showToast('Photo ready — save weigh-in to attach it')
      }
    } catch (err) { showToast(err.message, 'error') }
    finally { setUploadingCatch(false) }
  }

  const saveWeighIn = async () => {
    if (!selectedTeam) return
    setSaving(true)
    try {
      const rows = []

      if (comp.scoring_mode === 'standard') {
        // Insert newly ticked species (not already saved)
        for (const f of fish) {
          const instances = f.allow_multiples ? f.max_count : 1
          for (let inst = 1; inst <= instances; inst++) {
            const key = `${f.id}-${inst}`
            if (!(key in weights)) continue  // not ticked this session
            const alreadySaved = teamWeighins.find(w => w.fish_id === f.id && w.instance === inst && !w.is_bulk)
            if (alreadySaved) continue  // already in DB, skip
            if (f.weigh_separately) {
              const kg = parseFloat(weights[key]) || 0
              rows.push({
                competition_id: comp.id, team_id: selectedTeam.id,
                fish_id: f.id, fish_name: f.species_name,
                weight_kg: kg || null, points_awarded: calcPoints(f, kg, 'standard'),
                instance: inst, is_bulk: false,
                catch_photo_url: teamCatchPhotoUrl || null,
              })
            } else {
              rows.push({
                competition_id: comp.id, team_id: selectedTeam.id,
                fish_id: f.id, fish_name: f.species_name,
                weight_kg: null, points_awarded: f.points || 100,
                instance: inst, is_bulk: false,
                catch_photo_url: teamCatchPhotoUrl || null,
              })
            }
          }
        }

        // Handle bulk weight — upsert (update existing bulk row or insert new)
        const bulkKg = parseFloat(weights['__bulk__'])
        if (!isNaN(bulkKg) && bulkKg > 0) {
          const existingBulk = teamWeighins.find(w => w.is_bulk)
          const bulkBonus = calcBulkBonus(bulkKg)
          if (existingBulk) {
            await supabase.from('comp_weighins')
              .update({ weight_kg: bulkKg, points_awarded: bulkBonus })
              .eq('id', existingBulk.id)
          } else {
            // Insert bulk row separately (fish_id is null — not a species row)
            const { error: bulkErr } = await supabase.from('comp_weighins').insert({
              competition_id: comp.id, team_id: selectedTeam.id,
              fish_name: 'Bulk weight',
              weight_kg: bulkKg, points_awarded: bulkBonus,
              instance: 1, is_bulk: true,
              catch_photo_url: teamCatchPhotoUrl || null,
            })
            if (bulkErr) throw bulkErr
          }
        }

      } else {
        // Bingo: insert newly ticked only
        for (const f of fish) {
          const instances = f.allow_multiples ? f.max_count : 1
          for (let inst = 1; inst <= instances; inst++) {
            const key = `${f.id}-${inst}`
            if (!(key in weights)) continue
            const alreadySaved = teamWeighins.find(w => w.fish_id === f.id && w.instance === inst)
            if (alreadySaved) continue
            rows.push({
              competition_id: comp.id, team_id: selectedTeam.id,
              fish_id: f.id, fish_name: f.species_name,
              weight_kg: null, points_awarded: f.points || 100,
              instance: inst, is_bulk: false,
              catch_photo_url: teamCatchPhotoUrl || null,
            })
          }
        }
      }

      if (rows.length > 0) {
        const { error: insErr } = await supabase.from('comp_weighins').insert(rows)
        if (insErr) throw insErr
      } else if (!weights['__bulk__'] || isNaN(parseFloat(weights['__bulk__']))) {
        showToast('Nothing to save — tick at least one species', 'error')
        return
      }
      setWeights({})
      setTeamCatchPhotoUrl(null)
      await refreshWeighins()
      showToast('Weigh-in saved')
    } catch (err) {
      showToast(err.message, 'error')
      await refreshWeighins()
    }
    finally { setSaving(false) }
  }

  const deleteEntry = async (weighinId) => {
    await supabase.from('comp_weighins').delete().eq('id', weighinId)
    await refreshWeighins()
    showToast('Entry removed')
  }

  const exportWeighInCSV = () => {
    const rows = [['Team','Category','Fish','Instance','Weight (kg)','Points','Weighed At']]
    localWeighins.forEach(w => {
      const team = teams.find(t => t.id === w.team_id)
      const esc = v => { const s = String(v||''); return s.includes(',') ? `"${s}"` : s }
      rows.push([team?.team_name, team?.category, w.fish_name, w.instance, w.weight_kg, w.points_awarded, new Date(w.weighed_at).toLocaleString('en-NZ')].map(esc).join(','))
    })
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${comp.name.replace(/\s+/g,'-')}-weighins.csv`
    a.click()
    URL.revokeObjectURL(a.href)
    showToast('Weigh-in data exported')
  }

  const isStandard = comp.scoring_mode === 'standard'

  // For display: which fish are ticked in current state
  const tickedKeys = new Set(Object.keys(weights))
  const savedFishIds = new Set(teamWeighins.filter(w => !w.is_bulk).map(w => `${w.fish_id}-${w.instance}`))

  // Saved bulk row
  const savedBulk = teamWeighins.find(w => w.is_bulk)
  const savedTotal = teamWeighins.reduce((s, w) => s + (w.points_awarded || 0), 0)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          {isStandard ? 'Tick species claimed, enter bulk weight below. Separately-weighed fish (e.g. Kingfish) get their own weight entry.' : 'Tick each species claimed. Points are fixed.'}
        </p>
        <button onClick={exportWeighInCSV}
          className="px-4 py-2 rounded-lg text-sm font-bold border border-gray-300 text-gray-700 hover:bg-gray-50 transition">
          ↓ Export CSV
        </button>
      </div>

      {/* Team selector */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-5">
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Select Team</label>
        <div className="flex flex-wrap gap-2">
          {teams.map(t => {
            const tw = localWeighins.filter(w => w.team_id === t.id)
            const pts = tw.reduce((s,w)=>s+(w.points_awarded||0),0)
            const isSelected = selectedTeam?.id === t.id
            return (
              <button key={t.id} onClick={() => { setSelectedTeam(t); setWeights({}); setTeamCatchPhotoUrl(null) }}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 transition ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                {t.team_photo_url
                  ? <img src={t.team_photo_url} alt={t.team_name} className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-gray-200" />
                  : <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm flex-shrink-0">👥</div>
                }
                <div className="text-left">
                  <div className={`text-sm font-semibold ${isSelected ? 'text-blue-700' : 'text-gray-700'}`}>{t.team_name}</div>
                  {pts > 0 && <div className="text-xs font-bold text-green-600">{pts} pts</div>}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {selectedTeam && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          {/* Team header */}
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50">
            <div>
              <h3 className="font-black text-gray-900">{selectedTeam.team_name}</h3>
              <p className="text-xs text-gray-400">{members.filter(m => m.team_id === selectedTeam.id).map(m => m.name).join(' & ')}</p>
            </div>
            {savedTotal > 0 && <div className="text-2xl font-black" style={{ color: SNZ_BLUE }}>{savedTotal} pts</div>}
          </div>

          {/* Catch photo */}
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-4">
            <div className="flex-shrink-0">
              {teamCatchPhotoUrl || savedBulk?.catch_photo_url ? (
                <img src={teamCatchPhotoUrl || savedBulk?.catch_photo_url} alt="Catch"
                  className="w-20 h-16 object-cover rounded-xl border border-gray-200 cursor-pointer"
                  onClick={() => window.open(teamCatchPhotoUrl || savedBulk?.catch_photo_url, '_blank')} />
              ) : (
                <div className="w-20 h-16 rounded-xl bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center text-2xl">📷</div>
              )}
            </div>
            <div>
              <p className="text-sm font-bold text-gray-700">Team catch photo</p>
              <p className="text-xs text-gray-400 mb-2">One photo of the full catch</p>
              <label className={`cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-300 text-gray-600 hover:bg-white transition ${uploadingCatch ? 'opacity-50' : ''}`}>
                {uploadingCatch ? 'Uploading…' : teamCatchPhotoUrl || savedBulk?.catch_photo_url ? '📷 Replace' : '📷 Add photo'}
                <input type="file" accept="image/*" capture="environment" className="hidden" disabled={uploadingCatch}
                  onChange={e => e.target.files[0] && uploadCatchPhoto(e.target.files[0])} />
              </label>
            </div>
          </div>

          <div className="p-5">
            {/* Fish claim list */}
            <div className="space-y-2 mb-5">
              {fish.map(f => {
                const instances = f.allow_multiples ? f.max_count : 1
                return Array.from({ length: instances }, (_, i) => i + 1).map(inst => {
                  const key = `${f.id}-${inst}`
                  const savedEntry = teamWeighins.find(w => w.fish_id === f.id && w.instance === inst && !w.is_bulk)
                  const isTicked = !!savedEntry || key in weights
                  const isSepWeigh = isStandard && f.weigh_separately

                  return (
                    <div key={key} className={`flex items-center gap-3 p-3 rounded-xl border-2 transition ${
                      isTicked ? (isSepWeigh ? 'border-amber-400 bg-amber-50' : 'border-green-400 bg-green-50') : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}>
                      {/* Tick checkbox */}
                      <button type="button" onClick={() => {
                        if (savedEntry) return  // already saved, delete to untick
                        if (key in weights) {
                          const w = { ...weights }; delete w[key]; setWeights(w)
                        } else {
                          setWeights(w => ({ ...w, [key]: isSepWeigh ? '' : true }))
                        }
                      }}
                        className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center flex-shrink-0 transition font-black text-sm ${
                          isTicked ? (isSepWeigh ? 'border-amber-500 bg-amber-500 text-white' : 'border-green-500 bg-green-500 text-white') : 'border-gray-300 text-transparent hover:border-gray-400'
                        }`}>✓</button>

                      {/* Fish photo + name */}
                      {f.photo_url
                        ? <img src={f.photo_url} alt={f.species_name} className="w-10 h-8 object-cover rounded flex-shrink-0" />
                        : <div className="w-10 h-8 bg-gray-100 rounded flex items-center justify-center text-lg flex-shrink-0">🐟</div>
                      }
                      <div className="flex-1 min-w-0">
                        <span className="font-semibold text-gray-900 text-sm">
                          {f.species_name}{f.allow_multiples ? ` #${inst}` : ''}
                        </span>
                        {isSepWeigh && <span className="ml-2 text-xs font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">Weigh separately</span>}
                        {!isStandard && isTicked && (
                          <span className="ml-2 text-xs font-bold" style={{ color: SNZ_BLUE }}>{f.points || 100} pts</span>
                        )}
                        {isStandard && savedEntry && (
                          <span className="ml-2 text-xs text-green-600 font-semibold">✓ saved · {savedEntry.points_awarded} pts</span>
                        )}
                      </div>

                      {/* Weight input for separately-weighed fish */}
                      {isStandard && isSepWeigh && isTicked && !savedEntry && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <input type="number" step="0.01" min="0"
                            value={typeof weights[key] === 'string' ? weights[key] : ''}
                            onChange={e => setWeights(w => ({ ...w, [key]: e.target.value }))}
                            placeholder="kg"
                            className="w-20 border border-amber-300 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-amber-300" />
                          <span className="text-xs text-gray-400">kg</span>
                          {parseFloat(weights[key]) > 0 && (
                            <span className="text-xs font-black min-w-[48px] text-right" style={{ color: SNZ_BLUE }}>
                              {calcPoints(f, weights[key], 'standard')}pts
                            </span>
                          )}
                        </div>
                      )}
                      {isStandard && isSepWeigh && savedEntry && (
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-sm font-bold text-gray-700">{savedEntry.weight_kg} kg</span>
                          <button onClick={() => deleteEntry(savedEntry.id)} className="text-red-400 hover:text-red-600 text-xs font-bold">✕</button>
                        </div>
                      )}
                      {savedEntry && !isSepWeigh && (
                        <button onClick={() => deleteEntry(savedEntry.id)} className="text-red-400 hover:text-red-600 text-xs font-bold flex-shrink-0">✕</button>
                      )}
                    </div>
                  )
                })
              })}
            </div>

            {/* Bulk weight entry (standard mode only) */}
            {isStandard && (
              <div className={`rounded-xl border-2 p-4 mb-5 ${savedBulk ? 'border-blue-300 bg-blue-50' : 'border-dashed border-gray-300 bg-gray-50'}`}>
                <p className="text-sm font-black text-gray-900 mb-1">Total bulk weight of catch</p>
                <p className="text-xs text-gray-500 mb-3">Combined weight of all fish in the bin. Any fish over 8 kg must be weighed separately — only 8 kg will be counted for that fish. Fish under 8 kg go in the bin as normal.</p>
                {savedBulk ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-2xl font-black text-gray-900">{savedBulk.weight_kg} kg</span>
                      <span className="ml-3 text-lg font-black" style={{ color: SNZ_BLUE }}>+{savedBulk.points_awarded} pts</span>
                    </div>
                    <button onClick={() => deleteEntry(savedBulk.id)} className="text-red-400 hover:text-red-600 text-xs font-bold">✕ Remove</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <input type="number" step="0.01" min="0"
                      value={weights['__bulk__'] ?? ''}
                      onChange={e => setWeights(w => ({ ...w, '__bulk__': e.target.value }))}
                      placeholder="0.00"
                      className="w-28 border border-gray-300 rounded-lg px-3 py-2 text-lg font-bold text-center focus:outline-none focus:ring-2 focus:ring-blue-300" />
                    <span className="text-gray-500">kg</span>
                    {parseFloat(weights['__bulk__']) > 0 && (
                      <span className="font-black text-xl" style={{ color: SNZ_BLUE }}>
                        +{calcBulkBonus(weights['__bulk__'])} pts
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Score summary */}
            {(() => {
              const tickedCount = fish.reduce((n, f) => {
                const instances = f.allow_multiples ? f.max_count : 1
                return n + Array.from({length:instances},(_,i)=>i+1).filter(inst => {
                  const key = `${f.id}-${inst}`
                  return !!teamWeighins.find(w => w.fish_id === f.id && w.instance === inst && !w.is_bulk) || key in weights
                }).length
              }, 0)
              if (tickedCount === 0 && !savedBulk && !weights['__bulk__']) return null

              const pendingSepPts = fish.reduce((n, f) => {
                if (!f.weigh_separately) return n
                const instances = f.allow_multiples ? f.max_count : 1
                return n + Array.from({length:instances},(_,i)=>i+1).reduce((s, inst) => {
                  const key = `${f.id}-${inst}`
                  if (!(key in weights)) return s
                  return s + calcPoints(f, weights[key], 'standard')
                }, 0)
              }, 0)
              const pendingBulk = calcBulkBonus(weights['__bulk__'] || 0)
              const pendingSpecies = fish.reduce((n, f) => {
                const instances = f.allow_multiples ? f.max_count : 1
                return n + Array.from({length:instances},(_,i)=>i+1).filter(inst => `${f.id}-${inst}` in weights).length
              }, 0)
              const pendingSpeciesPts = pendingSpecies * 100

              const previewTotal = savedTotal + (isStandard
                ? pendingSpeciesPts + pendingSepPts + pendingBulk
                : pendingSpecies * 100)
              const hasPending = pendingSpecies > 0 || (weights['__bulk__'] && parseFloat(weights['__bulk__']) > 0)

              return (
                <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600 space-y-0.5">
                      {savedTotal > 0 && <div className="text-green-600 font-semibold">✓ Saved: {savedTotal} pts</div>}
                      {hasPending && <div className="text-amber-600 font-semibold">Pending: +{isStandard ? pendingSpeciesPts + pendingSepPts + pendingBulk : pendingSpecies * 100} pts</div>}
                    </div>
                    <div className="text-3xl font-black" style={{ color: SNZ_BLUE }}>{previewTotal} pts</div>
                  </div>
                </div>
              )
            })()}

            <button onClick={saveWeighIn}
              disabled={saving || Object.keys(weights).length === 0}
              className="w-full py-3 rounded-xl font-black text-white text-sm disabled:opacity-40"
              style={{ background: SNZ_BLUE }}>
              {saving ? 'Saving…' : 'Save Weigh-in'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}


// ── Admin Leaderboard ────────────────────────────────────────────────────────
function AdminLeaderboard({ comp, teams, weighins, fish }) {
  const leaderboard = teams.map(team => {
    const tw = weighins.filter(w => w.team_id === team.id)
    const total = tw.reduce((s, w) => s + (w.points_awarded || 0), 0)
    return { ...team, total, fishCount: tw.length }
  }).sort((a, b) => b.total - a.total)

  const medals = ['🥇','🥈','🥉']
  const cats = (comp.categories||[]).length > 1 ? comp.categories : null

  const renderBoard = (board) => (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm mb-6">
      <table className="w-full min-w-[600px] text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            <th className="px-4 py-3 text-left text-xs font-bold tracking-widest text-gray-400 uppercase w-12">Rank</th>
            <th className="px-4 py-3 text-left text-xs font-bold tracking-widest text-gray-400 uppercase">Team</th>
            <th className="px-4 py-3 text-left text-xs font-bold tracking-widest text-gray-400 uppercase">Category</th>
            <th className="px-4 py-3 text-left text-xs font-bold tracking-widest text-gray-400 uppercase">Fish</th>
            <th className="px-4 py-3 text-left text-xs font-bold tracking-widest text-gray-400 uppercase">Points</th>
          </tr>
        </thead>
        <tbody>
          {board.map((t, i) => (
            <tr key={t.id} className={`border-b border-gray-100 ${i===0?'bg-amber-50':i%2===0?'bg-white':'bg-gray-50/30'}`}>
              <td className="px-4 py-3 text-lg">{medals[i] || i + 1}</td>
              <td className="px-4 py-3 font-bold text-gray-900">{t.team_name}</td>
              <td className="px-4 py-3 text-xs">
                <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 font-bold">{t.category}</span>
              </td>
              <td className="px-4 py-3 text-gray-500">{t.fishCount}</td>
              <td className="px-4 py-3 text-2xl font-black" style={{ color: SNZ_BLUE }}>{t.total}</td>
            </tr>
          ))}
          {board.length === 0 && <tr><td colSpan={5} className="px-4 py-12 text-center text-gray-400">No scores entered yet</td></tr>}
        </tbody>
      </table>
    </div>
  )

  return (
    <div>
      {cats
        ? cats.map(cat => {
            const catBoard = leaderboard.filter(t => t.category === cat)
            if (catBoard.length === 0) return null
            return (
              <div key={cat}>
                <h3 className="text-sm font-black tracking-widest uppercase mb-3" style={{ color: SNZ_BLUE }}>{cat}</h3>
                {renderBoard(catBoard)}
              </div>
            )
          })
        : renderBoard(leaderboard)
      }
    </div>
  )
}

// ── Socials Tab ──────────────────────────────────────────────────────────────
function SocialsTab({ comp, teams, members, weighins }) {
  const [generating, setGenerating] = useState(null)
  const [previews, setPreviews] = useState({}) // key: teamId → dataURL
  const [selected, setSelected] = useState(new Set()) // selected team ids for bulk export
  const [bulkExporting, setBulkExporting] = useState(false)

  // One card per TEAM that has a catch photo — deduplicate
  const catchCards = teams
    .map(team => {
      const teamWeighins = weighins.filter(w => w.team_id === team.id)
      const photoUrl = teamWeighins.find(w => w.catch_photo_url)?.catch_photo_url
      if (!photoUrl) return null
      const teamMembers = members.filter(m => m.team_id === team.id)
      const teamTotal = teamWeighins.reduce((s, w) => s + (w.points_awarded || 0), 0)
      const fishClaimed = teamWeighins.filter(w => !w.is_bulk).length
      return { teamId: team.id, team, teamMembers, teamTotal, fishClaimed, catch_photo_url: photoUrl }
    })
    .filter(Boolean)

  const toggleSelect = (teamId) => {
    setSelected(s => {
      const n = new Set(s)
      n.has(teamId) ? n.delete(teamId) : n.add(teamId)
      return n
    })
  }
  const selectAll = () => setSelected(new Set(catchCards.map(c => c.teamId)))
  const clearAll = () => setSelected(new Set())

  const generateCard = async (card) => {
    setGenerating(card.teamId)
    try {
      const canvas = document.createElement('canvas')
      canvas.width = 1080
      canvas.height = 1080
      const ctx = canvas.getContext('2d')

      const img = await new Promise((resolve, reject) => {
        const i = new Image()
        i.crossOrigin = 'anonymous'
        i.onload = () => resolve(i)
        i.onerror = reject
        i.src = card.catch_photo_url
      })

      const scale = Math.max(canvas.width / img.width, canvas.height / img.height)
      const w = img.width * scale, h = img.height * scale
      ctx.drawImage(img, (canvas.width-w)/2, (canvas.height-h)/2, w, h)

      const grad = ctx.createLinearGradient(0, canvas.height-280, 0, canvas.height)
      grad.addColorStop(0, 'rgba(0,0,0,0)')
      grad.addColorStop(0.4, 'rgba(0,0,0,0.7)')
      grad.addColorStop(1, 'rgba(0,0,0,0.92)')
      ctx.fillStyle = grad
      ctx.fillRect(0, canvas.height-280, canvas.width, 280)

      ctx.fillStyle = '#2B6CB0'
      ctx.fillRect(0, canvas.height-280, canvas.width, 4)

      const pad = 48
      const names = card.teamMembers.map(m => m.name).join(' & ') || card.team?.team_name || ''
      ctx.fillStyle = '#ffffff'
      ctx.font = 'bold 52px system-ui, sans-serif'
      ctx.fillText(names, pad, canvas.height - 120)

      ctx.fillStyle = 'rgba(255,255,255,0.75)'
      ctx.font = 'bold 32px system-ui, sans-serif'
      ctx.fillText(`${card.fishClaimed} fish  ·  ${card.team?.category || ''}`, pad, canvas.height - 175)

      ctx.fillStyle = 'rgba(255,255,255,0.8)'
      ctx.font = '30px system-ui, sans-serif'
      ctx.fillText(`Total score: ${card.teamTotal} pts`, pad, canvas.height - 62)

      ctx.fillStyle = 'rgba(255,255,255,0.45)'
      ctx.font = 'bold 22px system-ui, sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText(comp.name, canvas.width-pad, pad+24)
      ctx.textAlign = 'left'

      const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
      setPreviews(p => ({ ...p, [card.teamId]: dataUrl }))
      return dataUrl
    } catch (err) {
      alert('Could not generate card: ' + err.message)
      return null
    } finally {
      setGenerating(null)
    }
  }

  const downloadCard = (card, dataUrl) => {
    const a = document.createElement('a')
    a.href = dataUrl
    const teamName = (card.team?.team_name || 'team').replace(/\s+/g, '-').toLowerCase()
    a.download = `${comp.name.replace(/\s+/g,'-')}-${teamName}.jpg`
    a.click()
  }

  const exportSelected = async () => {
    if (selected.size === 0) return
    setBulkExporting(true)
    const toExport = catchCards.filter(c => selected.has(c.teamId))
    for (const card of toExport) {
      let dataUrl = previews[card.teamId]
      if (!dataUrl) dataUrl = await generateCard(card)
      if (dataUrl) {
        downloadCard(card, dataUrl)
        await new Promise(r => setTimeout(r, 300)) // small delay between downloads
      }
    }
    setBulkExporting(false)
  }

  return (
    <div className="space-y-5">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <p className="font-bold mb-1">Social Media Export</p>
        <p className="text-xs">One 1080×1080 card per team. Competitor names and total score stamped at the bottom. Select multiple to bulk download.</p>
      </div>

      {catchCards.length === 0 && (
        <div className="text-center py-16 bg-gray-50 rounded-xl text-gray-400">
          <p className="font-semibold text-gray-500 mb-1">No catch photos yet</p>
          <p className="text-sm">Add a catch photo during weigh-in to generate social cards.</p>
        </div>
      )}

      {catchCards.length > 0 && (
        <>
          {/* Selection toolbar */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <button onClick={selectAll} className="text-xs font-bold px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">Select All</button>
              {selected.size > 0 && <button onClick={clearAll} className="text-xs font-bold px-3 py-1.5 rounded-lg border border-gray-300 text-gray-500 hover:bg-gray-50">Clear</button>}
              {selected.size > 0 && <span className="text-xs text-gray-500">{selected.size} selected</span>}
            </div>
            {selected.size > 0 && (
              <button onClick={exportSelected} disabled={bulkExporting}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-50"
                style={{ background: SNZ_BLUE }}>
                {bulkExporting ? 'Exporting…' : `↓ Export ${selected.size} card${selected.size > 1 ? 's' : ''}`}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {catchCards.map(card => {
              const isSelected = selected.has(card.teamId)
              const isGenerating = generating === card.teamId
              const preview = previews[card.teamId]
              return (
                <div key={card.teamId}
                  className={`bg-white rounded-xl overflow-hidden shadow-sm border-2 transition cursor-pointer ${isSelected ? 'border-blue-500' : 'border-gray-200 hover:border-gray-300'}`}
                  onClick={() => toggleSelect(card.teamId)}>
                  <div className="relative">
                    <img src={preview || card.catch_photo_url} alt={card.team?.team_name}
                      className="w-full aspect-square object-cover" />
                    {/* Select overlay */}
                    <div className={`absolute top-2 left-2 w-7 h-7 rounded-full border-2 flex items-center justify-center font-black text-sm transition ${
                      isSelected ? 'bg-blue-500 border-blue-500 text-white' : 'bg-white/80 border-gray-300 text-transparent'
                    }`}>✓</div>
                    {preview && <div className="absolute top-2 right-2 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-lg">✓ Ready</div>}
                  </div>
                  <div className="p-3" onClick={e => e.stopPropagation()}>
                    <p className="font-bold text-sm text-gray-900">{card.team?.team_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {card.teamMembers.map(m=>m.name).join(' & ')} · {card.fishClaimed} fish · {card.teamTotal} pts
                    </p>
                    <div className="flex gap-2 mt-3">
                      <button onClick={() => generateCard(card)} disabled={!!isGenerating}
                        className="flex-1 py-2 rounded-lg text-xs font-bold border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                        {isGenerating ? 'Generating…' : preview ? 'Regenerate' : 'Preview Card'}
                      </button>
                      {preview && (
                        <button onClick={() => downloadCard(card, preview)}
                          className="flex-1 py-2 rounded-lg text-xs font-bold text-white"
                          style={{ background: SNZ_BLUE }}>↓ Download</button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
