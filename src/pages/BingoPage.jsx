import { useNavigate } from 'react-router-dom'
import { useMemberSession } from '../components/MemberAuthGate'

const SNZ_BLUE = '#2B6CB0'

export default function BingoPage() {
  const navigate = useNavigate()
  const { member } = useMemberSession()

  return (
    <div className="min-h-screen bg-white">
      <div style={{ background: SNZ_BLUE }} className="px-6 py-3 flex items-center justify-between border-b border-blue-700">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
            ← SNZ Hub
          </button>
          <span className="text-blue-200 text-sm opacity-75">/ Fish Bingo</span>
        </div>
        <button onClick={() => navigate('/bingo/admin')}
          className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
          ⚙ Admin
        </button>
      </div>

      <div className="max-w-lg mx-auto px-6 py-16 text-center">
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 bg-blue-50 border border-blue-100">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={SNZ_BLUE} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" rx="1"/>
            <rect x="14" y="3" width="7" height="7" rx="1"/>
            <rect x="3" y="14" width="7" height="7" rx="1"/>
            <rect x="14" y="14" width="7" height="7" rx="1"/>
            <line x1="6.5" y1="6.5" x2="6.5" y2="6.51"/>
            <line x1="17.5" y1="6.5" x2="17.5" y2="6.51"/>
            <path d="m15.5 15.5 3 3m0-3-3 3"/>
          </svg>
        </div>

        <h1 className="text-3xl font-black text-gray-900 mb-3">Fish Bingo</h1>
        <p className="text-gray-500 leading-relaxed mb-2">
          Spear species from the board, earn points, and compete on the leaderboard across the summer season.
        </p>
        <p className="text-gray-400 text-sm leading-relaxed mb-8">
          Complete bonus rows — Weedline Wonders, Bluewater Beasties, Monsters of the Deep — for big extra points. SNZ members only.
        </p>

        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-sm font-bold mb-8">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          Opening for the 2025–26 season
        </div>

        {!member && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 text-left">
            <p className="font-black text-gray-900 text-sm mb-1">SNZ Membership Required</p>
            <p className="text-xs text-gray-500 mb-3">Fish Bingo is open to active SNZ members. Join now to be ready when the season opens.</p>
            <button
              onClick={() => navigate('/membership')}
              className="px-4 py-2 rounded-lg font-bold text-sm text-white transition hover:opacity-90"
              style={{ background: SNZ_BLUE }}
            >
              Join SNZ
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
