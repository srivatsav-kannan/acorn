import { describe, expect, it } from "vitest"
import { buildFixture } from "@/data/fixture"
import { getInstitution, institutions, listInstitutionChoices, plannedInstitutions } from "@/data/institutions/registry"
import { stanfordInstitution } from "@/data/institutions/stanford"
import { executeCommand } from "@/domain/commands"
import { isOverlayCourse, mergeCatalog, mergedCatalogFor, validateOverlayCourse, validateOverlaySection, workspaceOverlay } from "@/domain/reference"
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
  sourceUrl: "https://explorecourses.stanford.edu/search?q=CS+329S",
  sourceTitle: "Stanford ExploreCourses",
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
      course: { code: "CS 329S", title: "Machine Learning Systems Design", subject: "CS", level: 300, units: 3, sourceUrl: "https://explorecourses.stanford.edu/" },
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
