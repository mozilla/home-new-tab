import { test, expect } from "@playwright/test"

test("app loads without errors", async ({ page }) => {
  await page.goto("/")

  // Verify page loads
  await expect(page).toHaveTitle(/HNT/)

  // Verify timer is visible (checking for any timer-related element)
  const timerExists =
    (await page.locator('[data-testid="timer"]').count()) > 0 ||
    (await page.locator('article[class*="timer"]').count()) > 0

  expect(timerExists).toBe(true)
})
