// Admin function: set a temporary password for a member
// Protected by the SNZ admin password
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  try {
    const { adminPassword, memberId, tempPassword } = JSON.parse(event.body)

    // Verify admin password
    if (adminPassword !== process.env.VITE_ADMIN_PASSWORD) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorised' }) }
    }

    if (!memberId || !tempPassword || tempPassword.length < 8) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Member ID and password (min 8 chars) required' }) }
    }

    // Update the user's password via service role
    const { error } = await supabase.auth.admin.updateUserById(memberId, {
      password: tempPassword,
    })

    if (error) throw error

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    }
  } catch (err) {
    console.error('Admin reset error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
