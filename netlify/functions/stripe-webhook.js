// Netlify Function: handle Stripe webhook events
// Updates Supabase when payment is confirmed

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
    const { type, member_id, team_id, competition_id } = session.metadata
    const paymentIntent = session.payment_intent
    const paidAt = new Date().toISOString()

    try {
      if (type === 'membership' && member_id) {
        await supabase.from('members').update({
          payment_status: 'paid',
          stripe_session_id: session.id,
          stripe_payment_intent: paymentIntent,
          paid_at: paidAt,
          membership_status: 'active',
        }).eq('id', member_id)
        console.log(`Membership paid for member ${member_id}`)
      }

      if (type === 'competition_entry' && team_id) {
        await supabase.from('comp_teams').update({
          payment_status: 'paid',
          status: 'active',
          stripe_session_id: session.id,
          stripe_payment_intent: paymentIntent,
          paid_at: paidAt,
        }).eq('id', parseInt(team_id))
        console.log(`Competition entry paid for team ${team_id}`)
      }
    } catch (err) {
      console.error('Supabase update error:', err)
      return { statusCode: 500, body: 'Database update failed' }
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) }
}
