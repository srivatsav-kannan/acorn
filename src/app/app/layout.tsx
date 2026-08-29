import { AppShell } from "@/components/app-shell"
import { WorkspaceProvider } from "@/components/workspace-provider"
import { buildStanfordCatalog } from "@/data/fixture"
import { createCourseContextServerClient, isSupabaseServerConfigured } from "@/lib/supabase/server"
import { loadWorkspaceRecordForUser } from "@/lib/workspace-server"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

// The catalog is static shipped data; rebuilding its fifteen thousand
// courses on every request burned seconds of server time per page load.
const catalog = buildStanfordCatalog()

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  if (process.env.COURSE_CONTEXT_E2E_FIXTURE === "true") {
    const cookieStore = await cookies()
    if (cookieStore.get("course_context_local")?.value === "1") return <WorkspaceProvider mode="fixture" localAccount><AppShell>{children}</AppShell></WorkspaceProvider>
    if (cookieStore.get("course_context_demo")?.value === "1") return <WorkspaceProvider mode="fixture"><AppShell>{children}</AppShell></WorkspaceProvider>
  }
  if (!isSupabaseServerConfigured()) redirect("/login?error=auth_configuration")
  const client = await createCourseContextServerClient()
  const { data } = await client.auth.getUser()
  if (!data.user) redirect("/login")
  const record = await loadWorkspaceRecordForUser(client, data.user.id)
  if (!record || record.onboardingRequired) redirect("/onboarding")
  return <WorkspaceProvider mode="account" initialWorkspace={record.workspace} userId={data.user.id} userEmail={data.user.email ?? ""} catalog={catalog} isDemoAccount={record.isDemo}><AppShell>{children}</AppShell></WorkspaceProvider>
}
