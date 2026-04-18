// Netlify Function: send nationals partner invite / membership invite email
const { createClient } = require('@supabase/supabase-js')
const nodemailer = require('nodemailer')

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'mailx.freeparking.co.nz',
  port: parseInt(process.env.SMTP_PORT || '465'),
  secure: parseInt(process.env.SMTP_PORT || '465') === 465,
  auth: {
    user: process.env.SMTP_USER || 'president@spearfishingnz.co.nz',
    pass: process.env.SMTP_PASSWORD,
  },
  connectionTimeout: 8000,
  greetingTimeout: 8000,
  socketTimeout: 8000,
})

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  try {
    const {
      email,
      name,
      invitedBy,
      compName,
      teamName,
      teamId,
      nationals,
      isExistingMember,
      confirmUrl,
    } = JSON.parse(event.body)

    if (!email) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Email required' }) }
    }

    const origin = process.env.URL || 'https://spearfishingnz.netlify.app'
    const isNationals = !!nationals
    const confirmLink = confirmUrl || (teamId ? `${origin}/nationals/confirm?team=${teamId}` : `${origin}/membership/invited`)

    // Generate a magic link for sign-in — works for both new and existing users
    // For new users, this also creates their auth account
    let signInLink = confirmLink

    try {
      if (isExistingMember) {
        // Existing member — generate magic link so they sign in and land on confirm page
        const { data, error: linkError } = await supabase.auth.admin.generateLink({
          type: 'magiclink',
          email: email.trim().toLowerCase(),
          options: {
            redirectTo: confirmLink,
            data: { invited_by: invitedBy, comp_name: compName, team_name: teamName, team_id: teamId, nationals: isNationals },
          }
        })
        if (!linkError && data?.properties?.action_link) {
          signInLink = data.properties.action_link
        }
      } else {
        // New user — create invite link
        const { data, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
          email.trim().toLowerCase(),
          {
            redirectTo: confirmLink,
            data: { invited_by: invitedBy, comp_name: compName, team_name: teamName, team_id: teamId, nationals: isNationals },
          }
        )
        // If already exists, fall back to magic link
        if (inviteError) {
          const { data: mlData } = await supabase.auth.admin.generateLink({
            type: 'magiclink',
            email: email.trim().toLowerCase(),
            options: {
              redirectTo: confirmLink,
              data: { invited_by: invitedBy, comp_name: compName, team_name: teamName, team_id: teamId, nationals: isNationals },
            }
          })
          if (mlData?.properties?.action_link) {
            signInLink = mlData.properties.action_link
          }
        } else if (data?.properties?.action_link) {
          signInLink = data.properties.action_link
        }
      }
    } catch (linkErr) {
      console.error('Link generation error:', linkErr)
      // Continue with the confirm URL directly if link generation fails
    }

    // Build the email
    const isNationalsInvite = isNationals && teamId
    const subject = isNationalsInvite
      ? `You've been registered for SNZ Nationals 2027 — action required`
      : `You've been invited to join Spearfishing New Zealand`

    const membershipNote = isExistingMember
      ? `Your SNZ membership is already active.`
      : `You'll need to create your SNZ membership ($10/year) as part of this process.`

    const htmlBody = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
    <!-- Header -->
    <div style="background:#1e3a5f;padding:28px 32px;">
      <p style="margin:0;color:#ffffff;font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;">Spearfishing New Zealand</p>
      <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:900;">
        ${isNationalsInvite ? '🏆 Nationals 2027 — You\'ve been registered!' : '🤿 You\'ve been invited to join SNZ'}
      </h1>
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      ${isNationalsInvite ? `
      <p style="margin:0 0 16px;color:#374151;font-size:15px;">
        <strong>${invitedBy || 'Your dive partner'}</strong> has registered you as their partner for 
        <strong>${teamName || compName || 'SNZ Nationals 2027'}</strong>.
      </p>
      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px;margin:0 0 20px;">
        <p style="margin:0;color:#1e40af;font-size:13px;font-weight:bold;">📍 SNZ Nationals 2027</p>
        <p style="margin:4px 0 0;color:#1d4ed8;font-size:13px;">Tairua, Coromandel Peninsula · 19–24 January 2027</p>
      </div>
      <p style="margin:0 0 16px;color:#374151;font-size:14px;">
        To confirm your entry you need to:
      </p>
      <ol style="margin:0 0 20px;padding-left:20px;color:#374151;font-size:14px;line-height:1.8;">
        <li>Click the button below to sign in to SNZ</li>
        <li>Review your events and add any optional extras (merch, meal tickets)</li>
        <li>Pay your entry fee</li>
      </ol>
      <p style="margin:0 0 20px;color:#6b7280;font-size:13px;">${membershipNote}</p>
      ` : `
      <p style="margin:0 0 16px;color:#374151;font-size:15px;">
        <strong>${invitedBy || 'A fellow competitor'}</strong> has registered you as their dive partner${compName ? ` for <strong>${compName}</strong>` : ''}.
      </p>
      <p style="margin:0 0 20px;color:#374151;font-size:14px;">
        Click the button below to set up your SNZ membership and confirm your registration.
      </p>
      `}

      <!-- CTA Button -->
      <div style="text-align:center;margin:28px 0;">
        <a href="${signInLink}" 
           style="display:inline-block;background:#2B6CB0;color:#ffffff;font-size:15px;font-weight:900;text-decoration:none;padding:14px 32px;border-radius:10px;">
          ${isNationalsInvite ? 'Confirm My Entry →' : 'Set Up My Account →'}
        </a>
      </div>

      <p style="margin:0 0 8px;color:#9ca3af;font-size:12px;text-align:center;">
        This link expires in 24 hours. If it has expired, contact 
        <a href="mailto:president@spearfishingnz.co.nz" style="color:#2B6CB0;">president@spearfishingnz.co.nz</a>
      </p>
    </div>

    <!-- Footer -->
    <div style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e5e7eb;">
      <p style="margin:0;color:#9ca3af;font-size:12px;">
        Spearfishing New Zealand · <a href="https://spearfishingnz.co.nz" style="color:#6b7280;">spearfishingnz.co.nz</a>
      </p>
      <p style="margin:4px 0 0;color:#d1d5db;font-size:11px;">
        If you weren't expecting this email, you can safely ignore it.
      </p>
    </div>
  </div>
</body>
</html>
    `.trim()

    console.log(`Sending email to ${email} via ${process.env.SMTP_HOST || 'mailx.freeparking.co.nz'}:${process.env.SMTP_PORT || '465'}`)
    console.log(`SMTP user: ${process.env.SMTP_USER || 'president@spearfishingnz.co.nz'}`)
    console.log(`SMTP password set: ${!!process.env.SMTP_PASSWORD}`)

    const info = await transporter.sendMail({
      from: `"Spearfishing NZ" <${process.env.SMTP_USER || 'president@spearfishingnz.co.nz'}>`,
      to: email.trim().toLowerCase(),
      subject,
      html: htmlBody,
    })

    console.log('Email sent:', info.messageId, info.response)
    return { statusCode: 200, body: JSON.stringify({ sent: true, messageId: info.messageId }) }

  } catch (err) {
    console.error('Invite error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
