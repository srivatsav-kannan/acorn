import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { buildFixture } from "@/data/fixture"
import { AppShell } from "@/components/app-shell"
import { StatusState } from "@/components/status-state"
import { LandingPage } from "@/features/landing/landing-page"
import { LoginPage } from "@/features/auth/login-page"
import { PlanPage } from "@/features/plan/plan-page"
import { LibraryPage } from "@/features/library/library-page"
import { ProgramsPage } from "@/features/programs/programs-page"

describe("public product surfaces", () => {
  it("explains the product and exposes both entry paths", () => {
    render(<LandingPage />)
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/academic workspace/i)
    expect(screen.getByRole("link", { name: /try the demo/i })).toBeVisible()
    expect(screen.getByRole("link", { name: /create a workspace/i })).toBeVisible()
    expect(screen.getByText(/not an official stanford/i)).toBeVisible()
  })

  it("offers demo, Google, and email login without asking for Stanford credentials", () => {
    render(<LoginPage />)
    expect(screen.getByRole("button", { name: /continue with google/i })).toBeVisible()
    expect(screen.getByRole("button", { name: /email link/i })).toBeVisible()
    expect(screen.getByRole("link", { name: /use the demo/i })).toBeVisible()
    expect(screen.queryByText(/stanford password/i)).not.toBeInTheDocument()
  })

  it("fails clearly into demo mode when hosted authentication is not configured", async () => {
    render(<LoginPage />)
    await userEvent.click(screen.getByRole("button", { name: /continue with google/i }))
    expect(screen.getByRole("status")).toHaveTextContent(/not configured.*use the demo/i)
  })
})

describe("application shell", () => {
  it("renders all primary navigation and account controls", () => {
    render(<AppShell activePage="home" quarter="Autumn 2026"><div>Content</div></AppShell>)
    for (const name of ["Home", "Plan", "Explore", "Library", "Programs"]) {
      expect(screen.getByRole("link", { name })).toBeVisible()
    }
    expect(screen.getByRole("button", { name: /search workspace/i })).toBeVisible()
    expect(screen.getByRole("button", { name: /activity/i })).toBeVisible()
    expect(screen.getByRole("link", { name: /account/i })).toHaveAttribute("href", "/app/settings")
  })
})

describe("required product states", () => {
  it.each([
    ["loading", "Loading workspace"],
    ["empty", "Nothing here yet"],
    ["partial", "Some information is missing"],
    ["stale", "Information needs review"],
    ["permission", "You do not have access"],
    ["error", "Something went wrong"],
    ["rollback", "Your change was not saved"],
    ["success", "Saved"]
  ] as const)("renders %s", (kind, text) => {
    render(<StatusState kind={kind} />)
    expect(screen.getByText(text)).toBeVisible()
  })
})

describe("planning workspace", () => {
  it("shows scenarios, units, calendar, checks, backups, commitments, and inspector", () => {
    const fixture = buildFixture()
    render(<PlanPage workspace={fixture.workspace} catalog={fixture.catalog} onCommand={vi.fn()} />)
    expect(screen.getByRole("heading", { name: /autumn plan/i })).toBeVisible()
    expect(screen.getByText(/14 units/i)).toBeVisible()
    expect(screen.getByLabelText(/weekly calendar/i)).toBeVisible()
    expect(screen.getByText(/Backups/i)).toBeVisible()
    expect(screen.getByText(/Commitments/i)).toBeVisible()
    expect(screen.getByText(/Plan checks/i)).toBeVisible()
  })

  it("routes a human plan edit through the semantic command callback", async () => {
    const fixture = buildFixture()
    const onCommand = vi.fn()
    render(<PlanPage workspace={fixture.workspace} catalog={fixture.catalog} onCommand={onCommand} />)
    await userEvent.click(screen.getByRole("button", { name: /remove design foundations/i }))
    expect(onCommand).toHaveBeenCalledWith(expect.objectContaining({ type: "edit_plan" }))
  })

  it("switches to a real lighter scenario and compares alternatives", async () => {
    const fixture = buildFixture()
    render(<PlanPage workspace={fixture.workspace} catalog={fixture.catalog} onCommand={vi.fn()} />)
    const lighterTab = screen.getByRole("tab", { name: /lighter option/i })
    await userEvent.click(lighterTab)
    expect(lighterTab).toHaveAttribute("aria-selected", "true")
    expect(screen.getByText("12 units")).toBeVisible()
    await userEvent.click(screen.getByRole("button", { name: /compare scenarios/i }))
    expect(screen.getByRole("dialog", { name: /compare scenarios/i })).toBeVisible()
    expect(screen.getAllByText("14 units").length).toBeGreaterThan(0)
    expect(screen.getAllByText("12 units").length).toBeGreaterThan(0)
  })

  it("opens agent guidance and the complete deterministic report", async () => {
    const fixture = buildFixture()
    render(<PlanPage workspace={fixture.workspace} catalog={fixture.catalog} onCommand={vi.fn()} />)
    await userEvent.click(screen.getByRole("button", { name: /ask agent to refine/i }))
    expect(screen.getByRole("dialog", { name: /refine with your agent/i })).toHaveTextContent(/11.*semantic tools/i)
    await userEvent.click(screen.getByRole("button", { name: /close agent handoff/i }))
    await userEvent.click(screen.getByRole("button", { name: /complete check report/i }))
    expect(screen.getByRole("dialog", { name: /complete check report/i })).toHaveTextContent(/deterministic/i)
  })

  it("supports the accessible list calendar and routes new scenarios through commands", async () => {
    const fixture = buildFixture()
    const onCommand = vi.fn()
    render(<PlanPage workspace={fixture.workspace} catalog={fixture.catalog} onCommand={onCommand} />)
    await userEvent.click(screen.getByRole("button", { name: "List" }))
    expect(screen.getByRole("button", { name: "List" })).toHaveAttribute("aria-pressed", "true")
    await userEvent.click(screen.getByRole("button", { name: /add scenario/i }))
    expect(onCommand).toHaveBeenCalledWith(expect.objectContaining({ type: "edit_plan", operations: [expect.objectContaining({ type: "create_scenario" })] }))
  })
})

describe("Library", () => {
  it("shows collections, attribution, sources, and quick capture", () => {
    const fixture = buildFixture()
    render(<LibraryPage workspace={fixture.workspace} onCommand={vi.fn()} />)
    for (const name of ["Inbox", "Courses", "Programs", "People", "Clubs", "Research", "Decisions"]) {
      expect(screen.getByText(name)).toBeVisible()
    }
    expect(screen.getByRole("button", { name: /add to workspace/i })).toBeVisible()
    expect(screen.getByText(/Added by agent/i)).toBeVisible()
  })

  it.each(["note", "task", "link", "person", "club", "idea", "question", "decision", "commitment", "scratch document"])("captures a %s", async (type) => {
    const fixture = buildFixture()
    const onCommand = vi.fn()
    render(<LibraryPage workspace={fixture.workspace} onCommand={onCommand} />)
    await userEvent.click(screen.getByRole("button", { name: /add to workspace/i }))
    await userEvent.selectOptions(screen.getByLabelText(/type/i), type)
    await userEvent.type(screen.getByLabelText(/title/i), `A ${type}`)
    await userEvent.click(screen.getByRole("button", { name: /^save$/i }))
    expect(onCommand).toHaveBeenCalledWith(expect.objectContaining({ type: "create_context_item" }))
  })
})

describe("Programs", () => {
  it("shows completed, planned, missing, and uncertain requirement states", () => {
    const fixture = buildFixture()
    render(<ProgramsPage workspace={fixture.workspace} catalog={fixture.catalog} onCommand={vi.fn()} />)
    for (const state of ["Completed", "Planned", "Missing", "Needs review"]) {
      expect(screen.getByText(state)).toBeVisible()
    }
    expect(screen.getByText(/Catalog year/i)).toBeVisible()
    expect(screen.getByText(/Source/i)).toBeVisible()
  })
})
