// Netlify Function: fully delete a member account
// Deletes from members table + auth.users via service role
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
    const { userId } = JSON.parse(event.body)
    if (!userId) return { statusCode: 400, body: JSON.stringify({ error: 'userId required' }) }

    // Delete related data first
    await supabase.from('member_competitions').delete().eq('member_id', userId)
    
    // Remove as diver from any comp teams (set to null rather than delete the team)
    await supabase.from('comp_teams').update({ 
      diver1_member_id: null 
    }).eq('diver1_member_id', userId)
    await supabase.from('comp_teams').update({ 
      diver2_member_id: null 
    }).eq('diver2_member_id', userId)

    // Get email before deleting auth user
    const { data: { user } } = await supabase.auth.admin.getUserById(userId)
    const email = user?.email

    // Delete auth user first
    const { error } = await supabase.auth.admin.deleteUser(userId)
    if (error) throw error

    // Delete member profile by both id and email to catch all cases
    if (email) await supabase.from('members').delete().eq('email', email)
    await supabase.from('members').delete().eq('id', userId)

    return { statusCode: 200, body: JSON.stringify({ success: true }) }
  } catch (err) {
    console.error('Delete account error:', err)
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) }
  }
}
