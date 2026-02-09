import { test, expect } from "@playwright/test"

test("homepage visual baseline", async ({ page }) => {
  await page.goto("/")

  // Wait for page to load
  await page.waitForLoadState("networkidle")

  // Capture full page screenshot
  await expect(page).toHaveScreenshot("homepage.png", { fullPage: true })
})
