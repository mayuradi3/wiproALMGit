import { test, expect } from "@playwright/test"
import * as fs from "fs"
import * as path from "path"
import * as crypto from "crypto"

function seedWorkflows(page: import("@playwright/test").Page) {
  const aresId = crypto.randomUUID()
  const libraId = crypto.randomUUID()
  const workflows = [
    {
      id: aresId,
      name: "Smoke-Ares",
      type: "ares",
      createdAt: Date.now(),
    },
    {
      id: libraId,
      name: "Smoke-Libra",
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
    },
  ]
  return page.evaluate((data: { workflows: unknown; aresId: string; libraId: string }) => {
    window.localStorage.setItem("alm-workflows", JSON.stringify(data.workflows))
    return { aresId: data.aresId, libraId: data.libraId }
  }, { workflows, aresId, libraId })
}

test("homepage loads and workflows are listed", async ({ page }) => {
  await page.goto("/")
  const { libraId } = await seedWorkflows(page)
  await page.reload()
  await expect(page.locator("text=ALM").first()).toBeVisible()
  await expect(page.locator("text=Smoke-Libra")).toBeVisible()
  await page.locator("text=Smoke-Libra").click()
  await expect(page).toHaveURL(new RegExp(`/pipeline/libra\\?id=${libraId}`))
})

test("Ares pipeline uploads model + texture and buttons enable", async ({ page }) => {
  test.setTimeout(60_000)
  await page.goto("/")
  await seedWorkflows(page)
  await page.goto("/pipeline/ares?name=Smoke-Ares")
  await expect(page.locator("text=3D Model")).toBeVisible({ timeout: 15_000 })

  const fixtureDir = path.join(process.cwd(), "e2e", "fixtures")
  const modelPath = path.join(fixtureDir, "cube.obj")

  // Use a real PNG texture
  const texturePath = path.join(fixtureDir, "base-color.png")
  if (!fs.existsSync(texturePath)) {
    fs.writeFileSync(
      texturePath,
      Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        "base64"
      )
    )
  }

  // Upload model
  const modelInput = page.locator('input[type="file"] >> visible=false').first()
  await modelInput.setInputFiles(modelPath)
  await expect(page.getByText("cube.obj", { exact: true })).toBeVisible({ timeout: 10_000 })

  // Upload base color texture
  const textureInput = page.locator('input[type="file"] >> visible=false').nth(1)
  await textureInput.setInputFiles(texturePath)
  await expect(page.getByText("base-color.png", { exact: true })).toBeVisible({ timeout: 10_000 })

  // Run button should be enabled now
  await expect(page.locator('button:has-text("Run")')).toBeEnabled({ timeout: 5_000 })
})

test("Libra sorted pipeline groups and runs", async ({ page }) => {
  test.setTimeout(120_000)
  await page.goto("/")
  const { libraId } = await seedWorkflows(page)
  await page.goto(`/pipeline/libra?id=${libraId}`)
  await expect(page.locator("text=Upload Directory")).toBeVisible({ timeout: 15_000 })

  const inputDir = path.join(process.cwd(), "e2e", "fixtures", "sorted-input")
  if (fs.existsSync(inputDir)) fs.rmSync(inputDir, { recursive: true, force: true })
  fs.mkdirSync(inputDir, { recursive: true })
  for (const name of ["hero_01.usda", "hero_02.usda", "prop_table.usda", "prop_chair.usda", "misc.usda"]) {
    fs.writeFileSync(path.join(inputDir, name), '#usda 1.0\n(\n    defaultPrim = "Asset"\n)')
  }
  for (const stem of ["hero_01", "hero_02", "prop_table", "prop_chair", "misc"]) {
    for (const suffix of ["_BaseColor.png", "_Normal.png", "_ORM.png"]) {
      fs.writeFileSync(
        path.join(inputDir, `${stem}${suffix}`),
        Buffer.from(
          "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
          "base64"
        )
      )
    }
  }

  await page.locator('input[type="file"] >> visible=false').setInputFiles(inputDir)
  await expect(page.locator("text=Groups")).toBeVisible({ timeout: 15_000 })
  await expect(page.locator("text=No groups yet")).not.toBeVisible()

  await page.locator('button[title="Run"]').click()
  await expect(page.locator('button[aria-label="Download final archive"]')).toBeEnabled({ timeout: 60_000 })
})
