import { NextResponse } from "next/server"
import { CUSTOM_INSTITUTION_ID } from "@/data/institutions/registry"
import { buildPersonalWorkspaceWithHistory } from "@/data/personal-workspace"
import { createCourseContextServerClient, isSupabaseServerConfigured } from "@/lib/supabase/server"
import { loadWorkspaceRecordForUser } from "@/lib/workspace-server"

type OnboardingInput = {
  name?: string
  goal?: string
  institutionId?: string
  customInstitution?: string
  academicHistory?: Record<string, unknown>
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
  const customInstitution = input.customInstitution?.trim() ?? ""
  if (!name || name.length > 80) return NextResponse.json({ ok: false, message: "Enter the name you want to use here." }, { status: 400 })
  if (!goal || goal.length > 1200) return NextResponse.json({ ok: false, message: "Tell us what you want help figuring out." }, { status: 400 })
  if (input.institutionId === CUSTOM_INSTITUTION_ID && (customInstitution.length < 2 || customInstitution.length > 80)) {
    return NextResponse.json({ ok: false, message: "Enter your university's name." }, { status: 400 })
  }

  let workspace
  try {
    workspace = buildPersonalWorkspaceWithHistory({
      userId: data.user.id,
      email: data.user.email ?? "",
      name,
      goal,
      institutionId: input.institutionId,
      customInstitutionName: customInstitution || undefined,
      academicHistory: input.academicHistory
    })
  } catch (error) {
    return NextResponse.json({ ok: false, message: (error as Error).message }, { status: 400 })
  }
  const result = await client.rpc(existing ? "complete_demo_onboarding" : "create_personal_workspace", { workspace_title: workspace.title, initial_payload: workspace })
  if (result.error) return NextResponse.json({ ok: false, message: result.error.message }, { status: 400 })
  return NextResponse.json({ ok: true, workspaceId: result.data })
}
