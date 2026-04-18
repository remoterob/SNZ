// Netlify Function: create a Stripe Checkout session
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  const origin = event.headers.origin || 'https://spearfishingnz.netlify.app'

  try {
    const body = JSON.parse(event.body)
    const { type, memberId, teamId, competitionId, competitionName, amountCents, memberEmail, memberName } = body

    if (!type || !amountCents || amountCents <= 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid payment parameters' }) }
    }

    // ── Clear labels for Stripe Dashboard reconciliation ──────────────────────
    const isMembership = type === 'membership'

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

    // Nationals entry gets its own redirect URLs
    const isNationals = type === 'nationals_entry'
    const successUrl = isMembership
      ? `${origin}/membership/dashboard?payment=success`
      : isNationals
        ? `${origin}/nationals/register?payment=success&team=${teamId}`
        : `${origin}/competitions/${competitionId}?payment=success`
    const cancelUrl = isMembership
      ? `${origin}/membership/dashboard?payment=cancelled`
      : isNationals
        ? `${origin}/nationals/register?cancelled=1`
        : `${origin}/competitions/${competitionId}/register?payment=cancelled`

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      payment_intent_data: {
        description: paymentDescription,
        statement_descriptor: statementDescriptor,
        metadata,
      },
      line_items: [{
        price_data: {
          currency: 'nzd',
          product_data: {
            name: lineItemName,
            description: lineItemDesc,
            metadata,
          },
          unit_amount: amountCents,
        },
        quantity: 1,
      }],
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
