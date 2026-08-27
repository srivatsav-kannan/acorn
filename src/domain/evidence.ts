import type { Evidence } from "@/domain/types"
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

export const validateEvidence = (input: Evidence): Evidence => {
  if (!input.sourceUrl || !input.sourceTitle || !input.retrievedAt) throw new Error("Evidence requires a source URL, source title, and retrieval time")
  assertSafeExternalUrl(input.sourceUrl)
  if (!input.claim?.trim()) throw new Error("Evidence requires a claim")
  if (input.confidence < 0 || input.confidence > 1) throw new Error("Evidence confidence must be between zero and one")
  return structuredClone(input)
}
