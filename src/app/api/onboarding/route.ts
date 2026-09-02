import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { CUSTOM_INSTITUTION_ID } from "@/data/institutions/registry"
import { buildPersonalWorkspace } from "@/data/workspace/personal-workspace"
import { createAcornServerClient, isSupabaseServerConfigured } from "@/lib/supabase/server"
import { loadWorkspaceRecordForUser } from "@/lib/workspace-server"

type OnboardingInput = {
  name?: string
  institutionId?: string
  customInstitution?: string
  entryYear?: number
  gradYear?: number
}

const validateInput = (input: OnboardingInput): string | null => {
  const name = input.name?.trim() ?? ""
  const customInstitution = input.customInstitution?.trim() ?? ""
  const entryYear = Number(input.entryYear)
  const gradYear = Number(input.gradYear)
  if (name.length < 1 || name.length > 80) return "Enter your name."
  if (input.institutionId === CUSTOM_INSTITUTION_ID && (customInstitution.length < 2 || customInstitution.length > 80)) return "Enter your university's name."
  if (!Number.isInteger(entryYear) || entryYear < 2015 || entryYear > 2035) return "Choose your entry year."
  if (!Number.isInteger(gradYear) || gradYear <= entryYear || gradYear > entryYear + 8) return "Choose a graduation year after your entry year."
  return null
}

export async function POST(request: Request) {
  const input = await request.json().catch(() => null) as OnboardingInput | null
  if (!input || typeof input !== "object") return NextResponse.json({ ok: false, message: "Send the onboarding facts as JSON." }, { status: 400 })
  const invalid = validateInput(input)
  if (invalid) return NextResponse.json({ ok: false, message: invalid }, { status: 400 })
  const customInstitution = input.customInstitution?.trim() ?? ""
  const entryYear = Number(input.entryYear)
  const gradYear = Number(input.gradYear)

  // Playwright's fixture workspace goes through the same builder accounts
  // use, then lives in that test browser's storage. Real onboarding is always
  // account-backed below; this branch does not exist outside the test flag.
  const jar = await cookies()
  if (process.env.COURSE_CONTEXT_E2E_FIXTURE === "true" && process.env.NODE_ENV !== "production" && jar.get("course_context_local")?.value === "1") {
    try {
      const workspace = buildPersonalWorkspace({
        userId: "USER-LOCAL",
        email: "",
        name: input.name?.trim(),
        institutionId: input.institutionId,
        customInstitutionName: customInstitution || undefined,
        entryYear,
        gradYear
      })
      return NextResponse.json({ ok: true, workspace })
    } catch (error) {
      return NextResponse.json({ ok: false, message: (error as Error).message }, { status: 400 })
    }
  }

  if (!isSupabaseServerConfigured()) return NextResponse.json({ ok: false, message: "Account storage is not configured." }, { status: 503 })
  const client = await createAcornServerClient()
  const { data } = await client.auth.getUser()
  if (!data.user) return NextResponse.json({ ok: false, message: "Sign in again to continue." }, { status: 401 })
  const existing = await loadWorkspaceRecordForUser(client, data.user.id)
  if (existing && !existing.onboardingRequired) return NextResponse.json({ ok: true, existing: true })

  let workspace
  try {
    workspace = buildPersonalWorkspace({
      userId: data.user.id,
      email: data.user.email ?? "",
      name: input.name?.trim(),
      institutionId: input.institutionId,
      customInstitutionName: customInstitution || undefined,
      entryYear,
      gradYear
    })
  } catch (error) {
    return NextResponse.json({ ok: false, message: (error as Error).message }, { status: 400 })
  }
  // A reset account re-onboards in place: the new payload replaces the old
  // snapshot under the same workspace and clears the pending flag with it.
  // This covers every payload-flag reset, the shared demo account included;
  // only a database-side demo reset goes through the demo completion function.
  if (existing && !(existing.isDemo && existing.columnOnboardingRequired)) {
    workspace.id = existing.workspace.id
    workspace.version = existing.workspace.version + 1
    const commit = await client.rpc("commit_workspace_snapshot", {
      target_workspace_id: existing.workspace.id,
      expected_version: existing.workspace.version,
      next_payload: workspace,
      mutation_idempotency_key: `ONBOARD-${crypto.randomUUID()}`
    })
    if (commit.error) return NextResponse.json({ ok: false, message: "Your workspace could not be created. Log in to finish setup." }, { status: 400 })
    return NextResponse.json({ ok: true, workspaceId: existing.workspace.id })
  }
  const result = await client.rpc(existing ? "complete_demo_onboarding" : "create_personal_workspace", { workspace_title: workspace.title, initial_payload: workspace })
  if (result.error) return NextResponse.json({ ok: false, message: "Your workspace could not be created. Log in to finish setup." }, { status: 400 })
  return NextResponse.json({ ok: true, workspaceId: result.data })
}
