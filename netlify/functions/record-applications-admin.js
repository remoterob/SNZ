// Netlify Function: admin access to national record applications.
//
// record_applications holds applicants' personal details (address, phone,
// DOB). Under RLS (migration 042) the browser can only insert and edit its own
// draft, so Records Admin reads and changes applications through here, gated
// by the admin token (lib/adminAuth.js) and using the service role.
//
// Request: { adminToken, action: 'list' }
//          { adminToken, action: 'get',    id }
//          { adminToken, action: 'update', id, patch: { status?, admin_notes? } }
//          { adminToken, action: 'delete', id }   — also removes its photos

const { createClient } = require('@supabase/supabase-js')
const { requireAdmin } = require('./lib/adminAuth')

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
})

const PHOTO_KEYS = [
  'photo_applicant_with_fish', 'photo_applicant_on_scales', 'photo_fish_on_scales',
  'photo_species_diagnostic', 'photo_length_under', 'photo_height',
  'photo_length_over', 'photo_girth', 'photo_scales_sticker',
]
const PATCHABLE = ['status', 'admin_notes']

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' }

  let body
  try { body = JSON.parse(event.body || '{}') } catch { return json(400, { error: 'Bad request' }) }

  if (!requireAdmin(event, body)) return json(401, { error: 'Unauthorised' })

  const table = () => supabase.from('record_applications')

  try {
    switch (body.action) {
      case 'list': {
        const { data, error } = await table().select('*').order('submitted_at', { ascending: false })
        if (error) throw error
        return json(200, { rows: data || [] })
      }

      case 'get': {
        const { data, error } = await table().select('*').eq('id', body.id).maybeSingle()
        if (error) throw error
        if (!data) return json(404, { error: 'Not found' })
        return json(200, { row: data })
      }

      case 'update': {
        const patch = Object.fromEntries(
          Object.entries(body.patch || {}).filter(([k]) => PATCHABLE.includes(k))
        )
        if (!body.id || !Object.keys(patch).length) return json(400, { error: 'Nothing to update' })
        const { error } = await table().update(patch).eq('id', body.id)
        if (error) throw error
        return json(200, { ok: true })
      }

      case 'delete': {
        if (!body.id) return json(400, { error: 'id required' })
        const { data: app, error: getErr } = await table().select(PHOTO_KEYS.join(',')).eq('id', body.id).maybeSingle()
        if (getErr) throw getErr
        if (app) {
          const paths = PHOTO_KEYS
            .map(k => app[k] && (app[k].match(/snz-media\/(.+?)(\?|$)/) || [])[1])
            .filter(Boolean)
          // Also sweep the application's folder, in case a photo was replaced
          // under a different extension and the row only points at the latest.
          const { data: listed } = await supabase.storage.from('snz-media').list(`applications/${body.id}`)
          for (const f of listed || []) paths.push(`applications/${body.id}/${f.name}`)
          const unique = [...new Set(paths)]
          if (unique.length) {
            const { error: rmErr } = await supabase.storage.from('snz-media').remove(unique)
            if (rmErr) console.error('record-applications-admin: photo removal failed:', rmErr.message)
          }
        }
        const { error } = await table().delete().eq('id', body.id)
        if (error) throw error
        return json(200, { ok: true })
      }

      default:
        return json(400, { error: 'Unknown action' })
    }
  } catch (err) {
    console.error('record-applications-admin error:', err)
    return json(500, { error: err.message })
  }
}
