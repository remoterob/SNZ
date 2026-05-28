import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useMemberSession } from '../components/MemberAuthGate'

const SNZ_BLUE = '#2B6CB0'

function isEligibleMember(m) {
  return !!m && m.payment_status === 'paid' && m.membership_status === 'active'
}

function meetingStatusBadge(s) {
  if (s === 'open')   return 'bg-green-100 text-green-700 border border-green-300'
  if (s === 'closed') return 'bg-gray-100 text-gray-500 border border-gray-300'
  return 'bg-amber-100 text-amber-700 border border-amber-300'
}

function motionStatusBadge(s) {
  if (s === 'open')   return 'bg-blue-50 text-blue-700 border border-blue-200'
  if (s === 'closed') return 'bg-gray-100 text-gray-600 border border-gray-300'
  return 'bg-amber-50 text-amber-700 border border-amber-200'
}

function fmtDate(s) {
  if (!s) return ''
  return new Date(s).toLocaleString('en-NZ',
    { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function AGMPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  return id ? <MeetingView meetingId={id} navigate={navigate} /> : <MeetingsList navigate={navigate} />
}

function PageShell({ navigate, crumb, children }) {
  return (
    <div className="min-h-screen bg-white">
      <div style={{ background: SNZ_BLUE }}
        className="px-6 py-3 flex items-center justify-between border-b border-blue-700">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
            ← SNZ Hub
          </button>
          <span className="text-blue-200 text-sm opacity-75">/ {crumb}</span>
        </div>
        <button onClick={() => navigate('/agm/admin')}
          className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
          ⚙ Admin
        </button>
      </div>
      {children}
    </div>
  )
}

function MeetingsList({ navigate }) {
  const [meetings, setMeetings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('agm_meetings').select('*')
      .neq('status', 'draft')
      .order('meeting_date', { ascending: false })
      .then(({ data }) => { setMeetings(data || []); setLoading(false) })
  }, [])

  return (
    <PageShell navigate={navigate} crumb="AGM & SGM">
      <header className="border-b border-gray-200 px-6 py-5 bg-white">
        <h1 className="text-2xl font-black text-gray-900">AGM & SGM</h1>
        <p className="text-xs text-gray-400 tracking-wider">
          Annual and Special General Meetings — motions, attendance and voting
        </p>
      </header>
      <div className="max-w-3xl mx-auto p-6">
        <div className="mb-6 rounded-2xl border-2 border-amber-100 bg-amber-50 p-4">
          <p className="text-sm font-bold text-amber-900 mb-1">🛠 Coming soon</p>
          <p className="text-sm text-amber-800 leading-relaxed">
            We're trialling AGM &amp; SGM management on the Hub. Only active SNZ
            members may vote, and the chair retains full control of how each
            motion is conducted (open vote, secret ballot, or fallback to a
            traditional show of hands).
          </p>
        </div>
        {loading && <div className="text-center py-12 text-gray-400">Loading…</div>}
        {!loading && meetings.length === 0 && (
          <div className="text-center py-16 text-gray-400 bg-gray-50 rounded-2xl">
            <div className="text-3xl mb-2">📋</div>
            <p className="font-semibold text-gray-600">No meetings published yet.</p>
            <p className="text-sm mt-1">Check back closer to the next AGM or SGM.</p>
          </div>
        )}
        <div className="space-y-3">
          {meetings.map(m => (
            <button key={m.id} onClick={() => navigate(`/agm/${m.id}`)}
              className="w-full text-left bg-white border-2 border-gray-100 rounded-2xl p-5 hover:border-blue-300 hover:shadow-md transition">
              <div className="flex items-start justify-between gap-3 mb-1">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${meetingStatusBadge(m.status)}`}>
                      {m.status === 'open' ? '● Live' : m.status === 'closed' ? 'Closed' : 'Upcoming'}
                    </span>
                    <span className="text-xs font-bold text-gray-400 tracking-wider">{m.kind}</span>
                  </div>
                  <h2 className="text-lg font-black text-gray-900">{m.title}</h2>
                  {m.location && <p className="text-sm text-gray-500 mt-0.5">📍 {m.location}</p>}
                </div>
                <div className="text-right text-xs text-gray-400 whitespace-nowrap">
                  {fmtDate(m.meeting_date)}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </PageShell>
  )
}

function MeetingView({ meetingId, navigate }) {
  const { member, session } = useMemberSession()
  const [meeting, setMeeting] = useState(null)
  const [motions, setMotions] = useState([])
  const [attendees, setAttendees] = useState([])
  const [myVotes, setMyVotes] = useState({})    // motion_id -> 'for'|'against'|'abstain'
  const [tallies, setTallies] = useState({})    // motion_id -> {for, against, abstain}
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const eligible = isEligibleMember(member)
  const attending = !!member && attendees.some(a => a.member_id === member.id)
  const quorumMet = attendees.length >= 20

  const load = async () => {
    const [{ data: mtg }, { data: mns }, { data: att }] = await Promise.all([
      supabase.from('agm_meetings').select('*').eq('id', meetingId).maybeSingle(),
      supabase.from('agm_motions').select('*').eq('meeting_id', meetingId).order('order_no'),
      supabase.from('agm_attendees').select('member_id').eq('meeting_id', meetingId),
    ])
    setMeeting(mtg)
    setMotions(mns || [])
    setAttendees(att || [])

    const motionIds = (mns || []).map(m => m.id)
    if (motionIds.length > 0) {
      const { data: votes } = await supabase.from('agm_votes')
        .select('motion_id, member_id, vote').in('motion_id', motionIds)
      const t = {}, mine = {}
      ;(votes || []).forEach(v => {
        const acc = t[v.motion_id] || (t[v.motion_id] = { for: 0, against: 0, abstain: 0 })
        acc[v.vote] = (acc[v.vote] || 0) + 1
        if (member && v.member_id === member.id) mine[v.motion_id] = v.vote
      })
      setTallies(t)
      setMyVotes(mine)
    }
    setLoading(false)
  }
  useEffect(() => { load() }, [meetingId, member?.id])

  const toggleAttend = async () => {
    if (!eligible) return
    setBusy(true)
    try {
      if (attending) {
        await supabase.from('agm_attendees')
          .delete().eq('meeting_id', meetingId).eq('member_id', member.id)
      } else {
        await supabase.from('agm_attendees')
          .insert({ meeting_id: meetingId, member_id: member.id, source: 'self' })
      }
      await load()
    } finally { setBusy(false) }
  }

  const castVote = async (motionId, vote) => {
    if (!eligible || !attending) return
    setBusy(true)
    try {
      await supabase.from('agm_votes').upsert(
        { motion_id: motionId, meeting_id: meetingId, member_id: member.id, vote },
        { onConflict: 'motion_id,member_id' }
      )
      await load()
    } finally { setBusy(false) }
  }

  if (loading) {
    return (
      <PageShell navigate={navigate} crumb="AGM & SGM">
        <div className="text-center py-16 text-gray-400">Loading…</div>
      </PageShell>
    )
  }
  if (!meeting) {
    return (
      <PageShell navigate={navigate} crumb="AGM & SGM">
        <div className="text-center py-16 text-gray-400">Meeting not found.</div>
      </PageShell>
    )
  }

  return (
    <PageShell navigate={navigate} crumb={`AGM & SGM / ${meeting.kind}`}>
      <header className="border-b border-gray-200 px-6 py-5 bg-white">
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${meetingStatusBadge(meeting.status)}`}>
            {meeting.status === 'open' ? '● Live' : meeting.status === 'closed' ? 'Closed' : 'Upcoming'}
          </span>
          <span className="text-xs font-bold text-gray-400 tracking-wider">{meeting.kind}</span>
        </div>
        <h1 className="text-2xl font-black text-gray-900">{meeting.title}</h1>
        <p className="text-sm text-gray-500 mt-1">{fmtDate(meeting.meeting_date)}</p>
        {meeting.location && <p className="text-sm text-gray-500">📍 {meeting.location}</p>}
        {meeting.virtual_join_url && (
          <a href={meeting.virtual_join_url} target="_blank" rel="noreferrer"
            className="inline-block text-sm font-bold mt-2" style={{ color: SNZ_BLUE }}>
            Join virtually →
          </a>
        )}
      </header>

      <div className="max-w-3xl mx-auto p-6 space-y-4">
        {/* Attendance + quorum */}
        <div className="rounded-2xl border-2 border-gray-100 bg-white p-5 flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold tracking-widest text-gray-400 uppercase">Attendance</div>
            <div className="text-3xl font-black text-gray-900">
              {attendees.length} <span className="text-sm font-bold text-gray-400">checked in</span>
            </div>
            <div className={`text-xs font-bold mt-1 ${quorumMet ? 'text-green-600' : 'text-amber-600'}`}>
              {quorumMet ? '✓ Quorum met (20 needed)' : `Need ${20 - attendees.length} more for quorum`}
            </div>
          </div>
          {!session && (
            <button onClick={() => navigate('/membership/login')}
              className="px-4 py-2 rounded-xl text-sm font-bold text-white"
              style={{ background: SNZ_BLUE }}>
              Sign in to attend
            </button>
          )}
          {session && !eligible && (
            <div className="text-xs text-amber-700 font-semibold max-w-[180px] text-right">
              Active SNZ membership required to attend and vote
            </div>
          )}
          {eligible && meeting.status === 'open' && (
            <button onClick={toggleAttend} disabled={busy}
              className={`px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50 ${
                attending
                  ? 'bg-green-100 text-green-700 border border-green-300'
                  : 'text-white'
              }`}
              style={attending ? {} : { background: SNZ_BLUE }}>
              {attending ? '✓ Attending' : 'I\'m attending'}
            </button>
          )}
          {eligible && meeting.status !== 'open' && (
            <div className="text-xs text-gray-400 max-w-[180px] text-right">
              Check-in opens when the meeting goes live
            </div>
          )}
        </div>

        {/* Motions */}
        <div>
          <h2 className="text-xs font-bold tracking-widest text-gray-400 uppercase mb-3">
            Motions ({motions.length})
          </h2>
          {motions.length === 0 && (
            <div className="text-center py-12 text-gray-400 bg-gray-50 rounded-2xl">
              No motions published yet.
            </div>
          )}
          <div className="space-y-3">
            {motions.map(mn => (
              <MotionCard key={mn.id} motion={mn} tally={tallies[mn.id]}
                myVote={myVotes[mn.id]} eligible={eligible} attending={attending}
                onVote={(v) => castVote(mn.id, v)} busy={busy} />
            ))}
          </div>
        </div>
      </div>
    </PageShell>
  )
}

function MotionCard({ motion, tally, myVote, eligible, attending, onVote, busy }) {
  const isSecret = motion.voting_mode === 'secret'
  const canVote = motion.status === 'open' && eligible && attending
  const t = tally || { for: 0, against: 0, abstain: 0 }
  const floorTotal = (motion.floor_for || 0) + (motion.floor_against || 0) + (motion.floor_abstain || 0)
  const combined = {
    for:     t.for     + (motion.floor_for     || 0),
    against: t.against + (motion.floor_against || 0),
    abstain: t.abstain + (motion.floor_abstain || 0),
  }
  const showTallies = motion.status === 'closed' || (motion.status === 'open' && !isSecret)
  return (
    <div className="bg-white border-2 border-gray-100 rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${motionStatusBadge(motion.status)}`}>
            {motion.status === 'open' ? '● Voting open' : motion.status === 'closed' ? 'Closed' : 'Not yet open'}
          </span>
          {isSecret && (
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
              🔒 Secret ballot
            </span>
          )}
        </div>
      </div>
      <h3 className="font-black text-gray-900 mb-1">{motion.title}</h3>
      {motion.body && <p className="text-sm text-gray-600 whitespace-pre-line mb-2">{motion.body}</p>}
      {(motion.mover_name || motion.seconder_name) && (
        <p className="text-xs text-gray-400 mb-3">
          {motion.mover_name && <>Moved by <span className="font-semibold text-gray-600">{motion.mover_name}</span></>}
          {motion.mover_name && motion.seconder_name && ' · '}
          {motion.seconder_name && <>Seconded by <span className="font-semibold text-gray-600">{motion.seconder_name}</span></>}
        </p>
      )}

      {canVote && (
        <div className="grid grid-cols-3 gap-2 mt-3">
          {['for','against','abstain'].map(v => (
            <button key={v} onClick={() => onVote(v)} disabled={busy}
              className={`py-2 rounded-xl text-sm font-bold border-2 transition disabled:opacity-50 ${
                myVote === v
                  ? v === 'for'     ? 'bg-green-100 border-green-300 text-green-800'
                  : v === 'against' ? 'bg-red-100 border-red-300 text-red-800'
                  :                   'bg-gray-100 border-gray-300 text-gray-700'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300'
              }`}>
              {v === 'for' ? '✓ For' : v === 'against' ? '✕ Against' : '— Abstain'}
            </button>
          ))}
        </div>
      )}
      {motion.status === 'open' && !canVote && (
        <div className="text-xs text-gray-400 italic mt-2">
          {!eligible ? 'Active members only.' : !attending ? 'Check in to vote.' : ''}
        </div>
      )}

      {showTallies && (
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Tally label="For"     value={combined.for}     color="text-green-700 bg-green-50 border-green-200" />
          <Tally label="Against" value={combined.against} color="text-red-700 bg-red-50 border-red-200" />
          <Tally label="Abstain" value={combined.abstain} color="text-gray-600 bg-gray-50 border-gray-200" />
        </div>
      )}
      {showTallies && floorTotal > 0 && (
        <p className="text-xs text-gray-400 italic mt-2 text-center">
          Includes {floorTotal} floor vote{floorTotal === 1 ? '' : 's'} entered by the Secretary
        </p>
      )}

      {motion.status === 'closed' && motion.result && (
        <div className="mt-3 text-center text-sm font-black">
          {motion.result === 'passed'         && <span className="text-green-700">✓ MOTION PASSED</span>}
          {motion.result === 'failed'         && <span className="text-red-700">✕ MOTION FAILED</span>}
          {motion.result === 'tied'           && <span className="text-gray-600">— TIED</span>}
          {motion.result === 'casting_for'    && <span className="text-green-700">✓ PASSED ON CHAIR'S CASTING VOTE</span>}
          {motion.result === 'casting_against'&& <span className="text-red-700">✕ FAILED ON CHAIR'S CASTING VOTE</span>}
        </div>
      )}
    </div>
  )
}

function Tally({ label, value, color }) {
  return (
    <div className={`rounded-xl border ${color} py-2`}>
      <div className="text-2xl font-black">{value}</div>
      <div className="text-xs font-bold tracking-widest uppercase">{label}</div>
    </div>
  )
}
