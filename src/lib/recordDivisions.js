// NZ record categories. Open / Women's / Junior U18 can be combined — one fish
// can hold the record in all three (e.g. a junior woman's 16 kg snapper).
// Meritorious and Natural History are different kinds of entry and stand alone.
// Mirrors cleanDivisions() in netlify/functions/record-applications-admin.js.

export const COMBINABLE = ['Open', "Women's", 'Junior U18']
export const SOLO = ['Meritorious', 'Natural History']
export const DIVISIONS = [...COMBINABLE, ...SOLO]

// Every category a record stands in (falls back to the old single column).
export const divsOf = (r) =>
  Array.isArray(r?.divisions) && r.divisions.length ? r.divisions : (r?.division ? [r.division] : [])

export const inDivision = (r, d) => divsOf(r).includes(d)

// Toggle a category in a selection, keeping the combine rules and canonical order.
export function toggleDivision(current, d) {
  const has = current.includes(d)
  if (SOLO.includes(d)) return has ? [] : [d]
  const next = has ? current.filter(x => x !== d) : [...current.filter(x => !SOLO.includes(x)), d]
  return COMBINABLE.filter(x => next.includes(x))
}

// Record application "Application For" choices → record categories.
export function appTypeToDivisions(appType) {
  const types = String(appType || '').split(',').map(s => s.trim())
  const out = []
  if (types.includes('Open')) out.push('Open')
  if (types.includes("Women's")) out.push("Women's")
  if (types.includes('Junior')) out.push('Junior U18')
  if (out.length) return out
  if (types.includes('Meritorious Fish')) return ['Meritorious']
  return ['Open']
}

export function divBadgeClass(d) {
  if (d === 'Open') return 'bg-blue-50 text-blue-700 border border-blue-200'
  if (d === "Women's") return 'bg-pink-50 text-pink-700 border border-pink-200'
  if (d === 'Meritorious') return 'bg-amber-50 text-amber-700 border border-amber-200'
  return 'bg-purple-50 text-purple-700 border border-purple-200'
}

// "07/11/2026" (application form) → "07.11.26" (records table style).
export function toRecordDate(s) {
  const m = String(s || '').trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/)
  if (!m) return s || ''
  return `${m[1].padStart(2, '0')}.${m[2].padStart(2, '0')}.${m[3].slice(-2)}`
}
