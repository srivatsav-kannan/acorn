import { NextResponse } from "next/server"
import { CUSTOM_INSTITUTION_ID } from "@/data/institutions/registry"
import { buildPersonalWorkspace } from "@/data/personal-workspace"
import { createCourseContextServerClient, isSupabaseServerConfigured } from "@/lib/supabase/server"
import { loadWorkspaceRecordForUser } from "@/lib/workspace-server"

type OnboardingInput = {
  institutionId?: string
  customInstitution?: string
  entryYear?: number
  gradYear?: number
}

export async function POST(request: Request) {
  if (!isSupabaseServerConfigured()) return NextResponse.json({ ok: false, message: "Account storage is not configured." }, { status: 503 })
  const client = await createCourseContextServerClient()
  const { data } = await client.auth.getUser()
  if (!data.user) return NextResponse.json({ ok: false, message: "Sign in again to continue." }, { status: 401 })
  const existing = await loadWorkspaceRecordForUser(client, data.user.id)
  if (existing && (!existing.isDemo || !existing.onboardingRequired)) return NextResponse.json({ ok: true, existing: true })

  const input = await request.json() as OnboardingInput
  const customInstitution = input.customInstitution?.trim() ?? ""
  const entryYear = Number(input.entryYear)
  const gradYear = Number(input.gradYear)
  if (input.institutionId === CUSTOM_INSTITUTION_ID && (customInstitution.length < 2 || customInstitution.length > 80)) {
    return NextResponse.json({ ok: false, message: "Enter your university's name." }, { status: 400 })
  }
  if (!Number.isInteger(entryYear) || entryYear < 2015 || entryYear > 2035) {
    return NextResponse.json({ ok: false, message: "Choose your entry year." }, { status: 400 })
  }
  if (!Number.isInteger(gradYear) || gradYear <= entryYear || gradYear > entryYear + 8) {
    return NextResponse.json({ ok: false, message: "Choose a graduation year after your entry year." }, { status: 400 })
  }

  let workspace
  try {
    workspace = buildPersonalWorkspace({
      userId: data.user.id,
      email: data.user.email ?? "",
      institutionId: input.institutionId,
      customInstitutionName: customInstitution || undefined,
      entryYear,
      gradYear
    })
  } catch (error) {
    return NextResponse.json({ ok: false, message: (error as Error).message }, { status: 400 })
  }
  const result = await client.rpc(existing ? "complete_demo_onboarding" : "create_personal_workspace", { workspace_title: workspace.title, initial_payload: workspace })
  if (result.error) return NextResponse.json({ ok: false, message: result.error.message }, { status: 400 })
  return NextResponse.json({ ok: true, workspaceId: result.data })
}
