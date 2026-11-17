// "Want your club up here?" — clubs put themselves forward for Grassroots
// Spearo and send their footage as YouTube links. Posts to grassroots-submit.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { NZ_REGIONS } from '../lib/grassroots'
import { GrassrootsShell } from './GrassrootsPage'

const SNZ_BLUE = '#2B6CB0'
const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300'
const isYouTube = (s) => /^https?:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//i.test(s.trim())

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

export default function GrassrootsSubmit() {
  const navigate = useNavigate()
  const [clubs, setClubs] = useState([])
  const [form, setForm] = useState({
    club_id: '', club_name: '', contact_name: '', contact_email: '', contact_phone: '',
    region: '', town: '', notes: '', website_hp: '',
  })
  const [links, setLinks] = useState([''])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    supabase.from('clubs').select('id, name, region, town').eq('active', true).order('name')
      .then(({ data }) => setClubs(data || []))
  }, [])

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))
  const pickClub = (e) => {
    const v = e.target.value
    if (v === 'new' || v === '') { setForm(f => ({ ...f, club_id: v, club_name: '' })); return }
    const c = clubs.find(x => String(x.id) === v)
    setForm(f => ({ ...f, club_id: v, club_name: c?.name || '', region: c?.region || f.region, town: c?.town || f.town }))
  }

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    const video_links = links.map(l => l.trim()).filter(Boolean)
    const bad = video_links.find(l => !isYouTube(l))
    if (bad) { setError(`That doesn't look like a YouTube link: ${bad}`); return }
    setBusy(true)
    try {
      const res = await fetch('/.netlify/functions/grassroots-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          club_id: form.club_id && form.club_id !== 'new' ? Number(form.club_id) : null,
          video_links,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Something went wrong')
      setDone(true)
      window.scrollTo(0, 0)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (done) {
    return (
      <GrassrootsShell>
        <section className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 text-center">
          <div className="text-4xl mb-3">🤙</div>
          <h1 className="font-black text-gray-900 text-2xl">Thanks — we've got it</h1>
          <p className="text-sm text-gray-600 mt-3 leading-relaxed max-w-md mx-auto">
            We've emailed {form.contact_email} with the next steps. If you haven't sent footage yet, reply to that
            email with your YouTube links when they're ready.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button onClick={() => navigate('/grassroots/101')}
              className="px-5 py-2.5 rounded-xl font-black text-sm text-white" style={{ background: SNZ_BLUE }}>
              Grassroots 101 guide
            </button>
            <button onClick={() => navigate('/grassroots')}
              className="px-5 py-2.5 rounded-xl font-black text-sm bg-white border border-gray-300 text-gray-700">
              Back to the map
            </button>
          </div>
        </section>
      </GrassrootsShell>
    )
  }

  const isNewClub = form.club_id === 'new' || (clubs.length === 0)

  return (
    <GrassrootsShell>
      <div>
        <h1 className="font-black text-gray-900 text-2xl">Want your club up here?</h1>
        <p className="text-sm text-gray-600 mt-2 leading-relaxed">
          Put your club forward for Grassroots Spearo. Film your interviews and footage using the{' '}
          <a href="/grassroots/101" className="font-bold" style={{ color: SNZ_BLUE }}>Grassroots 101 guide</a>,
          upload the clips to YouTube as unlisted videos, and paste the links below. No footage yet? Send the form
          anyway and we'll be in touch.
        </p>
      </div>

      <form onSubmit={submit} className="bg-white border border-gray-200 rounded-2xl p-5 sm:p-6 space-y-4">
        {/* Honeypot — hidden from people */}
        <input type="text" name="website" value={form.website_hp} onChange={set('website_hp')}
          tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

        <Field label="Club" required>
          <select value={form.club_id} onChange={pickClub} className={inputCls} required={clubs.length > 0}>
            <option value="">Choose your club…</option>
            {clubs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            <option value="new">My club isn't listed</option>
          </select>
        </Field>

        {isNewClub && (
          <Field label="Club name" required>
            <input value={form.club_name} onChange={set('club_name')} className={inputCls} required maxLength={120} />
          </Field>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Region">
            <select value={form.region} onChange={set('region')} className={inputCls}>
              <option value="">—</option>
              {NZ_REGIONS.map(r => <option key={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="Town">
            <input value={form.town} onChange={set('town')} className={inputCls} maxLength={80} />
          </Field>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Your name" required>
            <input value={form.contact_name} onChange={set('contact_name')} className={inputCls} required maxLength={120} />
          </Field>
          <Field label="Email" required>
            <input type="email" value={form.contact_email} onChange={set('contact_email')} className={inputCls} required maxLength={200} />
          </Field>
        </div>
        <Field label="Phone" hint="Only SNZ sees this.">
          <input type="tel" value={form.contact_phone} onChange={set('contact_phone')} className={inputCls} maxLength={40} />
        </Field>

        <Field label="YouTube links" hint="Unlisted videos are fine. One link per clip.">
          <div className="space-y-2">
            {links.map((l, i) => (
              <div key={i} className="flex gap-2">
                <input value={l} placeholder="https://youtu.be/…" className={inputCls}
                  onChange={e => setLinks(ls => ls.map((x, j) => j === i ? e.target.value : x))} />
                {links.length > 1 && (
                  <button type="button" onClick={() => setLinks(ls => ls.filter((_, j) => j !== i))}
                    className="px-3 text-gray-400 hover:text-red-500" aria-label="Remove link">×</button>
                )}
              </div>
            ))}
            {links.length < 20 && (
              <button type="button" onClick={() => setLinks(ls => [...ls, ''])}
                className="text-sm font-bold" style={{ color: SNZ_BLUE }}>+ Add another link</button>
            )}
          </div>
        </Field>

        <Field label="Anything else we should know?" hint="Who's in the clips, best times to reach you, what makes your club different.">
          <textarea value={form.notes} onChange={set('notes')} rows={4} className={inputCls} maxLength={3000} />
        </Field>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" disabled={busy}
          className="w-full py-3 rounded-xl font-black text-sm text-white disabled:opacity-60" style={{ background: SNZ_BLUE }}>
          {busy ? 'Sending…' : 'Send to SNZ'}
        </button>
      </form>
    </GrassrootsShell>
  )
}
