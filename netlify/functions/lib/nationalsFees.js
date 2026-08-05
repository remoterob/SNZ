// Server-side source of truth for what a Nationals diver owes.
//
// Mirrors the fee logic in src/pages/NationalsRegister.jsx (buildLineItemsD1/
// calcTotal) and src/pages/NationalsConfirm.jsx (buildLineItems/calcTotal) —
// but computed from DB-stored team data and the server's own clock, never
// from anything the client sends. create-checkout-session.js must never
// trust a client-supplied amountCents/lineItems for nationals_entry or
// nationals_extra; it should build them from this module instead.

// Team-level events: both divers who entered pay their own share independently.
const TEAM_EVENTS = [
  { key: 'open', label: '🏆 2-Day Open Championship' },
  { key: 'juniors', label: '🌟 Junior Championship' },
  { key: 'goldenoldie', label: '🎖️ Golden Oldie' },
]
// Per-diver events: stored as `${key}_d1` / `${key}_d2` on nationals_event
// for pairs teams. NationalsRegisterIndividual.jsx (solo entry — no partner)
// stores these same event ids as BARE keys instead (no _d1/_d2 suffix,
// flagged by nationals_event.is_individual === true) — same price list,
// different storage shape, so both must be handled here.
const PER_DIVER_EVENTS = [
  { key: 'photography', label: '📸 Snorkel Photography' },
  { key: 'finswim', label: '🐟 Fin Swimming' },
  { key: 'under23', label: '🎯 Under 23 Division' },
]

function resolveFeeCents(eventKey, categoryFees, isEarlyBird) {
  if (!categoryFees) return null // TBC — caller must not charge anything
  const ev = categoryFees[eventKey]
  if (!ev) return 0
  if (isEarlyBird && ev.early_bird != null) return ev.early_bird
  return ev.standard ?? 0
}

function getMerchFeeDollars(categoryFees, type) {
  return categoryFees?.merch?.[type]?.price ?? null
}
function getMealFeeDollars(categoryFees) {
  return categoryFees?.meal?.price ?? null
}

// isEarlyBird MUST be computed from the server's own clock
// (new Date() in the Netlify function), never trusted from the client.
function isEarlyBirdNow(competition) {
  return competition?.early_bird_cutoff ? new Date() < new Date(competition.early_bird_cutoff) : false
}

// Builds the itemised, server-computed line items (in dollars, per
// category_fees convention) for one diver's Nationals entry fee, from
// DB-stored selections only. Returns null if fees are still TBC (nothing
// should be charged in that case — the free/TBC path never reaches Stripe).
function buildNationalsEntryLineItems({ diverSlot, nationalsEvent, merch, categoryFees, isEarlyBird }) {
  if (categoryFees === null || categoryFees === undefined) return null
  const ev = nationalsEvent || {}
  const items = []

  // TEAM_EVENTS (open/juniors/goldenoldie) are always stored as bare keys —
  // true for both a pairs team's nationals_event and an individual entry's.
  for (const { key, label } of TEAM_EVENTS) {
    if (!ev[key]) continue
    const fee = resolveFeeCents(key, categoryFees, isEarlyBird)
    if (fee) items.push({ name: label, amountCents: fee * 100 })
  }
  // PER_DIVER_EVENTS are suffixed `${key}_d1`/`${key}_d2` for a pairs team,
  // but bare for an individual entry (ev.is_individual === true) — see
  // NationalsRegisterIndividual.jsx, which has no diver 2 to disambiguate.
  for (const { key, label } of PER_DIVER_EVENTS) {
    const flag = ev.is_individual ? ev[key] : ev[`${key}_d${diverSlot}`]
    if (!flag) continue
    const fee = resolveFeeCents(key, categoryFees, isEarlyBird)
    if (fee) items.push({ name: label, amountCents: fee * 100 })
  }

  const m = merch || {}
  const jFee = getMerchFeeDollars(categoryFees, 'jacket')
  if (jFee && m.jacket?.gender && m.jacket?.size) {
    items.push({ name: `🧥 Event Jacket (${m.jacket.gender} ${m.jacket.size})`, amountCents: jFee * 100 })
  }
  const sFee = getMerchFeeDollars(categoryFees, 'shirt')
  if (sFee && m.shirt?.gender && m.shirt?.size) {
    items.push({ name: `👕 Event T-Shirt (${m.shirt.gender} ${m.shirt.size})`, amountCents: sFee * 100 })
  }
  const mFee = getMealFeeDollars(categoryFees)
  if (mFee && m.meal_qty > 0) {
    items.push({ name: `🍽️ Prize Giving Dinner × ${m.meal_qty}`, amountCents: mFee * m.meal_qty * 100 })
  }

  return items
}

// Builds server-computed line items for a nationals_extra purchase (buying
// additional merch/meal after already being registered) from the requested
// items only — prices always come from categoryFees, never from the client.
function buildNationalsExtraLineItems({ categoryFees, extraMealQty, extraJacket, extraShirt, extraShirtQty }) {
  if (categoryFees === null || categoryFees === undefined) return null
  const items = []
  const jFee = getMerchFeeDollars(categoryFees, 'jacket')
  if (jFee && extraJacket?.gender && extraJacket?.size) {
    items.push({ name: `🧥 Event Jacket (${extraJacket.gender} ${extraJacket.size})`, amountCents: jFee * 100 })
  }
  const sFee = getMerchFeeDollars(categoryFees, 'shirt')
  // extraShirtQty only appears for competitions with merch.shirt.allowMultiple
  // (Catfish Cull) — Nationals' calls never send it, so shirtQty defaults to
  // 1 and the label matches its existing unchanged wording exactly.
  const shirtQty = parseInt(extraShirtQty, 10) || (extraShirt?.gender && extraShirt?.size ? 1 : 0)
  if (sFee && extraShirt?.gender && extraShirt?.size && shirtQty > 0) {
    const suffix = shirtQty > 1 ? ` × ${shirtQty}` : ''
    items.push({ name: `👕 Event T-Shirt (${extraShirt.gender} ${extraShirt.size})${suffix}`, amountCents: sFee * 100 * shirtQty })
  }
  const mFee = getMealFeeDollars(categoryFees)
  const qty = parseInt(extraMealQty, 10) || 0
  if (mFee && qty > 0) {
    items.push({ name: `🍽️ Prize Giving Dinner × ${qty}`, amountCents: mFee * qty * 100 })
  }
  return items
}

module.exports = {
  isEarlyBirdNow,
  buildNationalsEntryLineItems,
  buildNationalsExtraLineItems,
}
