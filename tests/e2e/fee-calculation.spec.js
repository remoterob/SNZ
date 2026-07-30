import { test, expect } from '@playwright/test'
import { PAID_COMP_ID, EXISTING_MEMBER_EMAIL, EXISTING_MEMBER_PASSWORD } from './fixtures/seeded.js'

// Verifies the fee/early-bird calculation in CompRegister.jsx without ever
// contacting Stripe: intercepts the browser's fetch to
// create-checkout-session and asserts the posted amount, then fulfils with
// a same-origin mock URL so useStripeCheckout's `window.location.href`
// redirect has somewhere real to land.
test('paid competition sends the correct early-bird amount to checkout', async ({ page }) => {
  const teamName = `E2E Fee Calc ${Date.now()}`

  await page.goto('/membership/login')
  await page.locator('input[name=email]').fill(EXISTING_MEMBER_EMAIL)
  await page.locator('input[name=password]').fill(EXISTING_MEMBER_PASSWORD)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await expect(page).toHaveURL(/\/membership\/dashboard/)

  await page.goto(`/competitions/${PAID_COMP_ID}/register`)
  await page.getByTestId('comp-team-name').fill(teamName)
  await page.getByTestId('comp-member-1-skill-level').selectOption('Intermediate')
  await page.getByTestId('comp-rules-accepted').check()
  await page.getByTestId('comp-waiver-accepted').check()
  await page.getByTestId('comp-register-submit').click()

  // "Almost there!" payment-required screen
  await expect(page.getByTestId('comp-pay-now')).toBeVisible()
  await expect(page.getByTestId('comp-pay-now')).toContainText('$40.00')

  const checkoutRequest = page.waitForRequest('**/create-checkout-session')
  await page.route('**/create-checkout-session', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ url: page.url() }) })
  )
  await page.getByTestId('comp-pay-now').click()

  const request = await checkoutRequest
  const body = request.postDataJSON()
  expect(body.amountCents).toBe(4000) // early_bird tier (4000), not standard (5000)
  expect(body.lineItems).toBeUndefined() // single line item — CompRegister omits lineItems in that case
})
