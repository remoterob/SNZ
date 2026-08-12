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
