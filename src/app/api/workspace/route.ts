import { NextResponse } from "next/server"
import type { WorkspaceState } from "@/domain/types"
import { createCourseContextServerClient, isSupabaseServerConfigured } from "@/lib/supabase/server"
import { loadWorkspaceRecordForUser } from "@/lib/workspace-server"

const unauthorized = () => NextResponse.json({ ok: false, code: "UNAUTHORIZED", message: "Sign in again to continue." }, { status: 401 })

export async function GET() {
  if (!isSupabaseServerConfigured()) return NextResponse.json({ ok: false, code: "NOT_CONFIGURED" }, { status: 503 })
  const client = await createCourseContextServerClient()
  const { data } = await client.auth.getUser()
  if (!data.user) return unauthorized()
  const record = await loadWorkspaceRecordForUser(client, data.user.id)
  if (!record || record.onboardingRequired) return NextResponse.json({ ok: false, code: "WORKSPACE_NOT_FOUND" }, { status: 404 })
  return NextResponse.json({ ok: true, workspace: record.workspace })
}

export async function PUT(request: Request) {
  if (!isSupabaseServerConfigured()) return NextResponse.json({ ok: false, code: "NOT_CONFIGURED" }, { status: 503 })
  const client = await createCourseContextServerClient()
  const { data } = await client.auth.getUser()
  if (!data.user) return unauthorized()
  const body = await request.json() as { expectedVersion?: number, workspace?: WorkspaceState, idempotencyKey?: string }
  const workspace = body.workspace
  if (!workspace || !Number.isInteger(body.expectedVersion) || workspace.version !== Number(body.expectedVersion) + 1 || workspace.ownerUserId !== data.user.id) {
    return NextResponse.json({ ok: false, code: "INVALID_WORKSPACE", message: "The workspace payload or version is invalid." }, { status: 400 })
  }
  const currentRecord = await loadWorkspaceRecordForUser(client, data.user.id)
  const current = currentRecord?.workspace
  if (!currentRecord || currentRecord.onboardingRequired || !current || current.id !== workspace.id) return NextResponse.json({ ok: false, code: "FORBIDDEN" }, { status: 403 })
  const result = await client.rpc("commit_workspace_snapshot", {
    target_workspace_id: workspace.id,
    expected_version: body.expectedVersion,
    next_payload: workspace,
    mutation_idempotency_key: body.idempotencyKey ?? `WEB-${crypto.randomUUID()}`
  })
  if (result.error) {
    const conflict = result.error.code === "40001" || result.error.message.includes("version conflict")
    return NextResponse.json({ ok: false, code: conflict ? "VERSION_CONFLICT" : "PERSISTENCE_FAILED", message: conflict ? "The workspace changed in another session. Reloaded the newest version." : "The change could not be saved." }, { status: conflict ? 409 : 500 })
  }
  return NextResponse.json({ ok: true, workspaceVersion: Number(result.data) })
}
