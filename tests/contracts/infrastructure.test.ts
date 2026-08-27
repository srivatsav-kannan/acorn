import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { safeNextPath } from "@/lib/auth/redirects"
import { createCourseContextBrowserClient, isSupabaseConfigured } from "@/lib/supabase/browser"

const migration = readFileSync(resolve(process.cwd(), "supabase/migrations/0001_identity_and_workspace.sql"), "utf8")

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
})
