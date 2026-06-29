import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import CompCopilotFAB from './CompCopilotFAB'
import { teamLeaderboard, photographyLeaderboard, finSwimLeaderboard, superDiverLeaderboard, medalFor } from '../lib/nationalsScoring'
import { toCSV, downloadCSV } from '../lib/csvExport'

const SNZ_BLUE = '#2B6CB0'
const SNZ_DARK = '#1e3a5f'

const EVENT_LABELS = {
  open: '🏆 Open',
  womens: "🔱 Women's",
  juniors: '🌟 Juniors',
  goldenoldie: '🎖️ Golden Oldie',
  under23_d1: '🎯 U23 D1',
  under23_d2: '🎯 U23 D2',
  silveroldie: '🥈 Silver Oldie',
  photography_d1: '📸 Photo D1',
  photography_d2: '📸 Photo D2',
  finswim_d1: '🐟 FinSwim D1',
  finswim_d2: '🐟 FinSwim D2',
  superdiver_d1: '⭐ SuperDiver D1',
  superdiver_d2: '⭐ SuperDiver D2',
}

// Women's is a sub-division of the Open (no separate fee/date) — excluded here so
// it can't be priced or dated independently; it inherits the Open entry & dates.
const NATIONALS_EVENTS = [
  { id: 'open', label: '🏆 Open Championship' },
  { id: 'juniors', label: '🌟 Junior Championship' },
  { id: 'goldenoldie', label: '🎖️ Golden Oldie Day Boat (60+)' },
  { id: 'under23', label: '🎯 Under 23 Division' },
  { id: 'photography', label: '📸 Snorkel Photography' },
  { id: 'finswim', label: '🐟 Fin Swimming' },
]

const SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL']

// ── Scoring helpers ───────────────────────────────────────────────────────────
function calcNatPts(fish, weightKg) {
  const base = fish.points || 100
  const cap = parseFloat(fish.max_weight_kg) || 8
  const bonus = Math.min(cap * 10, Math.floor((parseFloat(weightKg || 0) || 0) * 10))
  return base + bonus
}
function calcBulkBonus(kg) { return Math.floor((parseFloat(kg || 0) || 0) * 10) }

const STANDARD_DIVS = [
  { id: 'open',        label: '🏆 Open' },
  { id: 'womens',      label: "🔱 Women's", derived: true },  // sub-division of Open — women's pairs ranked off their Open scores
  { id: 'juniors',     label: '🌟 Juniors' },
  { id: 'goldenoldie', label: '🎖️ Golden Oldie' },  // day boat comp — own fish list & weigh-in
  { id: 'silveroldie', label: '🥈 Silver Oldie', derived: true },  // derived from Open (50+)
  { id: 'under23',     label: '🎯 Under 23' },
]
const DIV_LABELS = Object.fromEntries(STANDARD_DIVS.map(d => [d.id, d.label]))

function isInDiv(team, divId) {
  const ev = team.nationals_event || {}
  if (divId === 'under23') return !!(ev.under23_d1 || ev.under23_d2)
  return !!ev[divId]
}
function teamsInDiv(teams, divId) { return teams.filter(t => isInDiv(t, divId)) }

function individualCompetitors(teams, type) {
  const result = []
  for (const team of teams) {
    const ev = team.nationals_event || {}
    if (ev[`${type}_d1`]) result.push({ team, diver_slot: 1, name: team._d1?.name || 'Diver 1', key: `${team.id}-1` })
    if (ev[`${type}_d2`]) result.push({ team, diver_slot: 2, name: team._d2?.name || team.diver2_email || 'Diver 2', key: `${team.id}-2` })
  }
  return result
}

// ── Status badges ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  if (status === 'active') return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">✓ Active</span>
  if (status === 'pending_payment') return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">⚠ Payment required</span>
  if (status === 'pending_diver2') return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">⏳ Awaiting partner</span>
  if (status === 'withdrawn') return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">Withdrawn</span>
  return <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">{status}</span>
}

function PayBadge({ paid }) {
  return paid
    ? <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">💳 Paid</span>
    : <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">Unpaid</span>
}

// ── Team Edit/Add Modal ───────────────────────────────────────────────────────
function TeamModal({ team, compId, onClose, onSaved }) {
  const isNew = !team
  const [form, setForm] = useState(isNew ? {
    team_name: '',
    diver1_email: '',
    diver2_email: '',
    status: 'active',
    payment_status: 'pending',
    diver2_payment_status: 'pending',
    stripe_payment_intent_id: '',
    entry_fee_cents: '',
    nationals_event: {},
    merch_d1: { jacket: null, shirt: null, meal_qty: 0 },
    merch_d2: { jacket: null, shirt: null, meal_qty: 0 },
  } : {
    team_name: team.team_name || '',
    diver1_email: team._d1?.email || '',
    diver2_email: team._d2?.email || team.diver2_email || '',
    status: team.status || 'active',
    payment_status: team.payment_status || 'pending',
    diver2_payment_status: team.diver2_payment_status || 'pending',
    stripe_payment_intent_id: team.stripe_payment_intent_id || '',
    entry_fee_cents: team.entry_fee_cents || '',
    nationals_event: team.nationals_event || {},
    merch_d1: team.merch_d1 || { jacket: null, shirt: null, meal_qty: 0 },
    merch_d2: team.merch_d2 || { jacket: null, shirt: null, meal_qty: 0 },
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = k => v => setForm(f => ({ ...f, [k]: v }))

  const toggleEvent = key => setForm(f => ({
    ...f,
    nationals_event: { ...f.nationals_event, [key]: !f.nationals_event[key] }
  }))

  const save = async () => {
    if (!form.team_name.trim()) { setError('Team name is required'); return }
    setSaving(true)
    setError('')
    try {
      let diver1_member_id = isNew ? null : team.diver1_member_id
      let diver2_member_id = isNew ? null : team.diver2_member_id

      if (isNew && form.diver1_email.trim()) {
        const { data } = await supabase.from('members').select('id').eq('email', form.diver1_email.trim().toLowerCase()).maybeSingle()
        diver1_member_id = data?.id || null
      }
      if (form.diver2_email.trim()) {
        const { data } = await supabase.from('members').select('id').eq('email', form.diver2_email.trim().toLowerCase()).maybeSingle()
        diver2_member_id = data?.id || null
      }

      const payload = {
        competition_id: compId,
        team_name: form.team_name.trim(),
        diver1_member_id,
        diver2_member_id,
        diver2_email: form.diver2_email.trim().toLowerCase() || null,
        status: form.status,
        payment_status: form.payment_status,
        diver2_payment_status: form.diver2_payment_status,
        stripe_payment_intent_id: form.stripe_payment_intent_id || null,
        entry_fee_cents: parseInt(form.entry_fee_cents) || null,
        nationals_event: form.nationals_event,
        merch_d1: form.merch_d1,
        merch_d2: form.merch_d2,
      }

      const res = isNew
        ? await supabase.from('comp_teams').insert(payload)
        : await supabase.from('comp_teams').update(payload).eq('id', team.id)

      if (res.error) throw res.error
      onSaved()
    } catch (e) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-lg my-4 shadow-2xl">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl z-10">
          <h2 className="font-black text-gray-900">{isNew ? '+ Add Team Manually' : `Edit — ${team.team_name || 'Team'}`}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto">
          {error && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>}

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Team Name *</label>
            <input value={form.team_name} onChange={e => set('team_name')(e.target.value)}
              placeholder="e.g. The Deep Ones"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Diver 1 Email</label>
              <input value={form.diver1_email} onChange={e => set('diver1_email')(e.target.value)}
                placeholder="diver1@email.com" disabled={!isNew}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:bg-gray-50 disabled:text-gray-400" />
              {!isNew && <p className="text-xs text-gray-400 mt-0.5">{team._d1?.name || 'Not found'}</p>}
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Diver 2 Email</label>
              <input value={form.diver2_email} onChange={e => set('diver2_email')(e.target.value)}
                placeholder="diver2@email.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              {!isNew && team._d2 && <p className="text-xs text-gray-400 mt-0.5">{team._d2.name}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Team Status</label>
              <select value={form.status} onChange={e => set('status')(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                <option value="active">Active</option>
                <option value="pending_payment">Pending payment</option>
                <option value="pending_diver2">Awaiting partner</option>
                <option value="withdrawn">Withdrawn</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Entry Fee ($)</label>
              <input type="number" min="0" value={form.entry_fee_cents} onChange={e => set('entry_fee_cents')(e.target.value)}
                placeholder="e.g. 135"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-3">
            <p className="text-xs font-bold text-blue-700 uppercase tracking-wide">Diver 1 Payment</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Status</label>
                <select value={form.payment_status} onChange={e => set('payment_status')(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="refunded">Refunded</option>
                  <option value="waived">Waived</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Stripe PI</label>
                <input value={form.stripe_payment_intent_id} onChange={e => set('stripe_payment_intent_id')(e.target.value)}
                  placeholder="pi_…"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>
            </div>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Diver 2 Payment</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Status</label>
                <select value={form.diver2_payment_status} onChange={e => set('diver2_payment_status')(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="refunded">Refunded</option>
                  <option value="waived">Waived</option>
                </select>
              </div>
              <div>
                <p className="text-xs text-gray-400 pt-5">Stripe PI recorded when Diver 2 pays via the invite link.</p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Events Entered</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'open', label: '🏆 Open' },
                { key: 'womens', label: "🔱 Women's" },
                { key: 'juniors', label: '🌟 Juniors' },
                { key: 'goldenoldie', label: '🎖️ Golden Oldie' },
                { key: 'under23_d1', label: '🎯 U23 — D1' },
                { key: 'under23_d2', label: '🎯 U23 — D2' },
                { key: 'silveroldie', label: '🥈 Silver Oldie' },
                { key: 'photography_d1', label: '📸 Photo — D1' },
                { key: 'photography_d2', label: '📸 Photo — D2' },
                { key: 'finswim_d1', label: '🐟 FinSwim — D1' },
                { key: 'finswim_d2', label: '🐟 FinSwim — D2' },
                { key: 'superdiver_d1', label: '⭐ SuperDiver D1' },
                { key: 'superdiver_d2', label: '⭐ SuperDiver D2' },
              ].map(ev => (
                <label key={ev.key} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={!!form.nationals_event[ev.key]} onChange={() => toggleEvent(ev.key)} className="w-4 h-4" />
                  <span className="text-sm text-gray-700">{ev.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Merch D1 */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Diver 1 Merch</label>
            <div className="grid grid-cols-2 gap-3 mb-2">
              <div>
                <p className="text-xs text-gray-500 mb-1">🧥 Jacket</p>
                <div className="flex gap-1">
                  <select value={form.merch_d1?.jacket?.gender || ''}
                    onChange={e => setForm(f => ({ ...f, merch_d1: { ...f.merch_d1, jacket: e.target.value ? { ...(f.merch_d1?.jacket || {}), gender: e.target.value } : null } }))}
                    className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300">
                    <option value="">None</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                  {form.merch_d1?.jacket?.gender && (
                    <select value={form.merch_d1?.jacket?.size || ''}
                      onChange={e => setForm(f => ({ ...f, merch_d1: { ...f.merch_d1, jacket: { ...f.merch_d1.jacket, size: e.target.value } } }))}
                      className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300">
                      <option value="">Size</option>
                      {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">👕 T-Shirt</p>
                <div className="flex gap-1">
                  <select value={form.merch_d1?.shirt?.gender || ''}
                    onChange={e => setForm(f => ({ ...f, merch_d1: { ...f.merch_d1, shirt: e.target.value ? { ...(f.merch_d1?.shirt || {}), gender: e.target.value } : null } }))}
                    className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300">
                    <option value="">None</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                  {form.merch_d1?.shirt?.gender && (
                    <select value={form.merch_d1?.shirt?.size || ''}
                      onChange={e => setForm(f => ({ ...f, merch_d1: { ...f.merch_d1, shirt: { ...f.merch_d1.shirt, size: e.target.value } } }))}
                      className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300">
                      <option value="">Size</option>
                      {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-xs text-gray-500">🍽️ Meal tickets:</p>
              <input type="number" min="0" max="20"
                value={form.merch_d1?.meal_qty || 0}
                onChange={e => setForm(f => ({ ...f, merch_d1: { ...f.merch_d1, meal_qty: parseInt(e.target.value) || 0 } }))}
                className="w-16 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>

          {/* Merch D2 */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Diver 2 Merch</label>
            <div className="grid grid-cols-2 gap-3 mb-2">
              <div>
                <p className="text-xs text-gray-500 mb-1">🧥 Jacket</p>
                <div className="flex gap-1">
                  <select value={form.merch_d2?.jacket?.gender || ''}
                    onChange={e => setForm(f => ({ ...f, merch_d2: { ...f.merch_d2, jacket: e.target.value ? { ...(f.merch_d2?.jacket || {}), gender: e.target.value } : null } }))}
                    className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300">
                    <option value="">None</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                  {form.merch_d2?.jacket?.gender && (
                    <select value={form.merch_d2?.jacket?.size || ''}
                      onChange={e => setForm(f => ({ ...f, merch_d2: { ...f.merch_d2, jacket: { ...f.merch_d2.jacket, size: e.target.value } } }))}
                      className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300">
                      <option value="">Size</option>
                      {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">👕 T-Shirt</p>
                <div className="flex gap-1">
                  <select value={form.merch_d2?.shirt?.gender || ''}
                    onChange={e => setForm(f => ({ ...f, merch_d2: { ...f.merch_d2, shirt: e.target.value ? { ...(f.merch_d2?.shirt || {}), gender: e.target.value } : null } }))}
                    className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300">
                    <option value="">None</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                  {form.merch_d2?.shirt?.gender && (
                    <select value={form.merch_d2?.shirt?.size || ''}
                      onChange={e => setForm(f => ({ ...f, merch_d2: { ...f.merch_d2, shirt: { ...f.merch_d2.shirt, size: e.target.value } } }))}
                      className="flex-1 border border-gray-300 rounded px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-300">
                      <option value="">Size</option>
                      {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <p className="text-xs text-gray-500">🍽️ Meal tickets:</p>
              <input type="number" min="0" max="20"
                value={form.merch_d2?.meal_qty || 0}
                onChange={e => setForm(f => ({ ...f, merch_d2: { ...f.merch_d2, meal_qty: parseInt(e.target.value) || 0 } }))}
                className="w-16 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-gray-100 flex gap-3 sticky bottom-0 bg-white rounded-b-2xl">
          <button onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-gray-300 text-sm font-bold text-gray-600 hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={save} disabled={saving}
            className="flex-1 py-2.5 rounded-xl text-sm font-black text-white disabled:opacity-50"
            style={{ background: SNZ_BLUE }}>
            {saving ? 'Saving…' : isNew ? 'Add Team' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Registrations Tab ─────────────────────────────────────────────────────────
function RegistrationsTab({ teams, comp, loading, onRefresh }) {
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [modalTeam, setModalTeam] = useState(undefined)
  const [saving, setSaving] = useState(null)
  const [deleting, setDeleting] = useState(null)

  const filtered = teams.filter(t => {
    if (filter === 'pending_payment') return t.status === 'pending_payment'
    if (filter === 'pending') return t.status === 'pending_diver2'
    if (filter === 'active') return t.status === 'active'
    if (filter === 'unpaid') return t.payment_status !== 'paid' && t.status !== 'withdrawn'
    if (filter === 'withdrawn') return t.status === 'withdrawn'
    return t.status !== 'withdrawn'
  }).filter(t => {
    if (!search.trim()) return true
    const s = search.toLowerCase()
    return (
      t.team_name?.toLowerCase().includes(s) ||
      t._d1?.name?.toLowerCase().includes(s) ||
      t._d1?.email?.toLowerCase().includes(s) ||
      t._d2?.name?.toLowerCase().includes(s) ||
      t.diver2_email?.toLowerCase().includes(s) ||
      t.stripe_payment_intent_id?.toLowerCase().includes(s)
    )
  })

  const deleteTeam = async (teamId, teamName, e) => {
    e.stopPropagation()
    if (!window.confirm(`Permanently delete "${teamName}"?\n\nThis removes the record from the database and cannot be undone.`)) return
    setDeleting(teamId)
    await supabase.from('comp_teams').delete().eq('id', teamId)
    await onRefresh()
    setDeleting(null)
  }

  const quickMark = async (teamId, field, value, e) => {
    e.stopPropagation()
    setSaving(`${teamId}-${field}`)
    const update = { [field]: value }
    if (field === 'payment_status' && value === 'paid') update.status = 'active'
    await supabase.from('comp_teams').update(update).eq('id', teamId)
    await onRefresh()
    setSaving(null)
  }

  const refundTeam = async (team, e) => {
    e.stopPropagation()
    const adminPassword = sessionStorage.getItem('snz_admin_session') || import.meta.env.VITE_ADMIN_PASSWORD
    setSaving(`${team.id}-refund`)
    try {
      // Find the refundable Stripe payment(s) — nationals teams can have two
      // (each diver pays separately)
      let res = await fetch('/.netlify/functions/refund-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPassword, type: 'comp_entry', teamId: team.id, listOnly: true }),
      })
      let data = await res.json()
      if (!res.ok) { window.alert(data.error || 'No refundable payment found'); return }
      const payments = data.payments || []
      if (!payments.length) { window.alert('No refundable Stripe payment found for this team.'); return }

      let pick = payments[0]
      if (payments.length > 1) {
        const list = payments.map((p, i) =>
          `${i + 1}: $${(p.amountRemainingCents / 100).toFixed(2)} — ${p.email || p.description || p.id} (${new Date(p.created).toLocaleDateString('en-NZ')})`
        ).join('\n')
        const choice = window.prompt(`This team has ${payments.length} payments:\n${list}\n\nEnter the number to refund:`)
        if (choice === null) return
        const idx = parseInt(choice, 10) - 1
        if (!(idx >= 0 && idx < payments.length)) { window.alert('Invalid choice'); return }
        pick = payments[idx]
      }

      const maxDollars = (pick.amountRemainingCents / 100).toFixed(2)
      const amtStr = window.prompt(`Refund amount in dollars (max $${maxDollars}).\nA full refund marks the team as withdrawn; a partial refund leaves the entry unchanged.`, maxDollars)
      if (amtStr === null) return
      const amountCents = Math.round(parseFloat(amtStr) * 100)
      if (!(amountCents > 0 && amountCents <= pick.amountRemainingCents)) { window.alert('Invalid amount'); return }

      if (!window.confirm(`Refund $${(amountCents / 100).toFixed(2)} for "${team.team_name || '(no name)'}"?`)) return

      res = await fetch('/.netlify/functions/refund-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPassword, type: 'comp_entry', teamId: team.id, paymentIntentId: pick.id, amountCents }),
      })
      data = await res.json()
      if (!res.ok) window.alert(data.error || 'Refund failed')
      else window.alert(`✓ Refunded $${(data.amountCents / 100).toFixed(2)}${data.full ? ' — team marked withdrawn' : ' (partial — entry unchanged)'}${data.dbUpdated === false ? '\n\nDB update failed — adjust the team status manually.' : ''}`)
      await onRefresh()
    } catch (err) {
      window.alert('Refund error: ' + err.message)
    } finally {
      setSaving(null)
    }
  }

  const counts = {
    all: teams.filter(t => t.status !== 'withdrawn').length,
    active: teams.filter(t => t.status === 'active').length,
    pending_payment: teams.filter(t => t.status === 'pending_payment').length,
    pending: teams.filter(t => t.status === 'pending_diver2').length,
    unpaid: teams.filter(t => t.payment_status !== 'paid' && t.status !== 'withdrawn').length,
    withdrawn: teams.filter(t => t.status === 'withdrawn').length,
  }

  const exportEntries = () => {
    const eventNames = (t) => Object.entries(t.nationals_event || {})
      .filter(([, v]) => v).map(([k]) => EVENT_LABELS[k]).filter(Boolean).join('; ')
    const merchStr = (m) => {
      if (!m) return ''
      const parts = []
      if (m.jacket?.size) parts.push(`Jacket ${m.jacket.gender || ''} ${m.jacket.size}`.trim())
      if (m.shirt?.size) parts.push(`Shirt ${m.shirt.gender || ''} ${m.shirt.size}`.trim())
      if (m.meal_qty) parts.push(`Meals x${m.meal_qty}`)
      return parts.join('; ')
    }
    const hasD2 = (t) => !!(t._d2 || t.diver2_email)
    const columns = [
      { label: 'Team Name', value: t => t.team_name || '' },
      { label: 'Type', value: t => t.nationals_event?.is_individual ? 'Individual' : 'Pair' },
      { label: 'Status', value: t => t.status || '' },
      { label: 'Diver 1', value: t => t._d1?.name || '' },
      { label: 'Diver 1 Email', value: t => t._d1?.email || '' },
      { label: 'Diver 2', value: t => t._d2?.name || '' },
      { label: 'Diver 2 Email', value: t => t._d2?.email || t.diver2_email || '' },
      { label: 'Events', value: t => eventNames(t) },
      { label: 'D1 Payment', value: t => t.payment_status || '' },
      { label: 'D2 Payment', value: t => hasD2(t) ? (t.diver2_payment_status || '') : '' },
      { label: 'Entry Fee ($)', value: t => t.entry_fee_cents ? (t.entry_fee_cents / 100).toFixed(2) : '' },
      { label: 'Merch D1', value: t => merchStr(t.merch_d1) },
      { label: 'Merch D2', value: t => merchStr(t.merch_d2) },
      { label: 'Safety Diver', value: t => t.nationals_event?.safety_diver_name || '' },
      { label: 'Stripe PI', value: t => t.stripe_payment_intent_id || '' },
      { label: 'Registered', value: t => t.created_at ? new Date(t.created_at).toLocaleString('en-NZ') : '' },
    ]
    const stamp = new Date().toISOString().slice(0, 10)
    downloadCSV(`nationals-2027-entries-${filter}-${stamp}.csv`, toCSV(filtered, columns))
  }

  if (loading) return <div className="text-center py-12 text-gray-400 text-sm">Loading registrations…</div>

  return (
    <div className="space-y-4">
      {modalTeam !== undefined && (
        <TeamModal
          team={modalTeam}
          compId={comp?.id}
          onClose={() => setModalTeam(undefined)}
          onSaved={() => { setModalTeam(undefined); onRefresh() }}
        />
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total entries', value: counts.all, color: 'text-gray-900' },
          { label: 'Active', value: counts.active, color: 'text-green-700' },
          { label: 'Awaiting payment', value: counts.pending_payment, color: 'text-red-600' },
          { label: 'Awaiting partner', value: counts.pending, color: 'text-amber-700' },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1 flex-wrap">
          {[
            ['all', 'All'],
            ['active', 'Active'],
            ['pending_payment', '⚠ Payment'],
            ['pending', 'Partner pending'],
            ['unpaid', 'Unpaid'],
            ['withdrawn', 'Withdrawn'],
          ].map(([f, label]) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${filter === f ? 'text-white' : 'bg-white border border-gray-200 text-gray-500 hover:border-gray-300'}`}
              style={filter === f ? { background: SNZ_BLUE } : {}}>
              {label}{counts[f] > 0 ? ` (${counts[f]})` : ''}
            </button>
          ))}
        </div>
        <div className="flex gap-2 sm:ml-auto flex-wrap">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name, email, Stripe PI…"
            className="flex-1 min-w-48 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
          <button onClick={exportEntries} disabled={filtered.length === 0}
            className="px-4 py-1.5 rounded-lg text-xs font-black whitespace-nowrap border border-gray-200 text-gray-700 hover:border-gray-300 disabled:opacity-40"
            title="Export the entries shown below to CSV">
            ⬇ Export CSV ({filtered.length})
          </button>
          <button onClick={() => setModalTeam(null)}
            className="px-4 py-1.5 rounded-lg text-xs font-black text-white whitespace-nowrap"
            style={{ background: SNZ_BLUE }}>
            + Add team
          </button>
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center text-gray-400 text-sm">No entries found.</div>
      )}

      <div className="space-y-2">
        {filtered.map(team => {
          const events = team.nationals_event || {}
          const activeEvents = Object.entries(events).filter(([, v]) => v).map(([k]) => EVENT_LABELS[k]).filter(Boolean)
          const merch = team.merch_d1 || {}

          return (
            <div key={team.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
              <div className="px-4 py-3 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <p className="font-black text-gray-900 text-sm">{team.team_name || '(no team name)'}</p>
                    <StatusBadge status={team.status} />
                    {team.nationals_event?.is_individual && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">Individual</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600">
                    <span className="font-semibold">{team._d1?.name || '—'}</span>
                    {team.nationals_event?.is_individual ? (
                      team.nationals_event?.safety_diver_name && (
                        <span className="text-gray-400"> · Safety: {team.nationals_event.safety_diver_name}{team.nationals_event?.safety_diver_contact ? ` (${team.nationals_event.safety_diver_contact})` : ''}</span>
                      )
                    ) : (
                      <> {' & '}<span className="font-semibold">{team._d2?.name || team.diver2_email || '—'}</span></>
                    )}
                  </p>

                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <span className="text-xs text-gray-400">D1:</span>
                    <PayBadge paid={team.payment_status === 'paid'} />
                    {team._d2 && (
                      <>
                        <span className="text-xs text-gray-400">D2:</span>
                        <PayBadge paid={team.diver2_payment_status === 'paid'} />
                      </>
                    )}
                    {team.entry_fee_cents > 0 && (
                      <span className="text-xs text-gray-400">${(team.entry_fee_cents / 100).toFixed(2)}</span>
                    )}
                  </div>

                  {activeEvents.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {activeEvents.map(e => (
                        <span key={e} className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">{e}</span>
                      ))}
                    </div>
                  )}

                  {(merch.jacket || merch.shirt || merch.meal_qty > 0) && (
                    <p className="text-xs text-gray-400 mt-1">
                      {[
                        merch.jacket ? `🧥 ${merch.jacket.gender} ${merch.jacket.size}` : null,
                        merch.shirt ? `👕 ${merch.shirt.gender} ${merch.shirt.size}` : null,
                        merch.meal_qty > 0 ? `🍽️ ×${merch.meal_qty}` : null,
                      ].filter(Boolean).join(' · ')}
                    </p>
                  )}

                  {(team.stripe_payment_intent_id || team.diver2_stripe_payment_intent_id) && (
                    <p className="text-xs text-gray-300 font-mono mt-0.5 truncate">
                      {[
                        team.stripe_payment_intent_id ? `D1: ${team.stripe_payment_intent_id}` : null,
                        team.diver2_stripe_payment_intent_id ? `D2: ${team.diver2_stripe_payment_intent_id}` : null,
                      ].filter(Boolean).join(' · ')}
                    </p>
                  )}

                  <p className="text-xs text-gray-300 mt-0.5">
                    {team.created_at ? new Date(team.created_at).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
                  </p>
                </div>

                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  <button onClick={() => setModalTeam(team)}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50">
                    Edit
                  </button>
                  {team.payment_status !== 'paid' && (
                    <button
                      disabled={saving === `${team.id}-payment_status`}
                      onClick={e => quickMark(team.id, 'payment_status', 'paid', e)}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg border border-green-300 text-green-700 hover:bg-green-50 disabled:opacity-40">
                      D1 paid ✓
                    </button>
                  )}
                  {team._d2 && team.diver2_payment_status !== 'paid' && (
                    <button
                      disabled={saving === `${team.id}-diver2_payment_status`}
                      onClick={e => quickMark(team.id, 'diver2_payment_status', 'paid', e)}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg border border-green-300 text-green-700 hover:bg-green-50 disabled:opacity-40">
                      D2 paid ✓
                    </button>
                  )}
                  {team.payment_status === 'paid' && (
                    <button
                      disabled={saving === `${team.id}-refund`}
                      onClick={e => refundTeam(team, e)}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-40">
                      {saving === `${team.id}-refund` ? '…' : 'Refund'}
                    </button>
                  )}
                  <button
                    disabled={deleting === team.id}
                    onClick={e => deleteTeam(team.id, team.team_name || '(no name)', e)}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-40 mt-1">
                    {deleting === team.id ? '…' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Setup Tab ─────────────────────────────────────────────────────────────────
function SetupTab({ comp, onRefresh }) {
  const [form, setForm] = useState(null)
  const [fees, setFees] = useState({})
  const [eventDates, setEventDates] = useState({})
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')

  const defaultFees = () => ({
    ...Object.fromEntries(NATIONALS_EVENTS.map(e => [e.id, { standard: 0, early_bird: '' }])),
    merch: { jacket: { price: '' }, shirt: { price: '' } },
    meal: { price: '' },
  })

  useEffect(() => {
    if (comp) {
      setForm({
        name: comp.name || 'SNZ Nationals 2027',
        date_start: comp.date_start || '2027-01-19',
        registration_cutoff: comp.registration_cutoff ? comp.registration_cutoff.slice(0, 10) : '',
        early_bird_cutoff: comp.early_bird_cutoff ? comp.early_bird_cutoff.slice(0, 10) : '',
        club_name: comp.club_name || 'Spearfishing New Zealand',
        status: comp.status || 'open',
      })
      const existing = comp.category_fees || {}
      const merged = defaultFees()
      for (const id of NATIONALS_EVENTS.map(e => e.id)) {
        if (existing[id]) merged[id] = { standard: existing[id].standard ?? 0, early_bird: existing[id].early_bird ?? '' }
      }
      if (existing.merch) merged.merch = { jacket: { price: existing.merch.jacket?.price ?? '' }, shirt: { price: existing.merch.shirt?.price ?? '' } }
      if (existing.meal) merged.meal = { price: existing.meal.price ?? '' }
      setFees(merged)
      setEventDates(comp.event_dates || {})
    } else {
      setForm({ name: 'SNZ Nationals 2027', date_start: '2027-01-19', registration_cutoff: '', early_bird_cutoff: '', club_name: 'Spearfishing New Zealand', status: 'upcoming' })
      setFees(defaultFees())
      setEventDates({})
    }
  }, [comp])

  const save = async () => {
    setSaving(true)
    setSaveError('')
    const category_fees = {}
    for (const ev of NATIONALS_EVENTS) {
      const f = fees[ev.id] || {}
      category_fees[ev.id] = { standard: parseInt(f.standard) || 0 }
      if (f.early_bird !== '' && f.early_bird != null) category_fees[ev.id].early_bird = parseInt(f.early_bird) || 0
    }
    const jacketPrice = parseInt(fees.merch?.jacket?.price) || 0
    const shirtPrice = parseInt(fees.merch?.shirt?.price) || 0
    if (jacketPrice > 0 || shirtPrice > 0) {
      category_fees.merch = {}
      if (jacketPrice > 0) category_fees.merch.jacket = { price: jacketPrice }
      if (shirtPrice > 0) category_fees.merch.shirt = { price: shirtPrice }
    }
    const mealPrice = parseInt(fees.meal?.price) || 0
    if (mealPrice > 0) category_fees.meal = { price: mealPrice }

    const event_dates = {}
    for (const ev of NATIONALS_EVENTS) {
      const d = eventDates[ev.id] || {}
      if (d.start) {
        event_dates[ev.id] = { start: d.start }
        if (d.end && d.end !== d.start) event_dates[ev.id].end = d.end
      }
    }

    const payload = {
      name: form.name, club_name: form.club_name,
      date_start: form.date_start || null,
      registration_cutoff: form.registration_cutoff || null,
      early_bird_cutoff: form.early_bird_cutoff || null,
      status: form.status, category_fees, event_dates,
      scoring_mode: 'standard', public_leaderboard: false,
    }
    try {
      const res = comp?.id
        ? await supabase.from('competitions').update(payload).eq('id', comp.id)
        : await supabase.from('competitions').insert(payload)
      if (res.error) throw res.error
      await onRefresh()
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      setSaveError(e.message || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (!form) return <div className="text-center py-12 text-gray-400 text-sm">Loading…</div>

  const set = k => v => setForm(f => ({ ...f, [k]: v }))
  const setFee = (id, field) => v => setFees(f => ({ ...f, [id]: { ...f[id], [field]: v } }))
  const setEvDate = (id, field) => v => setEventDates(d => ({ ...d, [id]: { ...(d[id] || {}), [field]: v } }))

  return (
    <div className="max-w-lg space-y-5">
      <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
        <h3 className="font-black text-gray-900">Competition Details</h3>
        {[
          { label: 'Competition name', key: 'name', type: 'text' },
          { label: 'Start date', key: 'date_start', type: 'date' },
          { label: 'Entries close', key: 'registration_cutoff', type: 'date' },
          { label: 'Early bird cutoff', key: 'early_bird_cutoff', type: 'date' },
          { label: 'Organiser / club', key: 'club_name', type: 'text' },
        ].map(f => (
          <div key={f.key}>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">{f.label}</label>
            <input type={f.type} value={form[f.key] || ''} onChange={e => set(f.key)(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
        ))}
        <div>
          <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Status</label>
          <select value={form.status} onChange={e => set('status')(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
            <option value="upcoming">Upcoming (registration not open)</option>
            <option value="open">Open (registration live)</option>
            <option value="closed">Closed</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
        <div>
          <h3 className="font-black text-gray-900">Event Dates</h3>
          <p className="text-xs text-gray-400 mt-0.5">Set the date(s) for each sub-event. Leave End blank for single-day events.</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs font-bold text-gray-400 uppercase tracking-wide pb-1 border-b border-gray-100">
          <span>Event</span><span>Start</span><span>End (optional)</span>
        </div>
        {NATIONALS_EVENTS.map(ev => (
          <div key={ev.id} className="grid grid-cols-3 gap-2 items-center">
            <span className="text-sm text-gray-700">{ev.label}</span>
            <input type="date" value={eventDates[ev.id]?.start || ''}
              onChange={e => setEvDate(ev.id, 'start')(e.target.value)}
              className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            <input type="date" value={eventDates[ev.id]?.end || ''}
              onChange={e => setEvDate(ev.id, 'end')(e.target.value)}
              className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
        <div>
          <h3 className="font-black text-gray-900">Entry Fees — Per Person</h3>
          <p className="text-xs text-gray-400 mt-0.5">All fees charged per person. Leave early bird blank to disable.</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs font-bold text-gray-400 uppercase tracking-wide pb-1 border-b border-gray-100">
          <span>Event</span><span>Standard ($)</span><span>Early bird ($)</span>
        </div>
        {NATIONALS_EVENTS.map(ev => (
          <div key={ev.id} className="grid grid-cols-3 gap-2 items-center">
            <span className="text-sm text-gray-700">{ev.label}</span>
            <input type="number" min="0" value={fees[ev.id]?.standard ?? 0}
              onChange={e => setFee(ev.id, 'standard')(e.target.value)}
              className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            <input type="number" min="0" value={fees[ev.id]?.early_bird ?? ''} placeholder="—"
              onChange={e => setFee(ev.id, 'early_bird')(e.target.value)}
              className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
        ))}
        <p className="text-xs text-gray-400">Whole dollar amounts. Silver Oldie auto-qualifies from Open (set to 0).</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
        <div>
          <h3 className="font-black text-gray-900">Merchandise & Meal Pricing</h3>
          <p className="text-xs text-gray-400 mt-0.5">Leave blank or 0 to hide from registration.</p>
        </div>
        {[{ label: '🧥 Event Jacket', key: 'jacket' }, { label: '👕 Event T-Shirt', key: 'shirt' }].map(item => (
          <div key={item.key} className="flex items-center gap-3">
            <span className="text-sm text-gray-700 w-36 flex-shrink-0">{item.label}</span>
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Price ($)</label>
              <input type="number" min="0" value={fees.merch?.[item.key]?.price ?? ''} placeholder="0"
                onChange={e => setFees(f => ({ ...f, merch: { ...f.merch, [item.key]: { price: e.target.value } } }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>
        ))}
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-700 w-36 flex-shrink-0">🍽️ Prize Giving Dinner</span>
          <div className="flex-1">
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Per ticket ($)</label>
            <input type="number" min="0" value={fees.meal?.price ?? ''} placeholder="0"
              onChange={e => setFees(f => ({ ...f, meal: { price: e.target.value } }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>
        </div>
      </div>

      {saveError && <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{saveError}</div>}
      <button onClick={save} disabled={saving}
        className="w-full py-2.5 rounded-xl font-black text-white text-sm disabled:opacity-50"
        style={{ background: SNZ_BLUE }}>
        {saving ? 'Saving…' : saved ? '✓ Saved' : comp ? 'Update' : 'Create Competition'}
      </button>
    </div>
  )
}

// ── Per-team fish breakdown (the weigh-ins making up a score) ─────────────────
function NatFishBreakdown({ teamId, allWeighins, scoreDiv }) {
  const entries = allWeighins.filter(w => w.team_id === teamId && w.division === scoreDiv)
  const fish = entries.filter(w => !w.is_bulk)
  const bulk = entries.find(w => w.is_bulk)
  return (
    <div className="px-4 py-3 bg-blue-50/60 border-t border-blue-100">
      <div className="space-y-1.5 max-w-sm">
        {fish.map((w, i) => (
          <div key={w.id ?? i} className="flex items-center justify-between text-xs">
            <span className="font-semibold text-gray-700">🐟 {w.fish_name}{w.instance > 1 ? ` #${w.instance}` : ''}</span>
            <div className="flex items-center gap-3">
              {w.weight_kg != null && <span className="text-gray-400">{w.weight_kg} kg</span>}
              <span className="font-black w-14 text-right" style={{ color: SNZ_BLUE }}>{w.points_awarded} pts</span>
            </div>
          </div>
        ))}
        {bulk && (
          <div className="flex items-center justify-between text-xs border-t border-blue-200 pt-1.5">
            <span className="font-semibold text-gray-500">⚖ Bulk — {bulk.weight_kg} kg</span>
            <span className="font-black w-14 text-right" style={{ color: SNZ_BLUE }}>+{bulk.points_awarded} pts</span>
          </div>
        )}
        {fish.length === 0 && !bulk && <p className="text-xs text-gray-400">No individual fish recorded.</p>}
      </div>
    </div>
  )
}

// ── Derived Division Leaderboard (Silver/Golden Oldie ranked by Open score) ───
function DerivedDivLeaderboard({ divId, label, teams, allWeighins }) {
  const [expandedId, setExpandedId] = useState(null)
  const divTeams = teams.filter(t => t.nationals_event?.[divId])
  const withPoints = divTeams.map(t => {
    const tw = allWeighins.filter(w => w.team_id === t.id && w.division === 'open')
    const total = tw.reduce((s, w) => s + (w.points_awarded || 0), 0)
    const fishCount = tw.filter(w => !w.is_bulk).length
    return { ...t, total, fishCount, hasEntry: tw.length > 0 }
  }).sort((a, b) => b.total - a.total)
  const medals = ['🥇', '🥈', '🥉']
  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
        <h3 className="font-black text-gray-900">{label} — Leaderboard</h3>
        <p className="text-xs text-gray-400 mt-0.5">Derived from Open scores · {divTeams.length} qualifier{divTeams.length !== 1 ? 's' : ''}</p>
      </div>
      {divTeams.length === 0 ? (
        <div className="p-8 text-center text-gray-400 text-sm">No {label} qualifiers registered.</div>
      ) : (
        <div className="divide-y divide-gray-100">
          {withPoints.map((t, i) => {
            const open = expandedId === t.id
            return (
              <div key={t.id}>
                <button type="button" disabled={!t.hasEntry}
                  onClick={() => setExpandedId(open ? null : t.id)}
                  className={`w-full text-left px-4 py-3 flex items-center gap-3 ${t.hasEntry ? 'cursor-pointer hover:bg-gray-50' : 'cursor-default'} ${open ? 'bg-blue-50' : i === 0 && t.hasEntry ? 'bg-amber-50' : ''}`}>
                  <span className="w-7 text-center font-bold text-sm flex-shrink-0">
                    {t.hasEntry ? (medals[i] || `#${i + 1}`) : <span className="text-gray-300">–</span>}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 text-sm truncate flex items-center gap-1">
                      {t.team_name}{t.hasEntry && <span className="text-gray-400 text-xs">{open ? '▲' : '▼'}</span>}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {t._d1?.name}{!t.nationals_event?.is_individual && t._d2?.name ? ` & ${t._d2.name}` : ''}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    {t.hasEntry
                      ? <><p className="text-base font-black" style={{ color: SNZ_BLUE }}>{t.total} pts</p><p className="text-xs text-gray-400">{t.fishCount} fish</p></>
                      : <p className="text-xs text-gray-300">No Open entry</p>}
                  </div>
                </button>
                {open && <NatFishBreakdown teamId={t.id} allWeighins={allWeighins} scoreDiv="open" />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Fish Lists Tab ────────────────────────────────────────────────────────────
function NationalsSpeciesPickerModal({ comp, division, existingFish, onClose, onSaved }) {
  const [library, setLibrary] = useState([])
  const [libLoading, setLibLoading] = useState(true)
  const [selected, setSelected] = useState(() =>
    existingFish.map(f => ({ slug: f.species_slug, count: f.max_count || 1 }))
  )
  const [fishSettings, setFishSettings] = useState(() => {
    const s = {}
    existingFish.forEach(f => {
      s[f.species_slug] = { weighSep: f.weigh_separately !== false, points: f.points || 100, maxKg: f.max_weight_kg || 8 }
    })
    return s
  })
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    supabase.from('comp_species_library').select('*').eq('active', true).order('sort_order').order('name')
      .then(({ data }) => { setLibrary(data || []); setLibLoading(false) })
  }, [])

  const isSelected = slug => selected.find(x => x.slug === slug)

  const toggle = slug => {
    setSelected(s => {
      const ex = s.find(x => x.slug === slug)
      return ex ? s.filter(x => x.slug !== slug) : [...s, { slug, count: 1 }]
    })
    if (!fishSettings[slug]) {
      setFishSettings(f => ({ ...f, [slug]: { weighSep: true, points: 100, maxKg: 8 } }))
    }
  }

  const getSetting = (slug, key, def) => fishSettings[slug]?.[key] ?? def
  const setSetting = (slug, key, val) => setFishSettings(f => ({ ...f, [slug]: { ...(f[slug] || {}), [key]: val } }))

  const save = async () => {
    setSaving(true)
    try {
      const { error: delErr } = await supabase.from('comp_fish').delete()
        .eq('competition_id', comp.id).eq('division', division)
      if (delErr) throw delErr
      const rows = []
      let order = 0
      for (const { slug, count } of selected) {
        const lib = library.find(s => s.slug === slug)
        if (!lib) continue
        const cfg = fishSettings[slug] || { weighSep: true, points: 100, maxKg: 8 }
        rows.push({
          competition_id: comp.id, division,
          species_name: lib.name, species_slug: slug, photo_url: lib.photo_url || null,
          points: cfg.points, max_weight_kg: cfg.maxKg, weigh_separately: cfg.weighSep,
          allow_multiples: count > 1, max_count: count, sort_order: order++,
        })
      }
      if (rows.length > 0) {
        const { error: insErr } = await supabase.from('comp_fish').insert(rows)
        if (insErr) throw insErr
      }
      onSaved()
      onClose()
    } catch (err) { alert(err.message) }
    finally { setSaving(false) }
  }

  const filtered = library.filter(s => s.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-2xl my-8 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-black text-gray-900">{DIV_LABELS[division]} Fish List ({selected.length} selected)</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
        </div>
        <div className="p-6">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search species…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-300" />
          {libLoading
            ? <div className="text-center py-8 text-gray-400">Loading species…</div>
            : <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-80 overflow-y-auto mb-4 pr-1">
                {filtered.map(s => {
                  const on = !!isSelected(s.slug)
                  return (
                    <div key={s.slug} className={`relative rounded-xl border-2 overflow-hidden transition ${on ? 'border-blue-500' : 'border-gray-200 hover:border-gray-300'}`}>
                      <button type="button" onClick={() => toggle(s.slug)} className="w-full text-left">
                        {s.photo_url
                          ? <img src={s.photo_url} alt={s.name} className="w-full h-24 object-cover" />
                          : <div className="w-full h-24 bg-gray-100 flex items-center justify-center text-4xl">🐟</div>}
                        <div className="p-1.5 text-xs font-semibold leading-tight">{s.name}</div>
                      </button>
                      {on && (
                        <div className="px-2 pb-2 space-y-1" onClick={e => e.stopPropagation()}>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input type="checkbox" className="w-3 h-3"
                              checked={getSetting(s.slug, 'weighSep', true)}
                              onChange={e => setSetting(s.slug, 'weighSep', e.target.checked)} />
                            <span className="text-xs text-gray-500">Weigh sep.</span>
                          </label>
                          <div className="flex items-center gap-1">
                            <input type="number" min="0" value={getSetting(s.slug, 'points', 100)}
                              onChange={e => setSetting(s.slug, 'points', parseInt(e.target.value) || 100)}
                              className="w-14 border border-gray-300 rounded px-1 py-0.5 text-xs text-center" />
                            <span className="text-xs text-gray-400">pts</span>
                            <input type="number" min="0" step="0.5" value={getSetting(s.slug, 'maxKg', 8)}
                              onChange={e => setSetting(s.slug, 'maxKg', parseFloat(e.target.value) || 8)}
                              className="w-12 border border-gray-300 rounded px-1 py-0.5 text-xs text-center" />
                            <span className="text-xs text-gray-400">kg</span>
                          </div>
                        </div>
                      )}
                      {on && <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold">✓</div>}
                    </div>
                  )
                })}
              </div>
          }
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

function FishListTab({ comp, fishLists, onRefresh }) {
  const [selDiv, setSelDiv] = useState('open')
  const [showPicker, setShowPicker] = useState(false)
  const [saving, setSaving] = useState(null)

  const currentList = fishLists[selDiv] || []

  const deleteFish = async (fishId) => {
    setSaving(fishId)
    await supabase.from('comp_fish').delete().eq('id', fishId)
    await onRefresh()
    setSaving(null)
  }

  const copyFromOpen = async () => {
    const openList = fishLists['open'] || []
    if (!openList.length) { alert('Open fish list is empty — add species to Open first.'); return }
    if (!window.confirm(`Replace the ${DIV_LABELS[selDiv]} fish list with a copy of the Open list (${openList.length} species)?`)) return
    setSaving('copy')
    const { error: delErr } = await supabase.from('comp_fish').delete().eq('competition_id', comp.id).eq('division', selDiv)
    if (!delErr) {
      const rows = openList.map((f, i) => ({
        competition_id: comp.id, division: selDiv,
        species_name: f.species_name, species_slug: f.species_slug, photo_url: f.photo_url || null,
        points: f.points, max_weight_kg: f.max_weight_kg, weigh_separately: f.weigh_separately,
        allow_multiples: f.allow_multiples, max_count: f.max_count, sort_order: i + 1,
      }))
      if (rows.length) await supabase.from('comp_fish').insert(rows)
    }
    await onRefresh()
    setSaving(null)
  }

  return (
    <div className="space-y-4">
      {showPicker && (
        <NationalsSpeciesPickerModal
          comp={comp} division={selDiv} existingFish={currentList}
          onClose={() => setShowPicker(false)}
          onSaved={() => { onRefresh() }} />
      )}

      <div className="flex gap-1.5 flex-wrap">
        {STANDARD_DIVS.filter(d => !d.derived).map(d => (
          <button key={d.id} onClick={() => setSelDiv(d.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition border ${selDiv === d.id ? 'text-white border-transparent' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}
            style={selDiv === d.id ? { background: SNZ_BLUE } : {}}>
            {d.label}
            <span className={`ml-1.5 text-xs ${selDiv === d.id ? 'text-white/70' : 'text-gray-400'}`}>
              {(fishLists[d.id] || []).length}
            </span>
          </button>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
          <div>
            <h3 className="font-bold text-gray-900">{DIV_LABELS[selDiv]} Fish List</h3>
            <p className="text-xs text-gray-400 mt-0.5">{currentList.length} species · Base pts + 10pts/kg up to max weight</p>
          </div>
          <div className="flex gap-2">
            {selDiv !== 'open' && (
              <button onClick={copyFromOpen} disabled={saving === 'copy'}
                className="text-xs font-bold px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                {saving === 'copy' ? '…' : '↩ Copy from Open'}
              </button>
            )}
            <button onClick={() => setShowPicker(true)}
              className="text-xs font-black px-3 py-1.5 rounded-lg text-white"
              style={{ background: SNZ_BLUE }}>
              {currentList.length > 0 ? '✎ Edit Fish List' : '+ Add Species'}
            </button>
          </div>
        </div>

        {currentList.length === 0 ? (
          <div className="px-4 py-12 text-center text-gray-400 text-sm">No species yet — click Add Species above.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-4">
            {currentList.map(f => (
              <div key={f.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm relative group">
                <div className="w-full h-24 bg-gray-50 flex items-center justify-center text-3xl relative overflow-hidden">
                  {f.photo_url
                    ? <img src={f.photo_url} alt={f.species_name} className="w-full h-full object-cover" onError={e => e.target.remove()} />
                    : '🐟'}
                </div>
                <div className="p-2">
                  <p className="font-bold text-gray-900 text-xs leading-tight">{f.species_name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{f.points} pts + up to {f.max_weight_kg}kg</p>
                  {f.weigh_separately && <span className="text-xs font-bold text-amber-600">⚖ Weigh sep.</span>}
                </div>
                <button onClick={() => deleteFish(f.id)} disabled={saving === f.id}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-red-500 text-white text-xs font-bold opacity-0 group-hover:opacity-100 transition flex items-center justify-center disabled:opacity-40">
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Weigh-In Panel ────────────────────────────────────────────────────────────
function WeighInPanel({ team, divId, fishList, allWeighins, compId, onSaved, onClose }) {
  const existing = allWeighins.filter(w => w.team_id === team.id && w.division === divId)

  const [caught, setCaught] = useState(() => {
    const m = {}
    existing.filter(w => !w.is_bulk && w.fish_id).forEach(w => { m[w.fish_id] = true })
    return m
  })
  const [weights, setWeights] = useState(() => {
    const m = {}
    existing.filter(w => !w.is_bulk && w.fish_id && w.weight_kg).forEach(w => { m[w.fish_id] = String(w.weight_kg) })
    return m
  })
  const [bulkKg, setBulkKg] = useState(() => {
    const b = existing.find(w => w.is_bulk)
    return b ? String(b.weight_kg || '') : ''
  })
  const [saving, setSaving] = useState(false)

  const previewPoints = fishList.reduce((sum, f) => {
    if (!caught[f.id]) return sum
    return sum + calcNatPts(f, f.weigh_separately ? (weights[f.id] || 0) : 0)
  }, 0) + calcBulkBonus(bulkKg)

  const save = async () => {
    setSaving(true)
    await supabase.from('comp_weighins')
      .delete().eq('competition_id', compId).eq('team_id', team.id).eq('division', divId)

    const rows = []
    for (const f of fishList) {
      if (!caught[f.id]) continue
      rows.push({
        competition_id: compId, team_id: team.id, division: divId,
        fish_id: f.id, fish_name: f.species_name,
        weight_kg: f.weigh_separately ? (parseFloat(weights[f.id]) || null) : null,
        points_awarded: calcNatPts(f, f.weigh_separately ? (weights[f.id] || 0) : 0),
        instance: 1, is_bulk: false, weighed_at: new Date().toISOString(),
      })
    }
    if (parseFloat(bulkKg) > 0) {
      rows.push({
        competition_id: compId, team_id: team.id, division: divId,
        fish_id: null, fish_name: '__bulk__',
        weight_kg: parseFloat(bulkKg), points_awarded: calcBulkBonus(bulkKg),
        instance: 1, is_bulk: true, weighed_at: new Date().toISOString(),
      })
    }
    if (rows.length) await supabase.from('comp_weighins').insert(rows)
    setSaving(false)
    onSaved()
  }

  return (
    <div className="bg-white border-2 border-blue-300 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-blue-50 flex items-center justify-between">
        <div>
          <p className="font-black text-gray-900">{team.team_name}</p>
          <p className="text-xs text-gray-500">
            {team._d1?.name || 'Diver 1'}
            {!team.nationals_event?.is_individual && (team._d2?.name || team.diver2_email) ? ` & ${team._d2?.name || team.diver2_email}` : ''}
          </p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
      </div>

      {fishList.length === 0 ? (
        <div className="p-6 text-center text-gray-400 text-sm">No species in the {DIV_LABELS[divId]} fish list. Add species in the Fish Lists tab first.</div>
      ) : (
        <div className="p-4 space-y-2">
          {fishList.map(f => (
            <div key={f.id} className={`border rounded-xl p-3 transition ${caught[f.id] ? 'border-blue-300 bg-blue-50/50' : 'border-gray-200'}`}>
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input type="checkbox" checked={!!caught[f.id]}
                  onChange={() => setCaught(prev => ({ ...prev, [f.id]: !prev[f.id] }))}
                  className="w-4 h-4 flex-shrink-0" />
                <span className="font-semibold text-gray-900 flex-1 text-sm">{f.species_name}</span>
                <span className="text-xs text-gray-400 flex-shrink-0">{f.points} pts base</span>
              </label>
              {caught[f.id] && f.weigh_separately && (
                <div className="mt-2 ml-7 flex items-center gap-2">
                  <input type="number" min="0" step="0.1"
                    value={weights[f.id] || ''}
                    onChange={e => setWeights(prev => ({ ...prev, [f.id]: e.target.value }))}
                    placeholder="0.0"
                    className="w-24 border border-amber-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-300" />
                  <span className="text-xs text-gray-500">kg</span>
                  <span className="text-xs font-black ml-auto" style={{ color: SNZ_BLUE }}>
                    = {calcNatPts(f, weights[f.id] || 0)} pts
                  </span>
                </div>
              )}
              {caught[f.id] && !f.weigh_separately && (
                <p className="text-xs font-bold mt-1 ml-7" style={{ color: SNZ_BLUE }}>{f.points} pts (fixed)</p>
              )}
            </div>
          ))}

          <div className="border border-gray-200 rounded-xl p-3">
            <p className="text-sm font-semibold text-gray-700 mb-2">Bulk bin (other valid species)</p>
            <div className="flex items-center gap-2">
              <input type="number" min="0" step="0.1" value={bulkKg}
                onChange={e => setBulkKg(e.target.value)} placeholder="0.0"
                className="w-24 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              <span className="text-xs text-gray-500">kg</span>
              {parseFloat(bulkKg) > 0 && (
                <span className="text-xs font-bold ml-auto" style={{ color: SNZ_BLUE }}>+{calcBulkBonus(bulkKg)} pts</span>
              )}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-center justify-between">
            <span className="text-sm font-bold text-blue-700">Total</span>
            <span className="text-xl font-black" style={{ color: SNZ_BLUE }}>{previewPoints} pts</span>
          </div>

          <button onClick={save} disabled={saving}
            className="w-full py-2.5 rounded-xl font-black text-white text-sm disabled:opacity-50"
            style={{ background: SNZ_BLUE }}>
            {saving ? 'Saving…' : 'Save Weigh-in'}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Division Leaderboard ──────────────────────────────────────────────────────
function DivisionLeaderboard({ divId, teams, allWeighins }) {
  const [expandedId, setExpandedId] = useState(null)
  const divTeams = teamsInDiv(teams, divId)

  const withPoints = divTeams.map(t => {
    const tw = allWeighins.filter(w => w.team_id === t.id && w.division === divId)
    const total = tw.reduce((s, w) => s + (w.points_awarded || 0), 0)
    const fishCount = tw.filter(w => !w.is_bulk).length
    return { ...t, total, fishCount, hasEntry: tw.length > 0 }
  }).sort((a, b) => b.total - a.total)

  // For Open, compute each team's rank within other divisions
  const getDivBadges = (team) => {
    if (divId !== 'open') return []
    const badges = []

    // Standard sub-divisions ranked by their own weigh-ins
    STANDARD_DIVS
      .filter(d => d.id !== 'open' && !d.derived && isInDiv(team, d.id))
      .forEach(d => {
        const ranked = teamsInDiv(teams, d.id)
          .map(t => {
            const tw = allWeighins.filter(w => w.team_id === t.id && w.division === d.id)
            return { id: t.id, total: tw.reduce((s, w) => s + (w.points_awarded || 0), 0), hasEntry: tw.length > 0 }
          })
          .filter(t => t.hasEntry)
          .sort((a, b) => b.total - a.total)
        const rank = ranked.findIndex(t => t.id === team.id) + 1
        if (rank > 0) badges.push({ label: d.label, rank })
      })

    // Age divisions (Silver/Golden Oldie) ranked by Open score
    ;[{ id: 'womens', label: "🔱 Women's" }, { id: 'silveroldie', label: '🥈 Silver Oldie' }, { id: 'goldenoldie', label: '🎖️ Golden Oldie' }]
      .filter(ag => team.nationals_event?.[ag.id])
      .forEach(ag => {
        const ranked = teams
          .filter(t => t.nationals_event?.[ag.id])
          .map(t => {
            const tw = allWeighins.filter(w => w.team_id === t.id && w.division === 'open')
            return { id: t.id, total: tw.reduce((s, w) => s + (w.points_awarded || 0), 0), hasEntry: tw.length > 0 }
          })
          .filter(t => t.hasEntry)
          .sort((a, b) => b.total - a.total)
        const rank = ranked.findIndex(t => t.id === team.id) + 1
        if (rank > 0) badges.push({ label: ag.label, rank })
      })

    return badges
  }

  const medals = ['🥇', '🥈', '🥉']

  if (divTeams.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center text-gray-400 text-sm">
        No competitors registered for {DIV_LABELS[divId]}.
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
        <h3 className="font-black text-gray-900">{DIV_LABELS[divId]} — Leaderboard</h3>
        <p className="text-xs text-gray-400 mt-0.5">
          {withPoints.filter(t => t.hasEntry).length} / {divTeams.length} weighed in
          {divId === 'open' && ' · Division badges show rank within sub-events'}
        </p>
      </div>
      <div className="divide-y divide-gray-100">
        {withPoints.map((t, i) => {
          const badges = getDivBadges(t)
          const open = expandedId === t.id
          return (
            <div key={t.id}>
              <button type="button" disabled={!t.hasEntry}
                onClick={() => setExpandedId(open ? null : t.id)}
                className={`w-full text-left px-4 py-3 flex items-center gap-3 ${t.hasEntry ? 'cursor-pointer hover:bg-gray-50' : 'cursor-default'} ${open ? 'bg-blue-50' : i === 0 && t.hasEntry ? 'bg-amber-50' : ''}`}>
                <span className="w-7 text-center flex-shrink-0 font-bold text-sm">
                  {t.hasEntry ? (medals[i] || `#${i + 1}`) : <span className="text-gray-300">–</span>}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-gray-900 text-sm truncate flex items-center gap-1">
                    {t.team_name}{t.hasEntry && <span className="text-gray-400 text-xs">{open ? '▲' : '▼'}</span>}
                  </p>
                  <div className="flex items-center gap-1 flex-wrap mt-0.5">
                    {t._d1?.name && (
                      <span className="text-xs text-gray-400">
                        {t._d1.name}{!t.nationals_event?.is_individual && t._d2?.name ? ` & ${t._d2.name}` : ''}
                      </span>
                    )}
                    {badges.map(b => (
                      <span key={b.label} className="text-xs px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-100 font-bold">
                        {b.label} #{b.rank}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  {t.hasEntry ? (
                    <>
                      <p className="text-base font-black" style={{ color: SNZ_BLUE }}>{t.total} pts</p>
                      <p className="text-xs text-gray-400">{t.fishCount} fish</p>
                    </>
                  ) : (
                    <p className="text-xs text-gray-300">Not entered</p>
                  )}
                </div>
              </button>
              {open && <NatFishBreakdown teamId={t.id} allWeighins={allWeighins} scoreDiv={divId} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Standard Division Results ─────────────────────────────────────────────────
function StandardDivisionResults({ divId, comp, teams, fishLists, allWeighins, onRefresh }) {
  const [selectedTeam, setSelectedTeam] = useState(null)
  const divTeams = teamsInDiv(teams, divId)
  const fishList = fishLists[divId] || []

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <div className="space-y-3">
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <h3 className="font-bold text-gray-900">Competitors</h3>
            <p className="text-xs text-gray-400 mt-0.5">
              {divTeams.length} teams · {fishList.length} species in list · Click to weigh in
            </p>
          </div>
          {divTeams.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No competitors registered for this event.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {divTeams.map(t => {
                const tw = allWeighins.filter(w => w.team_id === t.id && w.division === divId)
                const total = tw.reduce((s, w) => s + (w.points_awarded || 0), 0)
                const isSelected = selectedTeam?.id === t.id
                return (
                  <button key={t.id}
                    onClick={() => setSelectedTeam(isSelected ? null : t)}
                    className={`w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-gray-50 transition ${isSelected ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">{t.team_name}</p>
                      <p className="text-xs text-gray-400 truncate">
                        {t._d1?.name || '?'}{!t.nationals_event?.is_individual && (t._d2?.name || t.diver2_email) ? ` & ${t._d2?.name || t.diver2_email}` : ''}
                      </p>
                    </div>
                    {tw.length > 0 ? (
                      <span className="text-xs font-black flex-shrink-0" style={{ color: SNZ_BLUE }}>
                        {total} pts · {tw.filter(w => !w.is_bulk).length} fish
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300 flex-shrink-0">No entry</span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {selectedTeam && (
          <WeighInPanel
            key={selectedTeam.id}
            team={selectedTeam}
            divId={divId}
            fishList={fishList}
            allWeighins={allWeighins}
            compId={comp.id}
            onSaved={() => { setSelectedTeam(null); onRefresh() }}
            onClose={() => setSelectedTeam(null)}
          />
        )}
      </div>

      <DivisionLeaderboard divId={divId} teams={teams} allWeighins={allWeighins} />
    </div>
  )
}

// ── Photography Results ───────────────────────────────────────────────────────
function PhotographyResults({ comp, teams, allWeighins, onRefresh }) {
  const competitors = individualCompetitors(teams, 'photography')
  const [counts, setCounts] = useState({})
  const [saving, setSaving] = useState(null)

  useEffect(() => {
    const m = {}
    for (const c of competitors) {
      const ex = allWeighins.find(w => w.team_id === c.team.id && w.division === 'photography' && w.instance === c.diver_slot)
      if (ex) m[c.key] = String(ex.points_awarded || '')
    }
    setCounts(m)
  }, [allWeighins]) // eslint-disable-line

  const saveCount = async (c) => {
    const count = parseInt(counts[c.key]) || 0
    setSaving(c.key)
    await supabase.from('comp_weighins')
      .delete().eq('competition_id', comp.id).eq('team_id', c.team.id).eq('division', 'photography').eq('instance', c.diver_slot)
    await supabase.from('comp_weighins').insert({
      competition_id: comp.id, team_id: c.team.id, division: 'photography',
      fish_id: null, fish_name: '__photography__', weight_kg: null,
      points_awarded: count, instance: c.diver_slot, is_bulk: false,
      weighed_at: new Date().toISOString(),
    })
    setSaving(null)
    onRefresh()
  }

  const ranked = [...competitors].map(c => {
    const ex = allWeighins.find(w => w.team_id === c.team.id && w.division === 'photography' && w.instance === c.diver_slot)
    return { ...c, count: ex?.points_awarded || 0, hasResult: !!ex }
  }).sort((a, b) => b.count - a.count)

  const medals = ['🥇', '🥈', '🥉']

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
        <h3 className="font-black text-gray-900">📸 Photography — Results</h3>
        <p className="text-xs text-gray-400 mt-0.5">Enter fish count per competitor — ranked most to least</p>
      </div>
      {competitors.length === 0 ? (
        <div className="p-8 text-center text-gray-400 text-sm">No photography competitors registered.</div>
      ) : (
        <div className="divide-y divide-gray-100">
          {ranked.map((c, i) => (
            <div key={c.key} className="px-4 py-3 flex items-center gap-3">
              <span className="w-7 text-center font-bold text-sm flex-shrink-0">
                {c.hasResult ? (medals[i] || `#${i + 1}`) : <span className="text-gray-300">–</span>}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm">{c.name}</p>
                <p className="text-xs text-gray-400 truncate">{c.team.team_name}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <input type="number" min="0"
                  value={counts[c.key] ?? ''}
                  onChange={e => setCounts(prev => ({ ...prev, [c.key]: e.target.value }))}
                  placeholder="0"
                  className="w-16 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-300" />
                <span className="text-xs text-gray-400">fish</span>
                <button onClick={() => saveCount(c)} disabled={saving === c.key}
                  className="text-xs font-black px-3 py-1.5 rounded-lg text-white disabled:opacity-50"
                  style={{ background: SNZ_BLUE }}>
                  {saving === c.key ? '…' : '✓'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Fin Swim Results ──────────────────────────────────────────────────────────
function FinSwimResults({ comp, teams, allWeighins, onRefresh }) {
  const competitors = individualCompetitors(teams, 'finswim')
  const [placings, setPlacings] = useState({})
  const [saving, setSaving] = useState(null)

  useEffect(() => {
    const m = {}
    for (const c of competitors) {
      const ex = allWeighins.find(w => w.team_id === c.team.id && w.division === 'finswim' && w.instance === c.diver_slot)
      if (ex) m[c.key] = String(ex.points_awarded || '')
    }
    setPlacings(m)
  }, [allWeighins]) // eslint-disable-line

  const savePlacing = async (c) => {
    const placing = parseInt(placings[c.key])
    if (!placing || placing < 1) return
    setSaving(c.key)
    await supabase.from('comp_weighins')
      .delete().eq('competition_id', comp.id).eq('team_id', c.team.id).eq('division', 'finswim').eq('instance', c.diver_slot)
    await supabase.from('comp_weighins').insert({
      competition_id: comp.id, team_id: c.team.id, division: 'finswim',
      fish_id: null, fish_name: '__finswim__', weight_kg: null,
      points_awarded: placing, instance: c.diver_slot, is_bulk: false,
      weighed_at: new Date().toISOString(),
    })
    setSaving(null)
    onRefresh()
  }

  const ranked = [...competitors].map(c => {
    const ex = allWeighins.find(w => w.team_id === c.team.id && w.division === 'finswim' && w.instance === c.diver_slot)
    return { ...c, placing: ex?.points_awarded || null, hasResult: !!ex }
  }).sort((a, b) => {
    if (!a.placing && !b.placing) return 0
    if (!a.placing) return 1
    if (!b.placing) return -1
    return a.placing - b.placing
  })

  const getMedal = (placing) => placing === 1 ? '🥇' : placing === 2 ? '🥈' : placing === 3 ? '🥉' : `#${placing}`

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
        <h3 className="font-black text-gray-900">🐟 Fin Swimming — Results</h3>
        <p className="text-xs text-gray-400 mt-0.5">Enter placing per competitor (1 = 1st place)</p>
      </div>
      {competitors.length === 0 ? (
        <div className="p-8 text-center text-gray-400 text-sm">No fin swim competitors registered.</div>
      ) : (
        <div className="divide-y divide-gray-100">
          {ranked.map(c => (
            <div key={c.key} className="px-4 py-3 flex items-center gap-3">
              <span className="w-7 text-center font-bold text-sm flex-shrink-0">
                {c.hasResult ? getMedal(c.placing) : <span className="text-gray-300">–</span>}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm">{c.name}</p>
                <p className="text-xs text-gray-400 truncate">{c.team.team_name}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <input type="number" min="1"
                  value={placings[c.key] ?? ''}
                  onChange={e => setPlacings(prev => ({ ...prev, [c.key]: e.target.value }))}
                  placeholder="1"
                  className="w-16 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-300" />
                <span className="text-xs text-gray-400">place</span>
                <button onClick={() => savePlacing(c)} disabled={saving === c.key || !placings[c.key]}
                  className="text-xs font-black px-3 py-1.5 rounded-lg text-white disabled:opacity-50"
                  style={{ background: SNZ_BLUE }}>
                  {saving === c.key ? '…' : '✓'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Super Diver Results (aggregate of Open + Photography + Fin Swim placings) ──
function SuperDiverResults({ teams, allWeighins }) {
  const ranked = superDiverLeaderboard(teams, allWeighins)
  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
        <h3 className="font-black text-gray-900">⭐ Super Diver — Leaderboard</h3>
        <p className="text-xs text-gray-400 mt-0.5">Lowest aggregate of Open + Photography + Fin Swim placings wins · needs a result in all three</p>
      </div>
      {ranked.length === 0 ? (
        <div className="p-8 text-center text-gray-400 text-sm">No Super Diver entrants — divers must be entered in Open, Photography &amp; Fin Swim.</div>
      ) : (
        <div className="divide-y divide-gray-100">
          {ranked.map((c, i) => (
            <div key={c.key} className={`px-4 py-3 flex items-center gap-3 ${i === 0 && c.complete ? 'bg-amber-50' : ''}`}>
              <span className="w-9 text-center font-black text-base flex-shrink-0">
                {c.rank ? medalFor(c.rank) : <span className="text-gray-300 text-sm">–</span>}
              </span>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 text-sm truncate">{c.name}</p>
                <p className="text-xs text-gray-400 truncate">{c.team.team_name}</p>
              </div>
              <div className="text-right flex-shrink-0">
                {c.complete ? (
                  <>
                    <p className="text-base font-black" style={{ color: SNZ_BLUE }}>{c.aggregate}</p>
                    <p className="text-xs text-gray-400">Open {c.openPlacing} · Photo {c.photoPlacing} · Swim {c.swimPlacing}</p>
                  </>
                ) : (
                  <p className="text-xs text-amber-500">
                    Incomplete{' '}
                    <span className="text-gray-400">
                      ({[c.openPlacing ? null : 'Open', c.photoPlacing ? null : 'Photo', c.swimPlacing ? null : 'Swim'].filter(Boolean).join(', ')} pending)
                    </span>
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Results Tab ───────────────────────────────────────────────────────────────
function ResultsTab({ comp, teams, fishLists, allWeighins, onRefresh }) {
  const [selEvent, setSelEvent] = useState('open')

  const ALL_EVENTS = [
    ...STANDARD_DIVS,
    { id: 'photography', label: '📸 Photography' },
    { id: 'finswim', label: '🐟 Fin Swim' },
    { id: 'superdiver', label: '⭐ Super Diver' },
  ]

  // ── Results CSV export ──
  const EVENT_TYPE = { open: 'team', womens: 'team', juniors: 'team', under23: 'team', goldenoldie: 'team', silveroldie: 'team', photography: 'photo', finswim: 'finswim', superdiver: 'superdiver' }
  const SCORE_FROM = { womens: 'open', silveroldie: 'open' }
  const EXPORT_LABEL = { open: 'Open', womens: "Women's", juniors: 'Juniors', under23: 'Under 23', goldenoldie: 'Golden Oldie (60+)', silveroldie: 'Silver Oldie', photography: 'Photography', finswim: 'Fin Swim', superdiver: 'Super Diver' }
  const EXPORT_ORDER = ['open', 'womens', 'juniors', 'under23', 'goldenoldie', 'silveroldie', 'photography', 'finswim', 'superdiver']

  const unifiedRows = (id) => {
    const lbl = EXPORT_LABEL[id]
    const partnerLine = r => `${r._d1?.name || ''}${r._d2?.name ? ` & ${r._d2.name}` : ''}`
    if (EVENT_TYPE[id] === 'photo')
      return photographyLeaderboard(teams, allWeighins).filter(r => r.hasResult)
        .map(r => ({ event: lbl, rank: r.rank, competitor: r.name, team: r.team.team_name, score: r.count, detail: 'species' }))
    if (EVENT_TYPE[id] === 'finswim')
      return finSwimLeaderboard(teams, allWeighins).filter(r => r.hasResult)
        .map(r => ({ event: lbl, rank: r.placing, competitor: r.name, team: r.team.team_name, score: r.placing, detail: 'placing' }))
    if (EVENT_TYPE[id] === 'superdiver')
      return superDiverLeaderboard(teams, allWeighins).filter(r => r.complete)
        .map(r => ({ event: lbl, rank: r.rank, competitor: r.name, team: r.team.team_name, score: r.aggregate, detail: `Open ${r.openPlacing} / Photo ${r.photoPlacing} / Swim ${r.swimPlacing}` }))
    return teamLeaderboard(teams, allWeighins, id, SCORE_FROM[id] || null).filter(r => r.hasEntry)
      .map(r => ({ event: lbl, rank: r.rank, competitor: r.team_name, team: partnerLine(r), score: r.total, detail: `${r.fishCount} fish` }))
  }

  const RESULT_COLUMNS = [
    { label: 'Event', value: r => r.event },
    { label: 'Rank', value: r => r.rank },
    { label: 'Competitor', value: r => r.competitor },
    { label: 'Team / Partner', value: r => r.team },
    { label: 'Score', value: r => r.score },
    { label: 'Detail', value: r => r.detail },
  ]
  const stamp = () => new Date().toISOString().slice(0, 10)
  const exportSelected = () => downloadCSV(`nationals-2027-${selEvent}-results-${stamp()}.csv`, toCSV(unifiedRows(selEvent), RESULT_COLUMNS))
  const exportAll = () => downloadCSV(`nationals-2027-all-results-${stamp()}.csv`, toCSV(EXPORT_ORDER.flatMap(unifiedRows), RESULT_COLUMNS))

  const selectedRowCount = unifiedRows(selEvent).length

  return (
    <div className="space-y-4">
      <div className="flex gap-1.5 flex-wrap">
        {ALL_EVENTS.map(ev => (
          <button key={ev.id} onClick={() => setSelEvent(ev.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-bold transition border ${selEvent === ev.id ? 'text-white border-transparent' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}
            style={selEvent === ev.id ? { background: SNZ_BLUE } : {}}>
            {ev.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2 flex-wrap">
        <button onClick={exportSelected} disabled={selectedRowCount === 0}
          className="px-4 py-1.5 rounded-lg text-xs font-black whitespace-nowrap border border-gray-200 text-gray-700 hover:border-gray-300 disabled:opacity-40"
          title="Export the selected event's results to CSV">
          ⬇ Export this event ({selectedRowCount})
        </button>
        <button onClick={exportAll}
          className="px-4 py-1.5 rounded-lg text-xs font-black whitespace-nowrap border border-gray-200 text-gray-700 hover:border-gray-300"
          title="Export every event's results to a single CSV">
          ⬇ Export all results
        </button>
      </div>

      {selEvent === 'photography' && (
        <PhotographyResults comp={comp} teams={teams} allWeighins={allWeighins} onRefresh={onRefresh} />
      )}
      {selEvent === 'finswim' && (
        <FinSwimResults comp={comp} teams={teams} allWeighins={allWeighins} onRefresh={onRefresh} />
      )}
      {selEvent === 'superdiver' && (
        <SuperDiverResults teams={teams} allWeighins={allWeighins} />
      )}
      {STANDARD_DIVS.find(d => d.id === selEvent && !d.derived) && (
        <StandardDivisionResults
          divId={selEvent}
          comp={comp}
          teams={teams}
          fishLists={fishLists}
          allWeighins={allWeighins}
          onRefresh={onRefresh}
        />
      )}
      {STANDARD_DIVS.find(d => d.id === selEvent && d.derived) && (
        <DerivedDivLeaderboard
          divId={selEvent}
          label={STANDARD_DIVS.find(d => d.id === selEvent).label}
          teams={teams}
          allWeighins={allWeighins}
        />
      )}
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function NationalsAdmin() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('registrations')
  const [teams, setTeams] = useState([])
  const [comp, setComp] = useState(null)
  const [fishLists, setFishLists] = useState({})
  const [weighins, setWeighins] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    setLoading(true)
    let compData = null
    const { data: d1 } = await supabase
      .from('competitions').select('*').ilike('name', '%nationals%2027%').maybeSingle()
    compData = d1
    if (!compData) {
      const { data: all } = await supabase
        .from('competitions').select('*').ilike('name', '%national%')
      if (all?.length) compData = all[0]
    }
    setComp(compData)

    if (compData?.id) {
      const { data: teamData } = await supabase
        .from('comp_teams').select('*').eq('competition_id', compData.id)

      const enriched = await Promise.all((teamData || []).map(async team => {
        const { data: d1 } = await supabase.from('members').select('name, email').eq('id', team.diver1_member_id).maybeSingle()
        const d2 = team.diver2_member_id
          ? (await supabase.from('members').select('name, email').eq('id', team.diver2_member_id).maybeSingle()).data
          : null
        return { ...team, _d1: d1, _d2: d2 }
      }))
      setTeams(enriched)

      // Load per-division fish lists
      const { data: fishData } = await supabase
        .from('comp_fish').select('*').eq('competition_id', compData.id)
        .not('division', 'is', null).order('sort_order')
      const lists = {}
      for (const d of STANDARD_DIVS) lists[d.id] = []
      for (const f of (fishData || [])) { if (lists[f.division]) lists[f.division].push(f) }
      setFishLists(lists)

      // Load weigh-ins for this competition (nationals-specific)
      const { data: weighinData } = await supabase
        .from('comp_weighins').select('*').eq('competition_id', compData.id)
        .not('division', 'is', null)
      setWeighins(weighinData || [])
    } else {
      setTeams([])
      setFishLists({})
      setWeighins([])
    }
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

  const TABS = [
    ['registrations', 'Registrations'],
    ['fishlists', '🐟 Fish Lists'],
    ['results', '🏆 Results'],
    ['setup', '⚙ Setup'],
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <CompCopilotFAB competitionId={comp?.id} competitionName={comp?.name} />
      <div style={{ background: SNZ_DARK }} className="px-6 py-3 flex items-center justify-between border-b border-blue-900">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/nationals')}
            className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
            ← Nationals
          </button>
          <span className="text-white/50">/</span>
          <span className="text-white font-bold text-sm">Admin</span>
        </div>
        <button onClick={fetchData}
          className="text-xs font-bold text-white bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
          ↻ Refresh
        </button>
      </div>

      <div className="bg-white border-b border-gray-200 px-4 overflow-x-auto">
        <div className="flex gap-1 max-w-5xl mx-auto">
          {TABS.map(([tab, label]) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-4 py-3 text-sm font-bold whitespace-nowrap border-b-2 transition ${activeTab === tab ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {comp && (
        <div className="max-w-5xl mx-auto px-4 pt-3 pb-0">
          <p className="text-xs text-gray-400">Competition: <span className="font-bold text-gray-600">{comp.name}</span> · ID: <span className="font-mono text-gray-400">{comp.id}</span></p>
        </div>
      )}
      {!comp && activeTab === 'registrations' && !loading && (
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center">
            <p className="font-black text-amber-800 mb-1">No Nationals competition found</p>
            <p className="text-sm text-amber-700 mb-3">Create the competition record first in Setup, or check your competition name contains "national".</p>
            <button onClick={() => setActiveTab('setup')} className="px-4 py-2 rounded-xl font-bold text-white text-sm" style={{ background: SNZ_BLUE }}>
              Go to Setup →
            </button>
          </div>
        </div>
      )}
      {(activeTab === 'fishlists' || activeTab === 'results') && !comp && !loading && (
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center">
            <p className="font-black text-amber-800 mb-1">Competition not set up yet</p>
            <p className="text-sm text-amber-700">Create the competition in Setup first.</p>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-4 py-6">
        {activeTab === 'registrations' && <RegistrationsTab teams={teams} comp={comp} loading={loading} onRefresh={fetchData} />}
        {activeTab === 'fishlists' && comp && <FishListTab comp={comp} fishLists={fishLists} onRefresh={fetchData} />}
        {activeTab === 'results' && comp && <ResultsTab comp={comp} teams={teams} fishLists={fishLists} allWeighins={weighins} onRefresh={fetchData} />}
        {activeTab === 'setup' && <SetupTab comp={comp} onRefresh={fetchData} />}
      </div>
    </div>
  )
}
