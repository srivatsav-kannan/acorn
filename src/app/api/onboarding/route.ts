import { NextResponse } from "next/server"
import { buildFixture } from "@/data/fixture"
import { createCourseContextServerClient, isSupabaseServerConfigured } from "@/lib/supabase/server"
import { loadWorkspaceForUser } from "@/lib/workspace-server"

type OnboardingInput = {
  name?: string
  program?: string
  completedCourseIds?: string[]
  goals?: string
  keepFridayOpen?: boolean
  earliestStart?: string
  unitLimit?: number
}

export async function POST(request: Request) {
  if (!isSupabaseServerConfigured()) return NextResponse.json({ ok: false, message: "Account storage is not configured." }, { status: 503 })
  const client = await createCourseContextServerClient()
  const { data } = await client.auth.getUser()
  if (!data.user) return NextResponse.json({ ok: false, message: "Sign in again to continue." }, { status: 401 })
  if (await loadWorkspaceForUser(client, data.user.id)) return NextResponse.json({ ok: true, existing: true })

  const input = await request.json() as OnboardingInput
  const name = input.name?.trim()
  if (!name || name.length > 80) return NextResponse.json({ ok: false, message: "Enter your name." }, { status: 400 })
  const unitLimit = Math.min(20, Math.max(8, Number(input.unitLimit) || 15))
  const fixture = buildFixture()
  const workspace = fixture.workspace
  workspace.ownerUserId = data.user.id
  workspace.profile.id = `PROFILE-${crypto.randomUUID()}`
  workspace.profile.name = name
  workspace.profile.email = data.user.email ?? ""
  workspace.profile.isFictional = false
  workspace.profile.declaredProgramId = input.program === "PROGRAM-CS-BS" ? "PROGRAM-CS-BS" : null
  workspace.profile.completedCourseIds = (input.completedCourseIds ?? []).filter((id) => fixture.catalog.courses.some((course) => course.id === id))
  workspace.profile.residentCourseIds = [...workspace.profile.completedCourseIds]
  workspace.profile.courseGrades = {}
  workspace.profile.earliestStart = /^\d{2}:\d{2}$/.test(input.earliestStart ?? "") ? input.earliestStart! : "08:30"
  workspace.profile.excludedDays = input.keepFridayOpen ? ["fri"] : []
  workspace.profile.preferences = [
    { id: "PREFERENCE-UNIT-LIMIT", label: `Keep the quarter at or below ${unitLimit} units`, strength: "hard", value: unitLimit },
    ...(input.keepFridayOpen ? [{ id: "PREFERENCE-NO-FRIDAY", label: "Keep Fridays open", strength: "hard" as const, value: true }] : []),
    ...(input.goals?.trim() ? [{ id: "PREFERENCE-GOALS", label: "Current academic goals", strength: "soft" as const, value: input.goals.trim() }] : [])
  ]
  workspace.profile.summary = input.goals?.trim() || `${name} is building a source-backed Autumn plan.`
  workspace.plans[0].scenarios.forEach((scenario) => { scenario.unitLimit = unitLimit })
  workspace.activity = []
  workspace.receipts = []
  workspace.undoSnapshots = {}
  workspace.contextItems = input.goals?.trim() ? [{
    id: `GOAL-${crypto.randomUUID().toUpperCase()}`,
    type: "goal",
    title: "Planning goals",
    summary: input.goals.trim(),
    content: { text: input.goals.trim() },
    collectionId: "COLLECTION-INBOX",
    addedBy: { type: "human", id: data.user.id },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }] : []

  const result = await client.rpc("create_personal_workspace", { workspace_title: `${name}'s workspace`, initial_payload: workspace })
  if (result.error) return NextResponse.json({ ok: false, message: result.error.message }, { status: 400 })
  return NextResponse.json({ ok: true, workspaceId: result.data })
}
