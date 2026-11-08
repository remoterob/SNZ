// Netlify Function: exchange an admin password for a signed admin token.
//
// Request:  { password }
// Response: { token, scopes } on success, 401 otherwise.
//
// Passwords are compared server-side against SNZ_*_ADMIN_PASSWORD env vars
// (see lib/adminAuth.js). They are never shipped to the browser.

const { scopesForPassword, issueToken } = require('./lib/adminAuth')

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
})

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' }

  let body
  try { body = JSON.parse(event.body || '{}') } catch { return json(400, { error: 'Bad request' }) }

  // Flat delay on every attempt — blunts online guessing without state.
  await new Promise(r => setTimeout(r, 500))

  try {
    const scopes = scopesForPassword(typeof body.password === 'string' ? body.password : '')
    if (!scopes.length) return json(401, { error: 'Invalid password' })
    return json(200, { token: issueToken(scopes), scopes })
  } catch (err) {
    console.error('admin-login error:', err.message)
    return json(500, { error: 'Admin login is not configured' })
  }
}
