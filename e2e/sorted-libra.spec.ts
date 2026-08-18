import { test, expect } from "@playwright/test"
import * as fs from "fs"
import * as path from "path"

function makeInputDir() {
  const dir = path.join(process.cwd(), "e2e", "fixtures", "sorted-input")
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
  fs.mkdirSync(dir, { recursive: true })
  for (const name of [
    "hero_01.usda",
    "hero_02.usda",
    "prop_table.usda",
    "prop_chair.usda",
    "misc.usda",
  ]) {
    fs.writeFileSync(path.join(dir, name), '#usda 1.0\n(\n    defaultPrim = "Asset"\n)')
  }
  for (const stem of ["hero_01", "hero_02", "prop_table", "prop_chair", "misc"]) {
    for (const suffix of ["_BaseColor.png", "_Normal.png", "_ORM.png"]) {
      fs.writeFileSync(
        path.join(dir, `${stem}${suffix}`),
        Buffer.from("\x89PNG\r\n\x1a\n" + "\x00".repeat(24))
      )
    }
  }
  // Prepare a chr file that should also land in Heroes (second condition)
  fs.writeFileSync(path.join(dir, "chr_01.usda"), '#usda 1.0\n(\n    defaultPrim = "Asset"\n)')
  for (const suffix of ["_BaseColor.png", "_Normal.png", "_ORM.png"]) {
    fs.writeFileSync(
      path.join(dir, `chr_01${suffix}`),
      Buffer.from("\x89PNG\r\n\x1a\n" + "\x00".repeat(24))
    )
  }

  return dir
}

test("sorted Libra pipeline groups assets into named batches", async ({ page }) => {
  test.setTimeout(120_000)
  const wfId = "b60511e1-ba07-4623-9979-bce25de10bf5"
  const workflow = {
    id: wfId,
    name: "Sorted-Libra-Test",
    type: "bulk",
    sorting: "Sorted",
    listed: [
      {
        id: "rule-1",
        directory: "Heroes",
        conditions: [{ id: "cond-1", regexType: "contains", value: "hero" }],
      },
      {
        id: "rule-2",
        directory: "Props",
        conditions: [{ id: "cond-2", regexType: "contains", value: "prop" }],
      },
    ],
    unlisted: { id: "rule-3", directory: "Other", conditions: [] },
    createdAt: Date.now(),
  }

  await page.goto("/")
  await page.evaluate((w) => {
    window.localStorage.setItem("alm-workflows", JSON.stringify([w]))
  }, workflow)
  await page.goto(`/pipeline/libra?id=${wfId}`)
  await expect(page.locator("header span.text-sm")).toHaveText("Sorted-Libra-Test")

  const inputDir = makeInputDir()

  // Wait for the hidden file input and select the directory contents.
  const fileInput = page.locator('input[type="file"]')
  await fileInput.setInputFiles(inputDir)

  // The preprocess panel should now show 3 groups.
  await expect(page.locator("text=Groups")).toBeVisible()
  await expect(page.locator("text=No groups yet")).not.toBeVisible()
  const groups = page.locator('[class*="rounded-md"] span:text-matches("(Heroes|Props|Other)")')
  await expect(groups).toHaveCount(3)

  // Run the pipeline.
  await page.locator('button[title="Run"]').click()

  // Wait for the pipeline to finish generating the archive.
  await expect(page.locator("text=Pipeline finished")).toBeVisible({ timeout: 60_000 })

  // Wait for the zip to become available.
  await expect(page.locator('button[aria-label="Download final archive"]')).toBeEnabled({ timeout: 10_000 })

  // Verify the download button is enabled with the correct filename tooltip.
  const downloadBtn = page.locator('button[aria-label="Download final archive"]')
  await expect(downloadBtn).toHaveAttribute("title", "Download final archive")
  await expect(downloadBtn).toBeEnabled()
})
