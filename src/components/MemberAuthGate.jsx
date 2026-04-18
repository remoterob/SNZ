import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate } from 'react-router-dom'

const SNZ_BLUE = '#2B6CB0'

export function useMemberSession() {
  const [session, setSession] = useState(null)
  const [member, setMember] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) fetchMember(session.user.id)
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session?.user) fetchMember(session.user.id)
      else { setMember(null); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  const fetchMember = async (userId) => {
    const { data } = await supabase.from('members').select('*').eq('id', userId).maybeSingle()
    setMember(data)
    setLoading(false)
  }

  return { session, member, loading }
}

export function MemberAuthGate({ message }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const { data, error: err } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password
      })
      if (err) {
        if (err.message?.includes('Invalid login credentials')) {
          setError('Incorrect email or password. If you haven\'t set a password yet, use Forgot password to set one.')
        } else {
          setError(err.message)
        }
        return
      }
      if (!data?.session) {
        setError('Sign in failed — please try again.')
      }
      // success — onAuthStateChange in useMemberSession will update session
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="bg-white border-2 border-blue-200 rounded-2xl overflow-hidden">
      <div className="px-5 py-4 border-b border-blue-100" style={{ background: '#eff6ff' }}>
        <p className="font-black text-gray-900 text-sm mb-0.5">SNZ Membership Required</p>
        <p className="text-xs text-gray-600">{message}</p>
      </div>
      <div className="p-5">
        {/* Tab switcher */}
        <div className="flex gap-2 mb-4">
          <button type="button" onClick={() => { setMode('login'); setError('') }}
            className={`flex-1 py-2 rounded-lg text-sm font-bold border-2 transition ${mode==='login' ? 'text-white border-transparent' : 'border-gray-200 text-gray-500 hover:border-gray-300'}`}
            style={mode==='login' ? { background: SNZ_BLUE } : {}}>
            Sign In
          </button>
          <button type="button" onClick={() => navigate('/membership')}
            className="flex-1 py-2 rounded-lg text-sm font-bold border-2 border-gray-200 text-gray-500 hover:border-gray-300 transition">
            Sign Up Now
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600 mb-3">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-3">
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
            placeholder="Email address"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
            placeholder="Password"
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          <button type="submit" disabled={submitting}
            className="w-full py-2.5 rounded-xl font-bold text-white text-sm disabled:opacity-50"
            style={{ background: SNZ_BLUE }}>
            {submitting ? 'Signing in…' : 'Sign In'}
          </button>
          <p className="text-center text-xs text-gray-400">
            <a href="/membership/reset" tabIndex="-1" className="underline" style={{ color: SNZ_BLUE }}>Forgot password?</a>
          </p>
        </form>
      </div>
    </div>
  )
}

export default MemberAuthGate
