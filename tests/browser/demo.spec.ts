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

test("account entry fails clearly when hosted authentication is not configured", async ({ page }) => {
  await page.goto("/app")
  await expect(page).toHaveURL(/\/login\?reason=account_setup_required/)
  await expect(page.getByRole("heading", { name: "Sign in or create an account" })).toBeVisible()
  await expect(page.getByText("Account storage needs setup")).toBeVisible()
  await expect(page.getByRole("link", { name: "Use the resettable demo" })).toBeVisible()
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
  await page.getByLabel("Search courses").fill("CS 148")
  await expect(page.getByRole("heading", { name: /CS 148/ })).toBeVisible()
  await page.getByRole("button", { name: /add CS 148 to plan/i }).click()
  await page.getByRole("link", { name: "Plan" }).click()
  await expect(page.getByText("CS 148")).toBeVisible()
})

test("Programs reflects planned coursework and exposes sources", async ({ page }) => {
  await page.goto("/demo")
  await page.getByRole("link", { name: "Programs" }).click()
  await expect(page.getByRole("heading", { name: /Computer Science/ })).toBeVisible()
  await expect(page.getByText("Completed")).toBeVisible()
  await expect(page.getByText("Planned")).toBeVisible()
  await expect(page.getByText("Needs review")).toBeVisible()
  await expect(page.getByRole("link", { name: /official source/i })).toHaveAttribute("href", /^https:/)
  await page.getByLabel("Program tracking status").selectOption("exploring")
  await page.reload()
  await expect(page.getByLabel("Program tracking status")).toHaveValue("exploring")
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

test("a new student can complete the full onboarding questionnaire", async ({ page }) => {
  await page.goto("/demo")
  await page.goto("/onboarding")
  await page.getByLabel("Preferred name").fill("Maya")
  await page.getByRole("button", { name: "Continue" }).click()
  await page.getByRole("button", { name: /CS 106A/ }).click()
  await page.getByRole("button", { name: "Continue" }).click()
  await page.getByLabel("Goals and considerations").fill("Explore health-focused HCI while preserving research time.")
  await page.getByRole("button", { name: "Continue" }).click()
  await expect(page.getByRole("heading", { name: /clear starting point/i })).toBeVisible()
  await expect(page.getByText("Maya")).toBeVisible()
  await expect(page.getByText("1 selected")).toBeVisible()
  await expect(page.getByRole("button", { name: "Create my workspace" })).toBeVisible()
})

test("profile, Library edits, and archives persist through reloads", async ({ page }) => {
  await page.goto("/demo")
  await page.getByRole("link", { name: "Account" }).click()
  await page.getByRole("button", { name: "Edit profile" }).click()
  await page.getByLabel("Name").fill("Maya Patel")
  await page.getByLabel("Goals and planning context").fill("Explore health HCI and preserve research time.")
  await page.getByRole("button", { name: "Save profile" }).click()
  await page.reload()
  await expect(page.getByRole("heading", { name: "Maya Patel" })).toBeVisible()

  await page.getByRole("link", { name: "Library" }).click()
  await page.getByRole("button", { name: "Add to workspace" }).click()
  await page.getByLabel("Type").selectOption("person")
  await page.getByLabel("Collection", { exact: true }).selectOption("COLLECTION-PEOPLE")
  await page.getByLabel("Title").fill("Professor Rivera")
  await page.getByLabel("Details").fill("Ask about health-focused HCI research.")
  await page.getByRole("button", { name: "Save", exact: true }).click()
  await page.getByRole("button", { name: /People/ }).click()
  await expect(page.getByText("Professor Rivera")).toBeVisible()
  await page.getByRole("button", { name: "Edit Professor Rivera" }).click()
  await page.getByLabel("Details").fill("Ask about HCI research and autumn office hours.")
  await page.getByRole("button", { name: "Save changes" }).click()
  await page.reload()
  await page.getByRole("button", { name: /People/ }).click()
  await expect(page.getByText(/autumn office hours/i)).toBeVisible()
  await page.getByRole("button", { name: "Edit Professor Rivera" }).click()
  await page.getByRole("button", { name: "Archive", exact: true }).click()
  await expect(page.getByText("Professor Rivera")).not.toBeVisible()
  await page.getByRole("button", { name: /Archived/ }).click()
  await page.getByRole("button", { name: "Restore Professor Rivera" }).click()
  await page.getByRole("button", { name: /People/ }).click()
  await expect(page.getByText("Professor Rivera")).toBeVisible()
})

test("course and scenario controls perform persisted semantic edits", async ({ page }) => {
  await page.goto("/demo")
  await page.getByRole("link", { name: "Plan" }).click()
  await page.getByRole("button", { name: "Edit Design Foundations" }).click()
  await page.getByLabel("Plan role").selectOption("backup")
  await page.getByRole("button", { name: "Save course" }).click()
  await expect(page.getByText("12 units")).toBeVisible()
  await page.getByRole("tab", { name: /Lighter option/ }).click()
  await page.getByRole("button", { name: "Scenario settings" }).click()
  await page.getByLabel("Scenario name").fill("Research first")
  await page.getByRole("button", { name: "Save name" }).click()
  await page.reload()
  await expect(page.getByRole("tab", { name: /Research first/ })).toBeVisible()
})

test("agent onboarding reports connection and exposes the safe starter workflow", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(document, "modelContext", { configurable: true, value: { registerTool() { return { unregister() {} } } } })
  })
  await page.goto("/demo")
  await page.getByRole("link", { name: "Agent", exact: true }).click()
  await expect(page.getByText("WebMCP detected")).toBeVisible()
  await expect(page.getByRole("heading", { name: "11 semantic tools" })).toBeVisible()
  await expect(page.getByText(/search my workspace.*smallest useful atomic changes/i)).toBeVisible()
})

test("registers semantic WebMCP tools in a capable browser", async ({ page }) => {
  await page.addInitScript(() => {
    const names = new Set<string>()
    Object.defineProperty(document, "modelContext", {
      configurable: true,
      value: {
        registerTool(tool: { name: string }, options?: { signal?: AbortSignal }) {
          names.add(tool.name)
          options?.signal?.addEventListener("abort", () => names.delete(tool.name), { once: true })
        }
      }
    })
    Object.defineProperty(window, "__registeredTools", { get: () => [...names] })
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
