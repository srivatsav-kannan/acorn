import { NextResponse } from "next/server"
import { buildPersonalWorkspace } from "@/data/personal-workspace"
import { createCourseContextServerClient, isSupabaseServerConfigured } from "@/lib/supabase/server"
import { loadWorkspaceRecordForUser } from "@/lib/workspace-server"

type OnboardingInput = {
  name?: string
  goal?: string
  institutionId?: string
}

export async function POST(request: Request) {
  if (!isSupabaseServerConfigured()) return NextResponse.json({ ok: false, message: "Account storage is not configured." }, { status: 503 })
  const client = await createCourseContextServerClient()
  const { data } = await client.auth.getUser()
  if (!data.user) return NextResponse.json({ ok: false, message: "Sign in again to continue." }, { status: 401 })
  const existing = await loadWorkspaceRecordForUser(client, data.user.id)
  if (existing && (!existing.isDemo || !existing.onboardingRequired)) return NextResponse.json({ ok: true, existing: true })

  const input = await request.json() as OnboardingInput
  const name = input.name?.trim() ?? ""
  const goal = input.goal?.trim() ?? ""
  if (!name || name.length > 80) return NextResponse.json({ ok: false, message: "Enter the name you want to use here." }, { status: 400 })
  if (!goal || goal.length > 1200) return NextResponse.json({ ok: false, message: "Tell us what you want help figuring out." }, { status: 400 })

  const workspace = buildPersonalWorkspace({ userId: data.user.id, email: data.user.email ?? "", name, goal, institutionId: input.institutionId })
  const result = await client.rpc(existing ? "complete_demo_onboarding" : "create_personal_workspace", { workspace_title: `${name}'s workspace`, initial_payload: workspace })
  if (result.error) return NextResponse.json({ ok: false, message: result.error.message }, { status: 400 })
  return NextResponse.json({ ok: true, workspaceId: result.data })
}
