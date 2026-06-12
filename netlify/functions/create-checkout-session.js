// Netlify Function: create a Stripe Checkout session
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  const origin = event.headers.origin || 'https://spearfishingnz.netlify.app'

  try {
    const body = JSON.parse(event.body)
    const { type, memberId, teamId, competitionId, competitionName, memberEmail, memberName, lineItems } = body
    let { amountCents } = body

    if (!type || !amountCents || amountCents <= 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid payment parameters' }) }
    }

    const isMembership = type === 'membership'

    // Membership price is NEVER taken from the client — look it up from the
    // member's own record so a tampered request can't underpay.
    if (isMembership) {
      if (!memberId) {
        return { statusCode: 400, body: JSON.stringify({ error: 'memberId is required for membership payments' }) }
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

    // ── Clear labels for Stripe Dashboard reconciliation ──────────────────────

    // Top-level payment description — shows in Stripe payments list
    const paymentDescription = isMembership
      ? `SNZ Membership 2026 — ${memberName || memberEmail || 'Member'}`
      : `SNZ Comp Entry — ${competitionName || 'Competition'} — ${memberName || memberEmail || 'Team'}`

    // Line item name — shows on Stripe Checkout page and receipt
    const lineItemName = isMembership
      ? 'SNZ Annual Membership 2026'
      : `Competition Entry: ${competitionName || 'SNZ Event'}`

    const lineItemDesc = isMembership
      ? `Membership for ${memberName || memberEmail} · Valid to 31 Dec 2026`
      : `Team entry for ${memberName || 'competitor'} · ${competitionName || 'SNZ Competition'}`

    // Statement descriptor — appears on bank statements (max 22 chars)
    const statementDescriptor = isMembership ? 'SNZ MEMBERSHIP 2026' : 'SNZ COMP ENTRY'

    // Rich metadata for webhook + Stripe Dashboard filtering
    const metadata = {
      type,
      category: isMembership ? 'Membership' : 'Competition Entry',
      member_name: memberName || '',
      member_email: memberEmail || '',
    }
    if (memberId) metadata.member_id = memberId
    if (teamId) metadata.team_id = String(teamId)
    if (competitionId) metadata.competition_id = String(competitionId)
    if (competitionName) metadata.competition_name = competitionName

    // Success URLs carry the checkout session id so the app can verify the
    // payment server-side (verify-checkout-session) instead of trusting the URL.
    // Stripe substitutes the literal {CHECKOUT_SESSION_ID} placeholder.
    const isNationals = type === 'nationals_entry'
    const successUrl = isMembership
      ? `${origin}/membership/dashboard?payment=success&session_id={CHECKOUT_SESSION_ID}`
      : isNationals
        ? `${origin}/nationals/register?payment=success&team=${teamId}&session_id={CHECKOUT_SESSION_ID}`
        : `${origin}/competitions/${competitionId}/register?payment=success&session_id={CHECKOUT_SESSION_ID}`
    const cancelUrl = isMembership
      ? `${origin}/membership/dashboard?payment=cancelled`
      : isNationals
        ? `${origin}/nationals/register?cancelled=1`
        : `${origin}/competitions/${competitionId}/register?payment=cancelled`

    // Build line items — use provided array (entry + merch) or fall back to single item
    const stripeLineItems = lineItems && lineItems.length > 1
      ? lineItems.map(item => ({
          price_data: {
            currency: 'nzd',
            product_data: { name: item.name, description: item.description || '' },
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
