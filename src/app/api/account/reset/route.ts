import { NextResponse } from "next/server"
import { buildPersonalWorkspace } from "@/data/personal-workspace"
import { createAcornServerClient, isSupabaseServerConfigured } from "@/lib/supabase/server"
import { loadWorkspaceRecordForUser } from "@/lib/workspace-server"

// Any account can wipe its workspace back to onboarding. The reset commits a
// fresh payload carrying setupPending, which the app layout reads as
// onboarding-required until the student re-enters their facts.
export async function POST() {
  if (!isSupabaseServerConfigured()) return NextResponse.json({ ok: false, message: "Account storage is not configured." }, { status: 503 })
  const client = await createAcornServerClient()
  const { data } = await client.auth.getUser()
  if (!data.user) return NextResponse.json({ ok: false, message: "Sign in again to continue." }, { status: 401 })
  const record = await loadWorkspaceRecordForUser(client, data.user.id)
  if (!record) return NextResponse.json({ ok: false, message: "No workspace to reset." }, { status: 404 })
  const fresh = buildPersonalWorkspace({ userId: data.user.id, email: data.user.email ?? "" })
  fresh.id = record.workspace.id
  fresh.version = record.workspace.version + 1
  fresh.setupPending = true
  const result = await client.rpc("commit_workspace_snapshot", {
    target_workspace_id: record.workspace.id,
    expected_version: record.workspace.version,
    next_payload: fresh,
    mutation_idempotency_key: `RESET-${crypto.randomUUID()}`
  })
  if (result.error) return NextResponse.json({ ok: false, message: "The workspace could not be reset." }, { status: 400 })
  return NextResponse.json({ ok: true })
}
