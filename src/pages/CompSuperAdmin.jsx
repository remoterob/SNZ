import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, isAdmin } from '../lib/supabase'

const SNZ_BLUE = '#2B6CB0'
const SNZ_LOGO = import.meta.env.VITE_SNZ_LOGO_URL || null

// ── Password Reset Modal ────────────────────────────────────────────────────
function ResetPasswordModal({ comp, onClose, showToast }) {
  const [pwd, setPwd] = useState('')
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!pwd.trim()) { alert('Enter a new password'); return }
    setSaving(true)
    const { error } = await supabase.from('competitions').update({ club_password: btoa(pwd) }).eq('id', comp.id)
    if (error) showToast(error.message, 'error')
    else { showToast(`Password updated for ${comp.name}`); onClose() }
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6" onClick={e => e.stopPropagation()}>
        <h2 className="font-black text-gray-900 mb-1">Reset Password</h2>
        <p className="text-xs text-gray-400 mb-4">{comp.name}</p>
        <input type="password" value={pwd} onChange={e => setPwd(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && save()}
          placeholder="New club admin password"
          className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-blue-300" />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-300 text-sm font-bold text-gray-600">Cancel</button>
          <button onClick={save} disabled={saving} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50" style={{ background: SNZ_BLUE }}>
            {saving ? 'Saving…' : 'Reset Password'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Species Library Manager ─────────────────────────────────────────────────
function SpeciesLibrary({ showToast }) {
  const [species, setSpecies] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(null)
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [viewMode, setViewMode] = useState('grid')

  const fetchSpecies = () => {
    supabase.from('comp_species_library').select('*').order('sort_order').order('name')
      .then(({ data }) => { setSpecies(data || []); setLoading(false) })
  }

  useEffect(() => { fetchSpecies() }, [])

  const uploadPhoto = async (id, file) => {
    setUploading(id)
    try {
      const ext = file.name.split('.').pop().toLowerCase()
      const path = `species/${id}.${ext}`
      await supabase.storage.from('snz-media').remove([path])
      const { error } = await supabase.storage.from('snz-media').upload(path, file, { contentType: file.type })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('snz-media').getPublicUrl(path)
      await supabase.from('comp_species_library').update({ photo_url: publicUrl }).eq('id', id)
      showToast('Photo uploaded')
      fetchSpecies()
    } catch (err) { showToast(err.message, 'error') }
    finally { setUploading(null) }
  }

  const removePhoto = async (id) => {
    await supabase.from('comp_species_library').update({ photo_url: null }).eq('id', id)
    showToast('Photo removed')
    fetchSpecies()
  }

  const addSpecies = async () => {
    if (!newName.trim()) return
    const slug = newName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const { error } = await supabase.from('comp_species_library').insert({ name: newName.trim(), slug: `custom-${slug}-${Date.now()}`, sort_order: 999 })
    if (error) showToast(error.message, 'error')
    else { showToast('Species added'); setNewName(''); setAdding(false); fetchSpecies() }
  }

  const toggleActive = async (id, active) => {
    await supabase.from('comp_species_library').update({ active: !active }).eq('id', id)
    fetchSpecies()
  }

  const deleteSpecies = async (id, name) => {
    if (!confirm(`Delete "${name}" from the species library?

This won't affect fish already added to existing competitions.`)) return
    await supabase.from('comp_species_library').delete().eq('id', id)
    fetchSpecies()
    showToast(`${name} deleted`)
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50 flex-wrap gap-3">
        <div>
          <h2 className="font-black text-gray-900">Species Library</h2>
          <p className="text-xs text-gray-400 mt-0.5">Manage the master fish list available to all competitions. Upload photos against each species.</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => setViewMode(v => v === 'grid' ? 'list' : 'grid')}
            className="px-3 py-1.5 rounded-lg text-sm font-bold border border-gray-300 text-gray-600 hover:bg-gray-50">
            {viewMode === 'grid' ? '☰ List' : '⊞ Grid'}
          </button>
          <button onClick={() => setAdding(true)}
            className="px-3 py-1.5 rounded-lg text-sm font-bold text-white"
            style={{ background: SNZ_BLUE }}>+ Add Species</button>
        </div>
      </div>

      {adding && (
        <div className="px-5 py-3 border-b border-gray-100 bg-blue-50 flex gap-3 items-center">
          <input value={newName} onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addSpecies()}
            placeholder="Species common name"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            autoFocus />
          <button onClick={addSpecies} className="px-4 py-2 rounded-lg text-sm font-bold text-white" style={{ background: SNZ_BLUE }}>Add</button>
          <button onClick={() => { setAdding(false); setNewName('') }} className="px-4 py-2 rounded-lg text-sm font-bold border border-gray-300 text-gray-600">Cancel</button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-gray-400">Loading…</div>
      ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-4">
            {species.map(s => (
              <div key={s.id} className={`relative rounded-xl border-2 overflow-hidden ${!s.active ? 'opacity-40' : 'border-gray-200'}`}>
                <div className="relative">
                  {s.photo_url
                    ? <img src={s.photo_url} alt={s.name} className="w-full h-28 object-cover"
                        onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex' }} />
                    : null
                  }
                  <div className={`w-full h-28 bg-gray-100 items-center justify-center text-4xl ${s.photo_url ? 'hidden' : 'flex'}`}>🐟</div>
                  {uploading === s.id && (
                    <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
                    </div>
                  )}
                  {!s.active && <div className="absolute top-1 right-1 bg-gray-600 text-white text-xs px-1.5 py-0.5 rounded">Hidden</div>}
                </div>
                <div className="p-2">
                  <p className="text-xs font-bold text-gray-900 leading-tight">{s.name}</p>
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    <label className="cursor-pointer text-xs font-bold px-2 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 transition">
                      📷
                      <input type="file" accept="image/*" className="hidden"
                        onChange={e => e.target.files[0] && uploadPhoto(s.id, e.target.files[0])} />
                    </label>
                    {s.photo_url && (
                      <button onClick={() => removePhoto(s.id)} className="text-xs font-bold px-2 py-1 rounded border border-red-200 text-red-500 hover:bg-red-50">✕</button>
                    )}
                    <button onClick={() => toggleActive(s.id, s.active)}
                      className={`text-xs font-bold px-2 py-1 rounded border transition ${s.active ? 'border-gray-300 text-gray-400' : 'border-green-300 text-green-600'}`}>
                      {s.active ? 'Hide' : 'Show'}
                    </button>
                    <button onClick={() => deleteSpecies(s.id, s.name)}
                      className="text-xs font-bold px-2 py-1 rounded border border-red-200 text-red-500 hover:bg-red-50">✕</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {species.map(s => (
              <div key={s.id} className={`flex items-center gap-4 px-5 py-3 ${!s.active ? 'opacity-40' : ''}`}>
                <div className="flex-shrink-0 relative">
                  {s.photo_url
                    ? <img src={s.photo_url} alt={s.name} className="w-16 h-12 object-cover rounded-lg border border-gray-200"
                        onError={e => { e.target.style.display='none' }} />
                    : <div className="w-16 h-12 rounded-lg bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center text-2xl">🐟</div>
                  }
                  {uploading === s.id && (
                    <div className="absolute inset-0 bg-white/80 rounded-lg flex items-center justify-center">
                      <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
                    </div>
                  )}
                </div>
                <div className="flex-1 font-semibold text-gray-900 text-sm">{s.name}</div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <label className="cursor-pointer text-xs font-bold px-3 py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 transition">
                    {s.photo_url ? '📷 Replace' : '📷 Upload'}
                    <input type="file" accept="image/*" className="hidden"
                      onChange={e => e.target.files[0] && uploadPhoto(s.id, e.target.files[0])} />
                  </label>
                  {s.photo_url && (
                    <button onClick={() => removePhoto(s.id)}
                      className="text-xs font-bold px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition">Remove</button>
                  )}
                  <button onClick={() => toggleActive(s.id, s.active)}
                    className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition ${s.active ? 'border-gray-300 text-gray-500 hover:bg-gray-50' : 'border-green-300 text-green-600 hover:bg-green-50'}`}>
                    {s.active ? 'Hide' : 'Show'}
                  </button>
                  <button onClick={() => deleteSpecies(s.id, s.name)}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      }
    </div>
  )
}

// ── Create Competition Modal ─────────────────────────────────────────────────
function CreateCompModal({ onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '', club_name: '', scoring_mode: 'standard',
    date_start: '', date_end: '', location: '',
    categories: ['Open'], club_password: '', public_leaderboard: true,
  })
  const [saving, setSaving] = useState(false)
  const set = k => v => setForm(f => ({ ...f, [k]: v }))

  const toggleCat = (cat) => {
    const cur = form.categories || []
    set('categories')(cur.includes(cat) ? cur.filter(c => c !== cat) : [...cur, cat])
  }

  const save = async () => {
    if (!form.name.trim()) { alert('Competition name required'); return }
    if (!form.club_password.trim()) { alert('Club admin password required'); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('competitions').insert({
        ...form,
        club_password: btoa(form.club_password),
        date_start: form.date_start || null,
        date_end: form.date_end || null,
        status: 'draft',
      })
      if (error) throw error
      onCreated()
    } catch (err) { alert(err.message) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 overflow-y-auto" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-lg my-8 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-black text-gray-900">New Competition</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold">✕</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Competition Name <span className="text-red-400">*</span></label>
            <input value={form.name} onChange={e => set('name')(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="e.g. Auckland Spearfishing Classic 2026" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Club Name</label>
              <input value={form.club_name} onChange={e => set('club_name')(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" placeholder="e.g. Auckland USC" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Location</label>
              <input value={form.location} onChange={e => set('location')(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" placeholder="e.g. Hauraki Gulf" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Start Date</label>
              <input type="date" value={form.date_start} onChange={e => set('date_start')(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">End Date</label>
              <input type="date" value={form.date_end} onChange={e => set('date_end')(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Scoring Mode</label>
            <div className="flex gap-3">
              {[['standard','⚖ Standard'],['bingo','🎯 Fish Bingo']].map(([val,lbl]) => (
                <button key={val} type="button" onClick={() => set('scoring_mode')(val)}
                  className={`flex-1 py-2.5 rounded-lg border-2 text-sm font-semibold transition ${form.scoring_mode===val?'border-blue-500 bg-blue-50 text-blue-700':'border-gray-200 text-gray-500'}`}>
                  {lbl}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Categories</label>
            <div className="flex flex-wrap gap-2">
              {['Open','Mens','Womens','Mixed','Junior'].map(cat => {
                const on = form.categories.includes(cat)
                return (
                  <button key={cat} type="button" onClick={() => toggleCat(cat)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-bold border-2 transition ${on?'border-blue-500 bg-blue-50 text-blue-700':'border-gray-200 text-gray-500'}`}>
                    {cat}
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Club Admin Password <span className="text-red-400">*</span></label>
            <input type="text" value={form.club_password} onChange={e => set('club_password')(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder="Password you'll give the club admin" />
            <p className="text-xs text-gray-400 mt-1">This is shown in plain text so you can share it with the club. You can reset it any time.</p>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" checked={form.public_leaderboard} onChange={e => set('public_leaderboard')(e.target.checked)} className="w-4 h-4" />
            <span className="text-sm text-gray-700">Live public leaderboard (visible during competition)</span>
          </label>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-300 text-sm font-bold text-gray-600">Cancel</button>
            <button type="button" onClick={save} disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
              style={{ background: SNZ_BLUE }}>
              {saving ? 'Creating…' : 'Create Competition'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main ────────────────────────────────────────────────────────────────────

// ── Member Password Reset ────────────────────────────────────────────────────
function MemberPasswordReset({ adminPassword }) {
  const [search, setSearch] = useState('')
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(null)
  const [tempPwd, setTempPwd] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const showToast = (msg, type='success') => { setToast({msg,type}); setTimeout(()=>setToast(null),3000) }

  const searchMembers = async () => {
    if (!search.trim()) return
    setLoading(true)
    const { data } = await supabase.from('members')
      .select('id, name, email, member_number, membership_status, payment_status')
      .or(`name.ilike.%${search}%,email.ilike.%${search}%`)
      .limit(10)
    setMembers(data || [])
    setLoading(false)
  }

  const resetPassword = async () => {
    if (!selected || tempPwd.length < 8) return
    setSaving(true)
    try {
      const res = await fetch('/.netlify/functions/admin-reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminPassword,
          memberId: selected.id,
          tempPassword: tempPwd,
        })
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error)
      showToast(`Password reset for ${selected.name}. Temp password: ${tempPwd}`)
      setTempPwd('')
      setSelected(null)
    } catch (err) {
      showToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-semibold shadow-lg max-w-sm ${toast.type==='error'?'bg-red-600 text-white':'bg-green-600 text-white'}`}>
          {toast.msg}
        </div>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <p className="font-bold mb-1">Admin Password Reset</p>
        <p className="text-xs">Use this to set a temporary password for a member who can't receive email. Tell them their temp password directly, then they can change it from their membership dashboard.</p>
      </div>

      {/* Search */}
      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Find Member</label>
        <div className="flex gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && searchMembers()}
            placeholder="Name or email…"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
          <button onClick={searchMembers} disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-50"
            style={{ background: SNZ_BLUE }}>
            {loading ? '…' : 'Search'}
          </button>
        </div>

        {members.length > 0 && (
          <div className="mt-3 divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
            {members.map(m => (
              <button key={m.id} onClick={() => { setSelected(m); setTempPwd('') }}
                className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition flex items-center justify-between ${selected?.id === m.id ? 'bg-blue-50' : ''}`}>
                <div>
                  <p className="text-sm font-bold text-gray-900">{m.name || '—'}</p>
                  <p className="text-xs text-gray-400">{m.email} · {m.member_number}</p>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${m.payment_status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {m.payment_status === 'paid' ? 'Active' : 'Pending'}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Reset form */}
      {selected && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-black tracking-widest uppercase mb-3" style={{ color: SNZ_BLUE }}>Set Temporary Password for {selected.name}</p>
          <p className="text-xs text-gray-400 mb-3">{selected.email}</p>
          <div className="flex gap-2">
            <input type="text" value={tempPwd} onChange={e => setTempPwd(e.target.value)}
              placeholder="Temporary password (min 8 chars)"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
            <button onClick={resetPassword} disabled={saving || tempPwd.length < 8}
              className="px-4 py-2 rounded-lg text-sm font-bold text-white disabled:opacity-50"
              style={{ background: '#d97706' }}>
              {saving ? '…' : 'Set Password'}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">Tell the member their temporary password directly. They can change it from their membership dashboard.</p>
        </div>
      )}
    </div>
  )
}

export default function CompSuperAdmin() {
  const navigate = useNavigate()
  const [comps, setComps] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [resetComp, setResetComp] = useState(null)
  const [tab, setTab] = useState('comps')
  const [toast, setToast] = useState(null)
  const [authChecked, setAuthChecked] = useState(false)

  const showToast = (msg, type='success') => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000) }

  const fetchComps = () => {
    supabase.from('competitions').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { setComps(data || []); setLoading(false) })
  }

  useEffect(() => {
    if (!isAdmin()) {
      navigate('/admin/login', { state: { from: '/competitions/admin' } })
    } else {
      setAuthChecked(true)
      fetchComps()
    }
  }, [])

  if (!authChecked) return null

  const deleteComp = async (id, name) => {
    if (!confirm(`Delete "${name}"? This removes all teams and weigh-in data permanently.`)) return
    await supabase.from('comp_weighins').delete().eq('competition_id', id)
    await supabase.from('comp_team_members').delete().eq('competition_id', id)
    await supabase.from('comp_teams').delete().eq('competition_id', id)
    await supabase.from('comp_fish').delete().eq('competition_id', id)
    await supabase.from('competitions').delete().eq('id', id)
    fetchComps()
    showToast('Competition deleted')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {toast && <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-semibold shadow-lg ${toast.type==='error'?'bg-red-600 text-white':'bg-green-600 text-white'}`}>{toast.msg}</div>}
      {showCreate && <CreateCompModal onClose={() => setShowCreate(false)} onCreated={() => { fetchComps(); setShowCreate(false); showToast('Competition created') }} />}
      {resetComp && <ResetPasswordModal comp={resetComp} onClose={() => setResetComp(null)} showToast={showToast} />}

      <div style={{ background: SNZ_BLUE }} className="px-6 py-3 flex items-center justify-between border-b border-blue-700">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/competitions')} className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">← Competitions</button>
          <span className="text-blue-200 text-sm opacity-75">/ SNZ Admin</span>
        </div>
      </div>

      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-gray-900">Competitions Admin</h1>
            <p className="text-xs text-gray-400 mt-0.5">Manage club competitions and species library</p>
          </div>
          {tab === 'comps' && (
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold text-white"
              style={{ background: SNZ_BLUE }}>
              + New Competition
            </button>
          )}
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="max-w-4xl mx-auto flex gap-1">
          {[['comps','Competitions'],['species','Species Library']].map(([tid,tlabel]) => (
            <button key={tid} onClick={() => setTab(tid)}
              className={`py-3 px-4 text-sm font-bold border-b-2 transition ${tab===tid?'border-blue-600 text-blue-700':'border-transparent text-gray-400 hover:text-gray-600'}`}>
              {tlabel}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6">
        {tab === 'comps' && (
          <>
            {loading && <div className="text-center py-12 text-gray-400">Loading…</div>}
            {!loading && comps.length === 0 && (
              <div className="text-center py-16 bg-white border border-gray-200 rounded-2xl text-gray-400">
                <div className="text-4xl mb-3">🎣</div>
                <p>No competitions yet. Create the first one.</p>
              </div>
            )}
            <div className="space-y-3">
              {comps.map(c => (
                <div key={c.id} className="bg-white border border-gray-200 rounded-xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.status==='active'?'bg-green-100 text-green-700':c.status==='closed'?'bg-gray-100 text-gray-500':'bg-amber-100 text-amber-700'}`}>{c.status}</span>
                        <span className="text-xs text-gray-400">{c.club_name}</span>
                      </div>
                      <h3 className="font-black text-gray-900">{c.name}</h3>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {c.scoring_mode === 'standard' ? '⚖ Standard' : '🎯 Bingo'} ·
                        {c.date_start ? ` ${new Date(c.date_start).toLocaleDateString('en-NZ')}` : ' No date set'}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
                      <button onClick={() => navigate(`/competitions/${c.id}`)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold border border-gray-300 text-gray-600 hover:bg-gray-50">View</button>
                      <button onClick={() => navigate(`/competitions/${c.id}/admin`)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold text-white"
                        style={{ background: SNZ_BLUE }}>Manage</button>
                      <button onClick={() => setResetComp(c)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold border border-amber-300 text-amber-600 hover:bg-amber-50">🔑 Reset Password</button>
                      <button onClick={() => deleteComp(c.id, c.name)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold border border-red-200 text-red-500 hover:bg-red-50">Delete</button>
                    </div>
                  </div>
                  {/* Show current password hint */}
                  <div className="mt-2 pt-2 border-t border-gray-50">
                    <p className="text-xs text-gray-400">Club password: <span className="font-mono text-gray-600">{c.club_password ? atob(c.club_password) : '—'}</span></p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {tab === 'species' && <SpeciesLibrary showToast={showToast} />}
      {tab === 'members' && <MemberPasswordReset adminPassword={adminPassword} />}
      </div>
    </div>
  )
}
