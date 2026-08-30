import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { buildFixture } from "@/data/fixture"
import { AppShell } from "@/components/app-shell"
import { StatusState } from "@/components/status-state"
import { LandingPage } from "@/features/landing/landing-page"
import { LoginPage } from "@/features/auth/login-page"
import { SignupPage } from "@/features/auth/signup-page"
import { OnboardingPage } from "@/features/onboarding/onboarding-page"
import { ScratchpadPage } from "@/features/scratchpad/scratchpad-page"
import { CalendarPage } from "@/features/calendar/calendar-page"
import { AcademicsPage } from "@/features/academics/academics-page"
import { ActivitiesPage } from "@/features/activities/activities-page"
import { CollaboratePage } from "@/features/collaborate/collaborate-page"
import { ProfilePage } from "@/features/profile/profile-page"
import { WorkspaceProvider, useWorkspace } from "@/components/workspace-provider"

const routerSpies = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }))
vi.mock("next/navigation", () => ({ useRouter: () => routerSpies, usePathname: () => "/app" }))

const renderInWorkspace = (children: React.ReactNode) => {
  localStorage.clear()
  return render(<WorkspaceProvider mode="fixture">{children}</WorkspaceProvider>)
}

describe("public product surfaces", () => {
  it("asks for a name and the durable timeline facts, with dropdowns for everything durable", () => {
    render(<OnboardingPage />)
    expect(screen.getByLabelText("Name")).toBeVisible()
    expect(screen.getByLabelText("University")).toBeVisible()
    expect(screen.getByLabelText("Entered in autumn")).toBeVisible()
    expect(screen.getByLabelText("Graduating in spring")).toBeVisible()
    expect(screen.getAllByRole("textbox")).toHaveLength(1)
  })

  it("asks for the school's name only when Other is chosen", async () => {
    render(<OnboardingPage />)
    const university = screen.getByLabelText("University") as HTMLSelectElement
    await userEvent.selectOptions(university, screen.getByRole("option", { name: "Another university" }))
    expect(university.value).toBe("INSTITUTION-CUSTOM")
    expect(screen.getByLabelText("University name")).toBeVisible()
  })

  it("explains the product in three use cases and routes into the account flow", () => {
    render(<LandingPage />)
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(/every quarter to graduation/i)
    const starts = screen.getAllByRole("link", { name: /start planning/i })
    expect(starts.length).toBeGreaterThan(0)
    for (const link of starts) expect(link).toHaveAttribute("href", "/signup")
    expect(screen.getByRole("link", { name: /log in/i })).toBeVisible()
    expect(screen.getByRole("heading", { name: /braindump, get a schedule/i })).toBeVisible()
    expect(screen.getByRole("heading", { name: /tired of re-explaining yourself/i })).toBeVisible()
    expect(screen.getByText(/twenty-two real tools/i)).toBeVisible()
    expect(screen.getByText(/not affiliated with stanford/i)).toBeVisible()
  })

  it("greets a signed-in student with their own door", () => {
    render(<LandingPage signedIn />)
    const opens = screen.getAllByRole("link", { name: /open your workspace/i })
    expect(opens.length).toBeGreaterThan(0)
    for (const link of opens) expect(link).toHaveAttribute("href", "/app")
    expect(screen.queryByRole("link", { name: /start planning/i })).not.toBeInTheDocument()
  })

  it("logs in with an email and a password, nothing fancier", () => {
    render(<LoginPage />)
    expect(screen.getByLabelText("Email")).toBeVisible()
    expect(screen.getByLabelText("Password")).toBeVisible()
    expect(screen.getByRole("button", { name: "Log in" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /create an account/i })).toHaveAttribute("href", "/signup")
    expect(screen.queryByText(/sign-in link/i)).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /google/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /demo/i })).not.toBeInTheDocument()
  })

  it("signs up with name, credentials, and the two dates the map derives from", () => {
    render(<SignupPage />)
    expect(screen.getByLabelText("Name")).toBeVisible()
    expect(screen.getByLabelText("Email")).toBeVisible()
    expect(screen.getByLabelText("Password")).toBeVisible()
    expect(screen.getByLabelText("Entered Stanford in autumn")).toBeVisible()
    expect(screen.getByLabelText("Graduating in spring")).toBeVisible()
    expect(screen.getByRole("button", { name: "Create account" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /log in/i })).toHaveAttribute("href", "/login")
  })

  it("fails closed when account storage is not configured", async () => {
    render(<LoginPage />)
    expect(screen.getByText(/account sign-in is unavailable/i)).toBeVisible()
    expect(screen.getByRole("button", { name: "Log in" })).toBeDisabled()
  })
})

const DemoResetHarness = () => {
  const workspace = useWorkspace()
  return <button onClick={() => void workspace.reset()}>Reset server demo</button>
}

describe("account reset", () => {
  it("resets any signed-in account back to onboarding through the shared route", async () => {
    const fixture = buildFixture()
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) })
    vi.stubGlobal("fetch", fetchMock)
    routerSpies.replace.mockClear()
    render(<WorkspaceProvider mode="account" initialWorkspace={fixture.workspace} userId={fixture.workspace.ownerUserId} catalog={fixture.catalog}><DemoResetHarness /></WorkspaceProvider>)
    await userEvent.click(screen.getByRole("button", { name: "Reset server demo" }))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/account/reset", { method: "POST" }))
    expect(routerSpies.replace).toHaveBeenCalledWith("/onboarding")
    vi.unstubAllGlobals()
  })
})

describe("application shell", () => {
  it("renders the five tabs plus account controls with the active tab lit", () => {
    render(<AppShell quarter="Autumn 2026"><div>Content</div></AppShell>)
    for (const name of ["Calendar", "Academics", "Activities", "Scratchpad", "Collaborate"]) {
      expect(screen.getByRole("link", { name })).toBeVisible()
    }
    expect(screen.getByRole("link", { name: "Calendar" })).toHaveAttribute("aria-current", "page")
    expect(screen.getByRole("link", { name: "Academics" })).not.toHaveAttribute("aria-current")
    expect(screen.getByRole("button", { name: /search workspace/i })).toBeVisible()
    expect(screen.getByRole("button", { name: /activity/i })).toBeVisible()
    expect(screen.getByRole("link", { name: /account/i })).toHaveAttribute("href", "/app/profile")
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

describe("scratchpad", () => {
  it("holds goals, takes a jot with tags, and shows it immediately", async () => {
    renderInWorkspace(<ScratchpadPage />)
    expect(screen.getByRole("heading", { name: "Scratchpad" })).toBeVisible()
    expect(screen.getByLabelText("Degree objective")).toBeVisible()
    await userEvent.type(screen.getByLabelText("Jot something down"), "SLE sounds intense but tempting")
    await userEvent.type(screen.getByLabelText("Tags"), "residences, humanities")
    await userEvent.click(screen.getByRole("button", { name: "Add to scratchpad" }))
    expect(await screen.findByText("SLE sounds intense but tempting")).toBeVisible()
    expect(screen.getAllByText("residences").length).toBeGreaterThan(0)
  })
})

describe("calendar", () => {
  it("shows the standing headline, seeded Stanford todos, and adds one", async () => {
    renderInWorkspace(<CalendarPage />)
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/year|calendar/i)
    expect(screen.getByText("Plan the language requirement")).toBeVisible()
    expect(screen.getByText("Schedule PWR 1 during the first year")).toBeVisible()
    await userEvent.click(screen.getByRole("button", { name: /^Add$/ }))
    await userEvent.click(screen.getByRole("radio", { name: "Todo" }))
    await userEvent.type(screen.getByLabelText("Title"), "Email Prof. Rivera")
    await userEvent.click(screen.getByRole("button", { name: "Add todo" }))
    expect(await screen.findByText("Email Prof. Rivera")).toBeVisible()
  })

  it("keeps events separate from todos, with descriptions behind a click", async () => {
    renderInWorkspace(<CalendarPage />)
    expect(screen.getByRole("tab", { name: "Events" })).toBeVisible()
    expect(screen.getByRole("tab", { name: "Todos" })).toBeVisible()
    await userEvent.click(screen.getByRole("button", { name: /^Add$/ }))
    await userEvent.type(screen.getByLabelText("Title"), "Flight home")
    await userEvent.clear(screen.getByLabelText("Date"))
    await userEvent.type(screen.getByLabelText("Date"), "2026-12-13")
    await userEvent.type(screen.getByRole("textbox", { name: "Details" }), "SFO to CDG over winter closure.")
    await userEvent.click(screen.getByRole("button", { name: "Add event" }))
    await userEvent.click(screen.getByRole("tab", { name: "Events" }))
    const row = await screen.findByRole("button", { name: /Flight home/ })
    await userEvent.click(row)
    const inspector = screen.getByRole("complementary", { name: "Selection details" })
    expect(await within(inspector).findByText("SFO to CDG over winter closure.")).toBeVisible()
    expect(within(inspector).getByRole("heading", { name: "Flight home" })).toBeVisible()
    expect(screen.getByLabelText("Times shown in")).toBeVisible()
  })
})

describe("academics and activities", () => {
  it("searches the catalog and marks interest", async () => {
    renderInWorkspace(<AcademicsPage />)
    expect(screen.getByRole("tab", { name: "Courses" })).toHaveAttribute("aria-selected", "true")
    await userEvent.type(screen.getByLabelText("Search courses"), "CS 106B")
    expect((await screen.findAllByText(/Programming Abstractions/)).length).toBeGreaterThan(0)
    await userEvent.click(screen.getAllByRole("button", { name: "Interested" })[0])
    expect((await screen.findAllByRole("button", { name: /Interested ✓/ })).length).toBeGreaterThan(0)
  })

  it("lists shipped clubs with join and interest, and joining creates a real activity", async () => {
    renderInWorkspace(<ActivitiesPage />)
    expect(await screen.findByText("TreeHacks")).toBeVisible()
    const card = screen.getByText("TreeHacks").closest("article") as HTMLElement
    await userEvent.click(within(card).getByRole("button", { name: "Interested" }))
    expect(await within(card).findByRole("button", { name: /Interested ✓/ })).toBeVisible()
    await userEvent.click(within(card).getByRole("button", { name: "Join" }))
    expect((await screen.findAllByText("Joined ✓")).length).toBeGreaterThan(0)
    const mine = screen.getByRole("heading", { name: "Mine" }).closest("section") as HTMLElement
    expect(await within(mine).findByRole("heading", { name: "TreeHacks" })).toBeVisible()
  })

  it("keeps completed courses and all three credit kinds in the history tab", async () => {
    renderInWorkspace(<AcademicsPage initialTab="history" />)
    expect(screen.getByRole("heading", { name: "Credit before Stanford" })).toBeVisible()
    expect(screen.getByRole("heading", { name: "Completed courses" })).toBeVisible()
    await userEvent.click(screen.getByRole("button", { name: "Add credit" }))
    for (const kind of ["AP", "IB", "College course"]) {
      expect(screen.getByRole("radio", { name: kind })).toBeVisible()
    }
    await userEvent.click(screen.getByRole("radio", { name: "IB" }))
    expect(screen.getByLabelText("Subject")).toBeVisible()
    expect(screen.getByLabelText("Units Stanford granted")).toBeVisible()
    await userEvent.click(screen.getByRole("radio", { name: "College course" }))
    expect(screen.getByLabelText("College or university")).toBeVisible()
  })
})

describe("collaborate", () => {
  it("states the capability plainly and lists every registered tool", () => {
    renderInWorkspace(<CollaboratePage />)
    expect(screen.getByRole("heading", { name: "Work with your agent" })).toBeVisible()
    expect(screen.getByText("No agent bridge detected in this browser")).toBeVisible()
    for (const name of ["export_context", "ingest_context", "edit_plan", "manage_activity"]) {
      expect(screen.getAllByText(name).length).toBeGreaterThan(0)
    }
    expect(screen.getByRole("heading", { name: "If your agent needs an introduction" })).toBeVisible()
    expect(screen.getByText(/Start with get_planning_context/)).toBeVisible()
  })
})

describe("profile", () => {
  it("treats the enrollment dates as high-risk and asks before rebuilding", async () => {
    renderInWorkspace(<ProfilePage />)
    expect(screen.getByLabelText("Name")).toHaveValue("Alex Chen")
    await userEvent.selectOptions(screen.getByLabelText("Graduating in spring"), "2030")
    expect(await screen.findByRole("alertdialog")).toHaveTextContent(/Rebuild the map/)
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }))
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument()
  })

  it("offers every account the guarded full reset and no account labels", async () => {
    renderInWorkspace(<ProfilePage />)
    expect(screen.queryByText(/demo/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/fixture/i)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Reset workspace" }))
    expect(screen.getByRole("button", { name: "Yes, reset everything" })).toBeVisible()
    await userEvent.click(screen.getByRole("button", { name: "Keep my workspace" }))
    expect(screen.queryByRole("button", { name: "Yes, reset everything" })).not.toBeInTheDocument()
  })
})
