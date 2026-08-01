// Loads .env.test into process.env — shared by seed.js and any spec that
// needs local Supabase credentials directly (e.g. to call a Netlify
// function's handler in-process, or hit the local REST API with the
// request fixture). Each Playwright worker is its own Node process, so
// this needs to run again in every file that needs it — see the
// cross-process notes in seed.js.
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..', '..')

export function loadTestEnv() {
  const envFile = join(ROOT, '.env.test')
  if (existsSync(envFile)) {
    readFileSync(envFile, 'utf8').split('\n').forEach(line => {
      if (!line.trim() || line.trim().startsWith('#')) return
      const [key, ...rest] = line.split('=')
      if (key?.trim() && rest.length) process.env[key.trim()] = rest.join('=').trim()
    })
  }
}

export const ROOT_DIR = ROOT
