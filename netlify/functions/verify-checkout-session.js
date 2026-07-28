// Netlify Function: verify a Stripe Checkout session server-side and activate
// the corresponding membership / competition entry.
//
// Called by the app when the member returns from Stripe with
// ?session_id={CHECKOUT_SESSION_ID}. Nothing is trusted from the client except
// the session id — payment state and metadata come from Stripe directly.
// This is a belt-and-braces companion to stripe-webhook.js (which remains the
// primary path); both are idempotent.

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Same migration-tolerant update as stripe-webhook.js
async function safeUpdate(table, values, idColumn, idValue) {
  let { data, error } = await supabase.from(table).update(values)
    .eq(idColumn, idValue).select('id')

  if (error && error.code === 'PGRST204') {
    const missing = (error.message.match(/'([^']+)' column/) || [])[1]
    if (missing && missing in values) {
      console.warn(`${table}.${missing} does not exist — retrying update without it`)
      const { [missing]: _dropped, ...rest } = values
      ;({ data, error } = await supabase.from(table).update(rest)
        .eq(idColumn, idValue).select('id'))
    }
  }

  if (error) throw new Error(`${table} update failed: ${error.message} (${error.code})`)
  if (!data || data.length === 0) throw new Error(`${table} update matched no row for ${idColumn}=${idValue}`)
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  try {
    const { sessionId } = JSON.parse(event.body || '{}')
    if (!sessionId || typeof sessionId !== 'string' || !sessionId.startsWith('cs_')) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid session id' }) }
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId)

    if (session.payment_status !== 'paid') {
      console.warn(`verify-checkout-session: ${sessionId} not paid (${session.payment_status})`)
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verified: false, paymentStatus: session.payment_status }),
      }
    }

    const { type, member_id, team_id, diver_slot } = session.metadata || {}
    const paymentIntent = session.payment_intent
    const paidAt = new Date().toISOString()

    if (type === 'membership' && member_id) {
      await safeUpdate('members', {
        payment_status: 'paid',
        stripe_session_id: session.id,
        stripe_payment_intent: paymentIntent,
        paid_at: paidAt,
        membership_status: 'active',
      }, 'id', member_id)
      console.log(`Membership verified+activated for member ${member_id} (session ${session.id})`)

    } else if ((type === 'competition_entry' || type === 'nationals_entry') && team_id) {
      if (diver_slot === '2') {
        await safeUpdate('comp_teams', {
          diver2_payment_status: 'paid',
          status: 'active',
        }, 'id', team_id)
        console.log(`${type} diver2 verified+activated for team ${team_id} (session ${session.id})`)
      } else {
        await safeUpdate('comp_teams', {
          payment_status: 'paid',
          status: 'active',
          stripe_session_id: session.id,
          stripe_payment_intent_id: paymentIntent,
          paid_at: paidAt,
        }, 'id', team_id)
        console.log(`${type} verified+activated for team ${team_id} (session ${session.id})`)
      }

    } else {
      console.error(`verify-checkout-session: unrecognised metadata on ${session.id}: type=${type}`)
      return { statusCode: 400, body: JSON.stringify({ error: 'Unrecognised payment type' }) }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verified: true, type }),
    }
  } catch (err) {
    console.error('verify-checkout-session error:', err.message)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
