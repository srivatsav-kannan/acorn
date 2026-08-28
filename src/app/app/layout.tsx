import { AppShell } from "@/components/app-shell"
import { WorkspaceProvider } from "@/components/workspace-provider"
import { buildStanfordCatalog } from "@/data/fixture"
import { createCourseContextServerClient, isSupabaseServerConfigured } from "@/lib/supabase/server"
import { loadWorkspaceRecordForUser } from "@/lib/workspace-server"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  if (cookieStore.get("course_context_local")?.value === "1") return <WorkspaceProvider mode="fixture" localAccount><AppShell>{children}</AppShell></WorkspaceProvider>
  if (process.env.COURSE_CONTEXT_E2E_FIXTURE === "true" && cookieStore.get("course_context_demo")?.value === "1") return <WorkspaceProvider mode="fixture"><AppShell>{children}</AppShell></WorkspaceProvider>
  if (!isSupabaseServerConfigured()) redirect("/start")
  const client = await createCourseContextServerClient()
  const { data } = await client.auth.getUser()
  if (!data.user) redirect("/login")
  const record = await loadWorkspaceRecordForUser(client, data.user.id)
  if (!record || record.onboardingRequired) redirect("/onboarding")
  return <WorkspaceProvider mode="account" initialWorkspace={record.workspace} userId={data.user.id} userEmail={data.user.email ?? ""} catalog={buildStanfordCatalog()} isDemoAccount={record.isDemo}><AppShell>{children}</AppShell></WorkspaceProvider>
}
