import seed from './fixtures/seed.js'
import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default async function globalSetup() {
  const ids = await seed()
  // globalSetup runs in a different Node process from the test workers, so
  // the seeded ids can't be passed via module state — write them to a file
  // instead. See the comment in fixtures/seed.js for the full story.
  writeFileSync(join(__dirname, 'fixtures', 'seeded.json'), JSON.stringify(ids, null, 2))
}
