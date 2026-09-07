/**
 * Mudgeway Trophy scoring.
 *
 * Rules are Part A s23–s25 of the Nationals Rules (30 Jan 2026), applied to the
 * Mudgeway by Part I rule 1.7.
 *
 *   24.1   100 points per eligible fish, plus 10 points per kg of catch weight.
 *   24.1c  A fish over 8 kg is weighed separately; 8 kg of it is added to the
 *          bulk weight (the excess above 8 kg does not score).
 *   24.3   Bulk weight is read to the nearest 100 g BELOW.
 *   23.6   −100 points per non-compliant fish: under 80% of the minimum weight,
 *          an ineligible species, a breach of fisheries regulations, or over the
 *          allowable count for a species.
 *   25.1   The CD may apply a further penalty, or disqualify a team.
 *
 * Deliberately NOT the Nationals daily percentage system (24.4) — the Mudgeway
 * is a single-day head-to-head, so teams are compared on raw points.
 *
 * Pure functions only: no Supabase, no React. Tested in
 * tests/mudgewayScoring.test.mjs.
 */

export const POINTS_PER_FISH = 100
export const POINTS_PER_KG = 10
export const PENALTY_PER_FISH = -100
export const OVER_WEIGHT_CAP_G = 8000
export const DEFAULT_MIN_WEIGHT_G = 500

/** RULE 24.3 — round a gram weight down to the nearest 100 g. */
export function roundBulkDown(grams) {
  const g = Number(grams) || 0
  if (g <= 0) return 0
  return Math.floor(g / 100) * 100
}

/**
 * RULE 23.6 — decide whether a fish is non-compliant.
 * Returns a reason code, or null if the fish is good.
 *
 * `fish`     { species_name, weight_g, penalty_flag?, penalty_reason? }
 * `opts`     { minWeightG, fishList: [{ species_name, max_count, min_weight_g_override }] }
 * `seenCount` how many of this species have already been counted for this team.
 */
export function complianceReason(fish, opts = {}, seenCount = 0) {
  // A penalty applied by hand at the weigh station always stands.
  if (fish.penalty_flag) return fish.penalty_reason || 'other'

  const list = opts.fishList || null
  const entry = list
    ? list.find(f => (f.species_name || '').toLowerCase() === (fish.species_name || '').toLowerCase())
    : null

  if (list && !entry) return 'ineligible_species'

  const min = entry?.min_weight_g_override ?? opts.minWeightG ?? DEFAULT_MIN_WEIGHT_G
  // Under 80% of the minimum weight is a penalty, not merely a non-scoring fish.
  if (Number(fish.weight_g) < min * 0.8) return 'under_80_percent_min'

  if (entry?.max_count != null && seenCount >= entry.max_count) return 'over_species_count'

  return null
}

/**
 * Score one team.
 *
 * fish: [{ species_name, weight_g, is_over_8kg?, penalty_flag?, penalty_reason? }]
 * opts: { minWeightG, fishList, cdAdjustment, disqualified }
 *
 * Returns { fishCount, bulkWeightG, speciesPoints, weightPoints, penaltyPoints,
 *           cdAdjustment, totalPoints, disqualified, penalties[], countedFish[] }
 */
export function scoreTeam(fish = [], opts = {}) {
  const seen = {}
  const penalties = []
  const countedFish = []
  let rawWeight = 0

  for (const f of fish) {
    const key = (f.species_name || '').toLowerCase()
    const reason = complianceReason(f, opts, seen[key] || 0)

    if (reason) {
      penalties.push({ species_name: f.species_name, weight_g: f.weight_g, reason })
      continue
    }

    seen[key] = (seen[key] || 0) + 1
    countedFish.push(f)

    // RULE 24.1c — a fish over 8 kg contributes exactly 8 kg to the weight.
    const w = Number(f.weight_g) || 0
    rawWeight += (f.is_over_8kg || w > OVER_WEIGHT_CAP_G) ? Math.min(w, OVER_WEIGHT_CAP_G) : w
  }

  const fishCount = countedFish.length
  // RULE 24.3 — round the total down to the nearest 100 g before converting.
  const bulkWeightG = roundBulkDown(rawWeight)

  const speciesPoints = fishCount * POINTS_PER_FISH
  const weightPoints = Math.round((bulkWeightG / 1000) * POINTS_PER_KG)
  const penaltyPoints = penalties.length * PENALTY_PER_FISH
  const cdAdjustment = Number(opts.cdAdjustment) || 0
  const disqualified = !!opts.disqualified

  return {
    fishCount,
    bulkWeightG,
    speciesPoints,
    weightPoints,
    penaltyPoints,
    cdAdjustment,
    disqualified,
    totalPoints: disqualified ? 0 : speciesPoints + weightPoints + penaltyPoints + cdAdjustment,
    penalties,
    countedFish,
  }
}

/**
 * Decide the outcome of a challenge.
 *
 * defender:   { teamId, clubId, score }        (score from scoreTeam)
 * challengers:[{ teamId, clubId, score }]      (one or more — RULE 2.3)
 *
 * RULE 1.10  If the top-scoring team weighed in fewer than 4 eligible fish the
 *            whole challenge is a No Contest and the holder keeps the trophy.
 *            (The rule says "the successful team", which is circular — this is
 *            the SNZ reading, and a motion candidate.)
 * RULE 2.3   The defender must beat EVERY challenger to retain.
 * Tie:       the defender retains, recorded as a successful defence. The rules
 *            are silent; this is an SNZ ruling, not a rule.
 */
export const NO_CONTEST_MIN_FISH = 4

export function determineOutcome(defender, challengers = []) {
  if (!defender) throw new Error('determineOutcome requires a defender')

  const live = challengers.filter(c => !c.score.disqualified)
  const defenderScore = defender.score.disqualified ? -Infinity : defender.score.totalPoints

  const best = live.reduce(
    (acc, c) => (c.score.totalPoints > (acc?.score.totalPoints ?? -Infinity) ? c : acc),
    null
  )
  const bestScore = best ? best.score.totalPoints : -Infinity

  // Who is the top team overall? Ties go to the defender.
  const topTeam = defenderScore >= bestScore ? defender : best
  const defenderWins = defenderScore >= bestScore

  // RULE 1.10 — applied to the top-scoring team.
  if (!topTeam || topTeam.score.fishCount < NO_CONTEST_MIN_FISH) {
    return {
      isNoContest: true,
      trophyMovesTo: null,
      reason: `No contest — the leading team weighed in fewer than ${NO_CONTEST_MIN_FISH} eligible fish (rule 1.10). The holder keeps the trophy.`,
      results: [
        { teamId: defender.teamId, outcome: 'no_contest' },
        ...challengers.map(c => ({ teamId: c.teamId, outcome: 'no_contest' })),
      ],
    }
  }

  if (defenderWins) {
    const tied = best && defenderScore === bestScore
    return {
      isNoContest: false,
      trophyMovesTo: null,
      // RULE 3.4 — one star per challenging club on a successful defence.
      starsFor: challengers.map(c => c.clubId),
      reason: tied
        ? 'Tied on points — the holder retains the trophy and it counts as a successful defence (SNZ ruling; the rules are silent on ties).'
        : 'The holder outscored every challenger and retains the trophy.',
      results: [
        { teamId: defender.teamId, outcome: 'retained' },
        ...challengers.map(c => ({ teamId: c.teamId, outcome: 'lost' })),
      ],
    }
  }

  return {
    isNoContest: false,
    trophyMovesTo: best.clubId,
    starsFor: [],
    reason: 'The challenger outscored the holder and takes the trophy.',
    results: [
      { teamId: defender.teamId, outcome: 'lost' },
      ...challengers.map(c => ({
        teamId: c.teamId,
        outcome: c.teamId === best.teamId ? 'won' : 'lost',
      })),
    ],
  }
}
