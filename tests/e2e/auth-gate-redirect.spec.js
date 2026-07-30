import { test, expect } from '@playwright/test'
import { FREE_COMP_ID } from './fixtures/seeded.js'

const PASSWORD = 'e2e-test-password-123'

// Regression test for the bug fixed on 2026-07-29: a signed-out user landing
// on a MemberAuthGate-protected page (e.g. a Nationals partner-invite link,
// or here a competition registration link) who needs to *sign up* rather
// than just sign in was dropped on /membership/dashboard after completing
// signup — never returned to the page that sent them there. See
// src/components/MemberAuthGate.jsx and src/pages/MembershipPage.jsx.
test('signup started from a gated registration link returns to that link, not the dashboard', async ({ page }) => {
  const email = `e2e.redirect.${Date.now()}@example.test`
  const registerPath = `/competitions/${FREE_COMP_ID}/register`
  const expectedRedirectQuery = `redirect=${encodeURIComponent(registerPath)}`

  await page.goto(registerPath)

  // Signed out — MemberAuthGate renders instead of the registration form
  await expect(page.getByTestId('authgate-signup-now')).toBeVisible()
  await page.getByTestId('authgate-signup-now').click()

  await expect(page).toHaveURL(new RegExp(`/membership/signup\\?${expectedRedirectQuery}$`))

  // Step 1 — account
  await page.getByTestId('signup-email').fill(email)
  await page.getByTestId('signup-password').fill(PASSWORD)
  await page.getByTestId('signup-confirm-password').fill(PASSWORD)
  await page.getByTestId('signup-continue').click()

  // Step 2 — profile
  await page.getByTestId('signup-name').fill('E2E Auth Redirect Test User')
  await page.getByTestId('signup-fit-to-dive').check()
  await page.getByTestId('signup-complete').click()

  await page.getByRole('button', { name: 'Sign In & Pay →' }).click()

  // Login should have inherited the redirect param too
  await expect(page).toHaveURL(new RegExp(`/membership/login\\?${expectedRedirectQuery}$`))
  await page.locator('input[name=email]').fill(email)
  await page.locator('input[name=password]').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign In' }).click()

  // The regression assertion: back on the registration page, signed in —
  // NOT /membership/dashboard.
  await expect(page).toHaveURL(new RegExp(`/competitions/${FREE_COMP_ID}/register$`))
  await expect(page.getByText('Signed in as E2E Auth Redirect Test User')).toBeVisible()
})
