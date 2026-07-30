import { defineConfig, devices } from '@playwright/test'

// Phase 1 E2E scope: local Supabase only, no real Stripe calls (see
// tests/e2e/README.md for why). Tests run against plain `vite dev` — no
// Netlify function is exercised for real, so `netlify dev` isn't needed here.
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // tests share one seeded local DB — avoid cross-test races
  workers: 1,
  retries: 0,
  reporter: 'list',
  globalSetup: './tests/e2e/global-setup.js',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
})
