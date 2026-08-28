import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { safeNextPath } from "@/lib/auth/redirects"
import { createCourseContextBrowserClient, isSupabaseConfigured } from "@/lib/supabase/browser"

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/0001_identity_and_workspace.sql"), "utf8")
const onboardingMigration = readFileSync(resolve(process.cwd(), "supabase/migrations/0002_account_onboarding.sql"), "utf8")
const demoMigration = readFileSync(resolve(process.cwd(), "supabase/migrations/0003_server_backed_demo.sql"), "utf8")
const onboardingRoute = readFileSync(resolve(process.cwd(), "src/app/api/onboarding/route.ts"), "utf8")
const personalWorkspaceBuilder = readFileSync(resolve(process.cwd(), "src/data/personal-workspace.ts"), "utf8")
const proxySource = readFileSync(resolve(process.cwd(), "src/proxy.ts"), "utf8")
const workspaceRoute = readFileSync(resolve(process.cwd(), "src/app/api/workspace/route.ts"), "utf8")
const workspaceProvider = readFileSync(resolve(process.cwd(), "src/components/workspace-provider.tsx"), "utf8")
const commandEngine = readFileSync(resolve(process.cwd(), "src/domain/commands.ts"), "utf8")
const loginPage = readFileSync(resolve(process.cwd(), "src/features/auth/login-page.tsx"), "utf8")
const signupPage = readFileSync(resolve(process.cwd(), "src/features/auth/signup-page.tsx"), "utf8")
const demoResetRoute = readFileSync(resolve(process.cwd(), "src/app/api/demo/reset/route.ts"), "utf8")

describe("authentication configuration", () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const originalKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalKey
  })

  it("fails clearly when hosted authentication is not configured", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = ""
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = ""
    expect(isSupabaseConfigured()).toBe(false)
    expect(() => createCourseContextBrowserClient()).toThrow(/configuration/i)
  })

  it("requires both public values", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co"
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = ""
    expect(isSupabaseConfigured()).toBe(false)
  })

  it.each([
    ["/app/plan", "/app/plan"],
    [null, "/app"],
    ["https://evil.example", "/app"],
    ["//evil.example/path", "/app"]
  ])("keeps callback redirects on the application origin", (input, expected) => {
    expect(safeNextPath(input)).toBe(expected)
  })
})

describe("Supabase migration contract", () => {
  const tables = ["users", "workspaces", "workspace_memberships", "terms_acceptances", "workspace_snapshots", "workspace_versions", "demo_sessions"]

  it.each(tables)("creates and enables RLS for %s", (table) => {
    expect(migration).toContain(`create table public.${table}`)
    expect(migration).toContain(`alter table public.${table} enable row level security`)
  })

  it("enforces membership-scoped reads and editor-scoped writes", () => {
    expect(migration).toMatch(/workspaces_read_members[\s\S]*is_workspace_member/)
    expect(migration).toMatch(/snapshots_update_editors[\s\S]*owner', 'editor/)
    expect(migration).toMatch(/versions_insert_editors[\s\S]*owner', 'editor/)
  })

  it("uses explicit Data API grants when automatic table exposure is disabled", () => {
    expect(migration).toContain("revoke all on table public.users")
    expect(migration).toContain("grant select, update on table public.users, public.workspaces, public.workspace_snapshots to authenticated")
    expect(migration).toContain("grant select, insert on table public.terms_acceptances, public.workspace_versions to authenticated")
    expect(migration).toContain("revoke all on function public.commit_workspace_snapshot")
  })

  it("uses optimistic versions and immutable history in one database function", () => {
    expect(migration).toContain("commit_workspace_snapshot")
    expect(migration).toContain("version = expected_version")
    expect(migration).toContain("Workspace version conflict")
    expect(migration).toContain("insert into public.workspace_versions")
  })

  it("keeps expired demo cleanup away from ordinary clients", () => {
    expect(migration).toContain("delete_expired_demo_workspaces")
    expect(migration).toContain("revoke all on function public.delete_expired_demo_workspaces() from public")
  })

  it("creates one isolated workspace through an authenticated onboarding function", () => {
    expect(onboardingMigration).toContain("create_personal_workspace")
    expect(onboardingMigration).toContain("auth.uid()")
    expect(onboardingMigration).toContain("A workspace already exists for this account")
    expect(onboardingMigration).toContain("workspace_memberships")
    expect(onboardingMigration).toContain("workspace_snapshots")
    expect(onboardingMigration).toContain("revoke all on function public.create_personal_workspace")
  })

  it("keeps the demo identity and workspace while resetting the active snapshot to onboarding", () => {
    const resetFunction = demoMigration.slice(
      demoMigration.indexOf("create or replace function public.reset_demo_workspace"),
      demoMigration.indexOf("create or replace function public.complete_demo_onboarding")
    )
    expect(demoMigration).toContain("onboarding_required boolean not null default false")
    expect(demoMigration).toContain("is_permanent_demo boolean not null default false")
    expect(demoMigration).toContain("reset_demo_workspace")
    expect(resetFunction).toContain("public.is_demo_identity()")
    expect(resetFunction).toContain("workspace.is_permanent_demo = true")
    expect(resetFunction).toContain("for update of snapshot")
    expect(demoMigration).toContain("onboarding_required = true")
    expect(demoMigration).toContain("insert into public.workspace_versions")
    expect(resetFunction).not.toMatch(/delete from public\.(users|workspaces|workspace_memberships)/)
    expect(demoMigration).toContain("workspace.is_permanent_demo = false")
    expect(demoMigration).toContain("workspace.onboarding_required = false")
    expect(demoResetRoute).toContain("reset_demo_workspace")
    expect(demoResetRoute).toContain("client.auth.signOut()")
  })

  it("authenticates every account with a password and nothing fancier", () => {
    expect(loginPage).toContain("signInWithPassword")
    expect(loginPage).not.toContain("signInWithOtp")
    expect(loginPage).not.toContain("signInWithOAuth")
    expect(signupPage).toContain("auth.signUp")
    expect(signupPage).toContain("INSTITUTION-STANFORD")
    expect(signupPage).toContain("identities?.length === 0")
    expect(loginPage).not.toContain("workspace that remembers")
    expect(loginPage).not.toContain("resettable demo")
  })

  it("builds authenticated accounts without importing the fictional fixture", () => {
    expect(onboardingRoute).toContain("buildPersonalWorkspace")
    expect(onboardingRoute).not.toContain("buildFixture")
    expect(personalWorkspaceBuilder).not.toContain("buildFixture")
    expect(personalWorkspaceBuilder).toContain("declaredProgramId: null")
    expect(personalWorkspaceBuilder).toContain("completedCourseIds: []")
    expect(personalWorkspaceBuilder).toContain("preferences: []")
    expect(personalWorkspaceBuilder).toContain("courses: []")
    expect(personalWorkspaceBuilder).toContain("commitments: []")
  })

  it("fails closed instead of substituting demo state for an authenticated account", () => {
    expect(workspaceProvider).toContain('if (mode === "account")')
    expect(workspaceProvider).toContain('throw new Error("Authenticated workspace data is required")')
    expect(commandEngine).not.toContain('"USER-DEMO"')
  })

  it("keeps demo reset server-side and demo-gated", () => {
    expect(demoResetRoute).toContain("reset_demo_workspace")
    expect(demoResetRoute).toContain("client.auth.signOut()")
  })

  it("gives every account the same onboarding-returning reset", () => {
    const accountResetRoute = readFileSync(resolve(process.cwd(), "src/app/api/account/reset/route.ts"), "utf8")
    const workspaceServer = readFileSync(resolve(process.cwd(), "src/lib/workspace-server.ts"), "utf8")
    expect(accountResetRoute).toContain("commit_workspace_snapshot")
    expect(accountResetRoute).toContain("setupPending = true")
    expect(accountResetRoute).toContain("client.auth.getUser()")
    expect(workspaceServer).toContain("setupPending")
    expect(onboardingRoute).toContain("commit_workspace_snapshot")
  })

  it("sends payload-flag re-onboarding through the commit path even for the demo account", () => {
    // complete_demo_onboarding requires the database onboarding_required
    // column, which the in-app reset never sets. Guarding on isDemo alone
    // stranded a reset demo account at 'Demo onboarding is not available'.
    const workspaceServer = readFileSync(resolve(process.cwd(), "src/lib/workspace-server.ts"), "utf8")
    expect(workspaceServer).toContain("columnOnboardingRequired")
    expect(onboardingRoute).toContain("existing.isDemo && existing.columnOnboardingRequired")
    expect(onboardingRoute).not.toMatch(/existing && !existing\.isDemo\) \{/)
  })

  it("protects account routes and confines browser fixture mode to automated tests", () => {
    expect(proxySource).toContain("course_context_demo")
    expect(proxySource).toContain('COURSE_CONTEXT_E2E_FIXTURE === "true"')
    expect(proxySource).toContain("client.auth.getUser()")
    expect(proxySource).toContain("/onboarding")
  })

  it("confines the cookie fixture to the test flag in every entry point", () => {
    const startRoute = readFileSync(resolve(process.cwd(), "src/app/start/route.ts"), "utf8")
    const appLayout = readFileSync(resolve(process.cwd(), "src/app/app/layout.tsx"), "utf8")
    for (const source of [proxySource, onboardingRoute, appLayout]) {
      expect(source).toContain('COURSE_CONTEXT_E2E_FIXTURE === "true"')
    }
    expect(proxySource).toMatch(/COURSE_CONTEXT_E2E_FIXTURE === "true"[\s\S]{0,220}course_context_local/)
    expect(onboardingRoute).toMatch(/COURSE_CONTEXT_E2E_FIXTURE === "true"[\s\S]{0,220}course_context_local/)
    expect(appLayout).toMatch(/COURSE_CONTEXT_E2E_FIXTURE === "true"[\s\S]{0,320}course_context_local/)
    expect(startRoute).toMatch(/COURSE_CONTEXT_E2E_FIXTURE !== "true"/)
  })

  it("requires an authenticated account for every non-fixture workspace", () => {
    const appLayout = readFileSync(resolve(process.cwd(), "src/app/app/layout.tsx"), "utf8")
    expect(appLayout).toContain("isSupabaseServerConfigured()")
    expect(appLayout).toContain('redirect("/login")')
    expect(appLayout).toContain("loadWorkspaceRecordForUser")
    expect(proxySource).toContain("client.auth.getUser()")
    expect(proxySource).toContain("/login?next=")
  })

  it("validates ownership and optimistic versions before persisted commits", () => {
    expect(workspaceRoute).toContain("workspace.ownerUserId !== data.user.id")
    expect(workspaceRoute).toContain("workspace.version !== Number(body.expectedVersion) + 1")
    expect(workspaceRoute).toContain("VERSION_CONFLICT")
  })
})
