// Bingo game helpers — adapted from V15 for SNZ

// Mirrors the region/experience options used on the membership signup form
// (MembershipPage.jsx) so a diver's answers stay consistent across the app.
export const REGIONS = [
  'Northland', 'Auckland', 'Waikato / Bay of Plenty', 'Coromandel',
  'Hawke\'s Bay / Gisborne', 'Taranaki / Manawatū', 'Wellington / Wairarapa',
  'Nelson / Marlborough', 'Canterbury', 'Otago / Southland', 'West Coast',
]

export const EXPERIENCE_LEVELS = ['Beginner', 'Intermediate', 'Experienced', 'Elite']

export const isBonusSlug = (slug) => typeof slug === 'string' && slug.startsWith('bonus-')

export const pointsMapFromSpecies = (species) =>
  new Map((species || []).map(s => [s.slug, s.points]))

export const pointsForSlug = (slug, pMap) => {
  if (!slug) return 0
  const norm = String(slug).trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
  const P = (pMap && typeof pMap.get === 'function') ? pMap : new Map()
  const looseFind = () => {
    const stripped = norm.replace(/-/g, '')
    for (const [key, val] of P.entries()) {
      if (String(key).toLowerCase().replace(/[^a-z0-9]/g, '') === stripped) return val
    }
  }
  return P.get(slug) ?? P.get(norm) ?? looseFind() ?? 0
}

export const scoreForClaims = (claims, pMap) =>
  (claims || []).reduce((sum, c) => {
    const base = pointsForSlug(c.species_slug, pMap)
    const mult = isBonusSlug(c.species_slug) ? 1 : (c.first_time ? 2 : 1)
    return sum + base * mult
  }, 0)

// Returns the image src — handles full URL from Supabase Storage or relative /public path
export const imgFor = (s) => {
  const p = s?.image_path
  if (!p) return null
  return p.startsWith('http') ? p : `/${p}`
}

// Build infoMap { [speciesName]: { tips, recipe } } from bingo_species rows
export const buildInfoMap = (species) => {
  const m = {}
  for (const s of species || []) {
    if (s.tips || s.recipe_url) m[s.name] = { tips: s.tips || '', recipe: s.recipe_url || '' }
  }
  return m
}

export const infoFor = (infoMap, name) => {
  const v = infoMap?.[name] || infoMap?.[(name || '').trim()] || null
  return v ? { tips: v.tips || '', recipe: v.recipe || '' } : null
}

// ── Community photo showcase ─────────────────────────────────────────────────
// Species tiles prefer a real member-submitted photo over the stock image.
// Roughly REGION_PHOTO_BIAS of tiles draw from the viewer's own region, the
// rest from the full pool, so the board feels local without going stale.

export const REGION_PHOTO_BIAS = 0.8

// Deterministic 0..1 from a string, so a given species keeps the same photo
// across re-renders instead of reshuffling on every reload.
const hashUnit = (str, seed = 0) => {
  let h = (2166136261 ^ Math.floor(seed * 0xffffffff)) >>> 0
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 100000) / 100000
}

// slug -> { all: [entry], byRegion: Map<region, [entry]> }
export function buildPhotoPools(claims, profiles) {
  const pools = new Map()
  for (const c of claims || []) {
    const url = c.thumb_url || c.photo_url
    if (!url || !c.species_slug) continue
    if (!pools.has(c.species_slug)) pools.set(c.species_slug, { all: [], byRegion: new Map() })
    const pool = pools.get(c.species_slug)
    const entry = {
      url,
      fullUrl: c.photo_url || url,
      name: c.display_name || 'Diver',
      region: profiles?.[c.user_id]?.region || null,
    }
    pool.all.push(entry)
    if (entry.region) {
      if (!pool.byRegion.has(entry.region)) pool.byRegion.set(entry.region, [])
      pool.byRegion.get(entry.region).push(entry)
    }
  }
  return pools
}

// Returns an entry, or null when nobody has uploaded this species yet (caller
// then falls back to the stock species image).
export function pickShowcasePhoto(pools, slug, myRegion, seed = 0) {
  const pool = pools?.get?.(slug)
  if (!pool?.all.length) return null
  const regional = myRegion ? (pool.byRegion.get(myRegion) || []) : []
  const useRegional = regional.length > 0 && hashUnit(`${slug}|bucket`, seed) < REGION_PHOTO_BIAS
  const list = useRegional ? regional : pool.all
  const idx = Math.floor(hashUnit(`${slug}|pick`, seed) * list.length) % list.length
  return { ...list[idx], fromMyRegion: useRegional }
}

export const nzFormat = (iso) => {
  try {
    return new Date(iso).toLocaleString('en-NZ', {
      timeZone: 'Pacific/Auckland',
      dateStyle: 'long',
      timeStyle: 'short',
    })
  } catch { return String(iso) }
}

export const windowState = (nowIso, startIso, endIso) => {
  const now   = new Date(nowIso)
  const start = new Date(startIso)
  const end   = new Date(endIso)
  if (now < start) return { ok: false, state: 'before' }
  if (now > end)   return { ok: false, state: 'after' }
  return { ok: true, state: 'open' }
}
