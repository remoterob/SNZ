import { test, expect } from '@playwright/test'
import { FREE_COMP_ID, EXISTING_MEMBER_EMAIL, EXISTING_MEMBER_PASSWORD } from './fixtures/seeded.js'

test('existing member registers solo for a free competition end to end', async ({ page }) => {
  const teamName = `E2E Solo Entry ${Date.now()}`

  // Sign in as the pre-seeded member
  await page.goto('/membership/login')
  await page.locator('input[name=email]').fill(EXISTING_MEMBER_EMAIL)
  await page.locator('input[name=password]').fill(EXISTING_MEMBER_PASSWORD)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await expect(page).toHaveURL(/\/membership\/dashboard/)

  await page.goto(`/competitions/${FREE_COMP_ID}/register`)

  // Name/email/phone/gender/dob/emergency contact/fit-to-dive are pre-filled
  // from the member profile — only skill level (not pre-filled) and the
  // team/display name need filling in.
  await page.getByTestId('comp-team-name').fill(teamName)
  await page.getByTestId('comp-member-1-skill-level').selectOption('Intermediate')
  await page.getByTestId('comp-rules-accepted').check()
  await page.getByTestId('comp-waiver-accepted').check()
  await page.getByTestId('comp-register-submit').click()

  await expect(page.getByRole('heading', { name: "You're in!" })).toBeVisible()
  await expect(page.getByText(teamName)).toBeVisible()
})
