import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

test("public landing enters an isolated demo and exposes every primary surface", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("heading", { level: 1 })).toContainText("academic workspace")
  await page.getByRole("link", { name: "Try the demo" }).click()
  await expect(page).toHaveURL(/\/app/)
  await expect(page.getByText("Autumn 2026")).toBeVisible()
  for (const name of ["Home", "Plan", "Explore", "Library", "Programs"]) {
    await expect(page.getByRole("link", { name })).toBeVisible()
  }
})

test("student captures context, changes a plan, sees checks, and undoes the action", async ({ page }) => {
  await page.goto("/demo")
  await page.getByRole("link", { name: "Library" }).click()
  await page.getByRole("button", { name: "Add to workspace" }).click()
  await page.getByLabel("Type").selectOption("club")
  await page.getByLabel("Title").fill("Stanford Healthcare Club")
  await page.getByRole("button", { name: "Save" }).click()
  await expect(page.getByText("Stanford Healthcare Club")).toBeVisible()

  await page.getByRole("link", { name: "Plan" }).click()
  await page.getByRole("button", { name: /remove design foundations/i }).click()
  await expect(page.getByText(/12 units/i)).toBeVisible()
  await page.getByRole("button", { name: "Activity" }).click()
  await page.getByRole("button", { name: "Undo" }).first().click()
  await expect(page.getByText(/14 units/i)).toBeVisible()
})

test("Explore filters the catalog and adds a course through the shared command path", async ({ page }) => {
  await page.goto("/demo")
  await page.getByRole("link", { name: "Explore" }).click()
  await page.getByLabel("Search courses").fill("CS 147")
  await expect(page.getByRole("heading", { name: /CS 147/ })).toBeVisible()
  await page.getByRole("button", { name: /add CS 147 to plan/i }).click()
  await page.getByRole("link", { name: "Plan" }).click()
  await expect(page.getByText("CS 147")).toBeVisible()
})

test("Programs reflects planned coursework and exposes sources", async ({ page }) => {
  await page.goto("/demo")
  await page.getByRole("link", { name: "Programs" }).click()
  await expect(page.getByRole("heading", { name: /Computer Science/ })).toBeVisible()
  await expect(page.getByText("Completed")).toBeVisible()
  await expect(page.getByText("Planned")).toBeVisible()
  await expect(page.getByText("Needs review")).toBeVisible()
  await expect(page.getByRole("link", { name: /official source/i })).toHaveAttribute("href", /^https:/)
})

test("search, scenario comparison, and saved views are real shared workspace controls", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile")
  await page.goto("/demo")
  await page.getByRole("button", { name: "Search workspace" }).click()
  await page.getByLabel("Search courses, notes, people, and programs").fill("professor research")
  await expect(page.getByText("Professor conversation")).toBeVisible()
  await page.getByRole("button", { name: "Close search" }).click()

  await page.getByRole("link", { name: "Plan" }).click()
  await page.getByRole("button", { name: "Compare scenarios" }).click()
  await expect(page.getByRole("dialog", { name: "Compare scenarios" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Lighter option" })).toBeVisible()
  await page.getByRole("button", { name: "Open scenario" }).last().click()
  await expect(page.getByText("12 units")).toBeVisible()

  await page.getByRole("link", { name: "Settings" }).click()
  await page.getByRole("button", { name: "Create planning view" }).click()
  await expect(page.getByText("My planning view")).toBeVisible()
  await page.getByRole("button", { name: "Activity" }).click()
  await expect(page.getByText("configure view")).toBeVisible()
})

test("registers semantic WebMCP tools in a capable browser", async ({ page }) => {
  await page.addInitScript(() => {
    const names: string[] = []
    Object.defineProperty(document, "modelContext", {
      configurable: true,
      value: {
        registerTool(tool: { name: string }) {
          names.push(tool.name)
          return { unregister() {} }
        }
      }
    })
    Object.defineProperty(window, "__registeredTools", { value: names })
  })
  await page.goto("/demo")
  await expect.poll(() => page.evaluate(() => (window as unknown as { __registeredTools: string[] }).__registeredTools.length)).toBe(11)
  expect(await page.evaluate(() => (window as unknown as { __registeredTools: string[] }).__registeredTools)).toContain("search_workspace")
})

test("has no serious accessibility violations", async ({ page }, testInfo) => {
  await page.goto("/demo")
  const results = await new AxeBuilder({ page }).analyze()
  const serious = results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical")
  expect(serious, `${testInfo.project.name}: ${JSON.stringify(serious, null, 2)}`).toEqual([])
})

test("mobile navigation, quick capture, and calendar alternative are usable", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile")
  await page.goto("/demo")
  await expect(page.getByRole("navigation", { name: "Mobile" })).toBeVisible()
  await page.getByRole("link", { name: "Plan" }).click()
  await expect(page.getByRole("list", { name: "Schedule list" })).toBeVisible()
  await page.getByRole("link", { name: "Library" }).click()
  await expect(page.getByRole("button", { name: "Add to workspace" })).toBeVisible()
})
