import { test, expect } from '@playwright/test'

// Browser test of the form's conditional-field logic (brief section
// "Conditional logic"): not_reported_reasons only appears once
// reported_to includes not_reported; report_outcome only once a formal
// channel is selected; contact_email only for named/confidential consent.
test('conditional fields show and hide correctly', async ({ page }) => {
  await page.goto('/near-miss')

  // Step 1
  await page.getByTestId('opt-time_band-last_month').click()
  await page.getByTestId('field-region').selectOption('Auckland – Hauraki Gulf')
  await page.getByTestId('field-location-name').fill('Conditional fields test location')
  await page.getByTestId('opt-distance_from_shore-under_50m').click()
  await page.getByTestId('step-continue').click()

  // Step 2
  await page.getByTestId('opt-outcome-close_pass').click()
  await page.getByTestId('opt-closest_distance-5_10m').click()
  await page.getByTestId('opt-vessel_speed-planing').click()
  await page.getByTestId('opt-diver_position-surface_resting').click()
  await page.getByTestId('step-continue').click()

  // Step 3
  await page.getByTestId('opt-visibility_gear-flag_float').click()
  await page.getByTestId('opt-vessel_saw_you-no_reaction').click()
  await page.getByTestId('opt-vessel_type-trailer_under_6m').click()
  await page.getByTestId('step-continue').click()

  // Step 4 — conditional logic under test
  await expect(page.getByTestId('block-not-reported-reasons')).not.toBeVisible()
  await expect(page.getByTestId('block-report-outcome')).not.toBeVisible()

  await page.getByTestId('opt-reported_to-not_reported').click()
  await expect(page.getByTestId('block-not-reported-reasons')).toBeVisible()
  await expect(page.getByTestId('block-report-outcome')).not.toBeVisible()

  // Selecting a formal channel is mutually exclusive with not_reported —
  // should flip which conditional block shows.
  await page.getByTestId('opt-reported_to-harbourmaster').click()
  await expect(page.getByTestId('block-not-reported-reasons')).not.toBeVisible()
  await expect(page.getByTestId('block-report-outcome')).toBeVisible()

  await page.getByTestId('opt-report_outcome-nothing').click()
  await page.getByTestId('opt-injury_level-none').click()
  await page.getByTestId('step-continue').click()

  // Step 5 — contact_email only for named/confidential consent
  await expect(page.getByTestId('block-contact-email')).not.toBeVisible()
  await page.getByTestId('opt-contact_consent-anonymous').click()
  await expect(page.getByTestId('block-contact-email')).not.toBeVisible()
  await page.getByTestId('opt-contact_consent-named').click()
  await expect(page.getByTestId('block-contact-email')).toBeVisible()
})
