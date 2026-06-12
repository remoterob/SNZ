// Netlify Function: manual backup trigger from the membership admin page.
// The scheduled run lives in daily-backup.js (scheduled functions cannot be
// invoked over HTTP, so the manual path needs its own endpoint).

const { runBackup } = require('./lib/backup')

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  try {
    const body = JSON.parse(event.body || '{}')
    if (body.adminPassword !== process.env.VITE_ADMIN_PASSWORD) {
      return { statusCode: 401, body: 'Unauthorised' }
    }
  } catch (e) {
    return { statusCode: 400, body: 'Bad request' }
  }

  try {
    const { memberCount, teamCount } = await runBackup()
    return { statusCode: 200, body: `Backup sent: ${memberCount} members, ${teamCount} teams` }
  } catch (err) {
    console.error('Backup error:', err)
    return { statusCode: 500, body: err.message }
  }
}
