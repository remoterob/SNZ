// Shared backup logic — used by daily-backup (scheduled) and run-backup
// (manual trigger from the membership admin page).
// Lives in lib/ so Netlify doesn't deploy it as a function of its own.

const { createClient } = require('@supabase/supabase-js')
const nodemailer = require('nodemailer')

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const transporter = nodemailer.createTransport({
  host: 'mailx.freeparking.co.nz',
  port: 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,     // president@spearfishingnz.co.nz
    pass: process.env.SMTP_PASSWORD, // Freeparking email password
  }
})

function toCSV(rows, headers) {
  const esc = v => {
    const s = String(v == null ? '' : v)
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [headers.join(',')]
  rows.forEach(row => lines.push(headers.map(h => esc(row[h])).join(',')))
  return lines.join('\n')
}

// Alert Blair to any national record applications submitted, or Big Fish
// entries logged, in the ~24h since the last daily backup. Sends nothing when
// there are none. Runs as part of the backup so it never blocks it (failures
// here are caught by the caller in runBackup).
async function notifyNewSubmissions(now) {
  const RECIPIENT = 'Blair.Herbert@gmail.com'
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()

  const [{ data: records }, { data: bigfish }] = await Promise.all([
    supabase
      .from('record_applications')
      .select('full_name, common_name, app_type, weight_kg, submitted_at')
      .eq('status', 'submitted')
      .gte('submitted_at', cutoff)
      .order('submitted_at', { ascending: false }),
    supabase
      .from('bigfish_entries')
      .select('display_name, species, weight_kg, length_cm, created_at')
      .gte('created_at', cutoff)
      .order('created_at', { ascending: false }),
  ])

  const recs = records || []
  const bf = bigfish || []
  if (recs.length === 0 && bf.length === 0) {
    console.log('No new record/big-fish submissions in the last 24h — no alert sent')
    return { records: 0, bigfish: 0 }
  }

  const dateStr = now.toLocaleDateString('en-NZ', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Pacific/Auckland'
  })

  const lines = [`New submissions in the 24 hours to ${dateStr}:`, '']
  if (recs.length) {
    lines.push(`🏆 National record applications (${recs.length}):`)
    recs.forEach(r => lines.push(
      `  • ${r.full_name || 'Unknown'} — ${r.common_name || 'species?'}` +
      `${r.weight_kg ? `, ${r.weight_kg} kg` : ''}${r.app_type ? ` (${r.app_type} record)` : ''}`
    ))
    lines.push('  Review: https://spearfishingnz.netlify.app/records/admin', '')
  }
  if (bf.length) {
    lines.push(`🐟 Big Fish entries (${bf.length}):`)
    bf.forEach(e => lines.push(
      `  • ${e.display_name || 'Unknown'} — ${e.species || 'species?'}` +
      `${e.weight_kg ? `, ${e.weight_kg} kg` : ''}${e.length_cm ? `, ${e.length_cm} cm` : ''}`
    ))
    lines.push('  Review: https://spearfishingnz.netlify.app/admin/big-fish', '')
  }
  lines.push('— Spearfishing New Zealand (automated daily alert)')

  const parts = []
  if (recs.length) parts.push(`${recs.length} record application${recs.length !== 1 ? 's' : ''}`)
  if (bf.length) parts.push(`${bf.length} Big Fish ${bf.length !== 1 ? 'entries' : 'entry'}`)

  await transporter.sendMail({
    from: '"Spearfishing NZ" <president@spearfishingnz.co.nz>',
    to: RECIPIENT,
    subject: `SNZ — new submissions: ${parts.join(' & ')} (${dateStr})`,
    text: lines.join('\n'),
  })
  console.log(`Submission alert sent to ${RECIPIENT}: ${recs.length} records, ${bf.length} big fish`)
  return { records: recs.length, bigfish: bf.length }
}

async function runBackup() {
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-NZ', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Pacific/Auckland'
  })

  // ── Members CSV ──────────────────────────────────────────────────────────
  const { data: members, error: mErr } = await supabase
    .from('members')
    .select('member_number, name, email, phone, club, gender, dob, region, experience, emergency_contact, emergency_phone, membership_status, payment_status, membership_fee_cents, paid_at, created_at')
    .order('member_number')
  if (mErr) throw mErr

  const memberCSV = toCSV(members, [
    'member_number','name','email','phone','club','gender','dob',
    'region','experience','emergency_contact','emergency_phone',
    'membership_status','payment_status','membership_fee_cents','paid_at','created_at'
  ])

  // ── Competition Registrations CSV ─────────────────────────────────────────
  const { data: teams, error: tErr } = await supabase
    .from('comp_teams')
    .select(`
      id, team_name, category, status, payment_status, paid_at,
      competition:competitions(name, date_start, club_name),
      d1:members!comp_teams_diver1_member_id_fkey(name, email, member_number),
      d2:members!comp_teams_diver2_member_id_fkey(name, email, member_number)
    `)
    .neq('status', 'withdrawn')
    .order('id')
  if (tErr) throw tErr

  const teamRows = (teams || []).map(t => ({
    competition: t.competition?.name || '',
    date: t.competition?.date_start || '',
    club: t.competition?.club_name || '',
    team_name: t.team_name,
    category: t.category,
    status: t.status,
    payment_status: t.payment_status,
    paid_at: t.paid_at || '',
    diver1_name: t.d1?.name || '',
    diver1_email: t.d1?.email || '',
    diver1_number: t.d1?.member_number || '',
    diver2_name: t.d2?.name || '',
    diver2_email: t.d2?.email || t.diver2_email || '',
    diver2_number: t.d2?.member_number || '',
    registered: t.paid_at || '',
  }))

  const teamsCSV = toCSV(teamRows, [
    'competition','date','club','team_name','category','status','payment_status',
    'paid_at','diver1_name','diver1_email','diver1_number',
    'diver2_name','diver2_email','diver2_number','registered'
  ])

  // ── Send email ────────────────────────────────────────────────────────────
  const memberCount = members?.length || 0
  const teamCount = teamRows.length
  const paidCount = members?.filter(m => m.payment_status === 'paid').length || 0

  await transporter.sendMail({
    from: '"Spearfishing NZ" <president@spearfishingnz.co.nz>',
    to: 'secretary@spearfishingnz.co.nz',
    subject: `SNZ Daily Backup — ${dateStr}`,
    text: [
      `SNZ Hub Daily Backup — ${dateStr}`,
      '',
      `Members: ${memberCount} total, ${paidCount} active/paid`,
      `Competition registrations: ${teamCount} active teams`,
      '',
      'Two CSV files are attached:',
      '  1. snz-members.csv — full member register',
      '  2. snz-registrations.csv — all competition entries',
      '',
      'These files are also stored in Supabase with automatic 7-day rolling backups.',
      '',
      'Spearfishing New Zealand',
      'spearfishingnz.netlify.app',
    ].join('\n'),
    attachments: [
      {
        filename: `snz-members-${now.toISOString().slice(0,10)}.csv`,
        content: memberCSV,
        contentType: 'text/csv',
      },
      {
        filename: `snz-registrations-${now.toISOString().slice(0,10)}.csv`,
        content: teamsCSV,
        contentType: 'text/csv',
      },
    ],
  })

  console.log(`Backup sent: ${memberCount} members, ${teamCount} teams`)

  // Alert Blair to any new record/big-fish submissions. Isolated so a failure
  // here never fails the backup itself.
  let alerts = { records: 0, bigfish: 0 }
  try {
    alerts = await notifyNewSubmissions(now)
  } catch (err) {
    console.error('Submission alert failed (backup still succeeded):', err)
  }

  return { memberCount, teamCount, ...alerts }
}

module.exports = { runBackup }
