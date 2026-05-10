import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const SNZ_BLUE = '#2B6CB0'
const SNZ_LOGO = import.meta.env.VITE_SNZ_LOGO_URL || null

const STAT = ({ value, label }) => (
  <div className="text-center px-6 py-5">
    <div className="text-4xl font-black mb-1" style={{ color: SNZ_BLUE }}>{value}</div>
    <div className="text-sm text-gray-500 leading-tight">{label}</div>
  </div>
)

const Benefit = ({ icon, title, desc }) => (
  <div className="flex gap-4 items-start">
    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xl"
      style={{ background: '#EBF4FF' }}>
      {icon}
    </div>
    <div>
      <div className="font-black text-gray-900 text-sm mb-0.5">{title}</div>
      <div className="text-sm text-gray-500 leading-relaxed">{desc}</div>
    </div>
  </div>
)

export default function BigFishSponsorPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    company_name: '', contact_name: '', email: '',
    phone: '', website: '', offer_description: '', offer_value: '', notes: '',
  })
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async (e) => {
    e.preventDefault()
    if (!form.company_name || !form.contact_name || !form.email || !form.offer_description)
      return setError('Please fill in all required fields.')
    setBusy(true)
    setError(null)
    const { error: dbErr } = await supabase.from('bigfish_sponsor_inquiries').insert({
      company_name:      form.company_name.trim(),
      contact_name:      form.contact_name.trim(),
      email:             form.email.trim().toLowerCase(),
      phone:             form.phone.trim() || null,
      website:           form.website.trim() || null,
      offer_description: form.offer_description.trim(),
      offer_value:       form.offer_value.trim() || null,
      notes:             form.notes.trim() || null,
    })
    setBusy(false)
    if (dbErr) return setError('Something went wrong — please try emailing us directly at spearfishingnewzealand@gmail.com')
    setSubmitted(true)
  }

  if (submitted) return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5 text-4xl">✓</div>
        <h1 className="text-3xl font-black text-gray-900 mb-3">Thanks, we'll be in touch!</h1>
        <p className="text-gray-500 mb-2">We've received your sponsorship enquiry for the SNZ Big Fish Competition.</p>
        <p className="text-gray-400 text-sm mb-8">A member of the Spearfishing NZ committee will be in contact within a few days.</p>
        <button onClick={() => navigate('/big-fish')}
          className="w-full py-3 rounded-xl font-bold text-white"
          style={{ background: SNZ_BLUE }}>← Back to Big Fish</button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-white">

      {/* Nav */}
      <div style={{ background: SNZ_BLUE }} className="px-6 py-3 flex items-center justify-between border-b border-blue-700">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/big-fish')}
            className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
            ← Big Fish
          </button>
          <span className="text-blue-200 text-sm opacity-75">/ Sponsorship</span>
        </div>
        {SNZ_LOGO && <img src={SNZ_LOGO} alt="SNZ" className="h-8 object-contain" />}
      </div>

      {/* Hero */}
      <section className="px-6 py-16 text-center border-b border-gray-100"
        style={{ background: 'linear-gradient(135deg, #EBF4FF 0%, #ffffff 60%)' }}>
        <div className="max-w-3xl mx-auto">
          <div className="inline-block bg-blue-100 text-blue-700 text-xs font-black tracking-widest uppercase px-3 py-1 rounded-full mb-4">
            Sponsorship Opportunity
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-gray-900 leading-tight mb-4">
            Sponsor NZ's First<br />
            <span style={{ color: SNZ_BLUE }}>Verified Online Big Fish</span><br />
            Competition
          </h1>
          <p className="text-lg text-gray-500 max-w-xl mx-auto leading-relaxed">
            Put your brand in front of New Zealand's most passionate spearfishing community — season-long, digital-first, and administered by Spearfishing New Zealand.
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="border-b border-gray-100">
        <div className="max-w-3xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-gray-100">
            <STAT value="14,000+" label="Facebook followers" />
            <STAT value="7,500+"  label="App views on our previous platform" />
            <STAT value="12 months" label="Season-long visibility" />
            <STAT value="6"       label="Species categories" />
          </div>
        </div>
      </section>

      {/* About the comp */}
      <section className="px-6 py-14 border-b border-gray-100">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-black text-gray-900 mb-4">About the Competition</h2>
          <div className="prose prose-gray max-w-none text-gray-600 leading-relaxed space-y-4 text-sm">
            <p>
              The SNZ Big Fish Competition is a season-long spearfishing competition run by <strong>Spearfishing New Zealand</strong> — the official national governing body for competitive spearfishing in Aotearoa. It runs through our digital SNZ Hub platform, accessible to all SNZ members nationwide.
            </p>
            <p>
              Competitors submit catches across <strong>six species</strong> — Butterfish, Blue Moki, Kingfish, Snapper, Warehou and Bluefin — throughout the season. Every entry requires three verified photos: a competitor photo, weight on scales, and measured length. It's the only NZ spearfishing comp where every catch is documented and publicly visible.
            </p>
            <p>
              Up to three fish per species can be entered, with a running leaderboard updated in real time. Competitors share their competitor photos on Facebook throughout the season, tagging SNZ and generating organic reach around every big catch.
            </p>
            <p>
              At the end of the season, the top three across each species receive prizes — <strong>presented by the sponsor</strong> at a dedicated event or via the SNZ prizegiving.
            </p>
          </div>

          {/* Species pills */}
          <div className="flex flex-wrap gap-2 mt-6">
            {['Butterfish', 'Blue Moki', 'Kingfish', 'Snapper', 'Warehou', 'Bluefin'].map(s => (
              <span key={s} className="text-xs font-bold px-3 py-1.5 rounded-full border-2"
                style={{ borderColor: SNZ_BLUE, color: SNZ_BLUE, background: '#EBF4FF' }}>
                {s}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* What we're offering */}
      <section className="px-6 py-14 bg-gray-50 border-b border-gray-100">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-black text-gray-900 mb-2">What's on Offer</h2>
          <p className="text-sm text-gray-400 mb-8">Named sponsorship of the SNZ Big Fish Competition includes:</p>
          <div className="grid sm:grid-cols-2 gap-6">
            <Benefit icon="🏆"
              title="Named Competition"
              desc={`The competition runs as "[Your Brand] Big Fish Competition" — on the app, in all social posts, and at prizegiving.`} />
            <Benefit icon="📱"
              title="In-App Branding"
              desc="Your logo displayed on the Big Fish leaderboard page, seen every time competitors check standings throughout the season." />
            <Benefit icon="📣"
              title="Social Media Promotion"
              desc="Every competitor photo shared to our 14K+ Facebook audience tagged with your brand. Season-long organic reach with each new catch." />
            <Benefit icon="🥇"
              title="Prize Presentation"
              desc="Your brand presents prizes to the top three places across all six species — either in person at prizegiving or featured in a social post." />
            <Benefit icon="📅"
              title="Year-Round Visibility"
              desc="Unlike a single-day event, this is 12 months of association with NZ spearfishing. Competitors and followers see your brand from launch to prizegiving." />
            <Benefit icon="🤝"
              title="SNZ Endorsement"
              desc="Official association with Spearfishing New Zealand — the national body trusted by NZ's competitive spearfishing community since 1961." />
          </div>
        </div>
      </section>

      {/* Form */}
      <section className="px-6 py-14">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-black text-gray-900 mb-2">Submit Your Offer</h2>
          <p className="text-sm text-gray-500 mb-8 leading-relaxed">
            We're open to proposals that work for both parties. Tell us about your brand, what you'd like to offer, and what you're hoping to get in return. The SNZ committee will be in touch within a few days.
          </p>

          <form onSubmit={submit} className="space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">{error}</div>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Company / Brand name <span className="text-red-400">*</span>
                </label>
                <input value={form.company_name} onChange={set('company_name')} required
                  placeholder="e.g. Aotearoa Wetsuits"
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Contact name <span className="text-red-400">*</span>
                </label>
                <input value={form.contact_name} onChange={set('contact_name')} required
                  placeholder="Your full name"
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400" />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                  Email <span className="text-red-400">*</span>
                </label>
                <input type="email" autoComplete="email" value={form.email} onChange={set('email')} required
                  placeholder="you@company.com"
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Phone</label>
                <input value={form.phone} onChange={set('phone')}
                  placeholder="+64 21 xxx xxxx"
                  className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Website</label>
              <input value={form.website} onChange={set('website')}
                placeholder="https://yourcompany.co.nz"
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400" />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                Your sponsorship offer <span className="text-red-400">*</span>
              </label>
              <p className="text-xs text-gray-400 mb-1.5">What would you like to offer? Cash, product, vouchers, gear — tell us what works for you.</p>
              <textarea value={form.offer_description} onChange={set('offer_description')} required rows={4}
                placeholder="e.g. We'd like to offer $1,500 cash + $500 in product vouchers for prizes…"
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400 resize-none" />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Estimated offer value (NZD)</label>
              <input value={form.offer_value} onChange={set('offer_value')}
                placeholder="e.g. $2,000"
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-blue-400" />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1.5">Anything else?</label>
              <textarea value={form.notes} onChange={set('notes')} rows={3}
                placeholder="What you're hoping to get from the partnership, any specific requests, questions…"
                className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400 resize-none" />
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-700">
              Submissions go directly to the Spearfishing NZ committee. We aim to respond within 3–5 working days.
            </div>

            <button type="submit" disabled={busy}
              className="w-full py-4 rounded-xl font-black text-white text-base disabled:opacity-50 transition hover:opacity-90"
              style={{ background: SNZ_BLUE }}>
              {busy ? 'Submitting…' : 'Submit Sponsorship Enquiry →'}
            </button>
          </form>
        </div>
      </section>

      {/* Footer */}
      <div className="border-t border-gray-100 px-6 py-6 text-center text-xs text-gray-400">
        Questions? Email us at{' '}
        <a href="mailto:spearfishingnewzealand@gmail.com" className="underline font-semibold" style={{ color: SNZ_BLUE }}>
          spearfishingnewzealand@gmail.com
        </a>
      </div>
    </div>
  )
}
