import { describe, expect, it } from "vitest"
import { buildFixture } from "@/data/workspace/fixture"
import { getInstitution, institutions, listInstitutionChoices, plannedInstitutions } from "@/data/institutions/registry"
import { buildStanfordOpportunities, stanfordCatalogMeta, stanfordInstitution } from "@/data/institutions/stanford"
import { executeCommand } from "@/domain/workspace/commands"
import { isOverlayCourse, mergeCatalog, mergedCatalogFor, mergedOpportunities, referenceChanges, validateOpportunity, validateOverlayCourse, validateOverlaySection, workspaceOverlay } from "@/domain/workspace/reference"
import { MemoryWorkspaceRepository } from "@/store/memory-repository"

const actor = { type: "agent" as const, id: "AGENT-TEST" }
const envelope = (command: Record<string, unknown>, expectedVersion = 1, key = "REF-001") => ({
  actor,
  ownerUserId: "USER-DEMO",
  workspaceId: "WORKSPACE-DEMO",
  expectedVersion,
  idempotencyKey: key,
  command
})

const referenceEvidence = {
  id: "EVIDENCE-CS-329S",
  title: "CS 329S offering",
  classification: "official",
  claim: "CS 329S is offered this term.",
  sourceUrl: "https://navigator.stanford.edu/classes?q=CS+329S",
  sourceTitle: "Stanford Navigator",
  retrievedAt: "2026-08-28T00:00:00Z",
  confidence: 0.95,
  status: "current"
}

describe("institution registry", () => {
  it("ships Stanford as a full reference and honest placeholders for other universities", () => {
    expect(institutions.map((item) => item.slug)).toContain("stanford")
    expect(stanfordInstitution.status).toBe("full")
    expect(plannedInstitutions.length).toBeGreaterThanOrEqual(3)
    expect(plannedInstitutions.every((item) => item.status === "planned" && item.coverageNote.length > 20)).toBe(true)
    const choices = listInstitutionChoices()
    expect(choices[0]).toMatchObject({ id: "INSTITUTION-STANFORD", status: "full" })
    expect(choices.length).toBe(institutions.length + plannedInstitutions.length + 1)
    expect(choices[choices.length - 1]).toMatchObject({ id: "INSTITUTION-CUSTOM", status: "custom" })
  })

  it("falls back to Stanford for unknown institution IDs", () => {
    expect(getInstitution("nowhere").slug).toBe("stanford")
    expect(getInstitution(undefined).slug).toBe("stanford")
    expect(getInstitution("INSTITUTION-STANFORD").slug).toBe("stanford")
  })

  it("provides a broad, source-attributed Stanford pack", () => {
    const catalog = stanfordInstitution.buildCatalog()
    expect(catalog.courses.length).toBeGreaterThanOrEqual(90)
    expect(catalog.sections.length).toBeGreaterThanOrEqual(60)
    const programs = stanfordInstitution.buildPrograms()
    expect(programs.length).toBeGreaterThanOrEqual(10)
    const cs = programs.find((program) => program.id === "PROGRAM-CS-BS")!
    expect(cs.requirements.length).toBeGreaterThanOrEqual(10)
    const ways = programs.find((program) => program.id === "PROGRAM-WAYS-GER")!
    expect(ways.requirements.length).toBe(9)
    expect(stanfordInstitution.resources.some((resource) => resource.kind === "community")).toBe(true)
    const courseIds = new Set(catalog.courses.map((course) => course.id))
    for (const course of catalog.courses) for (const prerequisite of course.prerequisites ?? []) expect(courseIds.has(prerequisite)).toBe(true)
    for (const section of catalog.sections) expect(courseIds.has(section.courseId)).toBe(true)
  })
})

describe("imported catalog", () => {
  it("carries the complete catalog import with curated course rows winning collisions", () => {
    const catalog = stanfordInstitution.buildCatalog()
    expect(stanfordCatalogMeta.courses).toBeGreaterThan(15000)
    expect(catalog.courses.length).toBeGreaterThan(15000)
    const cs106b = catalog.courses.find((course) => course.code === "CS 106B")!
    expect(cs106b.prerequisites).toEqual(["COURSE-CS-106A"])
    expect(cs106b.ways).toContain("FR")
    const importedOnly = catalog.courses.find((course) => course.code === "ATHLETIC 50")
    expect(importedOnly).toBeDefined()
    expect(importedOnly?.offeredSeasons).toBeTruthy()
    const importedSection = catalog.sections.find((section) => section.evidenceIds.includes("EVIDENCE-EXPLORECOURSES-IMPORT"))
    expect(importedSection).toBeDefined()
    const ids = new Set(catalog.courses.map((course) => course.id))
    expect(catalog.courses.length).toBe(ids.size)
  })

  it("builds WAYS groups from official designations in the import", () => {
    const ways = stanfordInstitution.buildPrograms().find((program) => program.id === "PROGRAM-WAYS-GER")!
    expect(ways.requirements).toHaveLength(9)
    const formalReasoning = ways.requirements.find((requirement) => requirement.id === "REQUIREMENT-WAYS-FR")!
    expect(formalReasoning.rule).toMatchObject({ type: "course_group", count: 1 })
    expect((formalReasoning.rule as { courseIds: string[] }).courseIds.length).toBeGreaterThan(20)
  })
})

describe("opportunity directory", () => {
  const opportunityEvidence = { id: "EVIDENCE-OPP-TEST", title: "Club listing", classification: "student", claim: "A listing.", sourceUrl: "https://example.edu/club", sourceTitle: "Club", retrievedAt: "2026-08-28T00:00:00Z", confidence: 0.7, status: "current" }

  it("ships a starting directory and validates additions", () => {
    const base = buildStanfordOpportunities()
    expect(base.length).toBeGreaterThanOrEqual(12)
    expect(base.every((item) => ["club", "research", "program"].includes(item.kind))).toBe(true)
    expect(new Set(base.map((item) => item.id)).size).toBe(base.length)
    expect(validateOpportunity({ name: "Chess Club", summary: "Weekly games.", kind: "club" }).id).toBe("OPPORTUNITY-CHESS-CLUB")
    expect(() => validateOpportunity({ name: "X", summary: "", kind: "club" })).toThrow(/summary/)
    expect(() => validateOpportunity({ name: "X", summary: "Y", kind: "empire" })).toThrow(/kind/)
    expect(() => validateOpportunity({ name: "X", summary: "Y", kind: "club", url: "javascript:x" })).toThrow()
  })

  it("adds, amends with a visible diff, and restores through commands", async () => {
    const repository = new MemoryWorkspaceRepository(buildFixture())
    const envelope = (command: Record<string, unknown>, expectedVersion: number, key: string) => ({ actor: { type: "agent" as const, id: "AGENT-TEST" }, ownerUserId: "USER-DEMO", workspaceId: "WORKSPACE-DEMO", expectedVersion, idempotencyKey: key, command })
    const added = await executeCommand(repository, envelope({ type: "extend_reference_opportunity", opportunity: { kind: "club", name: "Quantum Computing Association", summary: "Talks and reading groups on quantum computing." }, evidence: opportunityEvidence }, 1, "OPP-1"))
    expect(added).toMatchObject({ ok: true, primaryVisibleId: "OPPORTUNITY-QUANTUM-COMPUTING-ASSOCIATION" })

    const base = buildStanfordOpportunities()
    const shipped = base.find((item) => item.id === "OPPORTUNITY-CURIS")!
    const amended = await executeCommand(repository, envelope({ type: "extend_reference_opportunity", opportunity: { ...shipped, timing: "Applications open in January", addedBy: undefined }, evidence: { ...opportunityEvidence, id: "EVIDENCE-OPP-AMEND" } }, 2, "OPP-2"))
    expect(amended.ok).toBe(true)
    const workspace = await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")
    const merged = mergedOpportunities(base, workspace.referenceOverlay?.opportunities)
    expect(merged.filter((item) => item.id === "OPPORTUNITY-CURIS")).toHaveLength(1)
    const current = merged.find((item) => item.id === "OPPORTUNITY-CURIS")!
    const changes = referenceChanges(shipped as unknown as Record<string, unknown>, current as unknown as Record<string, unknown>, ["name", "summary", "url", "commitment", "timing"])
    expect(changes).toEqual([{ field: "timing", label: "Timing", was: "Applications open winter quarter", now: "Applications open in January" }])

    const restored = await executeCommand(repository, envelope({ type: "remove_reference_opportunity", opportunityId: "OPPORTUNITY-CURIS" }, 3, "OPP-3"))
    expect(restored.ok).toBe(true)
    const after = await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")
    expect(after.referenceOverlay?.opportunities?.some((item) => item.id === "OPPORTUNITY-CURIS")).toBe(false)
    await expect(executeCommand(repository, envelope({ type: "remove_reference_opportunity", opportunityId: "OPPORTUNITY-CURIS" }, 4, "OPP-4"))).rejects.toThrow(/shipped reference/)
  })
})

describe("reference overlay", () => {
  it("merges overlay courses and sections over the shipped catalog", () => {
    const base = { courses: [{ id: "COURSE-A", code: "A 1", title: "A", description: "", subject: "A", level: 1, minUnits: 3, maxUnits: 3, tags: [] }], sections: [] }
    const overlay = {
      courses: [
        { id: "COURSE-A", code: "A 1", title: "A corrected", description: "", subject: "A", level: 1, minUnits: 4, maxUnits: 4, tags: [] },
        { id: "COURSE-B", code: "B 1", title: "B", description: "", subject: "B", level: 1, minUnits: 3, maxUnits: 3, tags: [] }
      ],
      sections: []
    }
    const merged = mergeCatalog(base, overlay)
    expect(merged.courses).toHaveLength(2)
    expect(merged.courses.find((course) => course.id === "COURSE-A")?.title).toBe("A corrected")
    expect(mergeCatalog(base, undefined)).toBe(base)
  })

  it("adds an agent-contributed course through the shared command layer", async () => {
    const repository = new MemoryWorkspaceRepository(buildFixture())
    const receipt = await executeCommand(repository, envelope({
      type: "extend_reference",
      course: { code: "CS 329S", title: "Machine Learning Systems Design", subject: "CS", level: 300, units: 3, sourceUrl: "https://navigator.stanford.edu/classes" },
      section: { units: 3, meetings: [{ days: ["mon", "wed"], start: "13:30", end: "14:50", location: "Gates B01" }] },
      evidence: referenceEvidence
    }))
    expect(receipt).toMatchObject({ ok: true, visibleChange: true, primaryVisibleId: "COURSE-CS-329S" })
    const workspace = await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")
    expect(isOverlayCourse(workspace, "COURSE-CS-329S")).toBe(true)
    expect(workspaceOverlay(workspace).sections).toHaveLength(1)
    const merged = mergedCatalogFor(workspace, repository.catalog)
    expect(merged.courses.some((course) => course.code === "CS 329S")).toBe(true)
    expect(workspace.contextItems.some((item) => item.sourceEvidenceIds?.includes("EVIDENCE-CS-329S"))).toBe(true)
    const removal = await executeCommand(repository, envelope({ type: "remove_reference_course", courseId: "COURSE-CS-329S" }, 2, "REF-002"))
    expect(removal.ok).toBe(true)
    const after = await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")
    expect(workspaceOverlay(after).courses).toHaveLength(0)
    expect(workspaceOverlay(after).sections).toHaveLength(0)
  })

  it("rejects reference additions without a valid source or shape", async () => {
    const repository = new MemoryWorkspaceRepository(buildFixture())
    await expect(executeCommand(repository, envelope({ type: "extend_reference", course: { code: "CS 1", title: "X" }, evidence: { ...referenceEvidence, sourceUrl: "javascript:alert(1)" } }))).rejects.toThrow()
    await expect(executeCommand(repository, envelope({ type: "extend_reference", course: { code: "", title: "X" }, evidence: referenceEvidence }))).rejects.toThrow(/course code/)
    await expect(executeCommand(repository, envelope({ type: "extend_reference", course: { code: "CS 2", title: "X", units: 99 }, evidence: referenceEvidence }))).rejects.toThrow(/units/)
    await expect(executeCommand(repository, envelope({
      type: "extend_reference",
      course: { code: "CS 3", title: "X" },
      section: { units: 3, meetings: [{ days: ["mon"], start: "15:00", end: "14:00" }] },
      evidence: referenceEvidence
    }))).rejects.toThrow(/meeting/i)
    await expect(executeCommand(repository, envelope({ type: "remove_reference_course", courseId: "COURSE-MISSING" }))).rejects.toThrow(/not found/)
  })

  it("validates overlay records directly", () => {
    const course = validateOverlayCourse({ code: "EE 292", title: "Special Topics", tags: ["hardware"] })
    expect(course).toMatchObject({ id: "COURSE-EE-292", subject: "EE", level: 100 })
    const section = validateOverlaySection({ units: 3, meetings: [{ days: ["tue"], start: "09:00", end: "10:20", type: "seminar" }] }, "COURSE-EE-292", "TERM-2026-AUTUMN", "EVIDENCE-X")
    expect(section).toMatchObject({ courseId: "COURSE-EE-292", termId: "TERM-2026-AUTUMN", evidenceIds: ["EVIDENCE-X"] })
    expect(() => validateOverlayCourse({ code: "EE 292", title: "Bad", id: "lowercase-id" })).toThrow(/uppercase/)
    expect(() => validateOverlaySection({ units: 3, meetings: [] }, "COURSE-EE-292", "TERM-2026-AUTUMN", "EVIDENCE-X")).toThrow(/meeting/)
  })
})
