import { test, expect } from '@playwright/test'

const PASSWORD = 'e2e-test-password-123'

test('brand-new user completes signup and reaches the dashboard', async ({ page }) => {
  const email = `e2e.signup.${Date.now()}@example.test`

  await page.goto('/membership/signup')

  // Step 1 — account
  await page.getByTestId('signup-email').fill(email)
  await page.getByTestId('signup-password').fill(PASSWORD)
  await page.getByTestId('signup-confirm-password').fill(PASSWORD)
  await page.getByTestId('signup-continue').click()

  // Step 2 — profile (name + fit-to-dive are the only JS-validated fields)
  await page.getByTestId('signup-name').fill('E2E Signup Test User')
  await page.getByTestId('signup-fit-to-dive').check()
  await page.getByTestId('signup-complete').click()

  // Success screen — not whitelisted, so fee isn't waived
  await expect(page.getByRole('heading', { name: 'Account created!' })).toBeVisible()
  await page.getByRole('button', { name: 'Sign In & Pay →' }).click()

  // Sign in
  await expect(page).toHaveURL(/\/membership\/login/)
  await page.locator('input[name=email]').fill(email)
  await page.locator('input[name=password]').fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign In' }).click()

  await expect(page).toHaveURL(/\/membership\/dashboard/)
})
