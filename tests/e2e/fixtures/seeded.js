// Reads the ids/credentials global-setup.js wrote after seed() ran. Safe to
// read synchronously at import time: Playwright guarantees globalSetup
// finishes before any worker process starts importing spec files.
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const { FREE_COMP_ID, PAID_COMP_ID, EXISTING_MEMBER_EMAIL, EXISTING_MEMBER_PASSWORD } =
  JSON.parse(readFileSync(join(__dirname, 'seeded.json'), 'utf8'))

export { FREE_COMP_ID, PAID_COMP_ID, EXISTING_MEMBER_EMAIL, EXISTING_MEMBER_PASSWORD }
