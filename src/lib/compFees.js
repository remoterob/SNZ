// Competition entry-fee resolution.
//
// The same early-bird logic was written out in CatfishCullRegister and
// CatfishConfirm, while CatfishCullPage hardcoded the prices in its copy — so
// the public page advertised $50 while checkout charged the $40 early-bird
// rate. Keep it in one place so displayed and charged prices can't drift.

export function isEarlyBirdNow(comp) {
  if (!comp?.early_bird_cutoff) return false
  return new Date() < new Date(comp.early_bird_cutoff)
}

/**
 * Per-competitor entry fee in cents for a category, honouring early bird.
 * Falls back to the competition's flat entry_fee_cents, then to `fallback`.
 */
export function perCompetitorCents(comp, category = 'Open', fallback = 5000) {
  const fees = comp?.category_fees?.[category] || {}
  if (isEarlyBirdNow(comp) && fees.early_bird != null) return fees.early_bird
  return fees.standard ?? comp?.entry_fee_cents ?? fallback
}

/** "$40" — cents to a whole-dollar string, since all SNZ fees are round. */
export const dollars = (cents) => `$${(Number(cents || 0) / 100).toFixed(0)}`

/** e.g. "31 December" — for "early bird until …" copy. */
export function earlyBirdEnds(comp) {
  if (!comp?.early_bird_cutoff) return null
  try {
    return new Date(comp.early_bird_cutoff).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long' })
  } catch { return null }
}
