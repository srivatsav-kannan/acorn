import { NextResponse } from "next/server"
import { buildPersonalWorkspace } from "@/data/personal-workspace"
import { isDemoAccountEmail } from "@/lib/demo-account"
import { createCourseContextServerClient, isSupabaseServerConfigured } from "@/lib/supabase/server"

export async function POST() {
  if (!isSupabaseServerConfigured()) return NextResponse.json({ ok: false, message: "Account storage is not configured." }, { status: 503 })
  const client = await createCourseContextServerClient()
  const { data } = await client.auth.getUser()
  if (!data.user || !isDemoAccountEmail(data.user.email)) return NextResponse.json({ ok: false, message: "Demo account required." }, { status: 403 })
  const resetPayload = buildPersonalWorkspace({
    userId: data.user.id,
    email: data.user.email ?? "",
    name: "Demo student",
    goal: "Complete onboarding to begin."
  })
  const result = await client.rpc("reset_demo_workspace", {
    reset_payload: resetPayload,
    mutation_idempotency_key: `DEMO-RESET-${crypto.randomUUID()}`
  })
  if (result.error) return NextResponse.json({ ok: false, message: "The demo could not be reset." }, { status: 400 })
  await client.auth.signOut()
  return NextResponse.json({ ok: true, workspaceVersion: Number(result.data) })
}
