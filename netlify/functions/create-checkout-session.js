// Netlify Function: create a Stripe Checkout session
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const { createClient } = require('@supabase/supabase-js')
const { getAuthenticatedUserId } = require('./lib/auth')
const { isEarlyBirdNow, buildNationalsEntryLineItems, buildNationalsExtraLineItems } = require('./lib/nationalsFees')

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

function sumCents(items) {
  return items.reduce((total, item) => total + item.amountCents, 0)
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  const origin = event.headers.origin || 'https://spearfishingnz.netlify.app'

  try {
    const body = JSON.parse(event.body)
    const { type, memberId, teamId, competitionId, competitionName, memberEmail, memberName, diverSlot, extraMealQty, extraJacket, extraShirt, extraShirtQty, successPath } = body
    let { amountCents, lineItems } = body

    if (!type) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid payment parameters' }) }
    }

    // Every payment type below charges a specific member or team — verify the
    // caller actually IS that member (or one of that team's two divers)
    // before creating any Stripe session. Previously nothing checked this at
    // all: any memberId/teamId in the request body was trusted at face value.
    const callerUserId = await getAuthenticatedUserId(event)
    if (!callerUserId) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Sign in required' }) }
    }

    const isMembership = type === 'membership'
    const isNationals = type === 'nationals_entry'
    const isExtras = type === 'nationals_extra'
    const isCompetitionEntry = type === 'competition_entry'
    const slot = diverSlot === '2' || diverSlot === 2 ? '2' : '1'

    // Membership price is NEVER taken from the client — look it up from the
    // member's own record so a tampered request can't underpay.
    if (isMembership) {
      if (!memberId) {
        return { statusCode: 400, body: JSON.stringify({ error: 'memberId is required for membership payments' }) }
      }
      if (callerUserId !== memberId) {
        return { statusCode: 403, body: JSON.stringify({ error: 'You can only pay your own membership' }) }
      }
      const { data: member, error: memberErr } = await supabase
        .from('members')
        .select('membership_fee_cents, payment_status')
        .eq('id', memberId)
        .maybeSingle()
      if (memberErr) {
        console.error('Member lookup failed:', memberErr.message)
        return { statusCode: 500, body: JSON.stringify({ error: 'Could not verify membership fee' }) }
      }
      if (!member) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Member not found' }) }
      }
      if (member.payment_status === 'paid') {
        return { statusCode: 400, body: JSON.stringify({ error: 'Membership is already paid' }) }
      }
      if (!member.membership_fee_cents || member.membership_fee_cents <= 0) {
        return { statusCode: 400, body: JSON.stringify({ error: 'No membership fee is due' }) }
      }
      amountCents = member.membership_fee_cents
    }

    // Nationals entries and Nationals extras (buying merch/meal after already
    // registering) previously trusted the client's own amountCents/lineItems
    // completely — a tampered request (or just a rolled-back system clock
    // fooling the early-bird check) could get a real entry marked paid for a
    // fraction of the real fee. Recompute both from DB-stored team data +
    // the server's own clock instead; the client's lineItems are ignored.
    if (isNationals || isExtras) {
      if (!teamId) {
        return { statusCode: 400, body: JSON.stringify({ error: 'teamId is required' }) }
      }
      const { data: team, error: teamErr } = await supabase
        .from('comp_teams')
        .select('diver1_member_id, diver2_member_id, nationals_event, merch_d1, merch_d2, competition_id')
        .eq('id', teamId)
        .maybeSingle()
      if (teamErr || !team) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Team not found' }) }
      }
      const expectedMemberId = slot === '2' ? team.diver2_member_id : team.diver1_member_id
      if (callerUserId !== expectedMemberId) {
        return { statusCode: 403, body: JSON.stringify({ error: 'You can only pay your own entry' }) }
      }

      const { data: competition, error: compErr } = await supabase
        .from('competitions')
        .select('category_fees, early_bird_cutoff')
        .eq('id', team.competition_id)
        .maybeSingle()
      if (compErr || !competition) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Competition not found' }) }
      }

      const computed = isExtras
        ? buildNationalsExtraLineItems({ categoryFees: competition.category_fees, extraMealQty, extraJacket, extraShirt, extraShirtQty })
        : buildNationalsEntryLineItems({
            diverSlot: slot,
            nationalsEvent: team.nationals_event,
            merch: slot === '2' ? team.merch_d2 : team.merch_d1,
            categoryFees: competition.category_fees,
            isEarlyBird: isEarlyBirdNow(competition),
          })

      if (computed === null) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Fees are not yet published for this competition' }) }
      }
      if (computed.length === 0 || sumCents(computed) <= 0) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Nothing to charge for the selected events/items' }) }
      }
      lineItems = computed
      amountCents = sumCents(computed)
    }

    // competition_entry (CompRegister.jsx / CatfishCullRegister.jsx) still
    // trusts the client's amountCents/lineItems — same class of gap as
    // nationals_entry/nationals_extra above, not yet closed. At minimum,
    // verify the caller is actually one of this team's two divers.
    if (isCompetitionEntry && teamId) {
      const { data: team, error: teamErr } = await supabase
        .from('comp_teams')
        .select('diver1_member_id, diver2_member_id')
        .eq('id', teamId)
        .maybeSingle()
      if (teamErr || !team) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Team not found' }) }
      }
      if (callerUserId !== team.diver1_member_id && callerUserId !== team.diver2_member_id) {
        return { statusCode: 403, body: JSON.stringify({ error: 'You can only pay for your own team' }) }
      }
    }

    if (!amountCents || amountCents <= 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid payment parameters' }) }
    }

    // ── Clear labels for Stripe Dashboard reconciliation ──────────────────────

    // Top-level payment description — shows in Stripe payments list
    const paymentDescription = isMembership
      ? `SNZ Membership 2026 — ${memberName || memberEmail || 'Member'}`
      : isExtras
        ? `SNZ Extras — ${competitionName || 'Competition'} — ${memberName || memberEmail || 'Member'}`
        : `SNZ Comp Entry — ${competitionName || 'Competition'} — ${memberName || memberEmail || 'Team'}`

    // Line item name — shows on Stripe Checkout page and receipt
    const lineItemName = isMembership
      ? 'SNZ Annual Membership 2026'
      : isExtras
        ? `Extras: ${competitionName || 'SNZ Event'}`
        : `Competition Entry: ${competitionName || 'SNZ Event'}`

    const lineItemDesc = isMembership
      ? `Membership for ${memberName || memberEmail} · Valid to 31 Dec 2026`
      : isExtras
        ? `Additional merch/meal for ${memberName || 'member'} · ${competitionName || 'SNZ Competition'}`
        : `Team entry for ${memberName || 'competitor'} · ${competitionName || 'SNZ Competition'}`

    // Statement descriptor — appears on bank statements (max 22 chars)
    const statementDescriptor = isMembership ? 'SNZ MEMBERSHIP 2026' : isExtras ? 'SNZ EXTRAS' : 'SNZ COMP ENTRY'

    // Rich metadata for webhook + Stripe Dashboard filtering
    const metadata = {
      type,
      category: isMembership ? 'Membership' : isExtras ? 'Event Extras' : 'Competition Entry',
      member_name: memberName || '',
      member_email: memberEmail || '',
    }
    if (memberId) metadata.member_id = memberId
    if (teamId) metadata.team_id = String(teamId)
    if (competitionId) metadata.competition_id = String(competitionId)
    if (competitionName) metadata.competition_name = competitionName
    // diver_slot tells the webhook whether this is diver 1's or diver 2's own
    // payment, so it updates the right payment-status column on comp_teams.
    if (diverSlot) metadata.diver_slot = String(diverSlot)
    if (isExtras) {
      if (extraMealQty) metadata.extra_meal_qty = String(extraMealQty)
      if (extraJacket) metadata.extra_jacket = JSON.stringify(extraJacket)
      if (extraShirt) metadata.extra_shirt = JSON.stringify(extraShirt)
      if (extraShirtQty) metadata.extra_shirt_qty = String(extraShirtQty)
    }

    // Nationals has three separate entry pages (diver 1 pairs, solo, diver 2
    // confirm) that all use type=nationals_entry. The caller tells us which
    // one to return to via successPath — without this every nationals payer
    // was bounced back to /nationals/register regardless of where they paid
    // from, so e.g. diver 2's post-payment confirmation code on
    // /nationals/confirm never ran.
    const nationalsPath = successPath || '/nationals/register'

    // Success URLs carry the checkout session id so the app can verify the
    // payment server-side (verify-checkout-session) instead of trusting the URL.
    // Stripe substitutes the literal {CHECKOUT_SESSION_ID} placeholder.
    // Generic competition_entry callers (e.g. CatfishCullRegister.jsx) can
    // also override the return path — same reasoning as nationalsPath above,
    // since /competitions/:id/register is a different page (CompRegister.jsx)
    // than a competition's own dedicated entry flow.
    const compPath = successPath || `/competitions/${competitionId}/register`

    const successUrl = isMembership
      ? `${origin}/membership/dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}`
      : isExtras
        ? `${origin}/membership/dashboard?extras=success&team=${teamId}&session_id={CHECKOUT_SESSION_ID}`
        : isNationals
          ? `${origin}${nationalsPath}?payment=success&team=${teamId}&session_id={CHECKOUT_SESSION_ID}`
          : `${origin}${compPath}?payment=success&session_id={CHECKOUT_SESSION_ID}`
    const cancelUrl = isMembership
      ? `${origin}/membership/dashboard?payment=cancelled`
      : isExtras
        ? `${origin}/membership/dashboard?extras=cancelled`
        : isNationals
          ? `${origin}${nationalsPath}?cancelled=1${teamId ? `&team=${teamId}` : ''}`
          : `${origin}${compPath}?payment=cancelled`

    // Build line items — use provided array (entry + merch, itemised on the
    // Checkout page and the Stripe receipt email) or fall back to a single
    // lumped item for callers that don't build one. For nationals_entry and
    // nationals_extra, `lineItems` was already overwritten above with the
    // server-computed items — the client's original array is never used.
    const stripeLineItems = lineItems && lineItems.length > 0
      ? lineItems.map(item => ({
          price_data: {
            currency: 'nzd',
            // Stripe rejects an explicit empty string for description (it
            // must be omitted, not blank) — callers like
            // NationalsRegister.jsx's buildLineItemsD1() never set one, so
            // `|| ''` broke every multi-item nationals_entry checkout.
            product_data: item.description
              ? { name: item.name, description: item.description }
              : { name: item.name },
            unit_amount: item.amountCents,
          },
          quantity: 1,
        }))
      : [{
          price_data: {
            currency: 'nzd',
            product_data: { name: lineItemName, description: lineItemDesc },
            unit_amount: amountCents,
          },
          quantity: 1,
        }]

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      payment_intent_data: {
        description: paymentDescription,
        statement_descriptor: statementDescriptor,
        // Guarantees Stripe sends an itemised receipt on successful payment,
        // regardless of the account's dashboard email settings.
        receipt_email: memberEmail || undefined,
        metadata,
      },
      line_items: stripeLineItems,
      mode: 'payment',
      metadata,
      customer_email: memberEmail || undefined,
      success_url: successUrl,
      cancel_url: cancelUrl,
    })

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: session.id, url: session.url }),
    }
  } catch (err) {
    console.error('Stripe checkout error:', err)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    }
  }
}
