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

export const materializeLegacyResearch = (workspace: WorkspaceState) => {
  const migrated = structuredClone(workspace)
  for (const evidence of migrated.evidence) {
    const referenced = migrated.contextItems.some((item) => item.sourceEvidenceIds?.includes(evidence.id))
    if (!referenced && evidence.addedBy !== "system") upsertResearchLibraryItem(migrated, validateEvidence(evidence as EvidenceInput), { type: evidence.addedBy === "human" ? "human" : "agent", id: "MIGRATION" }, evidence.retrievedAt)
  }
  return migrated
}
