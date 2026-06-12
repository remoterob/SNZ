// Netlify Function: refund a Stripe payment for a membership or comp entry.
// Admin-only (password-checked POST), called from the admin pages.
//
// Request: { adminPassword, type: 'membership' | 'comp_entry',
//            memberId? , teamId?, paymentIntentId?, amountCents?, listOnly? }
//
// Payment resolution order: the intent id stored on the DB row, then a Stripe
// metadata search (covers memberships paid before intent ids were recorded,
// and nationals teams where both divers paid separately). When several
// refundable payments exist for a comp entry, the caller gets the list back
// and must pick one (memberships auto-pick the most recent).
//
// After a FULL refund: members go back to pending/unpaid (must pay again to
// be active); comp teams are marked withdrawn. Partial refunds leave statuses
// untouched — they're recorded in Stripe only.

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

function describe(pi) {
  const refunded = pi.latest_charge?.amount_refunded || 0
  return {
    id: pi.id,
    amountCents: pi.amount,
    amountRemainingCents: pi.amount - refunded,
    created: new Date(pi.created * 1000).toISOString(),
    description: pi.description || '',
    email: pi.receipt_email || pi.metadata?.member_email || '',
    partiallyRefunded: refunded > 0,
  }
}

// Find succeeded, not-fully-refunded payment intents for this member/team
async function findRefundablePayments({ type, memberId, teamId, storedIntentId }) {
  const found = new Map()

  if (storedIntentId) {
    try {
      const pi = await stripe.paymentIntents.retrieve(storedIntentId, { expand: ['latest_charge'] })
      found.set(pi.id, pi)
    } catch (e) {
      console.warn(`Stored intent ${storedIntentId} not retrievable: ${e.message}`)
    }
  }

  // Metadata search — ids are UUIDs / integers from our own DB, but strip
  // quotes anyway so the query can't be broken
  const key = type === 'membership' ? 'member_id' : 'team_id'
  const value = String(type === 'membership' ? memberId : teamId).replace(/['"\\]/g, '')
  const search = await stripe.paymentIntents.search({
    query: `metadata['${key}']:'${value}' AND status:'succeeded'`,
    limit: 10,
    expand: ['data.latest_charge'],
  })
  for (const pi of search.data) found.set(pi.id, pi)

  return [...found.values()]
    .filter(pi => pi.status === 'succeeded')
    .filter(pi => (pi.latest_charge?.amount_refunded || 0) < pi.amount)
    .sort((a, b) => b.created - a.created)
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  let body
  try {
    body = JSON.parse(event.body || '{}')
  } catch (e) {
    return json(400, { error: 'Bad request' })
  }
  if (body.adminPassword !== process.env.VITE_ADMIN_PASSWORD) {
    return json(401, { error: 'Unauthorised' })
  }

  const { type, memberId, teamId, paymentIntentId, amountCents, listOnly } = body
  if (type !== 'membership' && type !== 'comp_entry') {
    return json(400, { error: 'type must be membership or comp_entry' })
  }
  if (type === 'membership' && !memberId) return json(400, { error: 'memberId required' })
  if (type === 'comp_entry' && !teamId) return json(400, { error: 'teamId required' })

  try {
    // Load the DB row (also gives us the stored intent id)
    let storedIntentId = null
    if (type === 'membership') {
      const { data: m, error } = await supabase.from('members')
        .select('id, email, name, stripe_payment_intent').eq('id', memberId).maybeSingle()
      if (error || !m) return json(404, { error: 'Member not found' })
      storedIntentId = m.stripe_payment_intent
    } else {
      const { data: t, error } = await supabase.from('comp_teams')
        .select('id, team_name, stripe_payment_intent_id').eq('id', teamId).maybeSingle()
      if (error || !t) return json(404, { error: 'Team not found' })
      storedIntentId = t.stripe_payment_intent_id
    }

    const payments = await findRefundablePayments({ type, memberId, teamId, storedIntentId })
    if (payments.length === 0) {
      return json(404, { error: 'No refundable Stripe payment found' })
    }

    if (listOnly) return json(200, { payments: payments.map(describe) })

    // Pick the payment to refund
    let target
    if (paymentIntentId) {
      target = payments.find(p => p.id === paymentIntentId)
      if (!target) return json(400, { error: 'That payment is not refundable for this record' })
    } else if (payments.length === 1 || type === 'membership') {
      target = payments[0] // most recent
    } else {
      return json(200, { requiresChoice: true, payments: payments.map(describe) })
    }

    const remaining = target.amount - (target.latest_charge?.amount_refunded || 0)
    const refundAmount = amountCents != null ? Math.round(amountCents) : remaining
    if (!(refundAmount > 0 && refundAmount <= remaining)) {
      return json(400, { error: `Amount must be between 1 and ${remaining} cents` })
    }
    const isFullRefund = refundAmount === target.amount

    const refund = await stripe.refunds.create({
      payment_intent: target.id,
      amount: refundAmount,
      reason: 'requested_by_customer',
      metadata: { refunded_via: 'snz-admin', type, member_id: memberId || '', team_id: teamId ? String(teamId) : '' },
    })

    // Update DB statuses on full refunds only
    let dbUpdated = true
    if (isFullRefund) {
      const update = type === 'membership'
        ? supabase.from('members').update({
            payment_status: 'pending',
            membership_status: 'pending',
            paid_at: null,
          }).eq('id', memberId)
        : supabase.from('comp_teams').update({
            payment_status: 'refunded',
            status: 'withdrawn',
            withdrawn_at: new Date().toISOString(),
          }).eq('id', teamId)
      const { error: updateErr } = await update
      if (updateErr) {
        console.error('Refund DB update failed:', updateErr.message)
        dbUpdated = false
      }
    }

    console.log(`Refunded ${refundAmount}c on ${target.id} (${type} ${memberId || teamId}, full=${isFullRefund})`)
    return json(200, {
      refunded: true,
      refundId: refund.id,
      amountCents: refundAmount,
      full: isFullRefund,
      dbUpdated,
    })
  } catch (err) {
    console.error('Refund error:', err)
    if (err.code === 'charge_already_refunded') {
      return json(400, { error: 'This payment has already been fully refunded' })
    }
    return json(500, { error: err.message })
  }
}
