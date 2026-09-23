// Weekly "your team isn't fully paid up" reminders for partially-paid teams.
//
// When Diver 1 registers and pays, their partner gets an invite email — but a
// lot of those partners never complete, leaving the team on
// status 'pending_teammates' with nobody chasing it. This scans for those
// teams and nudges everyone on the entry.
//
// Called from runBackup() so it piggybacks on the existing daily schedule.
// The 7-day cadence lives in comp_teams.teammate_reminder_sent_at (migration
// 036), not in a cron expression: the job runs daily and only emails a team
// whose last reminder is absent or 7+ days old.

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const RESEND_API_KEY = process.env.VITE_RESEND_API_KEY || process.env.RESEND_API_KEY
const FROM = '"Spearfishing NZ" <noreply@snzmail.teamaotea.com>'
const REPLY_TO = 'president@spearfishingnz.co.nz'
const ORIGIN = process.env.URL || 'https://spearfishingnz.netlify.app'

const PAID_STATUSES = ['paid', 'waived']
const REMINDER_INTERVAL_DAYS = 7

const isPaid = s => PAID_STATUSES.includes(s)

async function sendEmail({ to, subject, html }) {
  if (!RESEND_API_KEY) throw new Error('Resend API key not configured (VITE_RESEND_API_KEY)')
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, reply_to: REPLY_TO, to: [to], subject, html }),
  })
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`)
  return res.json()
}

// Magic link straight into the confirm page for this diver's slot. Falls back
// to the plain confirm URL if link generation fails — they'll just have to
// sign in themselves rather than landing already authenticated.
async function confirmLinkFor(email, teamId, slot, isExistingMember) {
  const confirmUrl = `${ORIGIN}/nationals/confirm?team=${teamId}&slot=${slot}`
  try {
    if (isExistingMember) {
      const { data } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: email.trim().toLowerCase(),
        options: { redirectTo: confirmUrl, data: { team_id: teamId, nationals: true } },
      })
      if (data?.properties?.action_link) return data.properties.action_link
    } else {
      const { data, error } = await supabase.auth.admin.inviteUserByEmail(
        email.trim().toLowerCase(),
        { redirectTo: confirmUrl, data: { team_id: teamId, nationals: true } }
      )
      if (!error && data?.properties?.action_link) return data.properties.action_link
      // Already has an auth account — magic link instead.
      const { data: ml } = await supabase.auth.admin.generateLink({
        type: 'magiclink',
        email: email.trim().toLowerCase(),
        options: { redirectTo: confirmUrl, data: { team_id: teamId, nationals: true } },
      })
      if (ml?.properties?.action_link) return ml.properties.action_link
    }
  } catch (err) {
    console.error(`Reminder link generation failed for ${email}:`, err.message)
  }
  return confirmUrl
}

// The logo is served as a PNG from the site's own PWA icon set rather than
// VITE_SNZ_LOGO_URL — that one is an AVIF, which Outlook and several other
// mail clients can't decode at all and would render as a broken image. The
// PNG is opaque white, so it sits on its own white bar above the navy band
// instead of inside it. Width/height attributes are set as well as the inline
// style because Outlook ignores CSS sizing on images.
const shell = (heading, inner) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <div style="background:#ffffff;padding:24px 32px 18px;text-align:center;">
      <a href="https://spearfishingnz.co.nz" style="text-decoration:none;border:0;">
        <img src="${ORIGIN}/icons/icon-192.png" width="76" height="76"
             alt="Spearfishing New Zealand"
             style="display:block;margin:0 auto;border:0;outline:none;text-decoration:none;width:76px;height:76px;">
      </a>
    </div>
    <div style="background:#1e3a5f;padding:24px 32px;">
      <p style="margin:0;color:#ffffff;font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">Spearfishing New Zealand</p>
      <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:900;">${heading}</h1>
    </div>
    <div style="padding:32px;">
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin:0 0 20px;">
        <p style="margin:0;color:#1e40af;font-size:13px;font-weight:bold;">📍 SNZ Nationals 2027</p>
        <p style="margin:4px 0 0;color:#1d4ed8;font-size:13px;">Tairua, Coromandel Peninsula · 19–24 January 2027</p>
      </div>
      ${inner}
    </div>
    <div style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e5e7eb;">
      <p style="margin:0;color:#9ca3af;font-size:12px;">
        Spearfishing New Zealand · <a href="https://spearfishingnz.co.nz" style="color:#6b7280;">spearfishingnz.co.nz</a>
      </p>
      <p style="margin:4px 0 0;color:#d1d5db;font-size:11px;">
        Already sorted this? You can ignore this reminder — it stops once everyone on the team has paid.
      </p>
    </div>
  </div>
</body>
</html>`.trim()

const cta = (link, label) => `
      <div style="text-align:center;margin:28px 0;">
        <a href="${link}" style="display:inline-block;background:#2B6CB0;color:#ffffff;font-size:15px;font-weight:900;text-decoration:none;padding:14px 32px;border-radius:10px;">${label}</a>
      </div>
      <p style="margin:0 0 8px;color:#9ca3af;font-size:12px;text-align:center;">
        This link expires in 24 hours. If it has expired, contact
        <a href="mailto:president@spearfishingnz.co.nz" style="color:#2B6CB0;">president@spearfishingnz.co.nz</a>
      </p>`

// Email for the diver who still owes — this is the one with the action.
function outstandingEmail({ teamName, link, otherNames }) {
  const partner = otherNames.length
    ? `<strong>${otherNames.join(' and ')}</strong> ${otherNames.length > 1 ? 'have' : 'has'} already paid their entry`
    : 'Your dive partner has already paid their entry'
  return shell('⏳ Your Nationals entry isn\'t finished', `
      <p style="margin:0 0 16px;color:#374151;font-size:15px;">
        Your team <strong>${teamName}</strong> is registered for SNZ Nationals 2027, but your own entry
        still isn't confirmed.
      </p>
      <p style="margin:0 0 16px;color:#374151;font-size:14px;">
        ${partner} — the team isn't on the start list until you've done the same.
      </p>
      <p style="margin:0 0 4px;color:#374151;font-size:14px;">It takes a couple of minutes:</p>
      <ol style="margin:0 0 20px;padding-left:20px;color:#374151;font-size:14px;line-height:1.8;">
        <li>Sign in using the button below</li>
        <li>Check your events and add any extras (merch, meal tickets)</li>
        <li>Pay your entry fee</li>
      </ol>
      ${cta(link, 'Complete My Entry →')}`)
}

// Email for divers who have paid — no action for them beyond chasing their mate.
function nudgeEmail({ teamName, outstandingNames }) {
  const who = outstandingNames.length
    ? `<strong>${outstandingNames.join(' and ')}</strong>`
    : 'Your dive partner'
  const verb = outstandingNames.length > 1 ? 'haven\'t' : 'hasn\'t'
  return shell('⏳ Your team isn\'t confirmed yet', `
      <p style="margin:0 0 16px;color:#374151;font-size:15px;">
        Thanks for getting your own entry sorted for <strong>${teamName}</strong> — but your team
        isn't on the start list yet.
      </p>
      <p style="margin:0 0 16px;color:#374151;font-size:14px;">
        ${who} ${verb} completed and paid their entry. We've emailed them a link directly, but a
        message from you usually does the trick faster.
      </p>
      <p style="margin:0 0 8px;color:#374151;font-size:14px;">
        Entries need to be complete before the registration cutoff, so please give them a nudge.
      </p>
      <p style="margin:0;color:#6b7280;font-size:13px;">
        Nothing further to do on your side — this reminder stops once they're paid up.
      </p>`)
}

// Everyone on the entry, with their email, paid state and slot.
function participantsOf(team) {
  const list = [{
    slot: 1,
    email: team.d1?.email || team.diver1_email || null,
    name: team.d1?.name || null,
    paid: isPaid(team.payment_status),
    isMember: !!team.diver1_member_id,
  }]
  if (team.diver2_email || team.diver2_member_id) {
    list.push({
      slot: 2,
      email: team.d2?.email || team.diver2_email || null,
      name: team.d2?.name || null,
      paid: isPaid(team.diver2_payment_status),
      isMember: !!team.diver2_member_id,
    })
  }
  if (team.diver3_email || team.diver3_member_id) {
    list.push({
      slot: 3,
      email: team.d3?.email || team.diver3_email || null,
      name: team.d3?.name || null,
      paid: isPaid(team.diver3_payment_status),
      isMember: !!team.diver3_member_id,
    })
  }
  return list.filter(p => p.email)
}

/**
 * Finds partially-paid teams on open Nationals competitions and emails
 * everyone on the entry, at most once every 7 days per team.
 *
 * dryRun returns what it *would* send without emailing or writing anything.
 */
async function sendTeammateReminders({ now = new Date(), dryRun = false } = {}) {
  // Nationals only for now — broadening to other competitions is a matter of
  // widening this name filter.
  const { data: comps, error: cErr } = await supabase
    .from('competitions')
    .select('id, name, status, registration_cutoff')
    .ilike('name', '%national%')
    .in('status', ['open', 'active'])
  if (cErr) throw cErr
  if (!comps?.length) return { scanned: 0, due: 0, sent: 0, failed: 0, teams: [] }

  const { data: teams, error: tErr } = await supabase
    .from('comp_teams')
    .select(`
      id, team_name, competition_id, status,
      payment_status, diver2_payment_status, diver3_payment_status,
      diver1_member_id, diver1_email,
      diver2_member_id, diver2_email,
      diver3_member_id, diver3_email,
      teammate_reminder_sent_at, teammate_reminder_count,
      d1:members!comp_teams_diver1_member_id_fkey(name, email),
      d2:members!comp_teams_diver2_member_id_fkey(name, email),
      d3:members!comp_teams_diver3_member_id_fkey(name, email)
    `)
    .in('competition_id', comps.map(c => c.id))
    .neq('status', 'withdrawn')
  if (tErr) throw tErr

  const cutoffMs = now.getTime() - REMINDER_INTERVAL_DAYS * 24 * 60 * 60 * 1000
  const report = []
  let sent = 0
  let failed = 0
  let due = 0

  for (const team of (teams || [])) {
    const people = participantsOf(team)
    const paid = people.filter(p => p.paid)
    const unpaid = people.filter(p => !p.paid)

    // Only chase teams that are genuinely half-done: someone has put money in,
    // someone else hasn't. Teams where nobody has paid are a different problem
    // (they never started) and teams where everyone has are complete.
    if (!paid.length || !unpaid.length) continue
    due++

    // Parse rather than string-compare: Postgres can hand back a non-UTC
    // offset, which would make a lexicographic comparison silently wrong.
    const lastSent = team.teammate_reminder_sent_at
    const lastSentMs = lastSent ? Date.parse(lastSent) : NaN
    if (Number.isFinite(lastSentMs) && lastSentMs > cutoffMs) {
      report.push({ teamId: team.id, teamName: team.team_name, skipped: 'within 7 days', lastSent })
      continue
    }

    const entry = {
      teamId: team.id,
      teamName: team.team_name,
      reminderNumber: (team.teammate_reminder_count || 0) + 1,
      outstanding: unpaid.map(p => p.email),
      nudged: paid.map(p => p.email),
    }

    if (dryRun) { report.push({ ...entry, dryRun: true }); continue }

    try {
      const outstandingNames = unpaid.map(p => p.name).filter(Boolean)
      const paidNames = paid.map(p => p.name).filter(Boolean)

      for (const p of unpaid) {
        const link = await confirmLinkFor(p.email, team.id, p.slot, p.isMember)
        await sendEmail({
          to: p.email,
          subject: `Reminder: your SNZ Nationals 2027 entry isn't finished`,
          html: outstandingEmail({ teamName: team.team_name, link, otherNames: paidNames }),
        })
      }
      for (const p of paid) {
        await sendEmail({
          to: p.email,
          subject: `Reminder: ${team.team_name} isn't confirmed for Nationals 2027 yet`,
          html: nudgeEmail({ teamName: team.team_name, outstandingNames }),
        })
      }

      const { error: uErr } = await supabase
        .from('comp_teams')
        .update({
          teammate_reminder_sent_at: now.toISOString(),
          teammate_reminder_count: (team.teammate_reminder_count || 0) + 1,
        })
        .eq('id', team.id)
      if (uErr) throw uErr

      sent++
      report.push({ ...entry, sentTo: people.length })
    } catch (err) {
      // One bad address must not stop the rest of the run.
      failed++
      console.error(`Teammate reminder failed for team ${team.id} (${team.team_name}):`, err.message)
      report.push({ ...entry, error: err.message })
    }
  }

  console.log(`Teammate reminders: ${teams?.length || 0} teams scanned, ${due} partially paid, ${sent} reminded, ${failed} failed`)
  return { scanned: teams?.length || 0, due, sent, failed, teams: report }
}

// Templates are exported so they can be rendered and eyeballed without
// sending anything to a real member.
module.exports = { sendTeammateReminders, outstandingEmail, nudgeEmail, REMINDER_INTERVAL_DAYS }
