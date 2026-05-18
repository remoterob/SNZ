// Admin function: mark a member as active/paid using service role key (bypasses RLS)
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
    const { adminPassword, memberId } = JSON.parse(event.body)

    if (adminPassword !== process.env.VITE_ADMIN_PASSWORD) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorised' }) }
    }
    if (!memberId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Member ID required' }) }
    }

    const { error } = await supabase.from('members').update({
      payment_status: 'paid',
      membership_status: 'active',
      paid_at: new Date().toISOString(),
    }).eq('id', memberId)

    if (error) throw error
    return { statusCode: 200, body: JSON.stringify({ success: true }) }
  } catch (err) {
    console.error('Admin activate error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
