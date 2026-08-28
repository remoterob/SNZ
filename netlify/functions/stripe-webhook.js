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
    const { type, member_id, team_id, diver_slot, extra_meal_qty, extra_jacket, extra_shirt, extra_shirt_qty } = session.metadata || {}
    const paymentIntent = session.payment_intent
    const paidAt = new Date().toISOString()

    try {
      if (type === 'nationals_extra' && team_id) {
        const merchCol = diver_slot === '2' ? 'merch_d2' : 'merch_d1'
        const { data: team, error: fetchErr } = await supabase
          .from('comp_teams').select(merchCol).eq('id', team_id).maybeSingle()
        if (fetchErr) throw new Error(`comp_teams lookup failed: ${fetchErr.message}`)
        const current = team?.[merchCol] || {}
        // Stripe explicitly documents at-least-once webhook delivery — a
        // redelivered event must not double-add meal_qty. Track which
        // session ids have already been applied inside the same jsonb blob
        // (no schema migration needed) and skip if this one already ran.
        const appliedSessions = current._applied_extra_sessions || []
        if (appliedSessions.includes(session.id)) {
          console.log(`nationals_extra session ${session.id} already applied to team ${team_id} (${merchCol}) — skipping duplicate delivery`)
        } else {
          const updated = {
            ...current,
            meal_qty: (current.meal_qty || 0) + (extra_meal_qty ? parseInt(extra_meal_qty, 10) : 0),
            jacket: extra_jacket ? JSON.parse(extra_jacket) : current.jacket || null,
            // extra_shirt_qty only appears for competitions with
            // merch.shirt.allowMultiple (Catfish Cull) — append to a running
            // list instead of overwriting the single `shirt` slot Nationals
            // uses, so different sizes bought across visits are all kept.
            // Nationals never sends extra_shirt_qty, so its existing
            // overwrite-`shirt` behaviour is completely unchanged.
            ...(extra_shirt_qty
              ? { shirts: [...(current.shirts || []), { ...JSON.parse(extra_shirt), qty: parseInt(extra_shirt_qty, 10) }] }
              : { shirt: extra_shirt ? JSON.parse(extra_shirt) : current.shirt || null }),
            _applied_extra_sessions: [...appliedSessions, session.id],
          }
          await safeUpdate('comp_teams', { [merchCol]: updated }, 'id', team_id)
          console.log(`Nationals extras applied to team ${team_id} (${merchCol}), session ${session.id}`)
        }

      } else if (type === 'membership' && member_id) {
        await safeUpdate('members', {
          payment_status: 'paid',
          stripe_session_id: session.id,
          stripe_payment_intent: paymentIntent,
          paid_at: paidAt,
          membership_status: 'active',
        }, 'id', member_id)
        console.log(`Membership paid for member ${member_id} (session ${session.id})`)

      } else if ((type === 'competition_entry' || type === 'nationals_entry') && team_id) {
        const { data: teamRow, error: teamFetchErr } = await supabase
          .from('comp_teams')
          .select('payment_status, diver2_email, diver2_payment_status, diver3_email, diver3_payment_status')
          .eq('id', team_id).maybeSingle()
        if (teamFetchErr) throw new Error(`comp_teams lookup failed: ${teamFetchErr.message}`)

        const updates = {}
        if (diver_slot === '2' || diver_slot === '3') {
          // Partners pay their own share on the confirm page — track it in
          // their own column so it doesn't clobber diver 1's
          // stripe_session_id / paid_at / payment_intent (a team-level record).
          updates[`diver${diver_slot}_payment_status`] = 'paid'
        } else {
          updates.payment_status = 'paid'
          updates.stripe_session_id = session.id
          updates.stripe_payment_intent_id = paymentIntent
          updates.paid_at = paidAt
        }

        // One diver paying doesn't speak for teammates who haven't confirmed
        // and paid their own share yet — only flip the team to 'active' once
        // every diver who actually has a seat (diver2/3 only count if the
        // team entered them) has paid.
        const merged = { ...teamRow, ...updates }
        const d1Paid = merged.payment_status === 'paid'
        const d2Ok = !merged.diver2_email || merged.diver2_payment_status === 'paid'
        const d3Ok = !merged.diver3_email || merged.diver3_payment_status === 'paid'
        updates.status = (d1Paid && d2Ok && d3Ok) ? 'active' : 'pending_teammates'

        await safeUpdate('comp_teams', updates, 'id', team_id)
        console.log(`${type} diver${diver_slot || 1} paid for team ${team_id} (session ${session.id}) — status=${updates.status}`)

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

  // Keep the DB in sync when a refund is issued (from the admin refund
  // button or manually in the Stripe dashboard). Full refunds only —
  // partial refunds don't change membership/entry status.
  if (stripeEvent.type === 'charge.refunded') {
    const charge = stripeEvent.data.object
    const isFullRefund = charge.amount_refunded >= charge.amount
    const intentId = typeof charge.payment_intent === 'string'
      ? charge.payment_intent : charge.payment_intent?.id

    if (isFullRefund && intentId) {
      try {
        const { type, member_id, team_id, diver_slot } = charge.metadata || {}

        // Prefer the intent id stored on our rows; fall back to charge metadata
        const { data: memberRows } = await supabase.from('members')
          .select('id').eq('stripe_payment_intent', intentId)
        const memberId = memberRows?.[0]?.id || (type === 'membership' ? member_id : null)

        if (memberId) {
          await safeUpdate('members', {
            payment_status: 'pending',
            membership_status: 'pending',
            paid_at: null,
          }, 'id', memberId)
          console.log(`Refund synced: member ${memberId} back to pending (${intentId})`)
        } else {
          // stripe_payment_intent_id on comp_teams only ever holds Diver 1's
          // intent (the diver2 checkout.session.completed branch above never
          // sets it), so a Diver 2 refund always falls through to charge
          // metadata's team_id — which is fine, that's always present.
          const { data: teamRows } = await supabase.from('comp_teams')
            .select('id').eq('stripe_payment_intent_id', intentId)
          const teamId = teamRows?.[0]?.id ||
            ((type === 'competition_entry' || type === 'nationals_entry' || type === 'comp_entry') ? team_id : null)
          if (teamId) {
            // A Diver 2 refund must only clear Diver 2's own payment status —
            // it must NOT withdraw the whole team, since Diver 1 may still be
            // competing. Only a Diver 1 refund (the team's primary payment)
            // withdraws the team.
            if (diver_slot === '2' || diver_slot === '3') {
              // A refunded teammate can no longer count toward 'active' — drop
              // a fully-active team back to pending so it doesn't read as
              // fully entered when it no longer is.
              const { data: teamForRefund } = await supabase
                .from('comp_teams').select('status').eq('id', teamId).maybeSingle()
              await safeUpdate('comp_teams', {
                [`diver${diver_slot}_payment_status`]: 'refunded',
                ...(teamForRefund?.status === 'active' ? { status: 'pending_teammates' } : {}),
              }, 'id', teamId)
              console.log(`Refund synced: team ${teamId} diver${diver_slot} payment refunded (${intentId})`)
            } else {
              await safeUpdate('comp_teams', {
                payment_status: 'refunded',
                status: 'withdrawn',
                withdrawn_at: new Date().toISOString(),
              }, 'id', teamId)
              console.log(`Refund synced: team ${teamId} withdrawn (${intentId})`)
            }
          } else {
            console.warn(`charge.refunded ${intentId}: no matching member or team — nothing to sync`)
          }
        }
      } catch (err) {
        console.error('Refund sync error:', err.message)
        return { statusCode: 500, body: 'Refund sync failed' }
      }
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) }
}
