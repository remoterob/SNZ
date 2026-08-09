import { pointsForSlug, isBonusSlug } from '../../lib/bingo/helpers'

const SNZ_BLUE = '#2B6CB0'

export default function BingoLatestCatchesPage({ allClaims, pMap, compCfg }) {
  const claimPoints = (c) => {
    const base = pointsForSlug(c.species_slug, pMap)
    return isBonusSlug(c.species_slug) ? base : base * (c.first_time ? 2 : 1)
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000)
  const recent = (allClaims || [])
    .filter(c => !!c.photo_url && c.created_at && new Date(c.created_at) >= sevenDaysAgo)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

  const nzYmd = (iso) => {
    const d = new Date(iso)
    const p = new Intl.DateTimeFormat('en-NZ', { timeZone: 'Pacific/Auckland', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d)
    return `${p.find(x => x.type === 'year').value}-${p.find(x => x.type === 'month').value}-${p.find(x => x.type === 'day').value}`
  }

  const nzLabel = (ymd) => {
    const [y, m, d] = ymd.split('-').map(Number)
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-NZ', { timeZone: 'Pacific/Auckland', weekday: 'long', day: 'numeric', month: 'long' })
  }

  const byDate = new Map()
  for (const c of recent) {
    const dk  = nzYmd(c.created_at)
    const uid = c.user_id || 'unknown'
    if (!byDate.has(dk))  byDate.set(dk, new Map())
    const users = byDate.get(dk)
    if (!users.has(uid)) users.set(uid, { name: c.display_name || 'Diver', items: [] })
    users.get(uid).items.push(c)
  }
  const dateKeys = Array.from(byDate.keys()).sort((a, b) => a < b ? 1 : -1)

  return (
    <div className="space-y-4">
      <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5">
        <h3 className="font-black text-gray-900 mb-1">Recent Catches</h3>
        <p className="text-xs text-gray-400 mb-3">Photos claimed in the last 7 days</p>
        {recent.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No catches with photos in the last 7 days.</p>
        ) : (
          dateKeys.map(dk => {
            const users = byDate.get(dk)
            return (
              <div key={dk} className="mt-4 first:mt-0">
                <h4 className="text-sm font-bold text-gray-900 mb-2">{nzLabel(dk)}</h4>
                {Array.from(users.entries()).sort((a, b) => a[1].name.localeCompare(b[1].name)).map(([uid, { name, items }]) => (
                  <div key={uid} className="mb-3">
                    <div className="flex items-baseline gap-2 mb-1.5">
                      <span className="font-bold text-gray-900 text-sm">{name}</span>
                      <span className="text-xs text-gray-400">{items.length} photo{items.length > 1 ? 's' : ''}</span>
                    </div>
                    <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
                      {items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map(c => (
                        <div key={c.id} className="text-center">
                          <a href={c.photo_url} target="_blank" rel="noopener noreferrer" className="relative block">
                            <img src={c.thumb_url || c.photo_url} alt={c.species_slug}
                              className="w-full h-auto rounded-lg" loading="lazy" />
                            <span className="absolute top-1.5 right-1.5 text-white text-xs font-bold px-1.5 py-0.5 rounded-md"
                              style={{ background: SNZ_BLUE }}>
                              {claimPoints(c)} pts
                            </span>
                          </a>
                          <p className="text-xs text-gray-500 mt-1 truncate">{c.species_slug}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
