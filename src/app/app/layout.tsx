import { WorkspaceProvider } from "@/components/workspace-provider"
import { buildStanfordCatalog } from "@/data/fixture"
import { createCourseContextServerClient, isSupabaseServerConfigured } from "@/lib/supabase/server"
import { loadWorkspaceForUser } from "@/lib/workspace-server"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  if (cookieStore.get("course_context_demo")?.value === "1") return <WorkspaceProvider mode="demo">{children}</WorkspaceProvider>
  if (!isSupabaseServerConfigured()) redirect("/login?reason=account_setup_required")
  const client = await createCourseContextServerClient()
  const { data } = await client.auth.getUser()
  if (!data.user) redirect("/login")
  const workspace = await loadWorkspaceForUser(client, data.user.id)
  if (!workspace) redirect("/onboarding")
  return <WorkspaceProvider mode="account" initialWorkspace={workspace} userId={data.user.id} userEmail={data.user.email ?? ""} catalog={buildStanfordCatalog()}>{children}</WorkspaceProvider>
}
