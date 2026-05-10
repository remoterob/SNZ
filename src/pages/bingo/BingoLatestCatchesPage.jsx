import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { pointsForSlug, isBonusSlug } from '../../lib/bingo/helpers'

export default function BingoLatestCatchesPage({ allClaims, pMap, compCfg }) {
  const [dishes, setDishes] = useState([])

  useEffect(() => {
    supabase.from('bingo_dishes')
      .select('id, user_id, title, species_slug, recipe_link, description, photo_url, thumb_url, created_at')
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => setDishes(data || []))
  }, [])

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
    <div className="card">
      <h3>Recent Catches</h3>
      {recent.length === 0 ? (
        <p className="small muted">No catches with photos in the last 7 days.</p>
      ) : (
        dateKeys.map(dk => {
          const users = byDate.get(dk)
          return (
            <div key={dk} style={{ marginTop: 16 }}>
              <h4 style={{ margin: '8px 0' }}>{nzLabel(dk)}</h4>
              {Array.from(users.entries()).sort((a, b) => a[1].name.localeCompare(b[1].name)).map(([uid, { name, items }]) => (
                <div key={uid} style={{ marginBottom: 12 }}>
                  <div className="row" style={{ alignItems: 'baseline', margin: '6px 0' }}>
                    <strong>{name}</strong>
                    <span className="small muted" style={{ marginLeft: 8 }}>{items.length} photo{items.length > 1 ? 's' : ''}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12 }}>
                    {items.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map(c => (
                      <div key={c.id} style={{ textAlign: 'center' }}>
                        <a href={c.photo_url} target="_blank" rel="noopener noreferrer" style={{ position: 'relative', display: 'block' }}>
                          <img src={c.thumb_url || c.photo_url} alt={c.species_slug}
                            style={{ width: '100%', height: 'auto', borderRadius: 8 }} loading="lazy" />
                          <div className="badge" style={{ position: 'absolute', top: 6, right: 6, background: '#009688', color: '#fff', padding: '2px 6px', borderRadius: 6, fontSize: 12 }}>
                            {claimPoints(c)} pts
                          </div>
                        </a>
                        <div style={{ marginTop: 4, fontSize: 13 }}>{c.species_slug}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        })
      )}

      <div style={{ marginTop: 32 }}>
        <h3>Dishes</h3>
        {dishes.length === 0 ? (
          <p className="small muted">No dishes yet.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
            {dishes.map(d => (
              <div key={d.id} className="card" style={{ padding: 8 }}>
                {d.photo_url && (
                  <a href={d.photo_url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', position: 'relative' }}>
                    <img src={d.thumb_url || d.photo_url} alt={d.title}
                      style={{ width: '100%', borderRadius: 8 }} loading="lazy" />
                    {d.species_slug && (
                      <div className="badge" style={{ position: 'absolute', top: 6, right: 6 }}>{d.species_slug}</div>
                    )}
                  </a>
                )}
                <div style={{ marginTop: 6 }}><strong>{d.title}</strong></div>
                {d.recipe_link && (
                  <div className="small"><a href={d.recipe_link} target="_blank" rel="noreferrer" style={{ color: '#009688' }}>View Recipe</a></div>
                )}
                {d.description && (
                  <div className="small muted" style={{ marginTop: 4, whiteSpace: 'pre-wrap' }}>
                    {d.description.length > 140 ? d.description.slice(0, 140) + '…' : d.description}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
