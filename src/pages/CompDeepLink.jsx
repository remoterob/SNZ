// Deep link page for competitors — clean shareable URL: /c/:id
// Designed to be shared via WhatsApp, Instagram, email etc.
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const SNZ_BLUE = '#2B6CB0'
const SNZ_LOGO = import.meta.env.VITE_SNZ_LOGO_URL || null

const CATEGORY_COLORS = {
  'Mens':   { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  'Womens': { bg: '#fdf2f8', text: '#9d174d', border: '#fbcfe8' },
  'Mixed':  { bg: '#f5f3ff', text: '#5b21b6', border: '#ddd6fe' },
  'Junior': { bg: '#f0fdf4', text: '#166534', border: '#bbf7d0' },
  'Open':   { bg: '#f9fafb', text: '#374151', border: '#e5e7eb' },
}

function SponsorBar({ comp }) {
  const sponsors = [comp?.sponsor1_url, comp?.sponsor2_url, comp?.sponsor3_url].filter(Boolean)
  if (!sponsors.length) return null
  return (
    <div className="bg-white border-t border-gray-100 px-6 py-5">
      <div className="max-w-5xl mx-auto">
        <p className="text-xs font-bold tracking-widest uppercase text-gray-400 text-center mb-3">Proudly Sponsored By</p>
        <div className="flex items-center justify-center gap-8 flex-wrap">
          {sponsors.map((url, i) => (
            <img key={i} src={url} alt={`Sponsor ${i+1}`}
              className="h-12 max-w-32 object-contain opacity-80 hover:opacity-100 transition" />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function CompDeepLink() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [comp, setComp] = useState(null)
  const [fish, setFish] = useState([])
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('competitions').select('*').eq('id', id).single(),
      supabase.from('comp_fish').select('*').eq('competition_id', id).order('sort_order'),
      supabase.from('comp_teams').select('*').eq('competition_id', id),
    ]).then(([c, f, t]) => {
      setComp(c.data)
      setFish(f.data || [])
      setTeams(t.data || [])
      setLoading(false)
    })
  }, [id])

  if (loading) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin"/>
    </div>
  )

  if (!comp) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6 text-white text-center">
      <div>
        <p className="font-bold">Competition not found.</p>
        <button onClick={() => navigate('/competitions')} className="mt-4 text-sm underline opacity-60">View all competitions</button>
      </div>
    </div>
  )

  const isActive = comp.status === 'active'
  const isClosed = comp.status === 'closed'
  const dateStr = comp.date_start
    ? new Date(comp.date_start).toLocaleDateString('en-NZ', { weekday:'long', day:'numeric', month:'long', year:'numeric' })
    : null
  const dateEndStr = comp.date_end && comp.date_end !== comp.date_start
    ? new Date(comp.date_end).toLocaleDateString('en-NZ', { weekday:'long', day:'numeric', month:'long', year:'numeric' })
    : null

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Cover image hero */}
      {comp.cover_image_url ? (
        <div className="relative w-full h-56 sm:h-80 overflow-hidden">
          <img src={comp.cover_image_url} alt={comp.name} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 px-5 pb-5">
            {SNZ_LOGO && <img src={SNZ_LOGO} alt="SNZ" className="h-8 object-contain mb-2 opacity-90" />}
            <h1 className="text-2xl sm:text-4xl font-black text-white leading-tight">{comp.name}</h1>
            {comp.club_name && <p className="text-white/70 text-sm mt-0.5">{comp.club_name}</p>}
          </div>
        </div>
      ) : (
        <div style={{ background: SNZ_BLUE }} className="px-5 pt-8 pb-6">
          {SNZ_LOGO && <img src={SNZ_LOGO} alt="SNZ" className="h-10 object-contain mb-3 opacity-90" />}
          <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight">{comp.name}</h1>
          {comp.club_name && <p className="text-white/70 text-sm mt-0.5">{comp.club_name}</p>}
        </div>
      )}

      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">

        {/* Status + date chips */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className={`text-xs font-black px-3 py-1 rounded-full ${isActive ? 'bg-green-100 text-green-700' : isClosed ? 'bg-gray-100 text-gray-500' : 'bg-amber-100 text-amber-700'}`}>
            {isActive ? '● REGISTRATIONS OPEN' : isClosed ? 'CLOSED' : 'COMING SOON'}
          </span>
          {dateStr && (
            <span className="text-xs font-semibold text-gray-500">
              📅 {dateStr}{dateEndStr ? ` — ${dateEndStr}` : ''}
            </span>
          )}
          {comp.location && <span className="text-xs font-semibold text-gray-500">📍 {comp.location}</span>}
        </div>

        {/* Register CTA — prominent */}
        {isActive && (
          <button
            onClick={() => navigate(`/competitions/${id}/register`)}
            className="w-full py-4 rounded-2xl font-black text-white text-lg shadow-lg active:scale-95 transition"
            style={{ background: '#16a34a' }}
          >
            Register Your Team
          </button>
        )}

        {/* Scoring mode + categories */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4">
          <div className="flex flex-wrap gap-2 mb-3">
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
              {comp.scoring_mode === 'standard' ? '⚖ Standard scoring' : '🎯 Fish bingo'}
            </span>
            {(comp.categories || []).map(cat => {
              const c = CATEGORY_COLORS[cat] || CATEGORY_COLORS['Open']
              return (
                <span key={cat} className="text-xs font-bold px-2.5 py-1 rounded-full"
                  style={{ background: c.bg, color: c.text, border: `1px solid ${c.border}` }}>
                  {cat}
                </span>
              )
            })}
          </div>
          {comp.scoring_mode === 'standard' && (
            <p className="text-xs text-gray-500">100 pts per species · +10 pts per kg (max 8 kg per fish)</p>
          )}
          <p className="text-xs text-gray-500 mt-0.5">{teams.length} team{teams.length !== 1 ? 's' : ''} registered</p>
        </div>

        {/* About */}
        {comp.details && (
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <h2 className="font-black text-gray-900 mb-2 text-sm">About</h2>
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{comp.details}</p>
          </div>
        )}

        {/* Event info */}
        {comp.event_info && (
          <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4">
            <h2 className="font-black text-gray-900 mb-2 text-sm">📍 Event Info</h2>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{comp.event_info}</p>
          </div>
        )}

        {/* Rules */}
        {comp.rules && (
          <div className="bg-blue-50 rounded-2xl border border-blue-200 p-4">
            <h2 className="font-black mb-2 text-sm" style={{ color: SNZ_BLUE }}>Rules</h2>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{comp.rules}</p>
          </div>
        )}

        {/* Fish list */}
        {fish.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <h2 className="font-black text-gray-900 mb-3 text-sm">Fish List ({fish.length} species)</h2>
            <div className="grid grid-cols-3 gap-2">
              {fish.map(f => (
                <div key={f.id} className="rounded-xl overflow-hidden border border-gray-100">
                  {f.photo_url
                    ? <img src={f.photo_url} alt={f.species_name} className="w-full h-20 object-cover" />
                    : <div className="w-full h-20 bg-gray-100 flex items-center justify-center text-3xl">🐟</div>
                  }
                  <div className="p-1.5">
                    <p className="text-xs font-bold text-gray-900 leading-tight">{f.species_name}</p>
                    {f.allow_multiples && <p className="text-xs text-blue-600">×{f.max_count}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer links */}
        <SponsorBar comp={comp} />
        <div className="flex justify-center gap-6 pt-2 pb-8">
          <button onClick={() => navigate(`/competitions/${id}`)}
            className="text-xs text-gray-400 hover:text-gray-600 underline">Full competition page</button>
          <button onClick={() => navigate(`/competitions/${id}/admin`)}
            className="text-xs text-gray-400 hover:text-gray-600 underline">Admin login</button>
        </div>
      </div>
    </div>
  )
}
