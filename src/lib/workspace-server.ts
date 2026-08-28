import type { SupabaseClient } from "@supabase/supabase-js"
import type { WorkspaceState } from "@/domain/types"

export type WorkspaceRecord = {
  id: string
  isDemo: boolean
  onboardingRequired: boolean
  workspace: WorkspaceState
}

export const loadWorkspaceRecordForUser = async (client: SupabaseClient, userId: string): Promise<WorkspaceRecord | null> => {
  const membership = await client.from("workspace_memberships").select("workspace_id").eq("user_id", userId).order("created_at", { ascending: true }).limit(1).maybeSingle()
  if (membership.error) throw membership.error
  if (!membership.data?.workspace_id) return null
  const metadata = await client.from("workspaces").select("id,is_demo,onboarding_required").eq("id", membership.data.workspace_id).single()
  if (metadata.error) throw metadata.error
  const snapshot = await client.from("workspace_snapshots").select("version,payload").eq("workspace_id", membership.data.workspace_id).single()
  if (snapshot.error) throw snapshot.error
  const workspace = structuredClone(snapshot.data.payload) as WorkspaceState
  workspace.version = Number(snapshot.data.version)
  return {
    id: metadata.data.id,
    isDemo: Boolean(metadata.data.is_demo),
    onboardingRequired: Boolean(metadata.data.onboarding_required),
    workspace
  }
}
