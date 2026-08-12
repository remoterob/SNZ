import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { REGIONS, EXPERIENCE_LEVELS } from '../../lib/bingo/helpers'
import { notify } from '../../utils/toasts'

const SNZ_BLUE = '#2B6CB0'

// Upserts the registration row and keeps the member's profile fields in sync,
// since region/experience originate there (and other parts of the app read
// them off `members`).
async function saveRegistration({ me, compCfg, region, experience, isNew }) {
  const payload = { user_id: me.id, comp_season: compCfg.season, region, experience }
  if (isNew) payload.rules_accepted_at = new Date().toISOString()

  const { error: upsertErr } = await supabase
    .from('bingo_registrations')
    .upsert(payload, { onConflict: 'user_id,comp_season' })
  if (upsertErr) throw upsertErr

  const { error: memberErr } = await supabase.from('members').update({ region, experience }).eq('id', me.id)
  if (memberErr) throw memberErr
}

function RegistrationFields({ region, setRegion, experience, setExperience }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Home Region</label>
        <select value={region} onChange={e => setRegion(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white">
          <option value="">Select your region…</option>
          {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1">Spearo Experience</label>
        <select value={experience} onChange={e => setExperience(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white">
          <option value="">Select your experience…</option>
          {EXPERIENCE_LEVELS.map(x => <option key={x} value={x}>{x}</option>)}
        </select>
      </div>
    </div>
  )
}

// Mandatory, shown until the diver has registered for the active season.
export function BingoRegistrationBanner({ me, member, compCfg, onRegistered, setTab }) {
  const [region, setRegion] = useState(member?.region || '')
  const [experience, setExperience] = useState(member?.experience || '')
  const [accepted, setAccepted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const canSubmit = !!(region && experience && accepted) && !submitting

  const submit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      await saveRegistration({ me, compCfg, region, experience, isNew: true })
      notify('You\'re registered for Fish Bingo!', 'success')
      await onRegistered()
    } catch (e) {
      notify(String(e.message || e), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-white border-2 border-blue-200 rounded-2xl overflow-hidden mb-4">
      <div className="px-4 sm:px-5 py-3 border-b border-blue-100" style={{ background: '#eff6ff' }}>
        <p className="font-black text-gray-900 text-sm">🎣 Register for Fish Bingo{compCfg?.season ? ` ${compCfg.season}` : ''}</p>
        <p className="text-xs text-gray-600 mt-0.5">Answer a few quick questions to unlock claims — you only need to do this once.</p>
      </div>
      <div className="p-4 sm:p-5 space-y-4">
        <RegistrationFields region={region} setRegion={setRegion} experience={experience} setExperience={setExperience} />
        <label className="flex items-start gap-2 text-xs text-gray-600 cursor-pointer">
          <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)}
            className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
          <span>
            I have read and accept the{' '}
            <button type="button" onClick={() => setTab('rules')} className="underline font-semibold" style={{ color: SNZ_BLUE }}>
              Fish Bingo rules
            </button>.
          </span>
        </label>
        <button onClick={submit} disabled={!canSubmit}
          className="w-full py-2.5 rounded-xl font-bold text-white text-sm disabled:opacity-40 transition"
          style={{ background: SNZ_BLUE }}>
          {submitting ? 'Registering…' : 'Register'}
        </button>
      </div>
    </div>
  )
}

// Lightbox opened via the diver's name, for changing region/experience after
// registering. Rules acceptance isn't re-collected here — already on file.
export function BingoRegistrationModal({ me, member, compCfg, registration, onClose, onSaved }) {
  const [region, setRegion] = useState(registration?.region || member?.region || '')
  const [experience, setExperience] = useState(registration?.experience || member?.experience || '')
  const [submitting, setSubmitting] = useState(false)

  const canSubmit = !!(region && experience) && !submitting

  const submit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      await saveRegistration({ me, compCfg, region, experience, isNew: false })
      notify('Registration updated.', 'success')
      await onSaved()
      onClose()
    } catch (e) {
      notify(String(e.message || e), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-black text-gray-900">Your Registration</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <RegistrationFields region={region} setRegion={setRegion} experience={experience} setExperience={setExperience} />
        {registration?.rules_accepted_at && (
          <p className="text-xs text-gray-400 mt-3">
            Rules accepted {new Date(registration.rules_accepted_at).toLocaleDateString('en-NZ')}.
          </p>
        )}
        <div className="flex gap-2 mt-4">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl font-bold text-sm border border-gray-300 text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={submit} disabled={!canSubmit}
            className="flex-1 py-2.5 rounded-xl font-bold text-white text-sm disabled:opacity-40"
            style={{ background: SNZ_BLUE }}>
            {submitting ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}
