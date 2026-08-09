import { useNavigate } from 'react-router-dom'
import { clearAdminSession } from '../lib/supabase'

const SNZ_BLUE = '#2B6CB0'

export default function BingoAdmin() {
  const navigate = useNavigate()

  const sections = [
    {
      title: 'Species',
      desc: 'Add, edit and toggle species on the bingo board. Manage names, slugs, point values, images, targeting tips and recipe links.',
      icon: '🐟',
      path: '/bingo/admin/species',
    },
    {
      title: 'Bonuses',
      desc: 'Configure monthly and evergreen bonus challenges. Set which species count toward each bonus row and how many points it awards.',
      icon: '⭐',
      path: '/bingo/admin/bonuses',
    },
  ]

  return (
    <div className="min-h-screen bg-white">
      <div style={{ background: SNZ_BLUE }} className="px-6 py-3 flex items-center justify-between border-b border-blue-700">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
            ← SNZ Hub
          </button>
          <span className="text-blue-200 text-sm opacity-75">/ Fish Bingo Admin</span>
        </div>
        <button onClick={() => { clearAdminSession(); navigate('/') }}
          className="text-xs text-blue-200 hover:text-white transition">Sign out</button>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10">
        <h1 className="text-3xl font-black text-gray-900 mb-1">Fish Bingo Admin</h1>
        <p className="text-sm text-gray-400 mb-8">Manage the Fish Bingo competition content</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {sections.map(s => (
            <button
              key={s.path}
              onClick={() => navigate(s.path)}
              className="text-left p-6 rounded-2xl border-2 border-gray-200 bg-white hover:shadow-md transition-all group"
              onMouseEnter={e => e.currentTarget.style.borderColor = SNZ_BLUE}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#e5e7eb'}
            >
              <div className="text-3xl mb-3">{s.icon}</div>
              <div className="text-lg font-black text-gray-900 mb-2">{s.title}</div>
              <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
              <div className="flex items-center gap-1 mt-4 font-bold text-sm" style={{ color: SNZ_BLUE }}>
                Open <span className="group-hover:translate-x-1 transition-transform inline-block">→</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
