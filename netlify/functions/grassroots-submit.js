// Netlify Function: public "Want your club up here?" submission (Grassroots).
//
// grassroots_submissions has no public RLS policies (migration 045), so this
// function validates and inserts with the service-role key, then emails a
// confirmation to the club contact and a heads-up to SNZ. Footage arrives as
// YouTube links (unlisted is fine) — no file uploads.

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const RESEND_API_KEY = process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY
const FROM = '"Spearfishing NZ" <noreply@snzmail.teamaotea.com>'
const SNZ_INBOX = 'president@spearfishingnz.co.nz'
const SITE = 'https://spearfishingnz.netlify.app'

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

const clean = (v, max = 500) => String(v ?? '').trim().slice(0, max)
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
const isYouTube = (s) => /^https?:\/\/(www\.|m\.)?(youtube\.com|youtu\.be)\//i.test(s)

async function sendEmail(to, subject, html, replyTo) {
  if (!RESEND_API_KEY) { console.warn('grassroots-submit: no Resend key, skipping email'); return }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, reply_to: replyTo, to, subject, html }),
  })
  if (!res.ok) console.error('grassroots-submit: Resend', res.status, await res.text())
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' }

  let b
  try { b = JSON.parse(event.body || '{}') } catch { return json(400, { error: 'Bad request' }) }

  // Honeypot: real people never see or fill this field.
  if (clean(b.website_hp)) return json(200, { ok: true })

  const row = {
    club_id: Number.isInteger(b.club_id) ? b.club_id : null,
    club_name: clean(b.club_name, 120),
    contact_name: clean(b.contact_name, 120),
    contact_email: clean(b.contact_email, 200).toLowerCase(),
    contact_phone: clean(b.contact_phone, 40) || null,
    region: clean(b.region, 60) || null,
    town: clean(b.town, 80) || null,
    notes: clean(b.notes, 3000) || null,
    video_links: (Array.isArray(b.video_links) ? b.video_links : [])
      .map(l => clean(l, 300)).filter(Boolean).slice(0, 20),
  }

  if (!row.club_name) return json(400, { error: 'Club name is required' })
  if (!row.contact_name) return json(400, { error: 'Your name is required' })
  if (!isEmail(row.contact_email)) return json(400, { error: 'A valid email is required' })
  const bad = row.video_links.find(l => !isYouTube(l))
  if (bad) return json(400, { error: `That doesn't look like a YouTube link: ${bad}` })

  const { data, error } = await supabase.from('grassroots_submissions').insert(row).select('id').single()
  if (error) {
    console.error('grassroots-submit insert', error)
    return json(500, { error: 'Could not save your submission — please try again.' })
  }

  const links = row.video_links.length
    ? `<ul>${row.video_links.map(l => `<li><a href="${esc(l)}">${esc(l)}</a></li>`).join('')}</ul>`
    : '<p>No video links yet — that\'s fine, reply to this email with them when they\'re ready.</p>'

  await Promise.all([
    sendEmail(
      row.contact_email,
      `Grassroots Spearo — thanks from SNZ, ${row.club_name}`,
      `<p>Kia ora ${esc(row.contact_name)},</p>
       <p>Thanks for putting <strong>${esc(row.club_name)}</strong> forward for Grassroots Spearo. We've got your details.</p>
       <p><strong>What happens next</strong></p>
       <ol>
         <li>If you haven't already, film your interviews and footage using the <a href="${SITE}/grassroots/101">Grassroots 101 guide</a>.</li>
         <li>Upload the clips to YouTube (unlisted is fine) and send us the links — reply to this email.</li>
         <li>We'll review the footage, edit it into an episode, publish it, and add your club to the map.</li>
       </ol>
       <p><strong>Links you sent</strong></p>${links}
       <p>Any questions, just reply.</p>
       <p>Ngā mihi,<br/>Spearfishing New Zealand</p>`,
      SNZ_INBOX
    ),
    sendEmail(
      SNZ_INBOX,
      `New Grassroots submission: ${row.club_name}`,
      `<p><strong>${esc(row.club_name)}</strong>${row.town ? ` — ${esc(row.town)}` : ''}${row.region ? `, ${esc(row.region)}` : ''}</p>
       <p>${esc(row.contact_name)} · <a href="mailto:${esc(row.contact_email)}">${esc(row.contact_email)}</a>${row.contact_phone ? ` · ${esc(row.contact_phone)}` : ''}</p>
       ${row.notes ? `<p>${esc(row.notes).replace(/\n/g, '<br/>')}</p>` : ''}
       ${links}
       <p><a href="${SITE}/admin/grassroots">Open Grassroots admin</a></p>`,
      row.contact_email
    ),
  ])

  return json(200, { ok: true, id: data.id })
}
