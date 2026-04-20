// One-time migration script for Fish ID species data
// Run once from your local machine: node seed_fish_species.js
//
// Requirements:
//   - Node 18+ (for built-in fetch)
//   - npm install @supabase/supabase-js adm-zip
//   - species_info.json in same folder
//   - fish.zip (hero photos) in same folder
//   - claims.csv (Fish Bingo user photos CSV export) in same folder
//
// Environment variables (set before running):
//   SNZ_SUPABASE_URL, SNZ_SERVICE_KEY     — your SNZ Hub Supabase
//   FB_SUPABASE_URL, FB_SERVICE_KEY       — Fish Bingo Supabase (for downloading user photos)

const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')
const AdmZip = require('adm-zip')

// ── Config ────────────────────────────────────────────────────────────────────
const SNZ_URL = process.env.SNZ_SUPABASE_URL
const SNZ_KEY = process.env.SNZ_SERVICE_KEY
const FB_URL = process.env.FB_SUPABASE_URL
const FB_KEY = process.env.FB_SERVICE_KEY
const BUCKET = 'fish-species-photos'
const JSON_FILE = path.join(__dirname, 'species_info.json')
const ZIP_FILE = path.join(__dirname, 'fish.zip')
const CLAIMS_CSV = path.join(__dirname, 'claims.csv')

if (!SNZ_URL || !SNZ_KEY) {
  console.error('❌ Set SNZ_SUPABASE_URL and SNZ_SERVICE_KEY env vars')
  process.exit(1)
}

const snz = createClient(SNZ_URL, SNZ_KEY)
const fb = FB_URL && FB_KEY ? createClient(FB_URL, FB_KEY) : null

// ── Entries to skip (Fish Bingo tasks, not species) ──────────────────────────
const SKIP_ENTRIES = new Set([
  'Perform a rescue', 'Share 3 dishes', 'Take a beginner out',
])

// ── Size-variant merges: { variant: baseSpecies } ────────────────────────────
const MERGE_INTO = {
  'Kingfish over 15kg': 'Kingfish',
  'Kingfish over 30kg': 'Kingfish',
  'Snapper over 5 kg': 'Snapper',
  'Snapper over 10kg': 'Snapper',
  'Trevally over 3kg': 'Trevally',
}

// ── Normalize a name/slug/filename to a common key for matching ──────────────
const norm = (s) => (s || '').toLowerCase().replace(/[-\s_]+/g, '').replace(/\.[a-z]+$/, '')

// ── Helpers ──────────────────────────────────────────────────────────────────
function stripPrefix(tips, name) {
  // JSON tips often start with "SpeciesName: ..." — strip it
  const pattern = new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[:\\-]\\s*`, 'i')
  return tips.replace(pattern, '').trim()
}

function contentTypeFor(filename) {
  const ext = path.extname(filename).toLowerCase()
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg'
  if (ext === '.png') return 'image/png'
  if (ext === '.gif') return 'image/gif'
  if (ext === '.webp') return 'image/webp'
  return 'application/octet-stream'
}

async function uploadBuffer(storagePath, buffer, contentType) {
  const { error } = await snz.storage.from(BUCKET).upload(storagePath, buffer, {
    contentType, upsert: true,
  })
  if (error) throw error
  const { data } = snz.storage.from(BUCKET).getPublicUrl(storagePath)
  return data.publicUrl
}

function parseCsv(text) {
  // Minimal CSV parser for this specific file — handles quoted + unquoted
  const lines = text.split(/\r?\n/).filter(Boolean)
  const headers = lines[0].split(',')
  return lines.slice(1).map(line => {
    const vals = []
    let cur = '', inQ = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"' && !inQ) inQ = true
      else if (c === '"' && inQ) { if (line[i+1] === '"') { cur += '"'; i++ } else inQ = false }
      else if (c === ',' && !inQ) { vals.push(cur); cur = '' }
      else cur += c
    }
    vals.push(cur)
    return Object.fromEntries(headers.map((h, i) => [h.trim(), vals[i] || '']))
  })
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🚀 Fish ID migration starting\n')

  // ── 1. Load JSON ────────────────────────────────────────────────────────────
  const speciesJson = JSON.parse(fs.readFileSync(JSON_FILE, 'utf8'))
  console.log(`📖 Loaded ${Object.keys(speciesJson).length} entries from species_info.json`)

  // Build canonical species list — skip tasks, merge variants
  const canonical = {}
  for (const [name, info] of Object.entries(speciesJson)) {
    if (SKIP_ENTRIES.has(name)) continue
    const targetName = MERGE_INTO[name] || name
    if (!canonical[targetName]) {
      canonical[targetName] = { tips: '', variantTips: [] }
    }
    const cleanedTips = stripPrefix(info.tips || '', name)
    if (MERGE_INTO[name]) {
      canonical[targetName].variantTips.push({ label: name, text: cleanedTips })
    } else {
      canonical[targetName].tips = cleanedTips
    }
  }

  // Combine variant tips into the base species tips
  for (const species of Object.values(canonical)) {
    if (species.variantTips.length > 0) {
      const extras = species.variantTips.map(v => `\n\n**${v.label}:** ${v.text}`).join('')
      species.tips = (species.tips || '') + extras
    }
    delete species.variantTips
  }

  console.log(`✅ ${Object.keys(canonical).length} canonical species after merging variants\n`)

  // ── 2. Extract zip and upload hero photos ───────────────────────────────────
  console.log('📦 Processing hero photos from fish.zip…')
  const zip = new AdmZip(ZIP_FILE)
  const zipEntries = zip.getEntries()

  // Map: normalized filename → { buffer, filename }
  const heroPhotos = {}
  for (const e of zipEntries) {
    if (e.isDirectory) continue
    const name = path.basename(e.entryName)
    const normKey = norm(name)
    heroPhotos[normKey] = { buffer: e.getData(), filename: name }
  }
  console.log(`✅ Extracted ${Object.keys(heroPhotos).length} files from zip\n`)

  // ── 3. Insert species + hero photos ─────────────────────────────────────────
  console.log('🐟 Inserting species and uploading hero photos…')
  const speciesMap = {} // { commonName: species_id }

  for (const [commonName, { tips }] of Object.entries(canonical)) {
    process.stdout.write(`  ${commonName}… `)

    // Upsert species
    const { data: existing } = await snz.from('fish_species')
      .select('id').eq('common_name', commonName).maybeSingle()

    let speciesId
    if (existing) {
      const { error } = await snz.from('fish_species')
        .update({ tips }).eq('id', existing.id)
      if (error) { console.log(`⚠️ update failed: ${error.message}`); continue }
      speciesId = existing.id
    } else {
      const { data, error } = await snz.from('fish_species')
        .insert({ common_name: commonName, tips }).select('id').single()
      if (error) { console.log(`⚠️ insert failed: ${error.message}`); continue }
      speciesId = data.id
    }
    speciesMap[commonName] = speciesId

    // Try to find hero photo in zip
    const heroKey = norm(commonName)
    const hero = heroPhotos[heroKey]
    if (hero) {
      // Upload and link as hero (skip if already exists)
      const storagePath = `hero/${heroKey}${path.extname(hero.filename)}`
      try {
        const publicUrl = await uploadBuffer(storagePath, hero.buffer, contentTypeFor(hero.filename))
        // Delete any existing hero for this species, then insert new one
        await snz.from('fish_species_photos')
          .delete().eq('species_id', speciesId).eq('is_hero', true)
        await snz.from('fish_species_photos').insert({
          species_id: speciesId,
          photo_url: publicUrl,
          is_hero: true,
          sort_order: 0,
        })
        console.log('✓ with hero')
      } catch (err) {
        console.log(`⚠️ hero upload failed: ${err.message}`)
      }
    } else {
      console.log('(no hero photo)')
    }

    // Also upload any size-variant photos as additional non-hero photos
    // e.g. kingfish-over-15kg.jpg → extra photo on Kingfish
    const variantPhotos = Object.entries(heroPhotos).filter(([key]) => {
      if (key === heroKey) return false
      // Check if this variant image belongs to this species
      // e.g. "kingfishover15kg" starts with "kingfish"
      return key.startsWith(heroKey) && key.length > heroKey.length
    })
    for (const [vKey, v] of variantPhotos) {
      const vPath = `hero-variants/${vKey}${path.extname(v.filename)}`
      try {
        const publicUrl = await uploadBuffer(vPath, v.buffer, contentTypeFor(v.filename))
        await snz.from('fish_species_photos').insert({
          species_id: speciesId,
          photo_url: publicUrl,
          caption: vKey.replace(heroKey, '').replace(/([A-Z])/g, ' $1').trim(),
          is_hero: false,
          sort_order: 10,
        })
      } catch (err) { /* silent */ }
    }
  }

  // ── 4. Migrate Fish Bingo user catch photos ────────────────────────────────
  if (!fs.existsSync(CLAIMS_CSV)) {
    console.log('\n⚠️ claims.csv not found — skipping user photo migration.')
    console.log('   Re-run with claims.csv present to pull Fish Bingo photos later.\n')
    console.log('🎉 Done (partial)')
    return
  }

  console.log('\n📸 Migrating Fish Bingo user catch photos…')
  const claims = parseCsv(fs.readFileSync(CLAIMS_CSV, 'utf8'))
  console.log(`   Found ${claims.length} claims in CSV`)

  // Build lookup: normalized slug/name → species_id
  const lookup = {}
  for (const [name, id] of Object.entries(speciesMap)) {
    lookup[norm(name)] = id
  }

  let uploaded = 0, skipped = 0, failed = 0
  for (const claim of claims) {
    const { species_slug, photo_url, id: claimId } = claim
    if (!photo_url || !species_slug) { skipped++; continue }

    const key = norm(species_slug)
    const speciesId = lookup[key]
    if (!speciesId) {
      // Check size-variant merges (e.g. "snapper-over-10kg" → "Snapper")
      let merged = null
      for (const [variant, base] of Object.entries(MERGE_INTO)) {
        if (norm(variant) === key) { merged = lookup[norm(base)]; break }
      }
      if (!merged) { skipped++; continue }
    }
    const targetSpeciesId = lookup[key] || Object.entries(MERGE_INTO)
      .find(([v]) => norm(v) === key)?.[1] && lookup[norm(Object.entries(MERGE_INTO).find(([v]) => norm(v) === key)[1])]

    if (!targetSpeciesId) { skipped++; continue }

    try {
      // Download from Fish Bingo (just fetch the public URL)
      const imgRes = await fetch(photo_url)
      if (!imgRes.ok) { failed++; continue }
      const buffer = Buffer.from(await imgRes.arrayBuffer())
      const ext = path.extname(new URL(photo_url).pathname) || '.jpg'
      const storagePath = `catches/${claimId}${ext}`
      const publicUrl = await uploadBuffer(storagePath, buffer, contentTypeFor(ext))

      await snz.from('fish_species_photos').insert({
        species_id: targetSpeciesId,
        photo_url: publicUrl,
        is_hero: false,
        sort_order: 20,
      })
      uploaded++
      process.stdout.write('.')
    } catch (err) {
      failed++
    }
  }

  console.log(`\n\n✅ Uploaded ${uploaded} user photos · ${skipped} skipped · ${failed} failed`)
  console.log('\n🎉 Migration complete')
}

main().catch(err => { console.error('💥', err); process.exit(1) })
