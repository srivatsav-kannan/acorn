import type { SupabaseClient } from "@supabase/supabase-js"
import type { WorkspaceState } from "@/domain/types"

export const loadWorkspaceForUser = async (client: SupabaseClient, userId: string) => {
  const membership = await client.from("workspace_memberships").select("workspace_id").eq("user_id", userId).order("created_at", { ascending: true }).limit(1).maybeSingle()
  if (membership.error) throw membership.error
  if (!membership.data?.workspace_id) return null
  const snapshot = await client.from("workspace_snapshots").select("version,payload").eq("workspace_id", membership.data.workspace_id).single()
  if (snapshot.error) throw snapshot.error
  const workspace = structuredClone(snapshot.data.payload) as WorkspaceState
  workspace.version = Number(snapshot.data.version)
  return workspace
}
