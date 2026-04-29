// Membership landing, signup, login, dashboard, password reset
import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useStripeCheckout } from '../hooks/useStripeCheckout'

const SNZ_BLUE = '#2B6CB0'
const SNZ_LOGO = import.meta.env.VITE_SNZ_LOGO_URL || null
const MEMBERSHIP_EXPIRES = '31 December 2026'

const REGIONS = [
  'Northland', 'Auckland', 'Waikato / Bay of Plenty', 'Coromandel',
  'Hawke\'s Bay / Gisborne', 'Taranaki / Manawatū', 'Wellington / Wairarapa',
  'Nelson / Marlborough', 'Canterbury', 'Otago / Southland', 'West Coast',
]

const EXPERIENCE_LEVELS = ['Beginner', 'Intermediate', 'Experienced', 'Elite']

// ── Shared header ─────────────────────────────────────────────────────────────
function MemberHeader({ session, onSignOut }) {
  const navigate = useNavigate()
  // Check if SNZ admin is logged in (stored in sessionStorage by AdminLogin)
  const isSnzAdmin = !!sessionStorage.getItem('snz_admin_session')
  return (
    <div style={{ background: SNZ_BLUE }} className="px-6 py-3 flex items-center justify-between border-b border-blue-700">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/')} className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">← SNZ Hub</button>
        <span className="text-blue-200 text-sm opacity-75">/ Membership</span>
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => isSnzAdmin ? navigate('/membership/admin') : navigate('/admin/login', { state: { from: '/membership/admin' } })}
          className="text-xs font-bold text-white bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
          ⚙ Admin
        </button>
        {session && (
          <button onClick={onSignOut} className="text-xs text-blue-200 hover:text-white transition">Sign out</button>
        )}
      </div>
    </div>
  )
}

// ── Membership Landing ────────────────────────────────────────────────────────
function MembershipLanding({ session, navigate }) {
  return (
    <div className="min-h-screen bg-white">
      <MemberHeader session={session} />
      <div className="max-w-2xl mx-auto px-6 py-12">
        {SNZ_LOGO && <img src={SNZ_LOGO} alt="SNZ" className="h-14 object-contain mb-6" />}
        <h1 className="text-4xl font-black text-gray-900 mb-3">SNZ Membership</h1>
        <p className="text-gray-500 text-lg mb-2">Join Spearfishing New Zealand — $10 annual membership.</p>
        <p className="text-gray-400 text-sm mb-8">Annual membership is $10 NZD, valid through to <strong>31 December 2026</strong>.</p>

        <div className="space-y-3 mb-8">
          {[
            'Access to SNZ sanctioned club competitions',
            'Official SNZ membership number and digital membership card',
            'Competition history tracking',
            'NZ Records, annual awards and national titles eligibility',
            'Support your national body to keep spearfishing organised and growing in New Zealand',
            'Support competitor development programmes and pathways',
            'Help subsidise Interpacific and World Championship teams representing New Zealand',
          ].map(b => (
            <div key={b} className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <span className="text-green-600 text-xs font-black">✓</span>
              </div>
              <span className="text-gray-700 text-sm">{b}</span>
            </div>
          ))}
        </div>

        {session ? (
          <button onClick={() => navigate('/membership/dashboard')}
            className="w-full py-4 rounded-xl font-black text-white text-base"
            style={{ background: SNZ_BLUE }}>Go to My Membership →</button>
        ) : (
          <div className="space-y-3">
            <button onClick={() => navigate('/membership/signup')}
              className="w-full py-4 rounded-xl font-black text-white text-base"
              style={{ background: '#16a34a' }}>Join Now — $10/year</button>
            <button onClick={() => navigate('/membership/login')}
              className="w-full py-4 rounded-xl font-black border-2 border-gray-300 text-gray-700 text-base hover:border-gray-400 transition">
              Already a member? Sign in
            </button>
          </div>
        )}


      </div>
    </div>
  )
}

// ── Sign Up ───────────────────────────────────────────────────────────────────
function MemberSignup({ navigate }) {
  const [step, setStep] = useState(1) // 1=account, 2=profile
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [profile, setProfile] = useState({
    name:'', phone:'', club:'', gender:'', dob:'',
    emergency_contact:'', emergency_phone:'', experience:'', region:'', fit_to_dive: false
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [wasWhitelisted, setWasWhitelisted] = useState(false)
  const [emailExists, setEmailExists] = useState(false)
  const [checkingEmail, setCheckingEmail] = useState(false)
  const set = k => v => setProfile(p => ({ ...p, [k]: v }))

  const checkEmail = async (val) => {
    if (!val.trim() || !val.includes('@')) return
    setCheckingEmail(true)
    try {
      // Only block if there is a members row WITH a linked auth account (id not null)
      // Orphaned rows (imported data, deleted accounts) must not block signup
      const { data } = await supabase.from('members')
        .select('id')
        .eq('email', val.trim().toLowerCase())
        .not('id', 'is', null)
        .maybeSingle()
      setEmailExists(!!data)
    } finally {
      setCheckingEmail(false)
    }
  }

  const submitAccount = async (e) => {
    e.preventDefault()
    setError('')
    if (!email.trim()) { setError('Email is required'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    setLoading(true)
    try {
      // Check if email already exists with an active auth account
      // We check both members table AND that the member has a valid id (linked auth user)
      // Members with null id are orphaned records — allow re-registration
      const { data: existing } = await supabase
        .from('members')
        .select('id, name')
        .eq('email', email.trim().toLowerCase())
        .not('id', 'is', null)
        .maybeSingle()
      if (existing) {
        setError('An SNZ membership account already exists for this email address. Please sign in instead.')
        return
      }
      setStep(2)
    } catch (err) {
      // If check fails just proceed — signup will catch duplicates
      setStep(2)
    } finally {
      setLoading(false)
    }
  }

  const submitProfile = async (e) => {
    e.preventDefault()
    setError('')
    if (!profile.name.trim()) { setError('Full name is required'); return }
    if (!profile.fit_to_dive) { setError('You must confirm fitness to dive'); return }
    setLoading(true)
    try {
      // Step 1: Create auth account
      const { data: signUpData, error: authErr } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      })
      if (authErr) {
        if (authErr.message?.includes('already registered') || authErr.message?.includes('already been registered')) {
          setError('__DUPLICATE__')
          setLoading(false)
          return
        }
        throw authErr
      }

      // Step 2: Sign in immediately (works when email confirm is disabled in Supabase)
      const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
        email: email.trim(), password
      })

      const userId = signInData?.user?.id || signUpData?.user?.id
      if (!userId) {
        // Email confirmation is on — save profile to localStorage for after confirmation
        localStorage.setItem('snz_pending_profile', JSON.stringify({
          ...profile, email: email.trim(), dob: profile.dob || null,
        }))
        setDone(true)
        return
      }

      // Step 3: Check whitelist — waive fee for pre-existing members
      const { data: whitelisted } = await supabase
        .from('member_whitelist')
        .select('email')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle()

      const isWhitelisted = !!whitelisted
      const membershipStatus = isWhitelisted ? 'active' : 'pending'
      const paymentStatus = isWhitelisted ? 'paid' : 'pending'
      const feeCents = isWhitelisted ? 0 : 1000

      // Step 4: Write full profile while authenticated
      const { error: profileErr } = await supabase.from('members').upsert({
        id: userId,
        email: email.trim(),
        name: profile.name,
        phone: profile.phone || null,
        club: profile.club || null,
        gender: profile.gender || null,
        dob: profile.dob || null,
        emergency_contact: profile.emergency_contact || null,
        emergency_phone: profile.emergency_phone || null,
        experience: profile.experience || null,
        region: profile.region || null,
        fit_to_dive: profile.fit_to_dive,
        membership_year: 2026,
        membership_expires: '2026-12-31',
        membership_status: membershipStatus,
        membership_fee_cents: feeCents,
        payment_status: paymentStatus,
        paid_at: isWhitelisted ? new Date().toISOString() : null,
      }, { onConflict: 'id' })

      if (profileErr) {
        console.error('Profile save error:', profileErr)
        throw new Error('Account created but profile could not be saved: ' + profileErr.message)
      }

      // Step 5: Sign out so they go through login → dashboard
      await supabase.auth.signOut()
      setWasWhitelisted(isWhitelisted)
      setDone(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (done) return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <span className="text-green-600 text-2xl">✓</span>
        </div>
        <h1 className="text-2xl font-black text-gray-900 mb-3">Account created!</h1>
        <p className="text-gray-500 text-sm mb-2">Welcome to SNZ, <strong>{profile.name || email}</strong>.</p>
        {wasWhitelisted ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4 text-sm text-green-800">
            ✓ Your membership fee has been waived — you're already in our records as a previous competitor.
          </div>
        ) : (
          <p className="text-gray-400 text-sm mb-4">Sign in now to pay your $10 membership fee and activate your membership card.</p>
        )}
        <button onClick={() => navigate('/membership/login')}
          className="w-full py-3 rounded-xl font-bold text-white text-sm"
          style={{ background: SNZ_BLUE }}>{wasWhitelisted ? 'Sign In →' : 'Sign In & Pay →'}</button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <MemberHeader />
      <div className="max-w-lg mx-auto px-6 py-10">
        <h1 className="text-2xl font-black text-gray-900 mb-1">Join SNZ</h1>
        <p className="text-gray-400 text-sm mb-6">Step {step} of 2 — {step === 1 ? 'Create your account' : 'Your details'}</p>

        {/* Progress */}
        <div className="flex gap-2 mb-6">
          {[1,2].map(s => (
            <div key={s} className={`h-1.5 flex-1 rounded-full transition ${s <= step ? 'bg-blue-500' : 'bg-gray-200'}`} />
          ))}
        </div>

        {error === '__DUPLICATE__' ? (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-4 mb-4">
            <p className="font-black text-amber-900 text-sm mb-1">Account already exists</p>
            <p className="text-amber-800 text-sm mb-3">An SNZ membership account is already registered to <strong>{email}</strong>.</p>
            <div className="flex flex-col gap-2">
              <button onClick={() => navigate('/membership/login')}
                className="w-full py-2.5 rounded-xl font-bold text-white text-sm"
                style={{ background: SNZ_BLUE }}>
                Sign In →
              </button>
              <button onClick={() => navigate('/membership/reset')}
                className="w-full py-2.5 rounded-xl font-bold border border-amber-300 text-amber-800 text-sm hover:bg-amber-100 transition">
                Forgot password? Reset it
              </button>
            </div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600 mb-4">{error}</div>
        ) : null}

        {step === 1 && (
          <form onSubmit={submitAccount} className="space-y-4 bg-white border border-gray-200 rounded-2xl p-6">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Email <span className="text-red-400">*</span></label>
              <input type="email" value={email}
                onChange={e => { setEmail(e.target.value); setEmailExists(false) }}
                onBlur={e => checkEmail(e.target.value)}
                required
                className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 ${emailExists ? 'border-amber-400 focus:ring-amber-300' : 'border-gray-300 focus:ring-blue-300'}`}
                placeholder="you@example.com" />
              {checkingEmail && <p className="text-xs text-gray-400 mt-1">Checking…</p>}
              {emailExists && !checkingEmail && (
                <div className="mt-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                  <p className="text-xs font-bold text-amber-800 mb-2">An account already exists for this email.</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => navigate('/membership/login')}
                      className="flex-1 py-1.5 rounded-lg text-xs font-bold text-white"
                      style={{ background: SNZ_BLUE }}>Sign In</button>
                    <button type="button" onClick={() => navigate('/membership/reset')}
                      className="flex-1 py-1.5 rounded-lg text-xs font-bold border border-amber-300 text-amber-700 hover:bg-amber-100">Reset Password</button>
                  </div>
                </div>
              )}
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Password <span className="text-red-400">*</span></label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                placeholder="At least 8 characters" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Confirm Password <span className="text-red-400">*</span></label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                placeholder="Repeat your password" />
            </div>
            <button type="submit" disabled={emailExists || checkingEmail}
              className="w-full py-3 rounded-xl font-black text-white text-sm disabled:opacity-40"
              style={{ background: SNZ_BLUE }}>
              Continue →
            </button>
            <p className="text-center text-xs text-gray-400">
              Already a member? <button type="button" onClick={() => navigate('/membership/login')} className="underline" style={{ color: SNZ_BLUE }}>Sign in</button>
            </p>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={submitProfile} className="space-y-4 bg-white border border-gray-200 rounded-2xl p-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Full Name <span className="text-red-400">*</span></label>
                <input value={profile.name} onChange={e => set('name')(e.target.value)} required
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  placeholder="Your full name" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Phone</label>
                <input value={profile.phone} onChange={e => set('phone')(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  placeholder="+64 21 xxx xxxx" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Club</label>
                <input value={profile.club} onChange={e => set('club')(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  placeholder="Club name" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Gender</label>
                <select value={profile.gender} onChange={e => set('gender')(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                  <option value="">Select…</option>
                  {['Male','Female','Non-binary','Prefer not to say'].map(g => <option key={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Date of Birth</label>
                <input type="date" value={profile.dob} onChange={e => set('dob')(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Experience</label>
                <select value={profile.experience} onChange={e => set('experience')(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                  <option value="">Select…</option>
                  {EXPERIENCE_LEVELS.map(l => <option key={l}>{l}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Preferred Dive Region</label>
                <select value={profile.region} onChange={e => set('region')(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                  <option value="">Select…</option>
                  {REGIONS.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Emergency Contact</label>
                <input value={profile.emergency_contact} onChange={e => set('emergency_contact')(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  placeholder="Name" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Emergency Phone</label>
                <input value={profile.emergency_phone} onChange={e => set('emergency_phone')(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  placeholder="+64 21 xxx xxxx" />
              </div>
            </div>

            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input type="checkbox" checked={profile.fit_to_dive} onChange={e => set('fit_to_dive')(e.target.checked)} className="mt-0.5 w-5 h-5 flex-shrink-0" />
                <span className="text-sm text-red-900 font-semibold">
                  I confirm I am medically fit and able to participate safely in spearfishing activities. I have no conditions that would prevent safe participation and take full responsibility for my own safety. <span className="text-red-600">*</span>
                </span>
              </label>
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={() => setStep(1)}
                className="flex-1 py-3 rounded-xl border border-gray-300 font-bold text-gray-600 text-sm">← Back</button>
              <button type="submit" disabled={loading}
                className="flex-1 py-3 rounded-xl font-black text-white text-sm disabled:opacity-50"
                style={{ background: '#16a34a' }}>
                {loading ? 'Creating account…' : 'Complete Registration'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ── Login ─────────────────────────────────────────────────────────────────────
function MemberLogin({ navigate }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { data, error: authErr } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (authErr) throw authErr
      // Check for pending profile data from signup form
      const pendingProfileJson = localStorage.getItem('snz_pending_profile')
      const pendingProfile = pendingProfileJson ? JSON.parse(pendingProfileJson) : null

      // Check if profile exists
      const { data: existingProfile } = await supabase.from('members').select('id').eq('id', data.user.id).maybeSingle()

      if (pendingProfile || !existingProfile) {
        // Write full profile data (from signup form or create basic one)
        await supabase.from('members').upsert({
          id: data.user.id,
          ...(pendingProfile || {}),
          email: data.user.email, // always use confirmed email
          membership_year: 2026,
          membership_expires: '2026-12-31',
          membership_status: 'pending',
          membership_fee_cents: 1000,
          payment_status: 'pending',
        }, { onConflict: 'id' })
        localStorage.removeItem('snz_pending_profile')
      }
      navigate('/membership/dashboard')
    } catch (err) {
      setError(err.message === 'Invalid login credentials' ? 'Incorrect email or password.' : err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <MemberHeader />
      <div className="max-w-sm mx-auto px-6 py-14">
        {SNZ_LOGO && <img src={SNZ_LOGO} alt="SNZ" className="h-12 object-contain mx-auto mb-6" />}
        <h1 className="text-2xl font-black text-gray-900 text-center mb-1">Member Sign In</h1>
        <p className="text-gray-400 text-sm text-center mb-6">Spearfishing New Zealand</p>

        {error === 'ALREADY_EXISTS' ? (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 mb-4">
            <p className="font-bold text-amber-900 text-sm mb-1">An account already exists for this email.</p>
            <p className="text-amber-800 text-xs mb-3">If this is you, sign in below. If you've forgotten your password, reset it.</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => navigate('/membership/login')}
                className="flex-1 py-2 rounded-lg text-xs font-bold text-white"
                style={{ background: SNZ_BLUE }}>Sign In</button>
              <button type="button" onClick={() => navigate('/membership/reset')}
                className="flex-1 py-2 rounded-lg text-xs font-bold border border-amber-300 text-amber-800 hover:bg-amber-100">Reset Password</button>
            </div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600 mb-4">{error}</div>
        ) : null}

        <form onSubmit={submit} className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="you@example.com" />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Password</label>
              <button type="button" onClick={() => navigate('/membership/reset')}
                className="text-xs underline" style={{ color: SNZ_BLUE }}>Forgot password?</button>
            </div>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
              onKeyDown={e => e.key === 'Enter' && submit(e)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="Your password" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-xl font-black text-white text-sm disabled:opacity-50"
            style={{ background: SNZ_BLUE }}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
        <p className="text-center text-sm text-gray-400 mt-4">
          Not a member? <button onClick={() => navigate('/membership/signup')} className="underline font-semibold" style={{ color: SNZ_BLUE }}>Join for $10</button>
        </p>
      </div>
    </div>
  )
}

// ── Password Reset Request ────────────────────────────────────────────────────
function PasswordReset({ navigate }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const redirectTo = 'https://spearfishingnz.netlify.app/membership/reset/confirm'
      const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo,
      })
      if (err) {
        // Show the actual Supabase error for diagnosis
        setError(`${err.message} (${err.status || 'no status'})`)
        return
      }
      setSent(true)
    } catch (err) {
      setError(err.message || 'Unknown error — check browser console')
      console.error('Password reset error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (sent) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-sm w-full text-center">
        <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
          <span className="text-blue-600 text-2xl">✉</span>
        </div>
        <h1 className="text-xl font-black text-gray-900 mb-3">Check your email</h1>
        <p className="text-gray-500 text-sm mb-6">If <strong>{email}</strong> is registered, you'll receive a password reset link shortly.</p>
        <button onClick={() => navigate('/membership/login')}
          className="w-full py-3 rounded-xl font-bold text-white text-sm" style={{ background: SNZ_BLUE }}>← Back to Sign In</button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <MemberHeader />
      <div className="max-w-sm mx-auto px-6 py-14">
        <h1 className="text-2xl font-black text-gray-900 mb-1">Reset Password</h1>
        <p className="text-gray-400 text-sm mb-6">Enter your email and we'll send a reset link.</p>
        {error === 'ALREADY_EXISTS' ? (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 mb-4">
            <p className="font-bold text-amber-900 text-sm mb-1">An account already exists for this email.</p>
            <p className="text-amber-800 text-xs mb-3">If this is you, sign in below. If you've forgotten your password, reset it.</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => navigate('/membership/login')}
                className="flex-1 py-2 rounded-lg text-xs font-bold text-white"
                style={{ background: SNZ_BLUE }}>Sign In</button>
              <button type="button" onClick={() => navigate('/membership/reset')}
                className="flex-1 py-2 rounded-lg text-xs font-bold border border-amber-300 text-amber-800 hover:bg-amber-100">Reset Password</button>
            </div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600 mb-4">{error}</div>
        ) : null}
        <form onSubmit={submit} className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="you@example.com" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-xl font-black text-white text-sm disabled:opacity-50"
            style={{ background: SNZ_BLUE }}>
            {loading ? 'Sending…' : 'Send Reset Link'}
          </button>
        </form>
        <p className="text-center text-sm text-gray-400 mt-4">
          <button onClick={() => navigate('/membership/login')} className="underline" style={{ color: SNZ_BLUE }}>← Back to sign in</button>
        </p>
      </div>
    </div>
  )
}

// ── Password Reset Confirm (from email link) ──────────────────────────────────
function PasswordResetConfirm({ navigate }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [sessionReady, setSessionReady] = useState(false)

  useEffect(() => {
    // Supabase sends tokens in URL hash — exchange them for a session
    const hash = window.location.hash
    if (hash && hash.includes('access_token')) {
      const params = new URLSearchParams(hash.replace('#', ''))
      const accessToken = params.get('access_token')
      const refreshToken = params.get('refresh_token')
      if (accessToken) {
        supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken || '' })
          .then(({ error }) => {
            if (error) setError('Invalid or expired reset link. Please request a new one.')
            else setSessionReady(true)
          })
        // Clean the tokens from the URL
        window.history.replaceState({}, '', '/membership/reset/confirm')
        return
      }
    }
    // No hash tokens — check if we already have a session (e.g. page refresh)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true)
      else setError('Invalid or expired reset link. Please request a new one.')
    })
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    setLoading(true)
    try {
      const { error: err } = await supabase.auth.updateUser({ password })
      if (err) throw err
      setDone(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (done) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-sm w-full text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <span className="text-green-600 text-2xl">✓</span>
        </div>
        <h1 className="text-xl font-black text-gray-900 mb-3">Password updated</h1>
        <p className="text-gray-500 text-sm mb-6">You can now sign in with your new password.</p>
        <button onClick={() => navigate('/membership/login')}
          className="w-full py-3 rounded-xl font-bold text-white text-sm" style={{ background: SNZ_BLUE }}>Sign In</button>
      </div>
    </div>
  )

  if (!sessionReady && !error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <p className="text-gray-400 text-sm">Verifying reset link…</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <MemberHeader />
      <div className="max-w-sm mx-auto px-6 py-14">
        <h1 className="text-2xl font-black text-gray-900 mb-1">Set New Password</h1>
        <p className="text-gray-400 text-sm mb-6">Choose a strong password for your SNZ account.</p>
        {error === 'ALREADY_EXISTS' ? (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 mb-4">
            <p className="font-bold text-amber-900 text-sm mb-1">An account already exists for this email.</p>
            <p className="text-amber-800 text-xs mb-3">If this is you, sign in below. If you've forgotten your password, reset it.</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => navigate('/membership/login')}
                className="flex-1 py-2 rounded-lg text-xs font-bold text-white"
                style={{ background: SNZ_BLUE }}>Sign In</button>
              <button type="button" onClick={() => navigate('/membership/reset')}
                className="flex-1 py-2 rounded-lg text-xs font-bold border border-amber-300 text-amber-800 hover:bg-amber-100">Reset Password</button>
            </div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600 mb-4">{error}</div>
        ) : null}
        <form onSubmit={submit} className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">New Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoFocus
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="At least 8 characters" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Confirm Password</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="Repeat your password" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-xl font-black text-white text-sm disabled:opacity-50"
            style={{ background: SNZ_BLUE }}>
            {loading ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  )
}


// ── Complete Payment Button ───────────────────────────────────────────────────
function CompletePaymentButton({ team, comp, member, showToast }) {
  const [loading, setLoading] = useState(false)

  const handlePay = async () => {
    setLoading(true)
    try {
      const isNationals = comp?.name?.toLowerCase().includes('nationals')
      const catFees = comp?.category_fees || {}
      const cents = isNationals
        ? (team.entry_fee_cents || comp?.entry_fee_cents || 0)
        : (catFees[team.category] != null ? catFees[team.category] : (comp?.entry_fee_cents || 0))
      if (!cents || cents === 0) { showToast('No fee required for this entry', 'error'); setLoading(false); return }

      const type = isNationals ? 'nationals_entry' : 'competition_entry'
      const successUrl = isNationals
        ? `${window.location.origin}/nationals/register?payment=success&team=${team.id}`
        : `${window.location.origin}/membership/dashboard?payment=success`
      const cancelUrl = isNationals
        ? `${window.location.origin}/nationals/register?cancelled=1`
        : `${window.location.origin}/membership/dashboard`

      const res = await fetch('/.netlify/functions/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          amountCents: cents,
          memberId: member?.id,
          memberEmail: member?.email,
          memberName: member?.name,
          teamId: team.id,
          competitionId: comp?.id,
          competitionName: comp?.name,
        }),
      })
      const { url, error } = await res.json()
      if (error) throw new Error(error)
      window.location.href = url
    } catch (err) {
      showToast('Payment error: ' + err.message, 'error')
      setLoading(false)
    }
  }

  return (
    <button onClick={handlePay} disabled={loading}
      className="px-3 py-1.5 rounded-lg text-xs font-black text-white flex-shrink-0 disabled:opacity-50"
      style={{ background: '#dc2626' }}>
      {loading ? 'Redirecting…' : 'Pay now →'}
    </button>
  )
}

// ── Photo Carousel ────────────────────────────────────────────────────────────
function PhotoCarousel({ photos }) {
  const [idx, setIdx] = useState(0)
  if (!photos || photos.length === 0) return null
  return (
    <div className="mt-3 relative rounded-xl overflow-hidden bg-gray-100" style={{ aspectRatio: '16/9' }}>
      <img
        src={photos[idx]}
        alt={`Photo ${idx + 1} of ${photos.length}`}
        className="w-full h-full object-cover"
      />
      {photos.length > 1 && (
        <>
          <button type="button"
            onClick={() => setIdx((idx - 1 + photos.length) % photos.length)}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/50 text-white text-base flex items-center justify-center hover:bg-black/70">‹</button>
          <button type="button"
            onClick={() => setIdx((idx + 1) % photos.length)}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-black/50 text-white text-base flex items-center justify-center hover:bg-black/70">›</button>
          <div className="absolute bottom-2 right-2 text-xs text-white bg-black/40 px-2 py-0.5 rounded-full">
            {idx + 1} / {photos.length}
          </div>
        </>
      )}
    </div>
  )
}

// ── My Competitions ───────────────────────────────────────────────────────────
function MyCompetitions({ session, memberId, member, showToast }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [changingBuddy, setChangingBuddy] = useState(null) // team id
  const [newBuddyEmail, setNewBuddyEmail] = useState('')
  const [buddyLookup, setBuddyLookup] = useState(null) // found member or null
  const [checkingBuddy, setCheckingBuddy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingTeamName, setEditingTeamName] = useState(null) // team id
  const [newTeamName, setNewTeamName] = useState('')
  const [editingBoat, setEditingBoat] = useState(null) // team id
  const [newBoatName, setNewBoatName] = useState('')
  const [newBoatDetails, setNewBoatDetails] = useState('')

  const fetchEntries = async () => {
    if (!memberId) return
    // Get teams where this member is Diver 1 or Diver 2
    const { data: d1Teams } = await supabase
      .from('comp_teams')
      .select('*, competition:competitions(id, name, date_start, status, club_name, registration_cutoff, entry_fee_cents, category_fees)')
      .eq('diver1_member_id', memberId)
      .neq('status', 'withdrawn')
      .order('id', { ascending: false })

    const { data: d2Teams } = await supabase
      .from('comp_teams')
      .select('*, competition:competitions(id, name, date_start, status, club_name, registration_cutoff, entry_fee_cents, category_fees)')
      .eq('diver2_member_id', memberId)
      .neq('status', 'withdrawn')
      .order('id', { ascending: false })

    // Merge, deduplicate by id
    const all = [...(d1Teams || []), ...(d2Teams || [])]
    const seen = new Set()
    const unique = all.filter(t => { if (seen.has(t.id)) return false; seen.add(t.id); return true })

    // Fetch partner details for each team
    for (const team of unique) {
      const isDiver1 = team.diver1_member_id === memberId
      const partnerId = isDiver1 ? team.diver2_member_id : team.diver1_member_id
      const partnerEmail = isDiver1 ? team.diver2_email : null
      if (partnerId) {
        const { data: partner } = await supabase.from('members').select('name, email').eq('id', partnerId).single()
        team._partner = partner
      } else if (partnerEmail) {
        team._partner = { name: 'Pending', email: partnerEmail }
      }
      team._isDiver1 = isDiver1
    }

    const withPhotos = await fetchWeighinPhotos(unique)
    setEntries(withPhotos)
    setLoading(false)
  }

  const fetchWeighinPhotos = async (teams) => {
    const teamIds = teams.map(t => t.id)
    if (!teamIds.length) return teams
    const { data: weighins } = await supabase
      .from('comp_weighins')
      .select('team_id, catch_photo_url')
      .in('team_id', teamIds)
      .not('catch_photo_url', 'is', null)
      .neq('catch_photo_url', '')
    const byTeam = {}
    for (const w of (weighins || [])) {
      if (!byTeam[w.team_id]) byTeam[w.team_id] = []
      byTeam[w.team_id].push(w.catch_photo_url)
    }
    return teams.map(t => ({
      ...t,
      _photos: [
        ...(t.team_photo_url ? [t.team_photo_url] : []),
        ...(byTeam[t.id] || []),
      ]
    }))
  }

  useEffect(() => { fetchEntries() }, [memberId])

  const isCutoffPassed = (comp) => {
    if (!comp?.registration_cutoff) return false
    return new Date() > new Date(comp.registration_cutoff)
  }

  const checkBuddy = async () => {
    if (!newBuddyEmail.trim()) return
    setCheckingBuddy(true)
    const { data } = await supabase.from('members').select('id, name, email, payment_status, membership_status')
      .eq('email', newBuddyEmail.trim().toLowerCase()).maybeSingle()
    setBuddyLookup(data || false) // false = checked, not found
    setCheckingBuddy(false)
  }

  const changeBuddy = async (team) => {
    if (!newBuddyEmail.trim()) return
    setSaving(true)
    try {
      const d2Email = newBuddyEmail.trim().toLowerCase()
      // Active if buddy is a confirmed SNZ member (paid or fee-waived), otherwise pending
      const newStatus = buddyLookup && (buddyLookup.payment_status === 'paid' || buddyLookup.membership_status === 'active') ? 'active' : 'pending_diver2'

      await supabase.from('comp_teams').update({
        diver2_email: d2Email,
        diver2_member_id: buddyLookup?.id || null,
        diver2_accepted_at: buddyLookup ? new Date().toISOString() : null,
        diver2_invite_sent: false,
        status: newStatus,
      }).eq('id', team.id)

      // Send invite if not a member
      if (!buddyLookup) {
        await fetch('/.netlify/functions/invite-member', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: d2Email,
            invitedBy: session?.user?.email,
            compName: team.competition?.name,
            teamName: team.team_name,
          })
        })
        showToast('Buddy updated — invite sent to ' + d2Email)
      } else {
        showToast('Buddy updated — ' + buddyLookup.name)
      }

      setChangingBuddy(null)
      setNewBuddyEmail('')
      setBuddyLookup(null)
      fetchEntries()
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const withdraw = async (team) => {
    if (!confirm(`Withdraw from ${team.competition?.name}? This cannot be undone. Entry fees are non-refundable.`)) return
    await supabase.from('comp_teams').update({
      status: 'withdrawn',
      withdrawn_at: new Date().toISOString(),
      withdrawn_by: memberId,
    }).eq('id', team.id)
    showToast('Withdrawn from ' + team.competition?.name)
    fetchEntries()
  }

  const saveTeamName = async (team) => {
    const name = newTeamName.trim()
    if (!name) return
    setSaving(true)
    const { error } = await supabase.from('comp_teams').update({ team_name: name }).eq('id', team.id)
    setSaving(false)
    if (error) { showToast('Failed to update team name', 'error'); return }
    showToast('Team name updated')
    setEditingTeamName(null)
    setNewTeamName('')
    fetchEntries()
  }

  const saveBoat = async (team) => {
    setSaving(true)
    const { error } = await supabase.from('comp_teams').update({
      boat_name: newBoatName.trim() || null,
      boat_details: newBoatDetails.trim() || null,
    }).eq('id', team.id)
    setSaving(false)
    if (error) { showToast('Failed to update boat details', 'error'); return }
    showToast('Boat details updated')
    setEditingBoat(null)
    setNewBoatName('')
    setNewBoatDetails('')
    fetchEntries()
  }

  const statusBadge = (team) => {
    if (team.status === 'active') return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">✓ Active</span>
    if (team.status === 'pending_payment') return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">⚠ Payment required</span>
    if (team.status === 'pending_diver2') return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">⏳ Awaiting partner</span>
    return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{team.status}</span>
  }

  if (loading) return <div className="bg-white border border-gray-200 rounded-2xl p-5 text-center text-gray-400 text-sm">Loading competitions…</div>

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="font-black text-gray-900">My Competitions — 2026</h3>
      </div>

      {entries.length === 0 ? (
        <div className="px-5 py-8 text-center text-gray-400 text-sm">
          No competitions registered yet.
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {entries.map(team => {
            const comp = team.competition
            const cutoffPassed = isCutoffPassed(comp)
            const isChanging = changingBuddy === team.id
            const isEditingName = editingTeamName === team.id
            const isEditingBoatDetails = editingBoat === team.id

            return (
              <div key={team.id} className="px-5 py-4">
                {/* Comp header */}
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div>
                    <p className="font-bold text-gray-900 text-sm">{comp?.name}</p>
                    <p className="text-xs text-gray-400">
                      {comp?.club_name}
                      {comp?.date_start && ` · ${new Date(comp.date_start).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {statusBadge(team)}
                    {team.payment_status === 'paid'
                      ? <span className="text-xs text-green-600 font-semibold">✓ Paid</span>
                      : comp?.entry_fee_cents > 0
                        ? <span className="text-xs text-amber-600 font-semibold">⚠ Payment due</span>
                        : null
                    }
                  </div>
                </div>

                {/* Partner info */}
                <div className="bg-gray-50 rounded-xl px-3 py-2 mb-3 text-xs">
                  <span className="text-gray-500">Partner: </span>
                  {team._partner
                    ? <><span className="font-semibold text-gray-800">{team._partner.name}</span>
                       <span className="text-gray-400"> · {team._partner.email}</span>
                       {team.status === 'pending_diver2' && <span className="ml-2 text-amber-600 font-semibold">Invite pending</span>}</>
                    : <span className="text-gray-400 italic">No partner</span>
                  }
                </div>

                {/* Team name */}
                <div className="bg-gray-50 rounded-xl px-3 py-2 mb-3 text-xs">
                  <span className="text-gray-500">Team name: </span>
                  <span className="font-semibold text-gray-800">{team.team_name || <span className="italic text-gray-400">Not set</span>}</span>
                </div>

                {/* Boat */}
                <div className="bg-gray-50 rounded-xl px-3 py-2 mb-3 text-xs">
                  <span className="text-gray-500">Boat: </span>
                  {team.boat_name
                    ? <><span className="font-semibold text-gray-800">{team.boat_name}</span>
                       {team.boat_details && <span className="text-gray-400"> · {team.boat_details}</span>}</>
                    : <span className="italic text-gray-400">Not set</span>
                  }
                </div>

                {/* Team name edit form */}
                {isEditingName ? (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-3">
                    <p className="text-xs font-bold text-blue-800 mb-2">Enter new team name</p>
                    <input
                      type="text"
                      value={newTeamName}
                      onChange={e => setNewTeamName(e.target.value)}
                      placeholder="Team name"
                      maxLength={60}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 mb-2"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => { setEditingTeamName(null); setNewTeamName('') }}
                        className="flex-1 py-2 rounded-lg text-xs font-bold border border-gray-300 text-gray-600">Cancel</button>
                      <button onClick={() => saveTeamName(team)}
                        disabled={saving || !newTeamName.trim()}
                        className="flex-1 py-2 rounded-lg text-xs font-bold text-white disabled:opacity-40"
                        style={{ background: SNZ_BLUE }}>
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  </div>
                ) : null}

                {/* Boat edit form */}
                {isEditingBoatDetails ? (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-3">
                    <p className="text-xs font-bold text-blue-800 mb-2">Enter boat details</p>
                    <input
                      type="text"
                      value={newBoatName}
                      onChange={e => setNewBoatName(e.target.value)}
                      placeholder="Boat name (e.g. Sea Breeze)"
                      maxLength={80}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 mb-2"
                    />
                    <input
                      type="text"
                      value={newBoatDetails}
                      onChange={e => setNewBoatDetails(e.target.value)}
                      placeholder="Details (e.g. 5m aluminium, reg. NZ1234)"
                      maxLength={200}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 mb-2"
                    />
                    <div className="flex gap-2">
                      <button onClick={() => { setEditingBoat(null); setNewBoatName(''); setNewBoatDetails('') }}
                        className="flex-1 py-2 rounded-lg text-xs font-bold border border-gray-300 text-gray-600">Cancel</button>
                      <button onClick={() => saveBoat(team)}
                        disabled={saving}
                        className="flex-1 py-2 rounded-lg text-xs font-bold text-white disabled:opacity-40"
                        style={{ background: SNZ_BLUE }}>
                        {saving ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  </div>
                ) : null}

                {/* Buddy change form */}
                {isChanging ? (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-3">
                    <p className="text-xs font-bold text-blue-800 mb-2">Enter new partner's email</p>
                    <div className="flex gap-2 mb-2">
                      <input type="email" value={newBuddyEmail}
                        onChange={e => { setNewBuddyEmail(e.target.value); setBuddyLookup(null) }}
                        placeholder="partner@email.com"
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                      <button onClick={checkBuddy} disabled={checkingBuddy || !newBuddyEmail.trim()}
                        className="px-3 py-2 rounded-lg text-xs font-bold border border-gray-300 text-gray-700 hover:bg-white disabled:opacity-40">
                        {checkingBuddy ? '…' : 'Look up'}
                      </button>
                    </div>
                    {buddyLookup && (
                      <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-2">
                        ✓ SNZ member found — {buddyLookup.name}
                      </div>
                    )}
                    {buddyLookup === false && (
                      <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-2">
                        Not an SNZ member — they'll receive an invite email
                      </div>
                    )}
                    <div className="flex gap-2">
                      <button onClick={() => { setChangingBuddy(null); setNewBuddyEmail(''); setBuddyLookup(null) }}
                        className="flex-1 py-2 rounded-lg text-xs font-bold border border-gray-300 text-gray-600">Cancel</button>
                      <button onClick={() => changeBuddy(team)}
                        disabled={saving || !newBuddyEmail.trim() || buddyLookup === null}
                        className="flex-1 py-2 rounded-lg text-xs font-bold text-white disabled:opacity-40"
                        style={{ background: SNZ_BLUE }}>
                        {saving ? 'Saving…' : 'Confirm change'}
                      </button>
                    </div>
                  </div>
                ) : null}

                {/* Complete Payment banner */}
                {team.status === 'pending_payment' && team.payment_status !== 'paid' && (
                  <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-black text-red-800">Entry fee outstanding</p>
                      <p className="text-xs text-red-600">
                        Payment required to confirm your entry
                      </p>
                    </div>
                    <CompletePaymentButton team={team} comp={comp} member={member} showToast={showToast} />
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 flex-wrap">
                  {!cutoffPassed && !isChanging && !isEditingName && !isEditingBoatDetails && team.status !== 'pending_payment' && (
                    <button onClick={() => { setChangingBuddy(team.id); setNewBuddyEmail(''); setBuddyLookup(null) }}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-300 text-gray-600 hover:bg-gray-50">
                      Change buddy
                    </button>
                  )}
                  {!cutoffPassed && !isChanging && !isEditingName && !isEditingBoatDetails && team.status !== 'pending_payment' && (
                    <button onClick={() => { setEditingTeamName(team.id); setNewTeamName(team.team_name || '') }}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-300 text-gray-600 hover:bg-gray-50">
                      Edit team name
                    </button>
                  )}
                  {!cutoffPassed && !isChanging && !isEditingName && !isEditingBoatDetails && team.status !== 'pending_payment' && (
                    <button onClick={() => { setEditingBoat(team.id); setNewBoatName(team.boat_name || ''); setNewBoatDetails(team.boat_details || '') }}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-300 text-gray-600 hover:bg-gray-50">
                      Edit boat
                    </button>
                  )}
                  {cutoffPassed && (
                    <span className="text-xs text-gray-400 italic">Registration closed</span>
                  )}
                  {!cutoffPassed && (
                    <button onClick={() => withdraw(team)}
                      className="px-3 py-1.5 rounded-lg text-xs font-bold border border-red-200 text-red-500 hover:bg-red-50">
                      Withdraw
                    </button>
                  )}
                </div>

                <PhotoCarousel photos={team._photos} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}


// ── Install App Card ──────────────────────────────────────────────────────────
function InstallAppCard() {
  const [isInstalled, setIsInstalled] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [showIOSSteps, setShowIOSSteps] = useState(false)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    // Already installed as PWA
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) {
      setIsInstalled(true)
      return
    }
    const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent) && !window.MSStream
    setIsIOS(ios)

    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault()
      setDeferredPrompt(e)
    })
  }, [])

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      if (outcome === 'accepted') setInstalled(true)
    }
  }

  if (isInstalled || installed) return (
    <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-3 flex items-center gap-3">
      <span className="text-green-600 text-lg">✓</span>
      <p className="text-sm font-bold text-green-800">SNZ Hub is installed on your device</p>
    </div>
  )

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5">
      <div className="flex items-center gap-3 mb-3">
        <img src="/icons/icon-192.png" alt="SNZ" className="w-10 h-10 rounded-xl border border-gray-100" />
        <div>
          <h3 className="font-black text-gray-900">Add SNZ Hub to your Home Screen</h3>
          <p className="text-xs text-gray-400">Quick access — works like an app</p>
        </div>
      </div>

      {isIOS ? (
        <>
          {!showIOSSteps ? (
            <button onClick={() => setShowIOSSteps(true)}
              className="w-full py-2.5 rounded-xl text-sm font-bold text-white"
              style={{ background: '#2B6CB0' }}>
              Show me how →
            </button>
          ) : (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 space-y-2">
              <p className="font-bold mb-2">3 quick steps in Safari:</p>
              <p>1. Tap the <strong>Share button</strong> <span className="text-base">⎋</span> at the bottom of the screen</p>
              <p>2. Scroll down and tap <strong>"Add to Home Screen"</strong></p>
              <p>3. Tap <strong>"Add"</strong> in the top right</p>
              <p className="text-xs text-blue-600 pt-1">The SNZ Hub icon will appear on your home screen — tap it to open the app directly.</p>
            </div>
          )}
        </>
      ) : deferredPrompt ? (
        <button onClick={handleInstall}
          className="w-full py-2.5 rounded-xl text-sm font-bold text-white"
          style={{ background: '#2B6CB0' }}>
          Install SNZ Hub
        </button>
      ) : (
        <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-500">
          Open this page in your browser (not in-app) to install SNZ Hub on your home screen.
        </div>
      )}
    </div>
  )
}

// ── Change Password ───────────────────────────────────────────────────────────
function ChangePassword({ session, showToast, navigate }) {
  const [mode, setMode] = useState('idle') // 'idle' | 'form'
  const [current, setCurrent] = useState('')
  const [newPwd, setNewPwd] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)

  const save = async (e) => {
    e.preventDefault()
    if (newPwd.length < 8) { showToast('Password must be at least 8 characters', 'error'); return }
    if (newPwd !== confirm) { showToast('Passwords do not match', 'error'); return }
    setLoading(true)
    try {
      // Re-authenticate first with current password
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: session.user.email, password: current
      })
      if (signInErr) throw new Error('Current password is incorrect')
      // Then update
      const { error } = await supabase.auth.updateUser({ password: newPwd })
      if (error) throw error
      showToast('Password updated successfully')
      setMode('idle'); setCurrent(''); setNewPwd(''); setConfirm('')
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5">
      <h3 className="font-black text-gray-900 mb-1">Password</h3>
      {mode === 'idle' ? (
        <div className="flex gap-3 flex-wrap mt-2">
          <button onClick={() => setMode('form')}
            className="px-4 py-2 rounded-lg text-sm font-bold border border-gray-300 text-gray-700 hover:bg-gray-50">
            Change password
          </button>
          <button onClick={() => navigate('/membership/reset')}
            className="px-4 py-2 rounded-lg text-sm font-bold border border-gray-300 text-gray-500 hover:bg-gray-50">
            Send reset email
          </button>
        </div>
      ) : (
        <form onSubmit={save} className="space-y-3 mt-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Current password</label>
            <input type="password" value={current} onChange={e => setCurrent(e.target.value)} required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">New password</label>
            <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} required
              placeholder="At least 8 characters"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">Confirm new password</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setMode('idle')}
              className="flex-1 py-2 rounded-xl border border-gray-300 text-sm font-bold text-gray-600">Cancel</button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-50"
              style={{ background: '#2B6CB0' }}>
              {loading ? 'Saving…' : 'Update Password'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

// ── Cancel Membership ─────────────────────────────────────────────────────────
function CancelMembership({ session, showToast, onSignOut }) {
  const [step, setStep] = useState('idle') // 'idle' | 'confirm' | 'cancelling'

  const handleCancel = async () => {
    setStep('cancelling')
    try {
      const { error } = await supabase.from('members').update({
        membership_status: 'cancelled',
        payment_status: 'cancelled',
        cancelled_at: new Date().toISOString(),
      }).eq('id', session.user.id)
      if (error) throw error
      showToast('Membership cancelled. You can rejoin at any time.')
      // Sign out after a short delay so they see the toast
      setTimeout(() => onSignOut(), 2000)
    } catch (err) {
      showToast(err.message, 'error')
      setStep('confirm')
    }
  }

  if (step === 'idle') return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5">
      <h3 className="font-black text-gray-900 mb-1">Cancel My Membership</h3>
      <p className="text-xs text-gray-400 mb-3">Resign from SNZ. Your records are retained as required by law. You can rejoin at any time.</p>
      <button onClick={() => setStep('confirm')}
        className="px-4 py-2 rounded-lg text-sm font-bold border border-red-200 text-red-500 hover:bg-red-50 transition">
        Cancel membership
      </button>
    </div>
  )

  if (step === 'confirm') return (
    <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-5">
      <h3 className="font-black text-red-800 mb-2">Cancel your SNZ membership?</h3>
      <div className="text-sm text-red-700 space-y-2 mb-5">
        <p>This will resign you from SNZ. Your membership will be set to inactive.</p>
        <p>Your records are kept as required under the Incorporated Societies Act 2022. You can rejoin at any time and your member history will be preserved.</p>
      </div>
      <div className="flex gap-3">
        <button onClick={() => setStep('idle')}
          className="flex-1 py-2.5 rounded-xl border border-gray-300 text-sm font-bold text-gray-600 hover:bg-white transition">
          Keep my membership
        </button>
        <button onClick={handleCancel} disabled={step === 'cancelling'}
          className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 transition">
          {step === 'cancelling' ? 'Cancelling…' : 'Yes, cancel membership'}
        </button>
      </div>
    </div>
  )

  return (
    <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center text-red-600 text-sm font-semibold">
      Cancelling membership…
    </div>
  )
}

// ── Request Data Removal ──────────────────────────────────────────────────────
function RequestDataRemoval({ session, member, showToast }) {
  const [step, setStep] = useState('idle') // 'idle' | 'confirm' | 'sending' | 'done'

  const handleRequest = async () => {
    setStep('sending')
    try {
      // Flag the request on their member record — admin handles manually
      const { error } = await supabase.from('members').update({
        data_removal_requested_at: new Date().toISOString(),
      }).eq('id', session.user.id)
      if (error) throw error
      setStep('done')
    } catch (err) {
      showToast(err.message, 'error')
      setStep('confirm')
    }
  }

  if (step === 'done') return (
    <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5">
      <h3 className="font-black text-gray-900 mb-1">Request received</h3>
      <p className="text-xs text-gray-500">Your data removal request has been logged. SNZ will be in touch within 30 days. Note that some records must be retained for legal and financial purposes.</p>
    </div>
  )

  if (step === 'idle') return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5">
      <h3 className="font-black text-gray-900 mb-1">Request Data Removal</h3>
      <p className="text-xs text-gray-400 mb-3">Submit a request for SNZ to remove your personal details. This is handled manually by the administrator. Financial and membership records may be retained as required by law.</p>
      <button onClick={() => setStep('confirm')}
        className="px-4 py-2 rounded-lg text-sm font-bold border border-gray-300 text-gray-500 hover:bg-gray-50 transition">
        Request removal of my data
      </button>
    </div>
  )

  if (step === 'confirm') return (
    <div className="bg-gray-50 border-2 border-gray-300 rounded-2xl p-5">
      <h3 className="font-black text-gray-900 mb-2">Request data removal?</h3>
      <div className="text-sm text-gray-600 space-y-2 mb-5">
        <p>This submits a request to the SNZ administrator to remove your personal details. SNZ will respond within 30 days.</p>
        <p className="text-xs text-gray-400">Note: some records (membership history, financial records) must be retained for up to 7 years under the Incorporated Societies Act 2022 and financial regulations. These will be anonymised where possible.</p>
      </div>
      <div className="flex gap-3">
        <button onClick={() => setStep('idle')}
          className="flex-1 py-2.5 rounded-xl border border-gray-300 text-sm font-bold text-gray-600 hover:bg-white transition">
          Cancel
        </button>
        <button onClick={handleRequest} disabled={step === 'sending'}
          className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 transition"
          style={{ background: '#2B6CB0' }}>
          {step === 'sending' ? 'Submitting…' : 'Submit request'}
        </button>
      </div>
    </div>
  )

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-2xl p-5 text-center text-gray-500 text-sm">
      Submitting request…
    </div>
  )
}

// ── Member Dashboard ──────────────────────────────────────────────────────────
function MemberDashboard({ session, navigate, onSignOut }) {
  const [member, setMember] = useState(null)

  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const { checkout, loading: checkoutLoading, error: checkoutError } = useStripeCheckout()
  const set = k => v => setForm(f => ({ ...f, [k]: v }))
  const showToast = (msg, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),3000) }

  useEffect(() => {
    if (!session) return
    const params = new URLSearchParams(window.location.search)
    const justPaid = params.get('payment') === 'success'

    const load = async () => {
      // If returning from Stripe, activate membership directly then reload
      if (justPaid) {
        await supabase.from('members').update({
          payment_status: 'paid',
          membership_status: 'active',
          paid_at: new Date().toISOString(),
        }).eq('id', session.user.id)
        window.history.replaceState({}, '', '/membership/dashboard')
      }

      const { data: m } = await supabase.from('members').select('*').eq('id', session.user.id).single()
      setMember(m)
      setForm(m || {})
      setLoading(false)
      if (justPaid) showToast('Payment confirmed — membership activated!')
    }
    load()
  }, [session])

  const save = async () => {
    setSaving(true)
    const { id, created_at, updated_at, member_number, membership_year, membership_expires, membership_status, ...rest } = form
    const { error } = await supabase.from('members').update({ ...rest, updated_at: new Date().toISOString() }).eq('id', session.user.id)
    if (error) showToast(error.message, 'error')
    else { setMember(form); setEditing(false); showToast('Profile saved') }
    setSaving(false)
  }

  const isExpired = member && new Date(member.membership_expires) < new Date()

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Loading…</div>

  return (
    <div className="min-h-screen bg-gray-50">
      {toast && <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-semibold shadow-lg ${toast.type==='error'?'bg-red-600 text-white':'bg-green-600 text-white'}`}>{toast.msg}</div>}
      <MemberHeader session={session} onSignOut={onSignOut} />

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-5">

        {/* Membership card */}
        <div className="rounded-2xl text-white p-6 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${SNZ_BLUE}, #1a4a80)` }}>
          {SNZ_LOGO && <img src={SNZ_LOGO} alt="SNZ" className="h-12 object-contain mb-4" style={{ filter: 'brightness(0) invert(1)' }} />}
          <div className="flex items-start justify-between">
            <div>
              <p className="text-blue-200 text-xs font-bold tracking-widest uppercase mb-1">SNZ Member</p>
              <h2 className="text-2xl font-black">{member?.name || 'Member'}</h2>
              <p className="text-blue-200 text-sm mt-0.5">{member?.club || 'No club set'}</p>
            </div>
            <div className="text-right">
              <p className="text-blue-200 text-xs font-bold tracking-widest uppercase mb-1">Number</p>
              <p className="text-xl font-black">{member?.member_number || '—'}</p>
            </div>
          </div>
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/20">
            <div>
              <p className="text-blue-200 text-xs">Expires</p>
              <p className="font-bold">{MEMBERSHIP_EXPIRES}</p>
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-black ${
              isExpired ? 'bg-red-500'
              : member?.payment_status === 'pending' && member?.membership_fee_cents > 0 ? 'bg-amber-500'
              : 'bg-green-500'
            }`}>
              {isExpired ? 'EXPIRED'
                : member?.payment_status === 'pending' && member?.membership_fee_cents > 0 ? '⚠ PAYMENT DUE'
                : '● ACTIVE'}
            </div>
          </div>
        </div>

        {/* Payment / fee card — only shown if a membership fee is set */}
        {member?.membership_fee_cents > 0 && member?.payment_status !== 'paid' && (
          <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5">
            <h3 className="font-black text-amber-900 mb-1">Membership Fee Due</h3>
            <p className="text-sm text-amber-800 mb-4">
              An annual membership fee of <strong>${(member.membership_fee_cents / 100).toFixed(2)}</strong> applies for {member.membership_year}. Pay now to maintain your active membership status.
            </p>
            {checkoutError && <p className="text-xs text-red-600 mb-2">{checkoutError}</p>}
            <button
              onClick={() => checkout({
                type: 'membership',
                memberId: session.user.id,
                amountCents: member.membership_fee_cents,
                description: `SNZ Membership ${member.membership_year}`,
                memberEmail: session.user.email,
                memberName: member.name,
              })}
              disabled={checkoutLoading}
              className="px-6 py-3 rounded-xl font-black text-white text-sm disabled:opacity-50"
              style={{ background: '#d97706' }}>
              {checkoutLoading ? 'Redirecting…' : `Pay $${(member.membership_fee_cents / 100).toFixed(2)} NZD`}
            </button>
          </div>
        )}

        {member?.payment_status === 'paid' && member?.membership_fee_cents > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-2xl px-5 py-3 flex items-center gap-3">
            <span className="text-green-600 font-black text-lg">✓</span>
            <div>
              <p className="font-bold text-green-800 text-sm">Membership fee paid</p>
              <p className="text-xs text-green-600">{member.paid_at ? new Date(member.paid_at).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}</p>
            </div>
          </div>
        )}

        {/* Profile */}
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h3 className="font-black text-gray-900">My Details</h3>
            <button onClick={() => editing ? save() : setEditing(true)} disabled={saving}
              className="px-4 py-1.5 rounded-lg text-sm font-bold text-white disabled:opacity-50"
              style={{ background: editing ? '#16a34a' : SNZ_BLUE }}>
              {saving ? 'Saving…' : editing ? 'Save' : 'Edit'}
            </button>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              ['name','Full Name','text'],['phone','Phone','text'],['club','Club','text'],
            ].map(([k,lbl,type]) => (
              <div key={k} className={k==='name'?'sm:col-span-2':''}>
                <label className="block text-xs font-semibold text-gray-400 mb-1">{lbl}</label>
                {editing
                  ? <input type={type} value={form[k]||''} onChange={e => set(k)(e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                  : <p className="text-sm font-semibold text-gray-900">{member?.[k] || <span className="text-gray-300">—</span>}</p>
                }
              </div>
            ))}
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Gender</label>
              {editing
                ? <select value={form.gender||''} onChange={e => set('gender')(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                    <option value="">Select…</option>
                    {['Male','Female','Non-binary','Prefer not to say'].map(g=><option key={g}>{g}</option>)}
                  </select>
                : <p className="text-sm font-semibold text-gray-900">{member?.gender || <span className="text-gray-300">—</span>}</p>
              }
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Date of Birth</label>
              {editing
                ? <input type="date" value={form.dob||''} onChange={e => set('dob')(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                : <p className="text-sm font-semibold text-gray-900">{member?.dob || <span className="text-gray-300">—</span>}</p>
              }
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Experience</label>
              {editing
                ? <select value={form.experience||''} onChange={e => set('experience')(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                    <option value="">Select…</option>
                    {EXPERIENCE_LEVELS.map(l=><option key={l}>{l}</option>)}
                  </select>
                : <p className="text-sm font-semibold text-gray-900">{member?.experience || <span className="text-gray-300">—</span>}</p>
              }
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Dive Region</label>
              {editing
                ? <select value={form.region||''} onChange={e => set('region')(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                    <option value="">Select…</option>
                    {REGIONS.map(r=><option key={r}>{r}</option>)}
                  </select>
                : <p className="text-sm font-semibold text-gray-900">{member?.region || <span className="text-gray-300">—</span>}</p>
              }
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Emergency Contact</label>
              {editing
                ? <input value={form.emergency_contact||''} onChange={e => set('emergency_contact')(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                : <p className="text-sm font-semibold text-gray-900">{member?.emergency_contact || <span className="text-gray-300">—</span>}</p>
              }
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Emergency Phone</label>
              {editing
                ? <input value={form.emergency_phone||''} onChange={e => set('emergency_phone')(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                : <p className="text-sm font-semibold text-gray-900">{member?.emergency_phone || <span className="text-gray-300">—</span>}</p>
              }
            </div>
            {editing && (
              <div className="sm:col-span-2">
                <button onClick={() => setEditing(false)} className="text-sm text-gray-400 hover:text-gray-600 underline">Cancel</button>
              </div>
            )}
          </div>
        </div>

        {/* Install App */}
        <InstallAppCard />

        {/* Password change */}
        <ChangePassword session={session} showToast={showToast} navigate={navigate} />

        {/* Cancel membership / data removal */}
        <CancelMembership session={session} showToast={showToast} onSignOut={onSignOut} />
        {/* RequestDataRemoval hidden for now */}

        {/* Competition management */}
        <MyCompetitions session={session} memberId={session?.user?.id} member={member} showToast={showToast} />
      </div>
    </div>
  )
}


// ── Invited Member (Diver 2 email link landing) ───────────────────────────────
function InvitedMember({ navigate }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [inviteData, setInviteData] = useState(null)

  useEffect(() => {
    // Handle invite token from URL — Supabase passes tokens in hash or query params
    const hash = window.location.hash
    const params = new URLSearchParams(window.location.search)
    const accessToken = params.get('access_token') || 
      (hash ? new URLSearchParams(hash.replace('#', '')).get('access_token') : null)

    if (accessToken) {
      // Set the session from the invite token
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user?.user_metadata) {
          setInviteData(session.user.user_metadata)
        }
      })
    }
  }, [])

  const submit = async (e) => {
    e.preventDefault()
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    setLoading(true)
    try {
      const { error: err } = await supabase.auth.updateUser({ password })
      if (err) throw err
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // Upsert member profile
        await supabase.from('members').upsert({
          id: user.id,
          email: user.email,
          name: inviteData?.name || '',
          membership_year: 2026,
          membership_expires: '2026-12-31',
          membership_status: 'pending',
          membership_fee_cents: 1000,
          payment_status: 'pending',
        }, { onConflict: 'id' })

        // Find pending teams for this email and activate them
        const { data: pendingTeams } = await supabase
          .from('comp_teams').select('id, competition_id')
          .eq('diver2_email', user.email).eq('status', 'pending_diver2')

        for (const team of (pendingTeams || [])) {
          await supabase.from('comp_teams').update({
            diver2_member_id: user.id,
            diver2_accepted_at: new Date().toISOString(),
            status: 'active',
          }).eq('id', team.id)
          await supabase.from('member_competitions').upsert({
            member_id: user.id,
            competition_id: team.competition_id,
            team_id: team.id,
            year: 2026,
          }, { onConflict: 'member_id,competition_id' })
        }
      }
      setDone(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (done) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-sm w-full text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <span className="text-green-600 text-2xl">✓</span>
        </div>
        <h1 className="text-2xl font-black text-gray-900 mb-3">You're in the team!</h1>
        <p className="text-gray-500 text-sm mb-2">Your team registration is now confirmed.</p>
        <p className="text-gray-400 text-sm mb-6">Head to your membership dashboard to pay your $10 SNZ membership fee and activate your full membership.</p>
        <button onClick={() => navigate('/membership/dashboard')}
          className="w-full py-3 rounded-xl font-bold text-white text-sm" style={{ background: SNZ_BLUE }}>
          Go to My Membership →
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <MemberHeader />
      <div className="max-w-sm mx-auto px-6 py-14">
        {SNZ_LOGO && <img src={SNZ_LOGO} alt="SNZ" className="h-12 object-contain mx-auto mb-6" />}
        <h1 className="text-2xl font-black text-gray-900 mb-2">You've been invited to join SNZ!</h1>
        {inviteData?.invited_by && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-4 text-sm text-blue-800">
            <p><strong>{inviteData.invited_by}</strong> has registered you as their dive partner{inviteData.comp_name ? ` for <strong>${inviteData.comp_name}</strong>` : ''}.</p>
            <p className="mt-1 text-xs text-blue-600">Set a password below to activate your SNZ membership and confirm your team registration.</p>
          </div>
        )}
        {!inviteData?.invited_by && (
          <p className="text-gray-500 text-sm mb-6">Set a password to activate your SNZ membership and confirm your team registration.</p>
        )}
        {error === 'ALREADY_EXISTS' ? (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 mb-4">
            <p className="font-bold text-amber-900 text-sm mb-1">An account already exists for this email.</p>
            <p className="text-amber-800 text-xs mb-3">If this is you, sign in below. If you've forgotten your password, reset it.</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => navigate('/membership/login')}
                className="flex-1 py-2 rounded-lg text-xs font-bold text-white"
                style={{ background: SNZ_BLUE }}>Sign In</button>
              <button type="button" onClick={() => navigate('/membership/reset')}
                className="flex-1 py-2 rounded-lg text-xs font-bold border border-amber-300 text-amber-800 hover:bg-amber-100">Reset Password</button>
            </div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600 mb-4">{error}</div>
        ) : null}
        <form onSubmit={submit} className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">New Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required autoFocus
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="At least 8 characters" />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Confirm Password</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="Repeat your password" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-xl font-black text-white text-sm disabled:opacity-50"
            style={{ background: '#16a34a' }}>
            {loading ? 'Confirming…' : 'Confirm & Activate Membership'}
          </button>
        </form>
      </div>
    </div>
  )
}

// ── Router component ──────────────────────────────────────────────────────────
export default function MembershipRouter() {
  const navigate = useNavigate()
  const location = useLocation()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    navigate('/membership')
  }

  const path = location.pathname

  // Public routes — render immediately without waiting for session
  if (path === '/membership/signup') return <MemberSignup navigate={navigate} />
  if (path === '/membership/login') return <MemberLogin navigate={navigate} />
  if (path === '/membership/reset/confirm') return <PasswordResetConfirm navigate={navigate} />
  if (path === '/membership/reset') return <PasswordReset navigate={navigate} />
  if (path === '/membership/invited' || path.startsWith('/membership/invited')) return <InvitedMember navigate={navigate} />

  // Auth-dependent routes — wait for session to load
  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400">Loading…</div>

  if (path === '/membership/dashboard') {
    if (!session) { navigate('/membership/login'); return null }
    return <MemberDashboard session={session} navigate={navigate} onSignOut={signOut} />
  }
  return <MembershipLanding session={session} navigate={navigate} />
}
