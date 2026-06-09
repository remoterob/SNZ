import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const SNZ_BLUE = '#2B6CB0'

function fmtDate(s) {
  if (!s) return ''
  return new Date(s).toLocaleString('en-NZ',
    { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function toast(msg, kind = 'success') {
  const el = document.createElement('div')
  el.className = `fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded-xl text-sm font-bold shadow-lg ${
    kind === 'error' ? 'bg-red-600 text-white' : 'bg-gray-900 text-white'
  }`
  el.textContent = msg
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 2200)
}

export default function AGMAdmin() {
  const navigate = useNavigate()
  const [meetings, setMeetings] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [editingMeeting, setEditingMeeting] = useState(null) // meeting object or 'new'

  const load = async () => {
    const { data } = await supabase.from('agm_meetings').select('*')
      .order('meeting_date', { ascending: false })
    setMeetings(data || [])
    if (!selectedId && data && data.length > 0) setSelectedId(data[0].id)
  }
  useEffect(() => { load() }, [])

  const selected = meetings.find(m => m.id === selectedId)

  return (
    <div className="min-h-screen bg-gray-50">
      <div style={{ background: SNZ_BLUE }}
        className="px-6 py-3 flex items-center justify-between border-b border-blue-700">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/agm')}
            className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
            ← AGM & SGM
          </button>
          <span className="text-blue-200 text-sm opacity-75">/ Admin</span>
        </div>
        <button onClick={() => setEditingMeeting('new')}
          className="text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
          + New Meeting
        </button>
      </div>

      <div className="max-w-6xl mx-auto p-6 grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6">
        {/* Meeting list */}
        <aside className="space-y-2">
          {meetings.length === 0 && (
            <div className="text-center py-8 text-gray-400 bg-white rounded-xl border border-gray-200 text-sm">
              No meetings yet — create one.
            </div>
          )}
          {meetings.map(m => (
            <button key={m.id} onClick={() => setSelectedId(m.id)}
              className={`w-full text-left p-3 rounded-xl border-2 transition ${
                m.id === selectedId ? 'border-blue-400 bg-white shadow-sm' : 'border-transparent bg-white hover:border-gray-200'
              }`}>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-bold text-gray-400 tracking-wider">{m.kind}</span>
                <StatusChip status={m.status} />
              </div>
              <div className="font-black text-sm text-gray-900">{m.title}</div>
              <div className="text-xs text-gray-400">{fmtDate(m.meeting_date)}</div>
            </button>
          ))}
        </aside>

        {/* Detail */}
        <main>
          {!selected && (
            <div className="text-center py-16 text-gray-400 bg-white rounded-2xl border border-gray-200">
              Select a meeting on the left, or create a new one.
            </div>
          )}
          {selected && (
            <MeetingAdmin meeting={selected} onEdit={() => setEditingMeeting(selected)} onChange={load} />
          )}
        </main>
      </div>

      {editingMeeting && (
        <MeetingModal
          meeting={editingMeeting === 'new' ? null : editingMeeting}
          onClose={() => setEditingMeeting(null)}
          onSaved={(id) => { setEditingMeeting(null); load().then(() => id && setSelectedId(id)) }}
        />
      )}
    </div>
  )
}

function StatusChip({ status }) {
  const map = {
    draft:     'bg-amber-100 text-amber-700 border-amber-300',
    published: 'bg-blue-100 text-blue-700 border-blue-300',
    open:      'bg-green-100 text-green-700 border-green-300',
    closed:    'bg-gray-100 text-gray-500 border-gray-300',
  }
  const labels = { draft: 'Draft', published: 'Published', open: 'Open', closed: 'Closed' }
  return <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full border ${map[status] || map.draft}`}>{labels[status] || status}</span>
}

function MeetingAdmin({ meeting, onEdit, onChange }) {
  const [motions, setMotions] = useState([])
  const [attendees, setAttendees] = useState([])
  const [showAttendees, setShowAttendees] = useState(false)
  const [editingMotion, setEditingMotion] = useState(null)

  const load = async () => {
    const [{ data: mns }, { data: att }] = await Promise.all([
      supabase.from('agm_motions').select('*').eq('meeting_id', meeting.id).order('order_no'),
      supabase.from('agm_attendees').select('*').eq('meeting_id', meeting.id)
        .order('checked_in_at'),
    ])
    setMotions(mns || [])
    const rows = att || []
    if (rows.length > 0) {
      const ids = [...new Set(rows.map(a => a.member_id))]
      const { data: mems } = await supabase.from('members').select('id, name').in('id', ids)
      const nameById = Object.fromEntries((mems || []).map(m => [m.id, m.name]))
      setAttendees(rows.map(a => ({ ...a, name: nameById[a.member_id] || 'Unknown member' })))
    } else {
      setAttendees([])
    }
  }
  useEffect(() => { load() }, [meeting.id])

  const updateMeetingStatus = async (status) => {
    const { error } = await supabase.from('agm_meetings').update({ status }).eq('id', meeting.id)
    if (error) { toast(`Error: ${error.message}`); return }
    toast(`Meeting ${status}`)
    onChange()
  }

  const deleteMeeting = async () => {
    if (!confirm(`Delete "${meeting.title}"? This will also delete all motions and votes. This cannot be undone.`)) return
    await supabase.from('agm_votes').delete().eq('meeting_id', meeting.id)
    await supabase.from('agm_motions').delete().eq('meeting_id', meeting.id)
    await supabase.from('agm_attendees').delete().eq('meeting_id', meeting.id)
    await supabase.from('agm_meetings').delete().eq('id', meeting.id)
    toast('Meeting deleted')
    onChange()
  }

  return (
    <div className="space-y-4">
      {/* Meeting card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-gray-400 tracking-wider">{meeting.kind}</span>
              <StatusChip status={meeting.status} />
            </div>
            <h2 className="text-xl font-black text-gray-900">{meeting.title}</h2>
            <p className="text-sm text-gray-500">{fmtDate(meeting.meeting_date)}</p>
            {meeting.location && <p className="text-sm text-gray-500">📍 {meeting.location}</p>}
            {meeting.virtual_join_url && (
              <a href={meeting.virtual_join_url.startsWith('http') ? meeting.virtual_join_url : `https://${meeting.virtual_join_url}`} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 mt-1 text-xs font-bold text-blue-600 hover:underline">
                🔗 {meeting.virtual_join_url}
              </a>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onEdit}
              className="text-xs font-bold px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">
              Edit
            </button>
            <button onClick={deleteMeeting}
              className="text-xs font-bold px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50">
              Delete
            </button>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap mt-3">
          {meeting.status === 'draft' && (
            <button onClick={() => updateMeetingStatus('published')}
              className="text-xs font-bold px-3 py-1.5 rounded-lg text-white" style={{ background: SNZ_BLUE }}>
              Publish motions
            </button>
          )}
          {meeting.status === 'published' && (
            <>
              <button onClick={() => updateMeetingStatus('open')}
                className="text-xs font-bold px-3 py-1.5 rounded-lg text-white bg-green-600 hover:bg-green-700">
                Open voting
              </button>
              <button onClick={() => updateMeetingStatus('draft')}
                className="text-xs font-bold px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">
                Back to draft
              </button>
            </>
          )}
          {meeting.status === 'open' && (
            <button onClick={() => updateMeetingStatus('closed')}
              className="text-xs font-bold px-3 py-1.5 rounded-lg bg-gray-800 text-white">
              Close meeting
            </button>
          )}
          {meeting.status === 'closed' && (
            <button onClick={() => updateMeetingStatus('open')}
              className="text-xs font-bold px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600">
              Reopen
            </button>
          )}
          <button
            onClick={() => {
              const url = `${window.location.origin}/agm/${meeting.id}`
              if (navigator.share) {
                navigator.share({ title: meeting.title, url })
              } else {
                navigator.clipboard.writeText(url)
                toast('Link copied!')
              }
            }}
            className="text-xs font-bold px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">
            🔗 Share link
          </button>
        </div>
      </div>

      {/* Quorum */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold tracking-widest text-gray-400 uppercase">Quorum</div>
            <div className="text-3xl font-black text-gray-900">
              {attendees.length} <span className="text-sm font-bold text-gray-400">/ 20</span>
            </div>
            <div className={`text-xs font-bold ${attendees.length >= 20 ? 'text-green-600' : 'text-amber-600'}`}>
              {attendees.length >= 20 ? '✓ Quorum met' : `Need ${20 - attendees.length} more`}
            </div>
          </div>
          <SecretaryCheckIn meeting={meeting} onChange={load} />
        </div>
        {attendees.length > 0 && (
          <div className="mt-3">
            <button onClick={() => setShowAttendees(s => !s)}
              className="text-xs font-bold text-gray-500 hover:text-gray-700 underline">
              {showAttendees ? 'Hide' : 'Show'} who's checked in ({attendees.length})
            </button>
            {showAttendees && (
              <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden">
                {[...attendees].sort((a, b) => a.name.localeCompare(b.name)).map((a, i) => (
                  <div key={a.id} className={`flex items-center justify-between px-3 py-1.5 text-sm ${i % 2 ? 'bg-gray-50' : 'bg-white'}`}>
                    <span className="text-gray-700">{a.name}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                      a.source === 'secretary'
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-blue-50 text-blue-700 border-blue-200'
                    }`}>
                      {a.source === 'secretary' ? '✍ On floor' : '📱 Self'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Motions */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold tracking-widest text-gray-400 uppercase">Motions</h3>
          <button onClick={() => setEditingMotion('new')}
            className="text-xs font-bold px-3 py-1.5 rounded-lg text-white" style={{ background: SNZ_BLUE }}>
            + Add motion
          </button>
        </div>
        {motions.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">No motions yet.</div>
        )}
        <div className="space-y-3">
          {motions.map(mn => (
            <MotionAdminCard key={mn.id} motion={mn} onEdit={() => setEditingMotion(mn)} onChange={load} />
          ))}
        </div>
      </div>

      {editingMotion && (
        <MotionModal
          motion={editingMotion === 'new' ? null : editingMotion}
          meetingId={meeting.id}
          nextOrder={motions.length}
          onClose={() => setEditingMotion(null)}
          onSaved={() => { setEditingMotion(null); load() }}
        />
      )}
    </div>
  )
}

function MotionAdminCard({ motion, onEdit, onChange }) {
  const [tally, setTally] = useState({ for: 0, against: 0, abstain: 0 })
  const [voterRows, setVoterRows] = useState([])  // [{ name, vote, voted_at }]
  const [showVoters, setShowVoters] = useState(false)
  const [busy, setBusy] = useState(false)

  const loadTally = async () => {
    const { data } = await supabase.from('agm_votes')
      .select('vote, member_id, voted_at').eq('motion_id', motion.id)
    const t = { for: 0, against: 0, abstain: 0 }
    ;(data || []).forEach(v => { t[v.vote] = (t[v.vote] || 0) + 1 })
    setTally(t)

    // Only fetch voter names for open ballots — secret stays anonymous
    if (motion.voting_mode === 'open' && data && data.length > 0) {
      const ids = [...new Set(data.map(v => v.member_id))]
      const { data: mems } = await supabase.from('members').select('id, name').in('id', ids)
      const nameById = Object.fromEntries((mems || []).map(m => [m.id, m.name]))
      setVoterRows(
        data.map(v => ({ name: nameById[v.member_id] || 'Unknown member', vote: v.vote, voted_at: v.voted_at }))
            .sort((a, b) => a.name.localeCompare(b.name))
      )
    } else {
      setVoterRows([])
    }
  }
  useEffect(() => { loadTally() }, [motion.id, motion.status, motion.voting_mode])

  const combined = {
    for:     tally.for     + (motion.floor_for     || 0),
    against: tally.against + (motion.floor_against || 0),
    abstain: tally.abstain + (motion.floor_abstain || 0),
  }

  const setStatus = async (status) => {
    setBusy(true)
    const patch = { status }
    if (status === 'open')   patch.opened_at = new Date().toISOString()
    if (status === 'closed') {
      patch.closed_at = new Date().toISOString()
      patch.result = combined.for > combined.against ? 'passed'
                  : combined.for < combined.against ? 'failed' : 'tied'
    }
    await supabase.from('agm_motions').update(patch).eq('id', motion.id)
    setBusy(false); onChange()
  }

  const setMode = async (voting_mode) => {
    await supabase.from('agm_motions').update({ voting_mode }).eq('id', motion.id)
    onChange()
  }

  const castingVote = async (dir) => {
    if (motion.result !== 'tied') {
      toast('Casting vote is only used when the result is tied', 'error'); return
    }
    const patch = {
      chair_casting_vote: dir,
      result: dir === 'for' ? 'casting_for' : 'casting_against',
    }
    await supabase.from('agm_motions').update(patch).eq('id', motion.id)
    onChange()
  }

  const remove = async () => {
    if (!confirm(`Delete motion "${motion.title}"? This also deletes all votes cast on it.`)) return
    await supabase.from('agm_motions').delete().eq('id', motion.id)
    onChange()
  }

  return (
    <div className="border border-gray-200 rounded-xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <StatusChip status={motion.status} />
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
              motion.voting_mode === 'secret'
                ? 'bg-purple-50 text-purple-700 border-purple-200'
                : 'bg-blue-50 text-blue-700 border-blue-200'
            }`}>
              {motion.voting_mode === 'secret' ? '🔒 Secret' : '👁 Open'}
            </span>
          </div>
          <div className="font-black text-gray-900">{motion.title}</div>
          {motion.body && <p className="text-xs text-gray-500 whitespace-pre-line mt-1">{motion.body}</p>}
        </div>
        <div className="flex gap-1.5 flex-shrink-0">
          <button onClick={onEdit} className="text-xs font-bold px-2 py-1 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">Edit</button>
          <button onClick={remove} className="text-xs font-bold px-2 py-1 rounded-lg border border-red-200 text-red-600 hover:bg-red-50">Delete</button>
        </div>
      </div>

      {/* Tally */}
      <div className="grid grid-cols-3 gap-2 mt-3 text-center">
        <MiniTally label="For"     digital={tally.for}     floor={motion.floor_for}     color="text-green-700 bg-green-50 border-green-200" />
        <MiniTally label="Against" digital={tally.against} floor={motion.floor_against} color="text-red-700 bg-red-50 border-red-200" />
        <MiniTally label="Abstain" digital={tally.abstain} floor={motion.floor_abstain} color="text-gray-600 bg-gray-50 border-gray-200" />
      </div>

      {/* Who voted — open ballots only */}
      {motion.voting_mode === 'open' && voterRows.length > 0 && (
        <div className="mt-3">
          <button onClick={() => setShowVoters(s => !s)}
            className="text-xs font-bold text-gray-500 hover:text-gray-700 underline">
            {showVoters ? 'Hide' : 'Show'} who voted ({voterRows.length})
          </button>
          {showVoters && (
            <div className="mt-2 border border-gray-200 rounded-lg overflow-hidden">
              {voterRows.map((v, i) => (
                <div key={i} className={`flex items-center justify-between px-3 py-1.5 text-sm ${i % 2 ? 'bg-gray-50' : 'bg-white'}`}>
                  <span className="text-gray-700">{v.name}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                    v.vote === 'for'     ? 'bg-green-50 text-green-700 border-green-200'
                  : v.vote === 'against' ? 'bg-red-50 text-red-700 border-red-200'
                  :                        'bg-gray-100 text-gray-600 border-gray-300'
                  }`}>
                    {v.vote === 'for' ? '✓ For' : v.vote === 'against' ? '✕ Against' : '— Abstain'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {motion.voting_mode === 'secret' && tally.for + tally.against + tally.abstain > 0 && (
        <div className="mt-2 text-xs text-gray-400 italic">
          🔒 Secret ballot — individual votes are not shown.
        </div>
      )}

      {/* Secretary floor entry */}
      <FloorEntry motion={motion} onChange={onChange} />

      {/* Controls */}
      <div className="flex flex-wrap gap-2 mt-3 items-center">
        <span className="text-xs font-bold text-gray-400 mr-1">Mode:</span>
        <button onClick={() => setMode('open')}
          className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${
            motion.voting_mode === 'open' ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-600'
          }`}>Open</button>
        <button onClick={() => setMode('secret')}
          className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${
            motion.voting_mode === 'secret' ? 'bg-purple-600 text-white border-purple-600' : 'border-gray-300 text-gray-600'
          }`}>Secret ballot</button>

        <span className="text-xs font-bold text-gray-400 mx-1 ml-3">Ballot:</span>
        {motion.status !== 'open' && (
          <button onClick={() => setStatus('open')} disabled={busy}
            className="text-xs font-bold px-2.5 py-1 rounded-lg text-white" style={{ background: SNZ_BLUE }}>
            Open voting
          </button>
        )}
        {motion.status === 'open' && (
          <button onClick={() => setStatus('closed')} disabled={busy}
            className="text-xs font-bold px-2.5 py-1 rounded-lg bg-gray-800 text-white">
            Close voting
          </button>
        )}
        {motion.status === 'closed' && (
          <button onClick={() => setStatus('open')} disabled={busy}
            className="text-xs font-bold px-2.5 py-1 rounded-lg border border-gray-300 text-gray-600">
            Reopen
          </button>
        )}
      </div>

      {motion.status === 'closed' && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          {motion.result === 'tied' && !motion.chair_casting_vote && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold text-amber-700">Tied — chair's casting vote:</span>
              <button onClick={() => castingVote('for')}
                className="text-xs font-bold px-2.5 py-1 rounded-lg bg-green-100 text-green-800 border border-green-300">
                Cast FOR
              </button>
              <button onClick={() => castingVote('against')}
                className="text-xs font-bold px-2.5 py-1 rounded-lg bg-red-100 text-red-800 border border-red-300">
                Cast AGAINST
              </button>
            </div>
          )}
          {motion.result && (
            <div className="text-sm font-black mt-1">
              {motion.result === 'passed'         && <span className="text-green-700">✓ MOTION PASSED</span>}
              {motion.result === 'failed'         && <span className="text-red-700">✕ MOTION FAILED</span>}
              {motion.result === 'tied'           && !motion.chair_casting_vote && <span className="text-amber-700">— TIED — awaiting casting vote</span>}
              {motion.result === 'casting_for'    && <span className="text-green-700">✓ PASSED ON CHAIR'S CASTING VOTE</span>}
              {motion.result === 'casting_against'&& <span className="text-red-700">✕ FAILED ON CHAIR'S CASTING VOTE</span>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MiniTally({ label, digital, floor, color }) {
  const total = digital + (floor || 0)
  return (
    <div className={`rounded-lg border ${color} py-1.5`}>
      <div className="text-lg font-black leading-none">{total}</div>
      <div className="text-[10px] font-bold tracking-widest uppercase">{label}</div>
      {floor > 0 && <div className="text-[10px] text-gray-400">{digital} app · {floor} floor</div>}
    </div>
  )
}

function FloorEntry({ motion, onChange }) {
  const [open, setOpen] = useState(false)
  const [vals, setVals] = useState({ floor_for: '', floor_against: '', floor_abstain: '' })
  const [saving, setSaving] = useState(false)

  // Re-sync inputs whenever the motion's stored floor counts change
  useEffect(() => {
    setVals({
      floor_for:     motion.floor_for     ? String(motion.floor_for)     : '',
      floor_against: motion.floor_against ? String(motion.floor_against) : '',
      floor_abstain: motion.floor_abstain ? String(motion.floor_abstain) : '',
    })
  }, [motion.floor_for, motion.floor_against, motion.floor_abstain])

  const save = async () => {
    const payload = {
      floor_for:     parseInt(vals.floor_for     || '0', 10) || 0,
      floor_against: parseInt(vals.floor_against || '0', 10) || 0,
      floor_abstain: parseInt(vals.floor_abstain || '0', 10) || 0,
    }
    setSaving(true)
    const { data, error } = await supabase.from('agm_motions')
      .update(payload).eq('id', motion.id).select('id, floor_for, floor_against, floor_abstain')
    setSaving(false)
    if (error) { toast(error.message, 'error'); return }
    if (!data || data.length === 0) {
      toast('Floor counts not saved — you may not have permission to edit this motion', 'error')
      return
    }
    toast('Floor counts saved')
    setOpen(false); onChange()
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="mt-2 text-xs font-bold text-gray-500 hover:text-gray-700 underline">
        ✏ Secretary: enter floor counts
      </button>
    )
  }
  return (
    <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded-lg">
      <div className="text-xs font-bold text-gray-500 mb-2">Floor (show of hands)</div>
      <div className="grid grid-cols-3 gap-2">
        {['floor_for','floor_against','floor_abstain'].map(k => (
          <label key={k} className="block">
            <span className="text-xs text-gray-500 capitalize">{k.replace('floor_','')}</span>
            <input type="number" min="0" inputMode="numeric" placeholder="0"
              value={vals[k]}
              onChange={e => setVals(v => ({ ...v, [k]: e.target.value.replace(/[^0-9]/g, '') }))}
              className="w-full border border-gray-300 rounded-lg px-2 py-1 text-sm" />
          </label>
        ))}
      </div>
      <div className="flex gap-2 mt-2">
        <button onClick={() => setOpen(false)} disabled={saving}
          className="text-xs font-bold px-2.5 py-1 rounded-lg border border-gray-300 text-gray-600 disabled:opacity-50">Cancel</button>
        <button onClick={save} disabled={saving}
          className="text-xs font-bold px-2.5 py-1 rounded-lg text-white disabled:opacity-50" style={{ background: SNZ_BLUE }}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}

function SecretaryCheckIn({ meeting, onChange }) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)

  const add = async () => {
    const e = email.trim().toLowerCase()
    if (!e) return
    setBusy(true)
    try {
      const { data: m } = await supabase.from('members').select('id, payment_status, membership_status')
        .eq('email', e).maybeSingle()
      if (!m) { toast('No member found for that email', 'error'); return }
      if (m.payment_status !== 'paid' || m.membership_status !== 'active') {
        if (!confirm('Member is not currently active. Check in anyway?')) return
      }
      const { error } = await supabase.from('agm_attendees')
        .insert({ meeting_id: meeting.id, member_id: m.id, source: 'secretary' })
      if (error && !/duplicate/i.test(error.message)) {
        toast(error.message, 'error'); return
      }
      toast('Checked in')
      setEmail('')
      onChange()
    } finally { setBusy(false) }
  }

  return (
    <div className="flex items-center gap-2">
      <input type="email" placeholder="member@email" value={email}
        onChange={e => setEmail(e.target.value)}
        className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm w-44" />
      <button onClick={add} disabled={busy}
        className="text-xs font-bold px-3 py-1.5 rounded-lg text-white disabled:opacity-50"
        style={{ background: SNZ_BLUE }}>
        Check in on floor
      </button>
    </div>
  )
}

function MeetingModal({ meeting, onClose, onSaved }) {
  const isNew = !meeting
  const [form, setForm] = useState({
    title: meeting?.title || '',
    kind: meeting?.kind || 'AGM',
    meeting_date: meeting?.meeting_date ? meeting.meeting_date.slice(0, 16) : '',
    location: meeting?.location || '',
    virtual_join_url: meeting?.virtual_join_url || '',
    notes: meeting?.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const set = k => v => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    if (!form.title.trim()) { toast('Title required', 'error'); return }
    if (!form.meeting_date) { toast('Meeting date required', 'error'); return }
    setSaving(true)
    try {
      const payload = {
        ...form,
        title: form.title.trim(),
        meeting_date: new Date(form.meeting_date).toISOString(),
        location: form.location.trim() || null,
        virtual_join_url: form.virtual_join_url.trim() || null,
        notes: form.notes.trim() || null,
      }
      if (isNew) {
        const { data, error } = await supabase.from('agm_meetings').insert(payload).select('id').single()
        if (error) throw error
        toast('Meeting created')
        onSaved(data.id)
      } else {
        const { error } = await supabase.from('agm_meetings').update(payload).eq('id', meeting.id)
        if (error) throw error
        toast('Meeting saved')
        onSaved(meeting.id)
      }
    } catch (e) { toast(e.message, 'error') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-lg my-8 shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-black text-gray-900">{isNew ? 'New Meeting' : 'Edit Meeting'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
        </div>
        <div className="p-6 space-y-3">
          <Field label="Kind">
            <select value={form.kind} onChange={e => set('kind')(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="AGM">AGM — Annual General Meeting</option>
              <option value="SGM">SGM — Special General Meeting</option>
            </select>
          </Field>
          <Field label="Title *">
            <input value={form.title} onChange={e => set('title')(e.target.value)}
              placeholder="e.g. SNZ AGM 2027"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </Field>
          <Field label="Date &amp; time *">
            <input type="datetime-local" value={form.meeting_date}
              onChange={e => set('meeting_date')(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </Field>
          <Field label="Location">
            <input value={form.location} onChange={e => set('location')(e.target.value)}
              placeholder="e.g. Tairua RSA"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </Field>
          <Field label="Virtual join URL">
            <input value={form.virtual_join_url} onChange={e => set('virtual_join_url')(e.target.value)}
              placeholder="Zoom / Teams link"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </Field>
          <Field label="Notes (members will see this)">
            <textarea value={form.notes} onChange={e => set('notes')(e.target.value)}
              rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </Field>
          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 py-2 rounded-xl border border-gray-300 text-sm font-bold text-gray-600">Cancel</button>
            <button onClick={save} disabled={saving}
              className="flex-1 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-50" style={{ background: SNZ_BLUE }}>
              {saving ? 'Saving…' : isNew ? 'Create' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function MotionModal({ motion, meetingId, nextOrder, onClose, onSaved }) {
  const isNew = !motion
  const [form, setForm] = useState({
    title: motion?.title || '',
    body: motion?.body || '',
    mover_name: motion?.mover_name || '',
    seconder_name: motion?.seconder_name || '',
    voting_mode: motion?.voting_mode || 'open',
    order_no: motion?.order_no ?? nextOrder,
  })
  const [saving, setSaving] = useState(false)
  const set = k => v => setForm(f => ({ ...f, [k]: v }))

  const save = async () => {
    if (!form.title.trim()) { toast('Title required', 'error'); return }
    setSaving(true)
    try {
      const payload = {
        ...form, title: form.title.trim(),
        body: form.body.trim() || null,
        mover_name: form.mover_name.trim() || null,
        seconder_name: form.seconder_name.trim() || null,
      }
      if (isNew) {
        const { error } = await supabase.from('agm_motions').insert({ ...payload, meeting_id: meetingId })
        if (error) throw error
        toast('Motion added')
      } else {
        const { error } = await supabase.from('agm_motions').update(payload).eq('id', motion.id)
        if (error) throw error
        toast('Motion saved')
      }
      onSaved()
    } catch (e) { toast(e.message, 'error') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-lg my-8 shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-black text-gray-900">{isNew ? 'New Motion' : 'Edit Motion'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
        </div>
        <div className="p-6 space-y-3">
          <Field label="Title *">
            <input value={form.title} onChange={e => set('title')(e.target.value)}
              placeholder="Motion title"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </Field>
          <Field label="Body">
            <textarea value={form.body} onChange={e => set('body')(e.target.value)}
              rows={5} placeholder="Full motion text…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Mover">
              <input value={form.mover_name} onChange={e => set('mover_name')(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </Field>
            <Field label="Seconder">
              <input value={form.seconder_name} onChange={e => set('seconder_name')(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
            </Field>
          </div>
          <Field label="Voting mode">
            <select value={form.voting_mode} onChange={e => set('voting_mode')(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm">
              <option value="open">Open (show-of-hands equivalent — votes recorded against members)</option>
              <option value="secret">Secret ballot (aggregate tallies only)</option>
            </select>
          </Field>
          <Field label="Order">
            <input type="number" min="0" value={form.order_no}
              onChange={e => set('order_no')(parseInt(e.target.value || '0', 10))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
          </Field>
          <div className="flex gap-2 pt-2">
            <button onClick={onClose} className="flex-1 py-2 rounded-xl border border-gray-300 text-sm font-bold text-gray-600">Cancel</button>
            <button onClick={save} disabled={saving}
              className="flex-1 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-50" style={{ background: SNZ_BLUE }}>
              {saving ? 'Saving…' : isNew ? 'Create' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{label}</span>
      {children}
    </label>
  )
}
