import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const SNZ_BLUE = '#2B6CB0'

export default function NearMissThanks() {
  const navigate = useNavigate()
  const [copied, setCopied] = useState(false)

  const shareUrl = `${window.location.origin}/near-miss`

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 4000)
    } catch {}
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white border border-green-200 rounded-2xl p-8 text-center space-y-4">
        <div className="text-6xl">✅</div>
        <h1 className="text-2xl font-black text-gray-900">Thank you</h1>
        <p className="text-gray-600 text-sm">
          Your report has been recorded. Every submission helps build a clearer picture of how
          often this actually happens — most of which never makes it into any official record.
        </p>

        <div className="flex flex-col gap-3 pt-2">
          <button onClick={() => navigate('/near-miss')}
            className="w-full py-3 rounded-xl font-black text-white text-sm" style={{ background: SNZ_BLUE }}>
            Submit another incident
          </button>
          <p className="text-xs text-gray-400">Had more than one? Please come back and submit again — one entry per incident.</p>

          <button onClick={copyLink}
            className="w-full py-2.5 rounded-xl font-bold text-sm border-2 border-gray-200 text-gray-600 hover:border-gray-300 transition">
            {copied ? '✓ Link copied' : '🔗 Copy link to share'}
          </button>
          <button onClick={() => navigate('/near-miss/results')}
            className="w-full py-2.5 rounded-xl font-bold text-sm text-gray-500 hover:text-gray-700 transition">
            View aggregate results →
          </button>
        </div>
      </div>
    </div>
  )
}
