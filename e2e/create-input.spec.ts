import { test, expect } from "@playwright/test"

test("create workflow name input accepts typing", async ({ page }) => {
  await page.goto("/")
  await expect(page.locator("text=Create your first workflow")).toBeVisible({ timeout: 15_000 })
  await page.locator("button[aria-label='Create workflow']").click()
  const input = page.locator('input[placeholder="e.g. Character Assets"]')
  await expect(input).toBeVisible({ timeout: 5_000 })
  await input.fill("My Test Workflow")
  await expect(input).toHaveValue("My Test Workflow")
})
