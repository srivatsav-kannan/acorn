import type { SavedView } from "@/domain/workspace/types"

const blocks = new Set(["plan_summary", "weekly_schedule", "course_list", "course_comparison", "requirement_progress", "checklist", "task_list", "source_list", "decision_table", "document", "collection", "recent_activity", "open_questions"])
const layouts = new Set(["one_column", "two_column"])

export const validateSavedView = (input: Record<string, unknown>, workspaceId: string): SavedView => {
  if (!String(input.id ?? "").match(/^[A-Z][A-Z0-9-]+$/) || !String(input.title ?? "").trim()) throw new Error("Saved view requires a stable ID and title")
  if (!layouts.has(String(input.layout))) throw new Error("Unsupported saved view layout")
  if (!Array.isArray(input.blocks)) throw new Error("Saved view blocks are required")
  if (input.blocks.length > 12) throw new Error("Saved views support at most 12 blocks")
  for (const block of input.blocks as Array<Record<string, unknown>>) {
    if (!blocks.has(String(block.type))) throw new Error("Unsupported saved view block")
    const query = block.query as Record<string, unknown> | undefined
    if (query?.workspaceId && query.workspaceId !== workspaceId) throw new Error("A view cannot query another workspace")
  }
  return structuredClone({ ...input, workspaceId }) as SavedView
}
