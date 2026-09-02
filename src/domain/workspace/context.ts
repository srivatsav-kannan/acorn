import type { ContextItem, ContextType, WorkspaceState } from "@/domain/workspace/types"

const allowed = new Set<ContextType>(["note", "document", "idea", "question", "task", "link", "source", "claim", "decision", "person", "organization", "club", "commitment", "preference", "goal", "constraint", "uncertainty", "scratch_document"])

export const validateContextItem = <T extends Record<string, unknown>>(item: T): T & { type: ContextType } => {
  if (!allowed.has(item.type as ContextType)) throw new Error("Unsupported context type")
  if (!String(item.id ?? "").trim() || !String(item.title ?? "").trim()) throw new Error("Context item requires an ID and title")
  return structuredClone(item) as T & { type: ContextType }
}

const lines = (items: ContextItem[]) => items.map((item) => `- **${item.title}**: ${item.summary}`).join("\n") || "- None"

export const exportWorkspace = (workspace: WorkspaceState): Record<string, string> => ({
  "workspace.json": JSON.stringify(workspace, null, 2),
  "PROFILE.md": `# Profile\n\n${workspace.profile.summary}\n\nCatalog year: ${workspace.profile.catalogYear}`,
  "PLANS.md": `# Plans\n\n${workspace.plans.map((plan) => `## ${plan.title}\n${plan.scenarios.map((scenario) => `${scenario.name}: ${scenario.courses.filter((course) => course.status === "active").reduce((sum, course) => sum + course.units, 0)} units`).join("\n")}`).join("\n\n")}`,
  "PROGRAMS.md": `# Programs\n\n${workspace.programs.map((program) => `- ${program.name} ${program.credential}`).join("\n")}`,
  "LIBRARY/Inbox.md": `# Inbox\n\n${lines(workspace.contextItems.filter((item) => item.collectionId === "COLLECTION-INBOX"))}`,
  "SOURCES.json": JSON.stringify(workspace.evidence, null, 2),
  "ACTIVITY.jsonl": workspace.activity.map((entry) => JSON.stringify(entry)).join("\n")
})
