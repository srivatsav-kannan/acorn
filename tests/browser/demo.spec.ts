import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

test("public landing explains the product and routes into the account flow", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("heading", { level: 1 })).toContainText("twelve quarters")
  await expect(page.getByText("15,587 courses")).toBeVisible()
  await page.getByRole("link", { name: "Start planning" }).first().click()
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible()
})

test("the demo workspace exposes every primary surface", async ({ page }) => {
  await page.goto("/demo")
  await expect(page).toHaveURL(/\/app/)
  await expect(page.getByRole("banner").getByText("Autumn 2026")).toBeVisible()
  for (const name of ["Home", "Plan", "Stanford", "Library", "Programs"]) {
    await expect(page.getByRole("link", { name, exact: true })).toBeVisible()
  }
  await page.goto("/")
  await expect(page.getByRole("link", { name: "Open your workspace" }).first()).toBeVisible()
})

test("account entry reflects the active authentication configuration", async ({ page }) => {
  await page.goto("/login")
  await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible()
  const setupNotice = page.getByText("Account sign-in is unavailable")
  if (await setupNotice.isVisible()) {
    await expect(page.getByRole("button", { name: "Email me a sign-in link" })).toBeDisabled()
  } else {
    await expect(page.getByRole("button", { name: "Email me a sign-in link" })).toBeEnabled()
    await expect(page.getByRole("button", { name: "Sign in with demo credentials" })).toBeVisible()
  }
  await expect(page.getByRole("button", { name: "Continue with Google" })).toHaveCount(0)
})

test("workspace and onboarding routes are account-gated", async ({ page }) => {
  await page.goto("/onboarding")
  await expect(page).toHaveURL(/\/login/)
  await page.goto("/app")
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByRole("heading", { name: "Sign in", exact: true })).toBeVisible()
})

test("student captures context, changes a plan, sees checks, and undoes the action", async ({ page }) => {
  await page.goto("/demo")
  await page.getByRole("link", { name: "Library", exact: true }).click()
  await page.getByRole("button", { name: "Add to workspace" }).click()
  await page.getByLabel("Type").selectOption("club")
  await page.getByLabel("Title").fill("Stanford Healthcare Club")
  await page.getByRole("button", { name: "Save" }).click()
  await expect(page.getByText("Stanford Healthcare Club")).toBeVisible()

  await page.getByRole("link", { name: "Plan", exact: true }).click()
  await page.getByRole("button", { name: /remove design foundations/i }).click()
  await expect(page.getByText(/13 units/i).first()).toBeVisible()
  await page.getByRole("button", { name: "Activity" }).click()
  await page.getByRole("button", { name: "Undo" }).first().click()
  await expect(page.getByText(/15 units/i).first()).toBeVisible()
})

test("Stanford browsing filters the catalog and adds a course through the shared command path", async ({ page }) => {
  await page.goto("/demo")
  await page.getByRole("link", { name: "Stanford", exact: true }).click()
  await expect(page.getByText("CS subject only")).toHaveCount(0)
  await page.getByLabel("Search courses").fill("CS 148")
  await expect(page.getByRole("heading", { name: /CS 148/ })).toBeVisible()
  await page.getByRole("button", { name: /add CS 148 to plan/i }).click()
  await page.getByRole("link", { name: "Plan", exact: true }).click()
  await expect(page.getByText("CS 148")).toBeVisible()
})

test("Programs reflects planned coursework and exposes sources", async ({ page }) => {
  await page.goto("/demo")
  await page.getByRole("link", { name: "Programs", exact: true }).click()
  await expect(page.getByRole("heading", { name: /Computer Science/ })).toBeVisible()
  await expect(page.getByText("Completed", { exact: true })).toBeVisible()
  await expect(page.getByText("Planned", { exact: true })).toBeVisible()
  await expect(page.getByText("Read official details", { exact: true })).toBeVisible()
  await expect(page.getByRole("link", { name: /open official page/i })).toHaveAttribute("href", /^https:/)
  await page.getByRole("button", { name: "Stop tracking" }).click()
  await page.reload()
  await expect(page.getByRole("button", { name: "Track this program" })).toBeVisible()
})

test("search, scenario comparison, and saved views are real shared workspace controls", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile")
  await page.goto("/demo")
  await page.getByRole("button", { name: "Search workspace" }).click()
  await page.getByLabel("Search courses, notes, people, and programs").fill("professor research")
  await expect(page.getByRole("link", { name: /Professor conversation/ })).toBeVisible()
  await page.getByRole("button", { name: "Close search" }).click()

  await page.getByRole("link", { name: "Plan", exact: true }).click()
  await page.getByRole("button", { name: "Compare scenarios" }).click()
  await expect(page.getByRole("dialog", { name: "Compare scenarios" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Lighter option" })).toBeVisible()
  await page.getByRole("button", { name: "Open scenario" }).last().click()
  await expect(page.getByText("13 units").first()).toBeVisible()

  await page.getByRole("link", { name: "Settings", exact: true }).click()
  await page.getByRole("button", { name: "Create planning view" }).click()
  await expect(page.getByText("My planning view")).toBeVisible()
  await page.getByRole("button", { name: "Activity" }).click()
  await expect(page.getByText("configure view")).toBeVisible()
})

test("a new student sees durable-facts onboarding with dropdowns only", async ({ page }) => {
  await page.goto("/demo")
  await page.goto("/onboarding")
  await expect(page.getByLabel("University")).toBeVisible()
  await page.getByLabel("Entered in autumn").selectOption("2026")
  await page.getByLabel("Graduating in spring").selectOption("2030")
  await expect(page.getByRole("button", { name: "Enter my workspace" })).toBeVisible()
  await expect(page.getByLabel(/what should we call you/i)).toHaveCount(0)
  await expect(page.getByText(/No sample student data/i)).toBeVisible()
})

test("profile, Library edits, and archives persist through reloads", async ({ page }) => {
  await page.goto("/demo")
  await page.getByRole("link", { name: "Account" }).click()
  await page.getByRole("button", { name: "Edit profile" }).click()
  await page.getByLabel("Name").fill("Maya Patel")
  await page.getByLabel("Goals and planning context").fill("Explore health HCI and preserve research time.")
  await page.getByLabel("Monday").check()
  await page.getByRole("button", { name: "Save profile" }).click()
  await page.reload()
  await expect(page.getByRole("heading", { name: "Maya Patel" })).toBeVisible()
  await expect(page.getByText("Mon, Fri")).toBeVisible()

  await page.getByRole("link", { name: "Library", exact: true }).click()
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

test("demo reset discards saved and in-progress edits and survives reload", async ({ page }) => {
  await page.goto("/demo")
  await page.getByRole("link", { name: "Account" }).click()
  await page.getByRole("button", { name: "Edit profile" }).click()
  await page.getByLabel("Name").fill("Reset Test Student")
  await page.getByRole("button", { name: "Save profile" }).click()
  await expect(page.getByRole("heading", { name: "Reset Test Student" })).toBeVisible()

  await page.getByRole("button", { name: "Edit profile" }).click()
  await page.getByLabel("Name").fill("Unsaved Stale Name")
  await page.getByRole("link", { name: "Account settings" }).click()
  await page.getByRole("button", { name: "Reset demo" }).click()

  await expect(page).toHaveURL(/\/app$/)
  await expect(page.getByRole("heading", { name: "Good to see you, Alex." })).toBeVisible()
  await page.reload()
  await expect(page.getByRole("heading", { name: "Good to see you, Alex." })).toBeVisible()
})

test("course and scenario controls perform persisted semantic edits", async ({ page }) => {
  await page.goto("/demo")
  await page.getByRole("link", { name: "Plan", exact: true }).click()
  await page.getByRole("button", { name: "Edit Design Foundations" }).click()
  await page.getByLabel("Plan role").selectOption("backup")
  await page.getByRole("button", { name: "Save course" }).click()
  await expect(page.getByText("13 units").first()).toBeVisible()
  await page.getByRole("tab", { name: /Lighter option/ }).click()
  await page.getByRole("button", { name: "Scenario settings" }).click()
  await page.getByLabel("Scenario name").fill("Research first")
  await page.getByRole("button", { name: "Save settings" }).click()
  await page.reload()
  await expect(page.getByRole("tab", { name: /Research first/ })).toBeVisible()
})

test("agent onboarding reports connection and exposes the safe starter workflow", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(document, "modelContext", { configurable: true, value: { registerTool() { return { unregister() {} } } } })
  })
  await page.goto("/demo")
  await page.getByRole("link", { name: "Plan together", exact: true }).click()
  await expect(page.getByText("Agent connection available")).toBeVisible()
  await expect(page.getByRole("heading", { name: /Keep CourseContext open/i })).toBeVisible()
  await expect(page.getByText(/Read what I have already saved.*smallest useful changes/i)).toBeVisible()
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
  await expect.poll(() => page.evaluate(() => (window as unknown as { __registeredTools: string[] }).__registeredTools.length)).toBe(12)
  expect(await page.evaluate(() => (window as unknown as { __registeredTools: string[] }).__registeredTools)).toContain("search_workspace")
})

test("WebMCP health research becomes visible, searchable Library context", async ({ page }) => {
  await page.addInitScript(() => {
    const tools = new Map<string, { execute: (input: Record<string, unknown>) => Promise<Record<string, unknown>> }>()
    Object.defineProperty(document, "modelContext", {
      configurable: true,
      value: {
        registerTool(tool: { name: string, execute: (input: Record<string, unknown>) => Promise<Record<string, unknown>> }, options?: { signal?: AbortSignal }) {
          tools.set(tool.name, tool)
          options?.signal?.addEventListener("abort", () => { if (tools.get(tool.name) === tool) tools.delete(tool.name) }, { once: true })
        }
      }
    })
    Object.defineProperty(window, "__courseContextTools", { value: tools })
  })
  await page.goto("/demo")
  await expect.poll(() => page.evaluate(() => (window as unknown as { __courseContextTools: Map<string, unknown> }).__courseContextTools.size)).toBe(12)
  const result = await page.evaluate(async () => {
    const tools = (window as unknown as { __courseContextTools: Map<string, { execute: (input: Record<string, unknown>) => Promise<Record<string, unknown>> }> }).__courseContextTools
    const context = await tools.get("get_planning_context")!.execute({}) as { version: number }
    await tools.get("update_student_context")!.execute({ expectedVersion: context.version, idempotencyKey: "HEALTH-PRIORITY-E2E", preferences: [{ id: "PREFERENCE-HEALTH-AI-E2E", label: "Build healthcare and health-AI depth", strength: "soft", value: true }] })
    const saved = await tools.get("save_research")!.execute({ expectedVersion: context.version + 1, idempotencyKey: "HEALTH-RESEARCH-E2E", evidence: { id: "EVIDENCE-HEALTH-AI-E2E", title: "Freshman health-AI course shortlist", claim: "Start with a low-load healthcare AI seminar before committing to advanced technical depth.", sourceUrl: "https://explorecourses.stanford.edu/", sourceTitle: "Stanford ExploreCourses", retrievedAt: "2026-08-28T00:00:00Z", classification: "official", confidence: 0.9, status: "current" } })
    const search = await tools.get("search_workspace")!.execute({ query: "freshman healthcare health AI courses" }) as { groups: Array<{ items: Array<{ id: string }> }> }
    return { saved, searchIds: search.groups.flatMap((group) => group.items.map((item) => item.id)) }
  })
  expect(result.saved).toMatchObject({ ok: true, visibleChange: true, primaryVisibleId: "SOURCE-EVIDENCE-HEALTH-AI-E2E" })
  expect(result.searchIds).toContain("SOURCE-EVIDENCE-HEALTH-AI-E2E")
  await page.getByRole("link", { name: "Library", exact: true }).click()
  await page.getByRole("button", { name: /Research 2/ }).click()
  await expect(page.getByRole("heading", { name: "Freshman health-AI course shortlist" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Open source" })).toHaveAttribute("href", "https://explorecourses.stanford.edu/")
  await page.getByRole("link", { name: "Account", exact: true }).click()
  await expect(page.getByText("Build healthcare and health-AI depth")).toBeVisible()
})

test("the fixture workspace onboards clean, persists edits, and plans future terms", async ({ page }) => {
  await page.goto("/start")
  await expect(page).toHaveURL(/\/onboarding$/)
  await page.getByLabel("Entered in autumn").selectOption("2026")
  await page.getByLabel("Graduating in spring").selectOption("2030")
  await page.getByRole("button", { name: "Enter my workspace" }).click()
  await expect(page).toHaveURL(/\/app$/)
  await expect(page.getByRole("heading", { name: "Welcome." })).toBeVisible()
  await expect(page.getByText("Alex Chen")).toHaveCount(0)

  await page.getByRole("link", { name: "Plan", exact: true }).click()
  await page.getByRole("button", { name: "+ Add course" }).click()
  await page.getByLabel("Search the catalog").fill("CS 106A")
  await page.getByRole("button", { name: "Add CS 106A" }).click()
  await page.getByRole("button", { name: "Close course search" }).click()
  await expect(page.getByText("CS 106A").first()).toBeVisible()

  await page.getByRole("tab", { name: /Win 2027/ }).click()
  await page.getByRole("button", { name: /^Plan Winter 2027$/ }).click()
  await page.getByRole("button", { name: "+ Add course" }).click()
  await page.getByLabel("Search the catalog").fill("CS 106B")
  await page.getByRole("button", { name: "Add CS 106B" }).click()
  await page.getByRole("button", { name: "Close course search" }).click()
  await expect(page.getByText("Programming Abstractions").first()).toBeVisible()

  await page.reload()
  await page.getByRole("tab", { name: /Win 2027/ }).click()
  await expect(page.getByText("Programming Abstractions").first()).toBeVisible()
  await page.getByRole("link", { name: "Home", exact: true }).click()
  await expect(page.getByText(/of 180 units planned or complete/)).toBeVisible()
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
  await page.getByRole("link", { name: "Plan", exact: true }).click()
  await expect(page.getByRole("list", { name: "Schedule list" })).toBeVisible()
  await page.getByRole("link", { name: "Library", exact: true }).click()
  await expect(page.getByRole("button", { name: "Add to workspace" })).toBeVisible()
})
