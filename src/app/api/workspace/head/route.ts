import { NextResponse } from "next/server"
import { createAcornServerClient, isSupabaseServerConfigured } from "@/lib/supabase/server"

// A commit whose acknowledgement is lost leaves the client unsure whether it
// landed. This endpoint answers that in a few hundred bytes: the current
// snapshot version and the idempotency key that produced it, so the client
// can adopt or roll back its local state without re-downloading the payload.
export async function GET() {
  if (!isSupabaseServerConfigured()) return NextResponse.json({ ok: false, code: "NOT_CONFIGURED" }, { status: 503 })
  const client = await createAcornServerClient()
  const { data } = await client.auth.getUser()
  if (!data.user) return NextResponse.json({ ok: false, code: "UNAUTHORIZED" }, { status: 401 })
  const membership = await client.from("workspace_memberships").select("workspace_id").eq("user_id", data.user.id).order("created_at", { ascending: true }).limit(1).maybeSingle()
  if (!membership.data) return NextResponse.json({ ok: false, code: "WORKSPACE_NOT_FOUND" }, { status: 404 })
  const snapshot = await client.from("workspace_snapshots").select("version").eq("workspace_id", membership.data.workspace_id).single()
  if (snapshot.error) return NextResponse.json({ ok: false, code: "WORKSPACE_NOT_FOUND" }, { status: 404 })
  const committed = await client.from("workspace_versions").select("idempotency_key").eq("workspace_id", membership.data.workspace_id).eq("version", snapshot.data.version).maybeSingle()
  return NextResponse.json({ ok: true, version: snapshot.data.version, idempotencyKey: committed.data?.idempotency_key ?? null })
}
