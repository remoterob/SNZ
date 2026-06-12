// Netlify Scheduled Function: daily member + registration backup via email
// Runs at 18:00 UTC daily (6am NZST / 7am NZDT).
//
// The schedule is declared in code with the schedule() wrapper — the
// netlify.toml [functions."daily-backup"] schedule was never registered by
// Netlify (deployed function metadata showed schedule: null), so the cron
// never fired. Scheduled functions cannot be invoked over HTTP; the manual
// admin trigger lives in run-backup.js.

const { schedule } = require('@netlify/functions')
const { runBackup } = require('./lib/backup')

exports.handler = schedule('0 18 * * *', async () => {
  try {
    const { memberCount, teamCount } = await runBackup()
    console.log(`Scheduled backup complete: ${memberCount} members, ${teamCount} teams`)
    return { statusCode: 200 }
  } catch (err) {
    console.error('Scheduled backup failed:', err)
    return { statusCode: 500 }
  }
})
