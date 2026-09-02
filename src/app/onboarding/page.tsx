import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { OnboardingPage } from "@/features/onboarding/onboarding-page"
import { createAcornServerClient, isSupabaseServerConfigured } from "@/lib/supabase/server"
import { loadWorkspaceRecordForUser } from "@/lib/workspace-server"

export default async function Page() {
  const jar = await cookies()
  const fixture = process.env.COURSE_CONTEXT_E2E_FIXTURE === "true" && jar.get("course_context_local")?.value === "1"
  if (fixture) return <OnboardingPage browserWorkspace />
  // A signed-in account that already has a workspace never belongs here: a
  // stale ?next= redirect could otherwise walk someone into the form that
  // replaces their workspace. The in-app reset is the one intentional path
  // back, and it flags onboardingRequired first.
  if (isSupabaseServerConfigured()) {
    const client = await createAcornServerClient()
    const { data } = await client.auth.getUser()
    if (data.user) {
      const record = await loadWorkspaceRecordForUser(client, data.user.id).catch(() => null)
      if (record && !record.onboardingRequired) redirect("/app")
    }
  }
  return <OnboardingPage />
}
