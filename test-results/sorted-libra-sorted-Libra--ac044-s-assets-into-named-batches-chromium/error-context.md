# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: sorted-libra.spec.ts >> sorted Libra pipeline groups assets into named batches
- Location: e2e/sorted-libra.spec.ts:40:5

# Error details

```
Error: expect(locator).toHaveText(expected) failed

Locator:  locator('header span.text-sm')
Expected: "Sorted-Libra-Test"
Received: "Libra"
Timeout:  5000ms

Call log:
  - Expect "toHaveText" with timeout 5000ms
  - waiting for locator('header span.text-sm')
    14 × locator resolved to <span class="text-sm font-semibold tracking-tight text-foreground truncate">Libra</span>
       - unexpected value "Libra"

```

```yaml
- text: Libra
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test"
  2  | import * as fs from "fs"
  3  | import * as path from "path"
  4  | 
  5  | function makeInputDir() {
  6  |   const dir = path.join(process.cwd(), "e2e", "fixtures", "sorted-input")
  7  |   if (fs.existsSync(dir)) {
  8  |     fs.rmSync(dir, { recursive: true, force: true })
  9  |   }
  10 |   fs.mkdirSync(dir, { recursive: true })
  11 |   for (const name of [
  12 |     "hero_01.usda",
  13 |     "hero_02.usda",
  14 |     "prop_table.usda",
  15 |     "prop_chair.usda",
  16 |     "misc.usda",
  17 |   ]) {
  18 |     fs.writeFileSync(path.join(dir, name), '#usda 1.0\n(\n    defaultPrim = "Asset"\n)')
  19 |   }
  20 |   for (const stem of ["hero_01", "hero_02", "prop_table", "prop_chair", "misc"]) {
  21 |     for (const suffix of ["_BaseColor.png", "_Normal.png", "_ORM.png"]) {
  22 |       fs.writeFileSync(
  23 |         path.join(dir, `${stem}${suffix}`),
  24 |         Buffer.from("\x89PNG\r\n\x1a\n" + "\x00".repeat(24))
  25 |       )
  26 |     }
  27 |   }
  28 |   // Prepare a chr file that should also land in Heroes (second condition)
  29 |   fs.writeFileSync(path.join(dir, "chr_01.usda"), '#usda 1.0\n(\n    defaultPrim = "Asset"\n)')
  30 |   for (const suffix of ["_BaseColor.png", "_Normal.png", "_ORM.png"]) {
  31 |     fs.writeFileSync(
  32 |       path.join(dir, `chr_01${suffix}`),
  33 |       Buffer.from("\x89PNG\r\n\x1a\n" + "\x00".repeat(24))
  34 |     )
  35 |   }
  36 | 
  37 |   return dir
  38 | }
  39 | 
  40 | test("sorted Libra pipeline groups assets into named batches", async ({ page }) => {
  41 |   const wfId = "b60511e1-ba07-4623-9979-bce25de10bf5"
  42 |   await page.goto(`/pipeline/libra?id=${wfId}`)
> 43 |   await expect(page.locator("header span.text-sm")).toHaveText("Sorted-Libra-Test")
     |                                                     ^ Error: expect(locator).toHaveText(expected) failed
  44 | 
  45 |   const inputDir = makeInputDir()
  46 | 
  47 |   // Wait for the hidden file input and select the directory contents.
  48 |   const fileInput = page.locator('input[type="file"]')
  49 |   await fileInput.setInputFiles(inputDir)
  50 | 
  51 |   // The preprocess panel should now show 3 groups.
  52 |   await expect(page.locator("text=Groups")).toBeVisible()
  53 |   await expect(page.locator("text=No groups yet")).not.toBeVisible()
  54 |   const groups = page.locator('[class*="rounded-md"] span:text-matches("(Heroes|Props|Other)")')
  55 |   await expect(groups).toHaveCount(3)
  56 | 
  57 |   // Run the pipeline.
  58 |   await page.locator('button[title="Run"]').click()
  59 | 
  60 |   // Wait for the zip to become available.
  61 |   await expect(page.locator('button[aria-label="Download final archive"]')).toBeEnabled({ timeout: 60_000 })
  62 | 
  63 |   // Wait for the zip to become available and capture the actual zip blob URL from the component state by triggering download and intercepting the generated anchor href.
  64 |   const [download] = await Promise.all([
  65 |     page.waitForEvent("download"),
  66 |     page.locator('button[aria-label="Download final archive"]').click(),
  67 |   ])
  68 |   expect(download.suggestedFilename()).toBe("Sorted-Libra-Test.zip")
  69 |   const path = await download.path()
  70 |   expect(path).toBeTruthy()
  71 | })
  72 | 
```