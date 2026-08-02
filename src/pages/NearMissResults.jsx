import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { OUTCOME, NOT_REPORTED_REASONS } from './NearMissReport'

const SNZ_BLUE = '#2B6CB0'
const SNZ_DARK = '#1e3a5f'

const outcomeLabel = (v) => OUTCOME.find(o => o.value === v)?.label || v
const reasonLabel = (v) => NOT_REPORTED_REASONS.find(o => o.value === v)?.label || v

function StatCell({ label, cell, big }) {
  if (!cell) return null
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
      <span className={`text-gray-700 ${big ? 'font-bold' : 'text-sm'}`}>{label}</span>
      {cell.insufficient
        ? <span className="text-xs text-gray-400 italic">Insufficient data</span>
        : <span className={`font-black ${big ? 'text-2xl' : 'text-sm'}`} style={{ color: SNZ_BLUE }}>{cell.pct}%</span>}
    </div>
  )
}

export default function NearMissResults() {
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/.netlify/functions/near-miss-aggregates')
      .then(res => res.json())
      .then(setData)
      .catch(() => setError('Could not load results — please try again shortly.'))
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <div style={{ background: SNZ_DARK }} className="px-6 py-3 flex items-center justify-between border-b border-blue-900">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/near-miss')}
            className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
            ← Report an incident
          </button>
          <span className="text-white/50 mx-2">/</span>
          <span className="text-white font-bold text-sm">Survey Results</span>
        </div>
        <button onClick={() => navigate('/admin/near-miss')}
          className="flex items-center gap-1.5 text-white font-bold text-sm bg-white/15 hover:bg-white/25 px-3 py-1.5 rounded-lg transition">
          ⚙ Admin
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-5">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Vessel Near-Miss Survey — Results</h1>
          <p className="text-gray-500 text-sm mt-1">
            Aggregated, anonymised figures from every report received. Any figure based on fewer
            than 5 reports is withheld to protect individual respondents.
          </p>
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{error}</div>}
        {!data && !error && <p className="text-gray-400 text-sm">Loading…</p>}

        {data && (
          <>
            <div className="bg-white border border-gray-200 rounded-2xl p-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Total reports received</p>
                {data.period && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(data.period.start).toLocaleDateString('en-NZ', { month: 'short', year: 'numeric' })}
                    {' – '}
                    {new Date(data.period.end).toLocaleDateString('en-NZ', { month: 'short', year: 'numeric' })}
                  </p>
                )}
              </div>
              <span className="text-3xl font-black text-gray-900">{data.total}</span>
            </div>

            {/* Headline figures */}
            <div className="bg-white border-2 rounded-2xl p-5" style={{ borderColor: SNZ_BLUE }}>
              <h2 className="font-black text-gray-900 text-sm uppercase tracking-widest mb-3" style={{ color: SNZ_BLUE }}>
                The headline number
              </h2>
              <StatCell label="Never reported to any authority" cell={data.underReporting} big />
            </div>

            <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-5">
              <h2 className="font-black text-red-800 text-sm uppercase tracking-widest mb-1">
                Maritime Rule 91.6 breach figure
              </h2>
              <p className="text-xs text-red-700 mb-3">Vessel on the plane or manoeuvring at speed, within 200 m of shore.</p>
              <StatCell label="Of all reports" cell={data.rule91_6BreachRate} big />
            </div>

            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <h2 className="font-black text-gray-900 text-sm uppercase tracking-widest mb-3" style={{ color: SNZ_BLUE }}>
                Visibility gear
              </h2>
              <StatCell label="Had a dive flag or float deployed" cell={data.visibilityFlagRate} />
            </div>

            {/* Why not reported */}
            {data.notReportedReasons && Object.keys(data.notReportedReasons).length > 0 && (
              <div className="bg-white border border-gray-200 rounded-2xl p-5">
                <h2 className="font-black text-gray-900 text-sm uppercase tracking-widest mb-3" style={{ color: SNZ_BLUE }}>
                  Why incidents go unreported
                </h2>
                {Object.entries(data.notReportedReasons)
                  .sort(([, a], [, b]) => (b.count || 0) - (a.count || 0))
                  .map(([reason, cell]) => <StatCell key={reason} label={reasonLabel(reason)} cell={cell} />)}
              </div>
            )}

            {/* Severity */}
            {data.outcomeDistribution && (
              <div className="bg-white border border-gray-200 rounded-2xl p-5">
                <h2 className="font-black text-gray-900 text-sm uppercase tracking-widest mb-3" style={{ color: SNZ_BLUE }}>
                  Severity
                </h2>
                {Object.entries(data.outcomeDistribution)
                  .sort(([, a], [, b]) => (b.count || 0) - (a.count || 0))
                  .map(([outcome, cell]) => <StatCell key={outcome} label={outcomeLabel(outcome)} cell={cell} />)}
              </div>
            )}

            {/* By region */}
            {data.byRegion && (
              <div className="bg-white border border-gray-200 rounded-2xl p-5">
                <h2 className="font-black text-gray-900 text-sm uppercase tracking-widest mb-3" style={{ color: SNZ_BLUE }}>
                  Reports by region
                </h2>
                {Object.entries(data.byRegion)
                  .sort(([, a], [, b]) => (b.count || 0) - (a.count || 0))
                  .map(([region, cell]) => <StatCell key={region} label={region} cell={cell} />)}
              </div>
            )}

            {/* Location clustering */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5">
              <h2 className="font-black text-gray-900 text-sm uppercase tracking-widest mb-1" style={{ color: SNZ_BLUE }}>
                Recurring locations
              </h2>
              <p className="text-xs text-gray-400 mb-3">Only shown where a named location has 5 or more reports.</p>
              {data.topLocations.length === 0
                ? <p className="text-sm text-gray-400 italic">No location has enough reports yet to show.</p>
                : data.topLocations.map(({ location, count }) => (
                    <div key={location} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <span className="text-sm text-gray-700 capitalize">{location}</span>
                      <span className="font-black text-sm" style={{ color: SNZ_BLUE }}>{count}</span>
                    </div>
                  ))}
            </div>

            <button onClick={() => navigate('/near-miss')}
              className="w-full py-3 rounded-xl font-black text-white text-sm" style={{ background: SNZ_BLUE }}>
              Report an incident →
            </button>
          </>
        )}
      </div>
    </div>
  )
}
