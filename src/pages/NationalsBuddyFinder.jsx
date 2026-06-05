import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useMemberSession } from '../components/MemberAuthGate'

const SNZ_BLUE = '#2B6CB0'
const SNZ_DARK = '#1e3a5f'

const EVENTS = [
  { key: 'open',       label: '🏆 Open Championship' },
  { key: 'womens',     label: "🔱 Women's Championship" },
  { key: 'juniors',    label: '🌟 Juniors Championship' },
  { key: 'under_23',   label: '🎯 Under 23' },
  { key: 'sixty_plus', label: '🎖️ 60 Plus' },
]

const SKILL_LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Experienced']

const AMBITIONS = [
  { key: 'qualify_interpacs', label: 'Qualify for Interpacifics' },
  { key: 'qualify_worlds',    label: 'Qualify for Worlds' },
  { key: 'gain_experience',   label: 'Gain experience' },
  { key: 'just_for_fun',      label: 'Just for fun' },
  { key: 'giving_it_a_try',   label: 'Giving it a try' },
]

const SKILL_COLORS = {
  'Beginner':     'bg-green-100 text-green-700',
  'Intermediate': 'bg-blue-100 text-blue-700',
  'Advanced':     'bg-orange-100 text-orange-700',
  'Experienced':  'bg-red-100 text-red-700',
}

function SkillBadge({ level }) {
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${SKILL_COLORS[level] || 'bg-gray-100 text-gray-600'}`}>
      {level}
    </span>
  )
}

function getMatches(myRequest, allRequests) {
  if (!myRequest?.skill_level || !myRequest?.events?.length) return []
  const myIdx = SKILL_LEVELS.indexOf(myRequest.skill_level)
  return allRequests
    .filter(r => {
      if (r.member_id === myRequest.member_id) return false
      const theirIdx = SKILL_LEVELS.indexOf(r.skill_level)
      return Math.abs(theirIdx - myIdx) <= 1 &&
        (myRequest.events || []).some(e => (r.events || []).includes(e))
    })
    .sort((a, b) => {
      const aOverlap = (myRequest.events || []).filter(e => (a.events || []).includes(e)).length
      const bOverlap = (myRequest.events || []).filter(e => (b.events || []).includes(e)).length
      return bOverlap - aOverlap
    })
}

function BuddyCard({ request, isMatch }) {
  const eventLabels = (request.events || [])
    .map(e => EVENTS.find(ev => ev.key === e)?.label).filter(Boolean)
  const ambitionLabels = (request.ambition || [])
    .map(a => AMBITIONS.find(am => am.key === a)?.label).filter(Boolean)

  return (
    <div className={`bg-white border-2 rounded-2xl p-5 transition ${isMatch ? 'border-green-400' : 'border-gray-200'}`}>
      {isMatch && (
        <span className="inline-flex text-xs font-black text-green-700 bg-green-100 px-2 py-0.5 rounded-full mb-3">
          ✓ Matches your request
        </span>
      )}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="font-black text-gray-900">{request.member?.name || 'SNZ Member'}</p>
          {request.member?.club && <p className="text-xs text-gray-500 mt-0.5">{request.member.club}</p>}
        </div>
        <SkillBadge level={request.skill_level} />
      </div>

      {eventLabels.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {eventLabels.map(label => (
            <span key={label} className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700">{label}</span>
          ))}
        </div>
      )}

      {ambitionLabels.length > 0 && (
        <p className="text-xs text-gray-600 mb-2">
          <span className="font-semibold">Ambition:</span> {ambitionLabels.join(' · ')}
        </p>
      )}

      {request.other_info && (
        <p className="text-xs text-gray-500 italic mb-3">"{request.other_info}"</p>
      )}

      <div className="border-t border-gray-100 pt-3 space-y-1.5">
        {request.contact_email && (
          <a href={`mailto:${request.contact_email}`}
            className="flex items-center gap-2 text-sm font-semibold text-blue-600 hover:underline">
            ✉ {request.contact_email}
          </a>
        )}
        {request.contact_phone && (
          <a href={`tel:${request.contact_phone}`}
            className="flex items-center gap-2 text-sm font-semibold text-green-600 hover:underline">
            📞 {request.contact_phone}
          </a>
        )}
      </div>
    </div>
  )
}

const emptyForm = { events: [], contact_email: '', contact_phone: '', skill_level: '', ambition: [], other_info: '' }

export default function NationalsBuddyFinder() {
  const navigate = useNavigate()
  const { member, session, loading: authLoading } = useMemberSession()
  const [requests, setRequests] = useState([])
  const [myRequest, setMyRequest] = useState(null)
  const [dataLoading, setDataLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const [form, setForm] = useState(emptyForm)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 4000)
  }

  const fetchRequests = async () => {
    const { data } = await supabase
      .from('buddy_requests')
      .select('*, member:members(name, club)')
      .eq('active', true)
      .order('created_at', { ascending: false })
    return data || []
  }

  useEffect(() => {
    fetchRequests().then(data => {
      setRequests(data)
      setDataLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!member) return
    const mine = requests.find(r => r.member_id === member.id)
    setMyRequest(mine || null)
    if (!mine && !editing) {
      setForm(f => ({ ...f, contact_email: member.email || '', contact_phone: member.phone || '' }))
    }
  }, [member, requests])

  const set = k => v => setForm(f => ({ ...f, [k]: v }))

  const toggleArr = (key, item) =>
    setForm(f => ({
      ...f,
      [key]: f[key].includes(item) ? f[key].filter(x => x !== item) : [...f[key], item]
    }))

  const startEdit = () => {
    if (myRequest) {
      setForm({
        events:        myRequest.events || [],
        contact_email: myRequest.contact_email || member?.email || '',
        contact_phone: myRequest.contact_phone || member?.phone || '',
        skill_level:   myRequest.skill_level || '',
        ambition:      myRequest.ambition || [],
        other_info:    myRequest.other_info || '',
      })
    }
    setEditing(true)
  }

  const saveRequest = async () => {
    if (!form.events.length)   { showToast('Select at least one event', 'error'); return }
    if (!form.skill_level)     { showToast('Select your skill level', 'error'); return }
    if (!form.contact_email.trim()) { showToast('Contact email is required', 'error'); return }
    setSaving(true)
    try {
      const payload = {
        member_id:     member.id,
        events:        form.events,
        contact_email: form.contact_email.trim(),
        contact_phone: form.contact_phone.trim() || null,
        skill_level:   form.skill_level,
        ambition:      form.ambition,
        other_info:    form.other_info.trim() || null,
        active:        true,
        updated_at:    new Date().toISOString(),
      }
      if (myRequest) {
        const { error } = await supabase.from('buddy_requests').update(payload).eq('id', myRequest.id)
        if (error) throw error
      } else {
        // upsert handles the case where a soft-deleted row already exists for this member
        const { error } = await supabase.from('buddy_requests')
          .upsert(payload, { onConflict: 'member_id' })
        if (error) throw error
      }
      const updated = await fetchRequests()
      setRequests(updated)
      setEditing(false)
      showToast(myRequest ? 'Request updated!' : 'Buddy request posted!')
    } catch (err) { showToast(err.message, 'error') }
    finally { setSaving(false) }
  }

  const removeRequest = async () => {
    if (!window.confirm('Remove your buddy request? Other members will no longer see it.')) return
    await supabase.from('buddy_requests').update({ active: false }).eq('id', myRequest.id)
    const updated = await fetchRequests()
    setRequests(updated)
    setMyRequest(null)
    showToast('Request removed')
  }

  const matches = myRequest ? getMatches(myRequest, requests) : []
  const othersAll = requests.filter(r => r.member_id !== member?.id)

  if (authLoading || dataLoading) return (
    <div className="min-h-screen flex items-center justify-center text-gray-400">Loading…</div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-semibold shadow-lg max-w-xs ${toast.type === 'error' ? 'bg-red-600' : 'bg-green-600'} text-white`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ background: SNZ_DARK }} className="px-6 py-3 flex items-center justify-between">
        <button onClick={() => navigate('/nationals')}
          className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
          ← Nationals
        </button>
        {!session && (
          <button onClick={() => navigate('/membership/login')}
            className="text-xs font-bold text-white bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
            Sign In
          </button>
        )}
        {session && (
          <button onClick={() => navigate('/membership/dashboard')}
            className="text-xs font-bold text-white bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
            My Account
          </button>
        )}
      </div>

      {/* Hero */}
      <div style={{ background: SNZ_BLUE }} className="px-6 py-10 text-white">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-black mb-2">🤿 Buddy Finder</h1>
          <p className="text-blue-200 max-w-xl">
            Looking for a dive partner for the Nationals? Post a request and connect with other divers at your level who want to compete in the same events.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-10">

        {/* ── Not signed in ── */}
        {!session && (
          <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center">
            <div className="text-4xl mb-3">🔒</div>
            <p className="text-lg font-black text-gray-900 mb-2">Sign in to post or view requests</p>
            <p className="text-sm text-gray-500 mb-5">You need to be a signed-in SNZ member to use the Buddy Finder.</p>
            <button onClick={() => navigate('/membership/login')}
              className="px-6 py-2.5 rounded-xl font-bold text-white text-sm"
              style={{ background: SNZ_BLUE }}>Sign In →</button>
            {requests.length > 0 && (
              <p className="text-xs text-gray-400 mt-4">
                {requests.length} active {requests.length === 1 ? 'request' : 'requests'} from SNZ members — sign in to view.
              </p>
            )}
          </div>
        )}

        {/* ── My Request section ── */}
        {session && member && (
          <section>
            <h2 className="text-lg font-black text-gray-900 mb-3">Your Buddy Request</h2>

            {/* Form — shown when no request yet OR editing */}
            {(!myRequest || editing) && (
              <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-6">

                {/* Events */}
                <div>
                  <p className="text-sm font-black text-gray-800 mb-2">Which events are you looking for a buddy for? <span className="text-red-500">*</span></p>
                  <div className="flex flex-wrap gap-2">
                    {EVENTS.map(e => (
                      <button key={e.key} type="button" onClick={() => toggleArr('events', e.key)}
                        className={`px-3 py-1.5 rounded-lg border-2 text-sm font-semibold transition ${form.events.includes(e.key) ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                        {e.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Skill level */}
                <div>
                  <p className="text-sm font-black text-gray-800 mb-2">Your skill level <span className="text-red-500">*</span></p>
                  <div className="flex flex-wrap gap-2">
                    {SKILL_LEVELS.map(level => (
                      <button key={level} type="button" onClick={() => set('skill_level')(level)}
                        className={`px-3 py-1.5 rounded-lg border-2 text-sm font-semibold transition ${form.skill_level === level ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                        {level}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Ambition */}
                <div>
                  <p className="text-sm font-black text-gray-800 mb-2">What's your ambition?</p>
                  <div className="flex flex-wrap gap-2">
                    {AMBITIONS.map(a => (
                      <button key={a.key} type="button" onClick={() => toggleArr('ambition', a.key)}
                        className={`px-3 py-1.5 rounded-lg border-2 text-sm font-semibold transition ${form.ambition.includes(a.key) ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Contact */}
                <div>
                  <p className="text-sm font-black text-gray-800 mb-2">Contact details <span className="text-xs font-normal text-gray-400">(shown to other signed-in members)</span></p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Email <span className="text-red-500">*</span></label>
                      <input type="email" value={form.contact_email} onChange={e => set('contact_email')(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Phone</label>
                      <input type="tel" value={form.contact_phone} onChange={e => set('contact_phone')(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
                    </div>
                  </div>
                </div>

                {/* Other info */}
                <div>
                  <label className="block text-sm font-black text-gray-800 mb-1">Anything else to share?</label>
                  <textarea value={form.other_info} onChange={e => set('other_info')(e.target.value)}
                    rows={3} placeholder="e.g. I train in the Hauraki Gulf, available weekends for training dives…"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-y" />
                </div>

                <div className="flex gap-3">
                  {editing && (
                    <button onClick={() => setEditing(false)}
                      className="flex-1 py-2.5 rounded-xl border border-gray-300 text-sm font-bold text-gray-600 hover:bg-gray-50">
                      Cancel
                    </button>
                  )}
                  <button onClick={saveRequest} disabled={saving}
                    className="flex-1 py-2.5 rounded-xl text-sm font-black text-white disabled:opacity-50"
                    style={{ background: SNZ_BLUE }}>
                    {saving ? 'Saving…' : myRequest ? 'Update Request' : 'Post Buddy Request'}
                  </button>
                </div>
              </div>
            )}

            {/* Existing request summary */}
            {myRequest && !editing && (
              <div className="bg-white border-2 border-blue-300 rounded-2xl p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="font-black text-gray-900">Your request is live ✓</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Posted {new Date(myRequest.created_at).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' })}
                      {myRequest.updated_at !== myRequest.created_at && ' · updated'}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={startEdit}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">
                      ✎ Edit
                    </button>
                    <button onClick={removeRequest}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50">
                      Remove
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-2">
                  {(myRequest.events || []).map(e => {
                    const ev = EVENTS.find(ev => ev.key === e)
                    return ev ? <span key={e} className="text-xs font-semibold px-2 py-0.5 rounded-lg bg-blue-50 text-blue-700">{ev.label}</span> : null
                  })}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <SkillBadge level={myRequest.skill_level} />
                  {(myRequest.ambition || []).map(a => AMBITIONS.find(am => am.key === a)?.label).filter(Boolean).join(' · ') &&
                    <span className="text-xs text-gray-500">{(myRequest.ambition || []).map(a => AMBITIONS.find(am => am.key === a)?.label).filter(Boolean).join(' · ')}</span>
                  }
                </div>

                {matches.length > 0 && (
                  <div className="mt-3 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5">
                    <p className="text-sm font-bold text-green-700">
                      🎉 {matches.length} potential {matches.length === 1 ? 'buddy' : 'buddies'} found — see below
                    </p>
                  </div>
                )}
                {matches.length === 0 && (
                  <p className="text-xs text-gray-400 mt-3">No matches yet — check back as more members post requests.</p>
                )}
              </div>
            )}
          </section>
        )}

        {/* ── Matches ── */}
        {session && myRequest && matches.length > 0 && (
          <section>
            <h2 className="text-lg font-black text-gray-900 mb-1">Your Matches</h2>
            <p className="text-sm text-gray-500 mb-4">
              Divers within one skill level of you who are looking for a buddy in the same events.
            </p>
            <div className="space-y-4">
              {matches.map(r => <BuddyCard key={r.id} request={r} isMatch />)}
            </div>
          </section>
        )}

        {/* ── All other requests ── */}
        {session && othersAll.length > 0 && (
          <section>
            <h2 className="text-lg font-black text-gray-900 mb-1">All Active Requests</h2>
            <p className="text-sm text-gray-500 mb-4">
              {othersAll.length} {othersAll.length === 1 ? 'member' : 'members'} looking for a Nationals buddy.
            </p>
            <div className="space-y-4">
              {othersAll.map(r => (
                <BuddyCard key={r.id} request={r} isMatch={matches.some(m => m.id === r.id)} />
              ))}
            </div>
          </section>
        )}

        {/* Empty state */}
        {session && othersAll.length === 0 && !myRequest && !editing && (
          <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
            <div className="text-4xl mb-3">🤿</div>
            <p className="font-black text-gray-900 mb-1">No requests yet</p>
            <p className="text-sm text-gray-500">Be the first to post a buddy request above!</p>
          </div>
        )}

      </div>
    </div>
  )
}
