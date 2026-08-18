// Netlify Function: keep a Mailchimp audience in step with the members table.
//
// Called by a Postgres trigger on public.members (migration 023) via pg_net,
// so it fires for every path that creates or changes a member — the three
// client-side signup paths, admin edits, and anything added later — rather
// than needing a call wired into each one.
//
// Required env (server-side only, never VITE_ prefixed):
//   MAILCHIMP_API_KEY       e.g. abc123...-us14  (datacenter is the suffix)
//   MAILCHIMP_AUDIENCE_ID   the audience/list id
//   MAILCHIMP_WEBHOOK_SECRET  shared secret, must match the DB trigger's
//
// Unsubscribes are respected: new contacts are created subscribed, but an
// existing contact's status is never overwritten, so someone who opts out
// stays out even if their member row is updated again.

const crypto = require('crypto')

const {
  MAILCHIMP_API_KEY,
  MAILCHIMP_AUDIENCE_ID,
  MAILCHIMP_WEBHOOK_SECRET,
} = process.env

const json = (code, body) => ({
  statusCode: code,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

const subscriberHash = (email) =>
  crypto.createHash('md5').update(String(email).trim().toLowerCase()).digest('hex')

function mailchimpBase() {
  const dc = (MAILCHIMP_API_KEY || '').split('-')[1]
  if (!dc) throw new Error('MAILCHIMP_API_KEY has no datacenter suffix (expected key-usXX)')
  return `https://${dc}.api.mailchimp.com/3.0`
}

async function mc(path, { method = 'GET', body } = {}) {
  const res = await fetch(mailchimpBase() + path, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`anystring:${MAILCHIMP_API_KEY}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let parsed = null
  try { parsed = text ? JSON.parse(text) : null } catch { /* non-JSON error page */ }
  return { ok: res.ok, status: res.status, body: parsed, raw: text }
}

const splitName = (name) => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return { FNAME: '', LNAME: '' }
  return { FNAME: parts[0], LNAME: parts.slice(1).join(' ') }
}

// Extra merge tags only apply if they exist in the audience; Mailchimp 400s on
// unknown ones, so we retry with just the built-in FNAME/LNAME if that happens.
const mergeFields = (m) => ({
  ...splitName(m.name),
  REGION: m.region || '',
  CLUB: m.club || '',
  EXPERIENCE: m.experience || '',
  MEMBERYEAR: m.membership_year ? String(m.membership_year) : '',
})

async function upsertContact(member) {
  const list = MAILCHIMP_AUDIENCE_ID
  const hash = subscriberHash(member.email)
  const base = {
    email_address: String(member.email).trim().toLowerCase(),
    // status_if_new (not status) is the whole trick: it sets the status only
    // when creating. An existing contact keeps whatever they chose, so an
    // unsubscribe is never undone by a later member-row update.
    status_if_new: 'subscribed',
  }

  let res = await mc(`/lists/${list}/members/${hash}`, {
    method: 'PUT',
    body: { ...base, merge_fields: mergeFields(member) },
  })

  if (!res.ok && res.status === 400 && /merge/i.test(res.raw || '')) {
    console.warn('Mailchimp rejected custom merge fields, retrying with FNAME/LNAME only:', res.raw?.slice(0, 200))
    res = await mc(`/lists/${list}/members/${hash}`, {
      method: 'PUT',
      body: { ...base, merge_fields: splitName(member.name) },
    })
  }
  return res
}

async function changeEmail(oldEmail, member) {
  const list = MAILCHIMP_AUDIENCE_ID
  // Update the contact at the OLD hash to the new address; Mailchimp keys on
  // the email, so skipping this would leave a duplicate behind.
  const res = await mc(`/lists/${list}/members/${subscriberHash(oldEmail)}`, {
    method: 'PATCH',
    body: { email_address: String(member.email).trim().toLowerCase(), merge_fields: splitName(member.name) },
  })
  if (res.ok) return res
  // Not on the list under the old address — just create them under the new one.
  return upsertContact(member)
}

const unsubscribe = (email) =>
  mc(`/lists/${MAILCHIMP_AUDIENCE_ID}/members/${subscriberHash(email)}`, {
    method: 'PATCH',
    body: { status: 'unsubscribed' },
  })

const archive = (email) =>
  mc(`/lists/${MAILCHIMP_AUDIENCE_ID}/members/${subscriberHash(email)}`, { method: 'DELETE' })

const deletePermanently = (email) =>
  mc(`/lists/${MAILCHIMP_AUDIENCE_ID}/members/${subscriberHash(email)}/actions/delete-permanent`, { method: 'POST' })

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' })

  if (!MAILCHIMP_API_KEY || !MAILCHIMP_AUDIENCE_ID) {
    console.error('mailchimp-sync: missing MAILCHIMP_API_KEY or MAILCHIMP_AUDIENCE_ID')
    return json(500, { error: 'Mailchimp is not configured' })
  }

  // The endpoint is public, so the shared secret is what stops anyone POSTing
  // arbitrary contacts into the audience.
  if (!MAILCHIMP_WEBHOOK_SECRET) {
    console.error('mailchimp-sync: MAILCHIMP_WEBHOOK_SECRET is not set — refusing to run unauthenticated')
    return json(500, { error: 'Webhook secret not configured' })
  }
  const provided = event.headers['x-webhook-secret'] || event.headers['X-Webhook-Secret']
  if (provided !== MAILCHIMP_WEBHOOK_SECRET) return json(401, { error: 'Unauthorised' })

  let payload
  try { payload = JSON.parse(event.body || '{}') } catch { return json(400, { error: 'Invalid JSON' }) }

  const type = payload.type
  const record = payload.record || null
  const oldRecord = payload.old_record || null
  const member = record || oldRecord
  if (!member?.email) return json(200, { skipped: 'no email on record' })

  try {
    let action, res

    if (type === 'DELETE') {
      action = 'archive'
      res = await archive(oldRecord.email)

    } else if (type === 'UPDATE' && !oldRecord?.data_removal_requested_at && record.data_removal_requested_at) {
      // Data removal requested — hard delete so they can't be re-added.
      action = 'delete-permanent'
      res = await deletePermanently(record.email)

    } else if (type === 'UPDATE' && !oldRecord?.cancelled_at && record.cancelled_at) {
      action = 'unsubscribe'
      res = await unsubscribe(record.email)

    } else if (type === 'UPDATE' && oldRecord?.email && oldRecord.email !== record.email) {
      action = 'change-email'
      res = await changeEmail(oldRecord.email, record)

    } else {
      action = 'upsert'
      res = await upsertContact(record)
    }

    if (!res.ok) {
      // 404 on unsubscribe/archive just means they were never on the list.
      if (res.status === 404) {
        console.log(`mailchimp-sync: ${action} — contact not on audience, nothing to do`)
        return json(200, { action, skipped: 'not on audience' })
      }
      console.error(`mailchimp-sync: ${action} failed (${res.status}):`, res.raw?.slice(0, 400))
      return json(502, { action, error: 'Mailchimp rejected the request', status: res.status })
    }

    console.log(`mailchimp-sync: ${action} ok for member ${member.id}`)
    return json(200, { action, ok: true })
  } catch (err) {
    console.error('mailchimp-sync: unhandled error', err)
    return json(500, { error: err.message })
  }
}
