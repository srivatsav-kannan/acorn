import type { Actor, Evidence, WorkspaceState } from "@/domain/types"
import { assertSafeExternalUrl } from "@/domain/security"

export type EvidenceQuestion = "description" | "offering" | "meeting_time" | "program_requirement" | "workload"

export const authorityForQuestion = (question: EvidenceQuestion) => ({
  description: "catalog",
  offering: "term_schedule",
  meeting_time: "term_schedule",
  program_requirement: "program_requirements",
  workload: "experiential"
} as const)[question]

export const isEvidenceStale = (evidence: Evidence, now = new Date()) => evidence.status === "stale" || Boolean(evidence.expiresAt && new Date(evidence.expiresAt) < now)

type EvidenceInput = Omit<Partial<Evidence>, "classification" | "status" | "addedBy"> & {
  classification?: unknown
  status?: unknown
  addedBy?: unknown
  trustLabel?: unknown
}

export const researchLibraryItemId = (evidenceId: string) => `SOURCE-${evidenceId.replace(/[^A-Za-z0-9-]/g, "-")}`

export const validateEvidence = (input: EvidenceInput): Evidence => {
  if (!input.sourceUrl || !input.sourceTitle || !input.retrievedAt) throw new Error("Evidence requires a source URL, source title, and retrieval time")
  assertSafeExternalUrl(input.sourceUrl)
  if (!input.claim?.trim()) throw new Error("Evidence requires a claim")
  const confidence = input.confidence ?? 0.8
  if (confidence < 0 || confidence > 1) throw new Error("Evidence confidence must be between zero and one")
  const classification = ["official", "experiential", "student", "derived"].includes(String(input.classification)) ? input.classification as Evidence["classification"] : String(input.trustLabel ?? "").startsWith("official") ? "official" : "derived"
  const status = ["current", "stale", "superseded"].includes(String(input.status)) ? input.status as Evidence["status"] : "current"
  const addedBy = ["human", "agent", "system"].includes(String(input.addedBy)) ? input.addedBy as Evidence["addedBy"] : "agent"
  return {
    id: String(input.id ?? "").trim(),
    title: typeof input.title === "string" ? input.title.trim() : undefined,
    classification,
    claim: input.claim.trim(),
    sourceUrl: input.sourceUrl,
    sourceTitle: input.sourceTitle.trim(),
    retrievedAt: input.retrievedAt,
    expiresAt: input.expiresAt,
    confidence,
    status,
    addedBy,
    untrustedExternalContent: input.untrustedExternalContent ?? true,
    authority: input.authority
  }
}

export const upsertResearchLibraryItem = (workspace: WorkspaceState, evidence: Evidence, actor: Actor, now = new Date().toISOString()) => {
  if (!workspace.collections.some((collection) => collection.id === "COLLECTION-RESEARCH")) workspace.collections.push({ id: "COLLECTION-RESEARCH", name: "Research", description: "Research context" })
  const existing = workspace.contextItems.find((item) => item.sourceEvidenceIds?.includes(evidence.id))
  const item = existing ?? {
    id: researchLibraryItemId(evidence.id),
    type: "source" as const,
    title: "",
    summary: "",
    content: {},
    collectionId: "COLLECTION-RESEARCH",
    sourceEvidenceIds: [evidence.id],
    addedBy: actor,
    createdAt: now
  }
  item.title = evidence.title || evidence.sourceTitle
  item.summary = evidence.claim
  item.content = { claim: evidence.claim, sourceUrl: evidence.sourceUrl, sourceTitle: evidence.sourceTitle, retrievedAt: evidence.retrievedAt, classification: evidence.classification, confidence: evidence.confidence }
  item.collectionId = "COLLECTION-RESEARCH"
  item.sourceEvidenceIds = [evidence.id]
  item.addedBy = actor
  item.updatedAt = now
  item.archived = false
  if (!existing) workspace.contextItems.push(item)
  return item
}

// Requirements every Stanford undergraduate carries, seeded once as system
// todos so a brand-new workspace already knows what the university expects.
export const defaultSystemTodos = () => [
  { id: "TODO-LANGUAGE-REQUIREMENT", title: "Plan the language requirement", detail: "One year of college-level language study, or placement, or an AP or SAT II result that satisfies it.", done: false, source: "system" as const, createdAt: "2026-08-28T00:00:00Z" },
  { id: "TODO-PWR-1", title: "Schedule PWR 1 during the first year", detail: "Writing and rhetoric, required of every first-year student.", done: false, source: "system" as const, createdAt: "2026-08-28T00:00:00Z" },
  { id: "TODO-WAYS-CHECK", title: "Review WAYS coverage each quarter", detail: "Eleven courses across eight Ways of Thinking, Ways of Doing areas by graduation.", done: false, source: "system" as const, createdAt: "2026-08-28T00:00:00Z" }
]

// Older stored workspaces predate the tracker fields; give them the current
// shape so every page and tool can rely on it.
export const normalizeWorkspaceShape = (workspace: WorkspaceState): WorkspaceState => {
  workspace.todos = Array.isArray(workspace.todos) ? workspace.todos : defaultSystemTodos()
  workspace.events = Array.isArray(workspace.events) ? workspace.events : []
  workspace.interestedCourseIds = Array.isArray(workspace.interestedCourseIds) ? workspace.interestedCourseIds : []
  workspace.interestedOpportunityIds = Array.isArray(workspace.interestedOpportunityIds) ? workspace.interestedOpportunityIds : []
  workspace.courseNotes = workspace.courseNotes && typeof workspace.courseNotes === "object" ? workspace.courseNotes : {}
  workspace.activities = Array.isArray(workspace.activities) ? workspace.activities : []
  return workspace
}

// Institutional records the system owns follow the shipped definitions, so
// a rename like ExploreCourses becoming Navigator reaches workspaces that
// stored the old wording. Only addedBy "system" rows are touched, and only
// their descriptive fields; student and agent records are never rewritten.
export const refreshSystemEvidence = (workspace: WorkspaceState, shipped: Evidence[]) => {
  const byId = new Map(shipped.map((item) => [item.id, item]))
  workspace.evidence = workspace.evidence.map((item) => {
    const current = item.addedBy === "system" ? byId.get(item.id) : undefined
    return current ? { ...item, title: current.title, claim: current.claim, sourceUrl: current.sourceUrl, sourceTitle: current.sourceTitle, classification: current.classification, confidence: current.confidence } : item
  })
  return workspace
}

export const materializeLegacyResearch = (workspace: WorkspaceState) => {
  const migrated = structuredClone(workspace)
  for (const evidence of migrated.evidence) {
    const referenced = migrated.contextItems.some((item) => item.sourceEvidenceIds?.includes(evidence.id))
    if (!referenced && evidence.addedBy !== "system") upsertResearchLibraryItem(migrated, validateEvidence(evidence as EvidenceInput), { type: evidence.addedBy === "human" ? "human" : "agent", id: "MIGRATION" }, evidence.retrievedAt)
  }
  return normalizeWorkspaceShape(migrated)
}
