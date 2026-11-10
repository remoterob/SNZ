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
//          { adminToken, action: 'publish', id, record: { species, weight_kg,
//              divisions[], diver, club, date_caught, location } }
//              — approved or provisional applications only; a provisional
//                application publishes a provisional record. Later status
//                changes (provisional <-> approved) carry over to the record.
//              — creates the nz_records row, copies the "applicant with fish"
//                photo to records/<recordId>.jpg (so it survives the
//                application being deleted) and links it to the application.
//          { adminToken, action: 'unpublish', id } — deletes that record again

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

// Categories a record can stand in. Open / Women's / Junior U18 can be combined
// (one fish can hold all three); Meritorious and Natural History stand alone.
const COMBINABLE = ['Open', "Women's", 'Junior U18']
const SOLO = ['Meritorious', 'Natural History']

function cleanDivisions(list) {
  const picked = [...new Set((list || []).filter(d => COMBINABLE.includes(d) || SOLO.includes(d)))]
  const solo = picked.filter(d => SOLO.includes(d))
  if (solo.length) return solo.length === 1 && picked.length === 1 ? solo : null
  return COMBINABLE.filter(d => picked.includes(d))   // canonical order
}

const storagePath = (url) => url && (String(url).match(/snz-media\/(.+?)(\?|$)/) || [])[1]

async function removeRecordPhotos(recordId) {
  const exts = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'heic']
  await supabase.storage.from('snz-media').remove(exts.map(e => `records/${recordId}.${e}`))
}

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
        const { data: before } = await table().select('status,published_record_id').eq('id', body.id).maybeSingle()
        const { error } = await table().update(patch).eq('id', body.id)
        if (error) throw error
        // Keep a published record's provisional flag in step with the application.
        if (patch.status && before?.published_record_id && patch.status !== before.status
            && ['approved', 'provisional'].includes(patch.status)) {
          const prov = patch.status === 'provisional'
          const { error: recErr } = await supabase.from('nz_records')
            .update({ provisional: prov, provisional_since: prov ? new Date().toISOString() : null })
            .eq('id', before.published_record_id)
          if (recErr) console.error('record-applications-admin: provisional sync failed:', recErr.message)
        }
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

      case 'publish': {
        if (!body.id) return json(400, { error: 'id required' })
        const { data: app, error: getErr } = await table()
          .select('id,status,published_record_id,photo_applicant_with_fish').eq('id', body.id).maybeSingle()
        if (getErr) throw getErr
        if (!app) return json(404, { error: 'Application not found' })
        if (!['approved', 'provisional'].includes(app.status)) {
          return json(400, { error: 'Only approved or provisional applications can be published' })
        }
        const provisional = app.status === 'provisional'
        if (app.published_record_id) return json(409, { error: 'Already published' })

        const r = body.record || {}
        const divisions = cleanDivisions(r.divisions)
        if (!divisions || !divisions.length) {
          return json(400, { error: "Pick one or more of Open / Women's / Junior U18, or Meritorious or Natural History on its own" })
        }
        const weight = parseFloat(r.weight_kg)
        if (!String(r.species || '').trim()) return json(400, { error: 'Species is required' })
        if (!(weight > 0)) return json(400, { error: 'Weight is required' })

        const str = (v) => (v == null ? '' : String(v)).trim() || null
        const { data: rec, error: insErr } = await supabase.from('nz_records').insert({
          species: str(r.species),
          weight_kg: weight,
          divisions,
          division: divisions[0],
          diver: str(r.diver),
          club: str(r.club),
          date_caught: str(r.date_caught),
          location: str(r.location),
          verified: true,
          provisional,
          provisional_since: provisional ? new Date().toISOString() : null,
        }).select('id').single()
        if (insErr) throw insErr

        // Copy the hero photo into records/ so it doesn't depend on the application.
        let photoWarning = null
        const src = storagePath(app.photo_applicant_with_fish)
        if (src) {
          const dest = `records/${rec.id}.jpg`
          await removeRecordPhotos(rec.id)
          const { error: cpErr } = await supabase.storage.from('snz-media').copy(src, dest)
          if (cpErr) {
            photoWarning = 'Record published, but the photo could not be copied: ' + cpErr.message
            console.error('record-applications-admin publish: photo copy failed:', cpErr.message)
          } else {
            const { data: { publicUrl } } = supabase.storage.from('snz-media').getPublicUrl(dest)
            await supabase.from('nz_records').update({ photo_url: `${publicUrl}?t=${Date.now()}` }).eq('id', rec.id)
          }
        } else {
          photoWarning = 'Record published without a photo (no "applicant with fish" photo on the application).'
        }

        const { error: linkErr } = await table().update({ published_record_id: rec.id }).eq('id', body.id)
        if (linkErr) {
          // Roll back so we never leave an unlinked duplicate behind.
          await supabase.from('nz_records').delete().eq('id', rec.id)
          await removeRecordPhotos(rec.id)
          throw linkErr
        }
        return json(200, { ok: true, recordId: rec.id, warning: photoWarning })
      }

      case 'unpublish': {
        if (!body.id) return json(400, { error: 'id required' })
        const { data: app, error: getErr } = await table().select('published_record_id').eq('id', body.id).maybeSingle()
        if (getErr) throw getErr
        if (!app) return json(404, { error: 'Application not found' })
        if (app.published_record_id) {
          const recId = app.published_record_id
          const { error: delErr } = await supabase.from('nz_records').delete().eq('id', recId)
          if (delErr) throw delErr
          await removeRecordPhotos(recId)
        }
        await table().update({ published_record_id: null }).eq('id', body.id)
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
