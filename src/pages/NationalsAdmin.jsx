import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import CompCopilotFAB from './CompCopilotFAB'

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

const NATIONALS_EVENTS = [
  { id: 'open', label: '🏆 Open Championship' },
  { id: 'womens', label: "🔱 Women's Championship" },
  { id: 'juniors', label: '🌟 Junior Championship' },
  { id: 'goldenoldie', label: '🎖️ Golden Oldie' },
  { id: 'under23', label: '🎯 Under 23 Division' },
  { id: 'photography', label: '📸 Snorkel Photography' },
  { id: 'finswim', label: '🐟 Fin Swimming' },
  { id: 'silveroldie', label: '🥈 Silver Oldie' },
]

const SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL']

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

          {/* Team name */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Team Name *</label>
            <input value={form.team_name} onChange={e => set('team_name')(e.target.value)}
              placeholder="e.g. The Deep Ones"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          </div>

          {/* Divers */}
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

          {/* Status + fee */}
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
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Entry Fee (¢)</label>
              <input type="number" min="0" value={form.entry_fee_cents} onChange={e => set('entry_fee_cents')(e.target.value)}
                placeholder="e.g. 13500"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>

          {/* Diver 1 payment */}
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

          {/* Diver 2 payment */}
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

          {/* Events */}
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
              {/* Jacket */}
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
              {/* Shirt */}
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

// ── Registrations Tab ────────────────────────────────────────────────────────
function RegistrationsTab({ teams, comp, loading, onRefresh }) {
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [modalTeam, setModalTeam] = useState(undefined) // undefined=closed, null=new, obj=edit
  const [saving, setSaving] = useState(null)

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

  const quickMark = async (teamId, field, value, e) => {
    e.stopPropagation()
    setSaving(`${teamId}-${field}`)
    const update = { [field]: value }
    if (field === 'payment_status' && value === 'paid') update.status = 'active'
    await supabase.from('comp_teams').update(update).eq('id', teamId)
    await onRefresh()
    setSaving(null)
  }

  const counts = {
    all: teams.filter(t => t.status !== 'withdrawn').length,
    active: teams.filter(t => t.status === 'active').length,
    pending_payment: teams.filter(t => t.status === 'pending_payment').length,
    pending: teams.filter(t => t.status === 'pending_diver2').length,
    unpaid: teams.filter(t => t.payment_status !== 'paid' && t.status !== 'withdrawn').length,
    withdrawn: teams.filter(t => t.status === 'withdrawn').length,
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

      {/* Stats */}
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

      {/* Controls */}
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
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <p className="font-black text-gray-900 text-sm">{team.team_name || '(no team name)'}</p>
                    <StatusBadge status={team.status} />
                  </div>
                  <p className="text-xs text-gray-600">
                    <span className="font-semibold">{team._d1?.name || '—'}</span>
                    {' & '}
                    <span className="font-semibold">{team._d2?.name || team.diver2_email || '—'}</span>
                  </p>

                  {/* Payment status row */}
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

                  {/* Events */}
                  {activeEvents.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {activeEvents.map(e => (
                        <span key={e} className="text-xs px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">{e}</span>
                      ))}
                    </div>
                  )}

                  {/* Merch */}
                  {(merch.jacket || merch.shirt || merch.meal_qty > 0) && (
                    <p className="text-xs text-gray-400 mt-1">
                      {[
                        merch.jacket ? `🧥 ${merch.jacket.gender} ${merch.jacket.size}` : null,
                        merch.shirt ? `👕 ${merch.shirt.gender} ${merch.shirt.size}` : null,
                        merch.meal_qty > 0 ? `🍽️ ×${merch.meal_qty}` : null,
                      ].filter(Boolean).join(' · ')}
                    </p>
                  )}

                  {/* Stripe PIs */}
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

                {/* Actions */}
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
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Setup Tab ────────────────────────────────────────────────────────────────
function SetupTab({ comp, onRefresh }) {
  const [form, setForm] = useState(null)
  const [fees, setFees] = useState({})
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
    } else {
      setForm({ name: 'SNZ Nationals 2027', date_start: '2027-01-19', registration_cutoff: '', early_bird_cutoff: '', club_name: 'Spearfishing New Zealand', status: 'upcoming' })
      setFees(defaultFees())
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

    const payload = {
      name: form.name, club_name: form.club_name,
      date_start: form.date_start || null,
      registration_cutoff: form.registration_cutoff || null,
      early_bird_cutoff: form.early_bird_cutoff || null,
      status: form.status, category_fees,
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

  return (
    <div className="max-w-lg space-y-5">
      {/* Competition details */}
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

      {/* Entry fees */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
        <div>
          <h3 className="font-black text-gray-900">Entry Fees — Per Person</h3>
          <p className="text-xs text-gray-400 mt-0.5">All fees charged per person. Leave early bird blank to disable.</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs font-bold text-gray-400 uppercase tracking-wide pb-1 border-b border-gray-100">
          <span>Event</span><span>Standard (¢)</span><span>Early bird (¢)</span>
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
        <p className="text-xs text-gray-400">Amounts in cents (8000 = $80.00). Silver Oldie auto-qualifies from Open (set to 0).</p>
      </div>

      {/* Merch & meal */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
        <div>
          <h3 className="font-black text-gray-900">Merchandise & Meal Pricing</h3>
          <p className="text-xs text-gray-400 mt-0.5">Leave blank or 0 to hide from registration.</p>
        </div>
        {[{ label: '🧥 Event Jacket', key: 'jacket' }, { label: '👕 Event T-Shirt', key: 'shirt' }].map(item => (
          <div key={item.key} className="flex items-center gap-3">
            <span className="text-sm text-gray-700 w-36 flex-shrink-0">{item.label}</span>
            <div className="flex-1">
              <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Price (¢)</label>
              <input type="number" min="0" value={fees.merch?.[item.key]?.price ?? ''} placeholder="0"
                onChange={e => setFees(f => ({ ...f, merch: { ...f.merch, [item.key]: { price: e.target.value } } }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>
        ))}
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-700 w-36 flex-shrink-0">🍽️ Prize Giving Dinner</span>
          <div className="flex-1">
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1">Per ticket (¢)</label>
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

// ── Main ─────────────────────────────────────────────────────────────────────
export default function NationalsAdmin() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('registrations')
  const [teams, setTeams] = useState([])
  const [comp, setComp] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    setLoading(true)
    // Try exact match first, then broader search
    let compData = null
    const { data: d1 } = await supabase
      .from('competitions').select('*').ilike('name', '%nationals%2027%').maybeSingle()
    compData = d1
    // Fallback: find any competition with nationals_event in category_fees
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
    } else {
      setTeams([])
    }
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [])

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
          {[['registrations', 'Registrations'], ['setup', '⚙ Setup']].map(([tab, label]) => (
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

      <div className="max-w-5xl mx-auto px-4 py-6">
        {activeTab === 'registrations' && <RegistrationsTab teams={teams} comp={comp} loading={loading} onRefresh={fetchData} />}
        {activeTab === 'setup' && <SetupTab comp={comp} onRefresh={fetchData} />}
      </div>
    </div>
  )
}
