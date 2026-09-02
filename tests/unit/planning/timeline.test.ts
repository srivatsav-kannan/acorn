import { describe, expect, it } from "vitest"
import { buildFixture } from "@/data/workspace/fixture"
import { executeCommand } from "@/domain/workspace/commands"
import { evaluateDegreePlan } from "@/domain/planning/degree-plan"
import { academicYearLabel, compareTerms, defaultGraduationTerm, defaultTimeline, nextTerm, parseTermId, standingForTerm, termForDate, termLabel, termSequence, termStatus, unitsRequired } from "@/domain/planning/timeline"
import { MemoryWorkspaceRepository } from "@/store/memory-repository"

const now = new Date("2026-10-15T12:00:00-07:00")

describe("term arithmetic", () => {
  it("parses, labels, and orders quarter terms deterministically", () => {
    expect(parseTermId("TERM-2026-AUTUMN")).toMatchObject({ year: 2026, season: "AUTUMN", academicYearStart: 2026 })
    expect(parseTermId("TERM-2027-WINTER")).toMatchObject({ academicYearStart: 2026 })
    expect(parseTermId("TERM-CURRENT")).toBeNull()
    expect(termLabel("TERM-2027-SPRING")).toBe("Spring 2027")
    expect(academicYearLabel("TERM-2027-WINTER")).toBe("2026-27")
    expect(compareTerms("TERM-2026-AUTUMN", "TERM-2027-WINTER")).toBeLessThan(0)
    expect(compareTerms("TERM-2027-SPRING", "TERM-2027-WINTER")).toBeGreaterThan(0)
  })

  it("advances terms with and without summer", () => {
    expect(nextTerm("TERM-2026-AUTUMN").id).toBe("TERM-2027-WINTER")
    expect(nextTerm("TERM-2027-SPRING").id).toBe("TERM-2027-AUTUMN")
    expect(nextTerm("TERM-2027-SPRING", true).id).toBe("TERM-2027-SUMMER")
    expect(nextTerm("TERM-2027-SUMMER", true).id).toBe("TERM-2027-AUTUMN")
  })

  it("generates a four year sequence of twelve quarters", () => {
    const sequence = termSequence("TERM-2026-AUTUMN", "TERM-2030-SPRING")
    expect(sequence).toHaveLength(12)
    expect(sequence[0].id).toBe("TERM-2026-AUTUMN")
    expect(sequence[11].id).toBe("TERM-2030-SPRING")
    expect(sequence.every((ref) => ref.season !== "SUMMER")).toBe(true)
    const withSummers = termSequence("TERM-2026-AUTUMN", "TERM-2030-SPRING", true)
    expect(withSummers).toHaveLength(15)
  })

  it("derives the current term and status from a date", () => {
    expect(termForDate(new Date("2026-10-15")).id).toBe("TERM-2026-AUTUMN")
    expect(termForDate(new Date("2027-02-01")).id).toBe("TERM-2027-WINTER")
    expect(termForDate(new Date("2027-05-01")).id).toBe("TERM-2027-SPRING")
    expect(termForDate(new Date("2027-07-15")).id).toBe("TERM-2027-SUMMER")
    expect(termStatus("TERM-2026-AUTUMN", now)).toBe("current")
    expect(termStatus("TERM-2026-SPRING", now)).toBe("past")
    expect(termStatus("TERM-2027-WINTER", now)).toBe("future")
  })

  it("computes degree defaults, units, and standing", () => {
    expect(defaultGraduationTerm("TERM-2026-AUTUMN", "BS")).toBe("TERM-2030-SPRING")
    expect(defaultGraduationTerm("TERM-2026-AUTUMN", "BS-MS")).toBe("TERM-2031-SPRING")
    expect(unitsRequired("BS")).toBe(180)
    expect(unitsRequired("BS-MS")).toBe(225)
    expect(defaultTimeline(now).entryTermId).toBe("TERM-2026-AUTUMN")
    const timeline = { entryTermId: "TERM-2025-AUTUMN", expectedGraduationTermId: "TERM-2029-SPRING", degree: "BS" }
    expect(standingForTerm(timeline, "TERM-2026-AUTUMN")).toBe("Sophomore")
    expect(standingForTerm(timeline, "TERM-2029-WINTER")).toBe("Senior")
  })
})

describe("edge handling", () => {
  it("degrades cleanly on non-quarter terms and boundary inputs", async () => {
    const { allPlannedCourseIds } = await import("@/domain/planning/degree-plan")
    const { supportsTimeline, nextTerm, standingForTerm, termLabel: label } = await import("@/domain/planning/timeline")
    expect(supportsTimeline({ currentTermId: "TERM-CURRENT" })).toBe(false)
    expect(supportsTimeline({ currentTermId: "TERM-2026-AUTUMN" })).toBe(true)
    expect(label("TERM-CURRENT")).toBe("current")
    expect(() => nextTerm("TERM-NOPE")).toThrow(/Unrecognized/)
    expect(standingForTerm({ entryTermId: "TERM-2026-AUTUMN", expectedGraduationTermId: "TERM-2030-SPRING", degree: "BS" }, "TERM-2025-AUTUMN")).toBe("Before entry")
    expect(standingForTerm({ entryTermId: "TERM-X", expectedGraduationTermId: "TERM-Y", degree: "BS" }, "TERM-2025-AUTUMN")).toBe("")
    expect(termSequence("TERM-2027-SPRING", "TERM-2026-AUTUMN").map((ref) => ref.id)).toEqual(["TERM-2027-SPRING"])
    expect(termSequence("TERM-NOPE", "TERM-2026-AUTUMN")).toEqual([])
    const fixture = buildFixture()
    expect(allPlannedCourseIds(fixture.workspace)).toContain("COURSE-CS-106B")
  })

  it("counts standalone granted units toward the degree total", () => {
    const fixture = buildFixture()
    fixture.workspace.profile.apCredits = [
      { id: "AP-1", exam: "AP Calculus BC", unitsGranted: 10 },
      { id: "AP-2", exam: "AP CS A", unitsGranted: 5, satisfiesCourseIds: ["COURSE-CS-106A"] }
    ]
    const evaluation = evaluateDegreePlan(fixture.workspace, fixture.catalog, now)
    expect(evaluation.completedUnits).toBe(15)
  })
})

describe("degree plan evaluation", () => {
  it("carries completion forward so sequencing works across terms", async () => {
    const repository = new MemoryWorkspaceRepository(buildFixture())
    const envelope = (key: string, expectedVersion: number, command: Record<string, unknown>) => ({ actor: { type: "human" as const, id: "USER-DEMO" }, ownerUserId: "USER-DEMO", workspaceId: "WORKSPACE-DEMO", expectedVersion, idempotencyKey: key, command })
    const winterAdd = await executeCommand(repository, envelope("TL-1", 1, {
      type: "edit_plan",
      termId: "TERM-2027-WINTER",
      operations: [{ type: "add_course", planCourse: { id: "PLANCOURSE-W-CS107", courseId: "COURSE-CS-107", sectionId: null, units: 5, status: "active" } }]
    }))
    expect(winterAdd.ok).toBe(true)
    const created = await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")
    expect(created.plans.map((plan) => plan.termId)).toEqual(["TERM-2026-AUTUMN", "TERM-2027-WINTER"])

    const evaluation = evaluateDegreePlan(created, repository.catalog, now)
    const winter = evaluation.terms.find((term) => term.termId === "TERM-2027-WINTER")!
    expect(winter.units).toBe(5)
    expect(winter.issues.some((issue) => issue.code === "SEQUENCE_PREREQUISITE")).toBe(false)
    expect(winter.issues.some((issue) => issue.code === "SCHEDULE_NOT_PUBLISHED")).toBe(true)

    await executeCommand(repository, envelope("TL-2", 2, {
      type: "edit_plan",
      termId: "TERM-2027-SPRING",
      operations: [{ type: "add_course", planCourse: { id: "PLANCOURSE-S-CS111", courseId: "COURSE-CS-111", sectionId: null, units: 4, status: "active" } }]
    }))
    const withSpring = await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")
    const sequenced = evaluateDegreePlan(withSpring, repository.catalog, now)
    const spring = sequenced.terms.find((term) => term.termId === "TERM-2027-SPRING")!
    expect(spring.issues.some((issue) => issue.code === "SEQUENCE_PREREQUISITE")).toBe(false)

    await executeCommand(repository, envelope("TL-3", 3, {
      type: "edit_plan",
      termId: "TERM-2027-WINTER",
      scenarioId: "SCENARIO-2027-WINTER-1",
      operations: [{ type: "remove_course", planCourseId: "PLANCOURSE-W-CS107" }]
    }))
    const withoutPrereq = await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")
    const broken = evaluateDegreePlan(withoutPrereq, repository.catalog, now)
    const brokenSpring = broken.terms.find((term) => term.termId === "TERM-2027-SPRING")!
    expect(brokenSpring.issues.some((issue) => issue.code === "SEQUENCE_PREREQUISITE" && issue.message.includes("CS 107"))).toBe(true)
  })

  it("totals units toward the degree and flags overloads and duplicates", async () => {
    const fixture = buildFixture()
    const evaluation = evaluateDegreePlan(fixture.workspace, fixture.catalog, now)
    expect(evaluation.requiredUnits).toBe(180)
    expect(evaluation.completedUnits).toBe(5)
    expect(evaluation.plannedUnits).toBe(13)
    expect(evaluation.projectedUnits).toBe(18)
    expect(evaluation.terms[0]).toMatchObject({ termId: "TERM-2025-AUTUMN", units: 0, status: "past" })

    const repository = new MemoryWorkspaceRepository(fixture)
    await executeCommand(repository, { actor: { type: "human", id: "USER-DEMO" }, ownerUserId: "USER-DEMO", workspaceId: "WORKSPACE-DEMO", expectedVersion: 1, idempotencyKey: "TL-4", command: {
      type: "edit_plan",
      termId: "TERM-2027-WINTER",
      operations: [
        { type: "add_course", planCourse: { id: "PC-1", courseId: "COURSE-CS-106B", sectionId: null, units: 5, status: "active" } },
        { type: "add_course", planCourse: { id: "PC-2", courseId: "COURSE-CS-103", sectionId: null, units: 5, status: "active" } },
        { type: "add_course", planCourse: { id: "PC-3", courseId: "COURSE-MATH-52", sectionId: null, units: 5, status: "active" } },
        { type: "add_course", planCourse: { id: "PC-4", courseId: "COURSE-PHYSICS-41", sectionId: null, units: 4, status: "active" } },
        { type: "add_course", planCourse: { id: "PC-5", courseId: "COURSE-PWR-1", sectionId: null, units: 4, status: "active" } }
      ]
    } })
    const overloaded = await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")
    const flagged = evaluateDegreePlan(overloaded, repository.catalog, now)
    const winter = flagged.terms.find((term) => term.termId === "TERM-2027-WINTER")!
    expect(winter.units).toBe(23)
    expect(winter.issues.some((issue) => issue.code === "TERM_OVERLOAD")).toBe(true)
    expect(winter.issues.some((issue) => issue.code === "DUPLICATE_ACROSS_TERMS" && issue.message.includes("CS 106B"))).toBe(true)
  })
})
