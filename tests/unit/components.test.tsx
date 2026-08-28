import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { buildFixture } from "@/data/fixture"
import { buildPersonalWorkspace, buildPersonalWorkspaceWithHistory } from "@/data/personal-workspace"
import { CUSTOM_INSTITUTION_ID } from "@/data/institutions/registry"
import { ExplorePage } from "@/features/explore/explore-page"
import { AppShell } from "@/components/app-shell"
import { StatusState } from "@/components/status-state"
import { LandingPage } from "@/features/landing/landing-page"
import { LoginPage } from "@/features/auth/login-page"
import { PlanPage } from "@/features/plan/plan-page"
import { LibraryPage } from "@/features/library/library-page"
import { ProgramsPage } from "@/features/programs/programs-page"
import { HomePage } from "@/features/home/home-page"
import { OnboardingPage } from "@/features/onboarding/onboarding-page"
import { WorkspaceProvider, useWorkspace } from "@/components/workspace-provider"

const routerSpies = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }))
vi.mock("next/navigation", () => ({ useRouter: () => routerSpies }))

describe("public product surfaces", () => {
  it("asks a new account for only a name and open-ended goal", () => {
    render(<OnboardingPage />)
    expect(screen.getByLabelText("What should we call you?")).toBeVisible()
    expect(screen.getByLabelText(/What would you like help with\?/)).toBeVisible()
    expect(screen.queryByText(/completed courses/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/unit limit/i)).not.toBeInTheDocument()
    expect(screen.getByText(/No sample student data/i)).toBeVisible()
  })

  it("explains the product and exposes both entry paths", () => {
    render(<LandingPage />)
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/academic workspace/i)
    expect(screen.getByRole("link", { name: /demo login/i })).toBeVisible()
    expect(screen.getByRole("link", { name: /create a workspace/i })).toBeVisible()
    expect(screen.getByText(/not an official stanford/i)).toBeVisible()
  })

  it("offers email and demo entry without advertising an unconfigured provider", () => {
    render(<LoginPage demoAvailable />)
    expect(screen.getByRole("button", { name: /email me a sign-in link/i })).toBeVisible()
    expect(screen.queryByRole("button", { name: /continue with google/i })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /sign in with demo credentials/i })).toBeVisible()
    expect(screen.queryByText(/workspace that remembers/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/resettable demo/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/stanford password/i)).not.toBeInTheDocument()
  })

  it("fails clearly into demo mode when hosted authentication is not configured", async () => {
    render(<LoginPage demoAvailable />)
    expect(screen.getByText(/account sign-in is unavailable/i)).toBeVisible()
    expect(screen.queryByRole("button", { name: /continue with google/i })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /email me a sign-in link/i })).toBeDisabled()
    expect(screen.getByRole("button", { name: /sign in with demo credentials/i })).toBeVisible()
  })

  it("signs into the demo through the server credential route", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    vi.stubGlobal("fetch", fetchMock)
    routerSpies.replace.mockClear()
    render(<LoginPage demoAvailable demoRequested />)
    await userEvent.click(screen.getByRole("button", { name: /sign in with demo credentials/i }))
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/demo", { method: "POST" })
    expect(routerSpies.replace).toHaveBeenCalledWith("/app")
    vi.unstubAllGlobals()
  })
})

const DemoResetHarness = () => {
  const workspace = useWorkspace()
  return <button onClick={() => void workspace.reset()}>Reset server demo</button>
}

describe("custom institution workspace", () => {
  const customWorkspace = () => buildPersonalWorkspaceWithHistory({
    userId: "USER-DAVE",
    email: "dave@example.com",
    name: "Dave Smith",
    goal: "Plan my semester without missing requirements.",
    institutionId: CUSTOM_INSTITUTION_ID,
    customInstitutionName: "University of Wherever"
  })

  it("shows the agent-built beta state in the empty catalog", () => {
    const workspace = customWorkspace()
    render(<ExplorePage workspace={workspace} catalog={{ courses: [], sections: [] }} onCommand={vi.fn()} />)
    expect(screen.getByText(/University of Wherever · Beta/i)).toBeVisible()
    expect(screen.getByText(/The catalog starts empty. Your agent fills it./i)).toBeVisible()
    expect(screen.getByText(/extend_reference/)).toBeVisible()
    expect(screen.queryByText(/Stanford Bulletin/i)).not.toBeInTheDocument()
  })

  it("shows the agent-built beta state when no programs exist", () => {
    const workspace = customWorkspace()
    render(<ProgramsPage workspace={workspace} catalog={{ courses: [], sections: [] }} onCommand={vi.fn()} />)
    expect(screen.getByRole("heading", { name: /No programs here yet/i })).toBeVisible()
    expect(screen.getByText(/it can build your program reference/i)).toBeVisible()
  })

  it("offers the WebMCP agent handoff and optional structured history at onboarding", async () => {
    render(<OnboardingPage />)
    expect(screen.getByText(/Already keep your context with an agent\?/i)).toBeVisible()
    expect(screen.getByRole("button", { name: /copy agent instruction/i })).toBeVisible()
    await userEvent.click(screen.getByRole("button", { name: /Other/i }))
    expect(screen.getByLabelText(/university's name/i)).toBeVisible()
    await userEvent.click(screen.getByRole("button", { name: /add academic history now/i }))
    expect(screen.getByLabelText(/class standing/i)).toBeVisible()
    await userEvent.click(screen.getByRole("button", { name: /add a credit/i }))
    expect(screen.getByLabelText("Credit 1 name")).toBeVisible()
  })
})

describe("server demo reset", () => {
  it("calls the reset endpoint and returns to demo login", async () => {
    const fixture = buildFixture()
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    vi.stubGlobal("fetch", fetchMock)
    routerSpies.replace.mockClear()
    render(<WorkspaceProvider mode="account" initialWorkspace={fixture.workspace} userId={fixture.workspace.ownerUserId} catalog={fixture.catalog} isDemoAccount><DemoResetHarness /></WorkspaceProvider>)
    await userEvent.click(screen.getByRole("button", { name: "Reset server demo" }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/demo/reset", { method: "POST" }))
    expect(routerSpies.replace).toHaveBeenCalledWith("/login?demo=1&reset=1")
    vi.unstubAllGlobals()
  })
})

describe("application shell", () => {
  it("renders all primary navigation and account controls", () => {
    render(<AppShell activePage="home" quarter="Autumn 2026"><div>Content</div></AppShell>)
    for (const name of ["Home", "Plan", "Stanford", "Library", "Programs"]) {
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
  it("renders a genuinely empty new account with useful first actions", () => {
    const workspace = buildPersonalWorkspace({ userId: "USER-NEW", email: "new@example.com", name: "Maya", goal: "Explore several fields before choosing a major.", id: () => "ACCOUNT-ONE" })
    const catalog = buildFixture().catalog
    const { rerender } = render(<HomePage workspace={workspace} catalog={catalog} />)
    expect(screen.getByRole("heading", { name: /Good to see you, Maya/i })).toBeVisible()
    expect(screen.getByText(/Nothing scheduled yet/i)).toBeVisible()
    expect(screen.getByText("Not chosen")).toBeVisible()
    expect(screen.queryByText(/Alex/i)).not.toBeInTheDocument()
    rerender(<PlanPage workspace={workspace} catalog={catalog} onCommand={vi.fn()} />)
    expect(screen.getByText("No courses yet")).toBeVisible()
    expect(screen.getByText("Ready when you are")).toBeVisible()
  })

  it("shows scenarios, units, calendar, checks, backups, commitments, and inspector", () => {
    const fixture = buildFixture()
    render(<PlanPage workspace={fixture.workspace} catalog={fixture.catalog} onCommand={vi.fn()} />)
    expect(screen.getByRole("heading", { name: /autumn plan/i })).toBeVisible()
    expect(screen.getAllByText(/15 units/i).length).toBeGreaterThan(0)
    expect(screen.getByLabelText(/weekly calendar/i)).toBeVisible()
    expect(screen.getByText(/Backups/i)).toBeVisible()
    expect(screen.getByRole("heading", { name: "Commitments" })).toBeVisible()
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
    expect(screen.getByText("13 units")).toBeVisible()
    await userEvent.click(screen.getByRole("button", { name: /compare scenarios/i }))
    expect(screen.getByRole("dialog", { name: /compare scenarios/i })).toBeVisible()
    expect(screen.getAllByText("15 units").length).toBeGreaterThan(0)
    expect(screen.getAllByText("13 units").length).toBeGreaterThan(0)
  })

  it("opens the complete deterministic report", async () => {
    const fixture = buildFixture()
    render(<PlanPage workspace={fixture.workspace} catalog={fixture.catalog} onCommand={vi.fn()} />)
    await userEvent.click(screen.getByRole("button", { name: /complete check report/i }))
    expect(screen.getByRole("dialog", { name: /complete check report/i })).toHaveTextContent(/deterministic/i)
  })

  it("shows the degree map with sequencing totals and per term planning", async () => {
    const fixture = buildFixture()
    render(<PlanPage workspace={fixture.workspace} catalog={fixture.catalog} onCommand={vi.fn()} />)
    await userEvent.click(screen.getByRole("tab", { name: /degree map/i }))
    expect(screen.getByText(/of 180 units planned or complete/i)).toBeVisible()
    expect(screen.getByText("Timeline checks")).toBeVisible()
    await userEvent.click(screen.getByRole("tab", { name: /this term/i }))
    const winter = screen.getByRole("tab", { name: /Win 2027/i })
    await userEvent.click(winter)
    expect(screen.getByRole("button", { name: /^Plan Winter 2027$/i })).toBeVisible()
  })

  it("creates a future term plan through the shared command path", async () => {
    const fixture = buildFixture()
    const onCommand = vi.fn()
    render(<PlanPage workspace={fixture.workspace} catalog={fixture.catalog} onCommand={onCommand} />)
    await userEvent.click(screen.getByRole("tab", { name: /Spr 2027/i }))
    await userEvent.click(screen.getByRole("button", { name: /^Plan Spring 2027$/i }))
    expect(onCommand).toHaveBeenCalledWith({ type: "edit_plan", termId: "TERM-2027-SPRING", operations: [] })
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
    for (const state of ["Completed", "Planned", "Open", "Read official details"]) {
      expect(screen.getAllByText(state).length).toBeGreaterThan(0)
    }
    expect(screen.getByText(/Catalog year/i)).toBeVisible()
    expect(screen.getAllByText(/Source/i).length).toBeGreaterThan(0)
  })
})
