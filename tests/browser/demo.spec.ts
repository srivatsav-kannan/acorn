import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

const todayIso = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
}

test("public landing explains the product and routes into the account flow", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("heading", { level: 1 })).toContainText("every quarter to graduation")
  await expect(page.getByText("15,587 courses")).toBeVisible()
  await page.getByRole("link", { name: "Start planning" }).first().click()
  await expect(page).toHaveURL(/\/signup/)
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible()
})

test("the demo workspace exposes the four tabs and the front-door return", async ({ page }) => {
  await page.goto("/demo")
  await expect(page).toHaveURL(/\/app/)
  await expect(page.getByRole("banner").getByText("Autumn 2026")).toBeVisible()
  for (const name of ["Scratchpad", "Calendar", "Courses", "Collaborate"]) {
    await expect(page.getByRole("link", { name, exact: true })).toBeVisible()
  }
  await page.goto("/")
  await expect(page.getByRole("link", { name: "Open your workspace" }).first()).toBeVisible()
})

test("account entry is a plain email and password form", async ({ page }) => {
  await page.goto("/login")
  await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible()
  await expect(page.getByLabel("Email")).toBeVisible()
  await expect(page.getByLabel("Password")).toBeVisible()
  await expect(page.getByRole("button", { name: "Continue with Google" })).toHaveCount(0)
  await expect(page.getByRole("link", { name: "Create an account" })).toBeVisible()
})

test("workspace and onboarding routes are account-gated", async ({ page }) => {
  await page.goto("/onboarding")
  await expect(page).toHaveURL(/\/login/)
  await page.goto("/app")
  await expect(page).toHaveURL(/\/login/)
  await expect(page.getByRole("heading", { name: "Log in" })).toBeVisible()
})

test("the scratchpad takes jots with tags, edits, archives, and persists", async ({ page }) => {
  await page.goto("/demo")
  await expect(page.getByRole("heading", { name: "Scratchpad" })).toBeVisible()
  await page.getByLabel("Jot something down").fill("Heard the Solar Car shop is open to frosh")
  await page.getByLabel("Tags").fill("clubs, engineering")
  await page.getByRole("button", { name: "Add to scratchpad" }).click()
  await expect(page.getByText("Heard the Solar Car shop is open to frosh")).toBeVisible()
  await page.reload()
  await expect(page.getByText("Heard the Solar Car shop is open to frosh")).toBeVisible()
  const card = page.locator("article", { hasText: "Solar Car shop" }).first()
  await card.getByRole("button", { name: "Edit" }).click()
  await page.getByLabel("Note details").fill("Ask at the activities fair which shifts fit around CS 106B.")
  await page.getByRole("button", { name: "Save", exact: true }).click()
  await expect(page.getByText(/activities fair/)).toBeVisible()
  await page.locator("article", { hasText: "Solar Car shop" }).first().getByRole("button", { name: "Archive" }).click()
  await expect(page.getByText("Heard the Solar Car shop is open to frosh")).not.toBeVisible()
})

test("courses search, interest, planning, and undo run through one command path", async ({ page }) => {
  await page.goto("/demo")
  await page.getByRole("link", { name: "Courses", exact: true }).click()
  await expect(page.getByText(/15 units/).first()).toBeVisible()
  await page.getByLabel("Search courses").fill("CS 148")
  await expect(page.getByText("Introduction to Computer Graphics").first()).toBeVisible()
  await page.getByRole("button", { name: "Interested", exact: true }).first().click()
  await expect(page.getByRole("button", { name: /Interested ✓/ }).first()).toBeVisible()
  await page.getByRole("button", { name: /Plan CS 148 for Aut 2026/ }).first().click()
  await expect(page.locator(".plan-rail").getByText("CS 148")).toBeVisible()

  await page.locator(".plan-rail").getByRole("button", { name: /Remove DESIGN 60 from plan/ }).click()
  await page.getByRole("button", { name: "Activity" }).click()
  await page.getByRole("button", { name: "Undo" }).first().click()
  await page.keyboard.press("Escape")
  await expect(page.locator(".plan-rail").getByText("DESIGN 60")).toBeVisible()
})

test("clubs mark interest and hand-added clubs land dated on the calendar", async ({ page }) => {
  await page.goto("/demo")
  await page.goto("/app/courses")
  await page.getByRole("tab", { name: "Clubs" }).click()
  await expect(page.getByText("TreeHacks")).toBeVisible()
  const treehacks = page.locator("article", { hasText: "TreeHacks" }).first()
  await treehacks.getByRole("button", { name: "Interested" }).click()
  await expect(treehacks.getByRole("button", { name: /Interested ✓/ })).toBeVisible()

  await page.getByRole("button", { name: "Add a club" }).click()
  await page.getByLabel("Name", { exact: true }).fill("Stanford Healthcare Innovators")
  await page.getByLabel("What it is").fill("Student group building health tech with clinicians.")
  await page.getByLabel("Date", { exact: true }).fill(todayIso())
  await page.getByLabel("What happens then").first().fill("Info session")
  await page.getByRole("button", { name: "Add club", exact: true }).click()
  const added = page.locator("article", { hasText: "Stanford Healthcare Innovators" }).first()
  await expect(added.getByText(/unverified/i)).toBeVisible()
  await added.getByRole("button", { name: "Interested" }).click()

  await page.getByRole("link", { name: "Calendar", exact: true }).click()
  await expect(page.getByText(/Stanford Healthcare Innovators: Info session/).first()).toBeVisible()
})

test("the calendar carries registrar dates, todos, and planned classes", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile")
  await page.goto("/demo")
  await page.getByRole("link", { name: "Calendar", exact: true }).click()
  await expect(page.getByText("Plan the language requirement")).toBeVisible()
  await page.getByLabel("New todo").fill("Confirm study list")
  await page.getByLabel("Due date").fill(todayIso())
  await page.getByRole("button", { name: "Add", exact: true }).click()
  await expect(page.locator(".todo-list").getByText("Confirm study list")).toBeVisible()
  await expect(page.locator(".calendar-grid").getByText("Confirm study list").first()).toBeVisible()

  let found = false
  for (let hop = 0; hop < 5 && !found; hop += 1) {
    found = await page.getByText("Autumn quarter begins; instruction begins").first().isVisible().catch(() => false)
    if (!found) await page.getByRole("button", { name: "Next month" }).click()
  }
  expect(found).toBe(true)
  await expect(page.locator(".calendar-grid").getByText("CS 106B").first()).toBeVisible()
})

test("profile edits identity and treats the two dates as a guarded rebuild", async ({ page }) => {
  await page.goto("/demo")
  await page.getByRole("link", { name: "Account" }).click()
  await expect(page.getByLabel("Name")).toHaveValue("Alex Chen")
  await page.getByLabel("Name").fill("Maya Patel")
  await page.getByRole("button", { name: "Save", exact: true }).click()
  await page.reload()
  await expect(page.getByLabel("Name")).toHaveValue("Maya Patel")

  await page.getByLabel("Graduating in spring").selectOption("2030")
  await expect(page.getByRole("alertdialog")).toContainText("Rebuild the map")
  await page.getByRole("button", { name: "Rebuild the map" }).click()
  await expect(page.getByText("Autumn 2025 to Spring 2030")).toBeVisible()
  await page.reload()
  await expect(page.getByText("Autumn 2025 to Spring 2030")).toBeVisible()
})

test("demo reset discards edits and returns to the seeded workspace", async ({ page }) => {
  await page.goto("/demo")
  await page.getByRole("link", { name: "Account" }).click()
  await page.getByLabel("Name").fill("Reset Test Student")
  await page.getByRole("button", { name: "Save", exact: true }).click()
  await expect(page.getByLabel("Name")).toHaveValue("Reset Test Student")
  await page.getByRole("button", { name: "Reset demo" }).click()
  await expect(page).toHaveURL(/\/app$/)
  await page.getByRole("link", { name: "Account" }).click()
  await expect(page.getByLabel("Name")).toHaveValue("Alex Chen")
})

test("workspace search stays one keystroke away", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile")
  await page.goto("/demo")
  await page.getByRole("button", { name: "Search workspace" }).click()
  await page.getByLabel("Search courses, notes, people, and programs").fill("professor research")
  await expect(page.getByRole("link", { name: /Professor conversation/ })).toBeVisible()
  await page.getByRole("button", { name: "Close search" }).click()
})

test("onboarding asks for a name and durable facts through real controls", async ({ page }) => {
  await page.goto("/demo")
  await page.goto("/onboarding")
  await expect(page.getByLabel("Name", { exact: true })).toBeVisible()
  await expect(page.getByLabel("University")).toBeVisible()
  await page.getByLabel("Entered in autumn").selectOption("2026")
  await page.getByLabel("Graduating in spring").selectOption("2030")
  await expect(page.getByRole("button", { name: "Enter my workspace" })).toBeVisible()
  await expect(page.getByText(/no sample data is preloaded/i)).toBeVisible()
})

test("the collaborate page states the agent capability without theater", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(document, "modelContext", { configurable: true, value: { registerTool() { return { unregister() {} } } } })
  })
  await page.goto("/demo")
  await page.getByRole("link", { name: "Collaborate", exact: true }).click()
  await expect(page.getByText("Agent connection available")).toBeVisible()
  await expect(page.getByText("export_context").first()).toBeVisible()
  await expect(page.getByText("ingest_context").first()).toBeVisible()
})

test("registers the full semantic tool surface in a capable browser", async ({ page }) => {
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
  await expect.poll(() => page.evaluate(() => (window as unknown as { __registeredTools: string[] }).__registeredTools.length)).toBe(18)
  expect(await page.evaluate(() => (window as unknown as { __registeredTools: string[] }).__registeredTools)).toContain("export_context")
})

test("agent research and tracker edits become visible workspace state", async ({ page }) => {
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
  await expect.poll(() => page.evaluate(() => (window as unknown as { __courseContextTools: Map<string, unknown> }).__courseContextTools.size)).toBe(18)
  const result = await page.evaluate(async () => {
    const tools = (window as unknown as { __courseContextTools: Map<string, { execute: (input: Record<string, unknown>) => Promise<Record<string, unknown>> }> }).__courseContextTools
    const context = await tools.get("get_planning_context")!.execute({}) as { version: number }
    await tools.get("manage_todo")!.execute({ expectedVersion: context.version, idempotencyKey: "AGENT-TODO-E2E", action: "add", todo: { title: "Ask advisor about coterm timing" } })
    const saved = await tools.get("save_research")!.execute({ expectedVersion: context.version + 1, idempotencyKey: "HEALTH-RESEARCH-E2E", evidence: { id: "EVIDENCE-HEALTH-AI-E2E", title: "Freshman health-AI course shortlist", claim: "Start with a low-load healthcare AI seminar before committing to advanced technical depth.", sourceUrl: "https://explorecourses.stanford.edu/", sourceTitle: "Stanford ExploreCourses", retrievedAt: "2026-08-28T00:00:00Z", classification: "official", confidence: 0.9, status: "current" } })
    const exported = await tools.get("export_context")!.execute({ section: "todos" }) as { markdown: string }
    return { saved, exported: exported.markdown }
  })
  expect(result.saved).toMatchObject({ ok: true, visibleChange: true, primaryVisibleId: "SOURCE-EVIDENCE-HEALTH-AI-E2E" })
  expect(result.exported).toContain("Ask advisor about coterm timing")
  await page.getByRole("link", { name: "Scratchpad", exact: true }).click()
  await expect(page.getByText("Freshman health-AI course shortlist")).toBeVisible()
  await page.getByRole("link", { name: "Calendar", exact: true }).click()
  await expect(page.getByText("Ask advisor about coterm timing")).toBeVisible()
})

test("a fresh fixture account onboards and plans across terms", async ({ page }) => {
  await page.goto("/start")
  await expect(page).toHaveURL(/\/onboarding$/)
  await page.getByLabel("Name", { exact: true }).fill("Sam Rivera")
  await page.getByLabel("Entered in autumn").selectOption("2026")
  await page.getByLabel("Graduating in spring").selectOption("2030")
  await page.getByRole("button", { name: "Enter my workspace" }).click()
  await expect(page).toHaveURL(/\/app$/)
  await expect(page.getByRole("heading", { name: "Scratchpad" })).toBeVisible()
  await expect(page.getByText("Alex Chen")).toHaveCount(0)

  await page.getByRole("link", { name: "Courses", exact: true }).click()
  await page.getByLabel("Search courses").fill("CS 106A")
  await page.getByRole("button", { name: /Plan CS 106A for Aut 2026/ }).first().click()
  await expect(page.locator(".plan-rail").getByText("CS 106A")).toBeVisible()
  await page.getByLabel("Planning term").selectOption("TERM-2027-WINTER")
  await page.getByLabel("Search courses").fill("CS 106B")
  await page.getByRole("button", { name: /Plan CS 106B for Win 2027/ }).first().click()
  await expect(page.locator(".plan-rail").getByText("CS 106B")).toBeVisible()
  await page.reload()
  await page.getByLabel("Planning term").selectOption("TERM-2027-WINTER")
  await expect(page.locator(".plan-rail").getByText("CS 106B")).toBeVisible()
})

test("has no serious accessibility violations", async ({ page }, testInfo) => {
  await page.goto("/demo")
  const results = await new AxeBuilder({ page }).analyze()
  const serious = results.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical")
  expect(serious, `${testInfo.project.name}: ${JSON.stringify(serious, null, 2)}`).toEqual([])
})

test("mobile navigation reaches every tab with the active one lit", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile")
  await page.goto("/demo")
  await expect(page.getByRole("navigation", { name: "Mobile" })).toBeVisible()
  await page.getByRole("navigation", { name: "Mobile" }).getByRole("link", { name: "Calendar" }).click()
  await expect(page.getByRole("heading", { name: "Todos" })).toBeVisible()
  await page.getByRole("navigation", { name: "Mobile" }).getByRole("link", { name: "Courses" }).click()
  await expect(page.getByLabel("Search courses")).toBeVisible()
})
