// Netlify Scheduled Function: daily member + registration backup via email
// Runs at 6am NZT (6pm UTC) every day
// Schedule: "0 18 * * *"

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

exports.handler = async (event) => {
  // Support both scheduled invocation and manual POST from admin
  if (event?.httpMethod === 'POST') {
    try {
      const body = JSON.parse(event.body || '{}')
      if (body.adminPassword !== process.env.VITE_ADMIN_PASSWORD) {
        return { statusCode: 401, body: 'Unauthorised' }
      }
    } catch(e) {
      return { statusCode: 400, body: 'Bad request' }
    }
  }
  try {
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
    return { statusCode: 200, body: 'Backup sent' }

  } catch (err) {
    console.error('Backup error:', err)
    return { statusCode: 500, body: err.message }
  }
}
