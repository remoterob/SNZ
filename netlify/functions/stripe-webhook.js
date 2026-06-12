// Netlify Function: handle Stripe webhook events
// Updates Supabase when payment is confirmed
//
// IMPORTANT: every Supabase update MUST be error-checked. supabase-js does not
// throw on DB errors — it returns { error }. Ignoring it means the webhook
// returns 200 to Stripe on failure and Stripe never retries the event.

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Update that tolerates a not-yet-applied migration: if a column in `values`
// doesn't exist (PGRST204), drop it and retry so the payment still lands.
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

  const sig = event.headers['stripe-signature']
  let stripeEvent

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message)
    return { statusCode: 400, body: `Webhook Error: ${err.message}` }
  }

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object
    const { type, member_id, team_id } = session.metadata || {}
    const paymentIntent = session.payment_intent
    const paidAt = new Date().toISOString()

    try {
      if (type === 'membership' && member_id) {
        await safeUpdate('members', {
          payment_status: 'paid',
          stripe_session_id: session.id,
          stripe_payment_intent: paymentIntent,
          paid_at: paidAt,
          membership_status: 'active',
        }, 'id', member_id)
        console.log(`Membership paid for member ${member_id} (session ${session.id})`)

      } else if ((type === 'competition_entry' || type === 'nationals_entry') && team_id) {
        await safeUpdate('comp_teams', {
          payment_status: 'paid',
          status: 'active',
          stripe_session_id: session.id,
          stripe_payment_intent_id: paymentIntent,
          paid_at: paidAt,
        }, 'id', team_id)
        console.log(`${type} paid for team ${team_id} (session ${session.id})`)

      } else {
        // Unrecognised metadata — log loudly so it shows in function logs,
        // but return 200 (retrying won't fix missing metadata).
        console.error(`Unhandled checkout.session.completed: type=${type} member_id=${member_id} team_id=${team_id} session=${session.id}`)
      }
    } catch (err) {
      console.error('Supabase update error:', err.message, `(session ${session.id})`)
      // 500 so Stripe retries the event — payments must never be lost silently
      return { statusCode: 500, body: 'Database update failed' }
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) }
}
