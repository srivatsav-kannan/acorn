import { describe, expect, it } from "vitest"
import { buildFixture } from "@/data/workspace/fixture"
import { CUSTOM_INSTITUTION_ID, customInstitution, institutionForWorkspace } from "@/data/institutions/registry"
import { buildPersonalWorkspaceWithHistory } from "@/data/workspace/personal-workspace"
import { executeCommand } from "@/domain/workspace/commands"
import { effectiveCompletedCourseIds, validateApCredit, validateAcademicHistoryPatch } from "@/domain/workspace/history"
import { checkPlan } from "@/domain/planning/planner"
import { validateRequirementRule } from "@/domain/workspace/reference"
import { MemoryWorkspaceRepository } from "@/store/memory-repository"

const agent = { type: "agent" as const, id: "AGENT-TEST" }
const envelope = (command: Record<string, unknown>, expectedVersion = 1, key = "HIST-001") => ({
  actor: agent,
  ownerUserId: "USER-DEMO",
  workspaceId: "WORKSPACE-DEMO",
  expectedVersion,
  idempotencyKey: key,
  command
})

describe("academic history", () => {
  it("merges AP equivalencies into the effective completed set", () => {
    const profile = buildFixture().workspace.profile
    profile.apCredits = [{ id: "AP-CALC", exam: "AP Calculus BC", score: 5, satisfiesCourseIds: ["COURSE-MATH-21"] }]
    const effective = effectiveCompletedCourseIds(profile)
    expect(effective).toContain("COURSE-CS-106A")
    expect(effective).toContain("COURSE-MATH-21")
  })

  it("validates credits and history patches", () => {
    expect(validateApCredit({ exam: "AP Physics C" })).toMatchObject({ id: "AP-AP-PHYSICS-C", exam: "AP Physics C" })
    expect(() => validateApCredit({ exam: "AP Calculus BC", score: 9 })).toThrow(/between 1 and 5/)
    expect(() => validateApCredit({ exam: "" })).toThrow(/named exam/)
    expect(() => validateApCredit({ exam: "IB Math", unitsGranted: 99 })).toThrow(/between 0 and 45/)
    expect(() => validateAcademicHistoryPatch({})).toThrow(/class year, timeline, completed courses, or credits/)
    const patch = validateAcademicHistoryPatch({ classYear: "Class of 2030", completedCourses: [{ courseId: "COURSE-CS-106A", grade: "A" }] })
    expect(patch.completedCourses).toEqual([{ courseId: "COURSE-CS-106A", grade: "A" }])
  })

  it("lets an agent record structured history through the shared command, visibly and undoably", async () => {
    const repository = new MemoryWorkspaceRepository(buildFixture())
    await expect(executeCommand(repository, envelope({
      type: "update_academic_history",
      patch: { classYear: "Class of 2030" }
    }, 1, "HIST-GUARD"))).rejects.toThrow(/derived from the entry and graduation dates/)
    const receipt = await executeCommand(repository, envelope({
      type: "update_academic_history",
      patch: {
        completedCourses: [{ courseId: "COURSE-CS-106A", grade: "A" }, { courseId: "COURSE-MATH-19" }],
        apCredits: [{ exam: "AP Calculus BC", score: 5, unitsGranted: 10, satisfiesCourseIds: ["COURSE-MATH-21"] }]
      }
    }))
    expect(receipt).toMatchObject({ ok: true, undoAvailable: true })
    const workspace = await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")
    expect(workspace.profile.completedCourseIds).toEqual(["COURSE-CS-106A", "COURSE-MATH-19"])
    expect(workspace.profile.courseGrades).toEqual({ "COURSE-CS-106A": "A" })
    expect(workspace.profile.apCredits).toHaveLength(1)
    expect(workspace.activity).toHaveLength(1)
    const undo = await executeCommand(repository, envelope({ type: "undo_action", receiptId: receipt.receiptId }, 2, "HIST-UNDO"))
    expect(undo.ok).toBe(true)
    const restored = await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")
    expect(restored.profile.classYear).toBe("Sophomore")
  })

  it("counts AP equivalencies toward prerequisites in plan checks", () => {
    const fixture = buildFixture()
    const scenario = fixture.workspace.plans[0].scenarios[0]
    scenario.courses.push({ id: "PLANCOURSE-MATH-52", courseId: "COURSE-MATH-52", sectionId: "SECTION-MATH-52-01", units: 5, status: "active" })
    const without = checkPlan({ scenario, catalog: fixture.catalog, profile: fixture.workspace.profile, evidence: fixture.workspace.evidence, now: new Date("2026-08-28T12:00:00Z") })
    expect(without.some((check) => check.code === "PREREQUISITE_MISSING" && check.affectedIds.includes("PLANCOURSE-MATH-52"))).toBe(true)
    fixture.workspace.profile.apCredits = [{ id: "AP-CALC", exam: "AP Calculus BC", score: 5, satisfiesCourseIds: ["COURSE-MATH-51"] }]
    const withCredit = checkPlan({ scenario, catalog: fixture.catalog, profile: fixture.workspace.profile, evidence: fixture.workspace.evidence, now: new Date("2026-08-28T12:00:00Z") })
    expect(withCredit.some((check) => check.code === "PREREQUISITE_MISSING" && check.affectedIds.includes("PLANCOURSE-MATH-52"))).toBe(false)
  })
})

describe("custom institutions", () => {
  it("builds a neutral template workspace named for the school", () => {
    const workspace = buildPersonalWorkspaceWithHistory({
      userId: "USER-DAVE",
      email: "dave@example.com",
      name: "Dave Smith",
      goal: "Plan my semester without missing degree requirements.",
      institutionId: CUSTOM_INSTITUTION_ID,
      customInstitutionName: "University of Wherever",
      academicHistory: { classYear: "Junior", apCredits: [{ exam: "AP Statistics", score: 4 }] }
    })
    expect(workspace.title).toBe("Dave's University of Wherever Workspace")
    expect(workspace.institution).toBe("University of Wherever")
    expect(workspace.institutionId).toBe(CUSTOM_INSTITUTION_ID)
    expect(workspace.currentTermId).toBe("TERM-CURRENT")
    expect(workspace.programs).toEqual([])
    expect(workspace.evidence).toEqual([])
    expect(workspace.profile.classYear).toBe("Junior")
    expect(workspace.profile.apCredits).toHaveLength(1)
    const institution = institutionForWorkspace(workspace)
    expect(institution.buildCatalog().courses).toEqual([])
    expect(institution.resources).toEqual([])
  })

  it("names known-institution workspaces with the school short name", () => {
    const workspace = buildPersonalWorkspaceWithHistory({ userId: "USER-DAVE", email: "dave@example.com", name: "Dave Smith", goal: "Plan Autumn well." })
    expect(workspace.title).toBe("Dave's Stanford Workspace")
    expect(customInstitution("Anywhere U").coverageNote).toContain("Anywhere U")
  })

  it("builds the timeline from onboarding's three durable facts", () => {
    const coterm = buildPersonalWorkspaceWithHistory({ userId: "USER-A", email: "a@example.com", entryYear: 2026, gradYear: 2031 })
    expect(coterm.title).toBe("Stanford Workspace")
    expect(coterm.profile.name).toBe("")
    expect(coterm.profile.timeline).toEqual({ entryTermId: "TERM-2026-AUTUMN", expectedGraduationTermId: "TERM-2031-SPRING", degree: "BS-MS" })
    expect(coterm.contextItems).toEqual([])
    const fixedGrad = buildPersonalWorkspaceWithHistory({ userId: "USER-B", email: "b@example.com", entryYear: 2026, gradYear: 2026 })
    expect(fixedGrad.profile.timeline?.expectedGraduationTermId).toBe("TERM-2030-SPRING")
    expect(fixedGrad.profile.timeline?.degree).toBe("BS")
  })

  it("lets an agent add and remove a program with a validated requirement tree", async () => {
    const repository = new MemoryWorkspaceRepository(buildFixture())
    const evidence = { id: "EVIDENCE-WHEREVER-CS", title: "CS degree page", classification: "official", claim: "Official CS requirements.", sourceUrl: "https://example.edu/cs", sourceTitle: "University catalog", retrievedAt: "2026-08-28T00:00:00Z", confidence: 0.9, status: "current" }
    const receipt = await executeCommand(repository, envelope({
      type: "add_reference_program",
      evidence,
      program: {
        name: "Computer Science",
        credential: "BS",
        sourceUrl: "https://example.edu/cs",
        catalogYear: "2026-27",
        requirements: [
          { title: "Core", rule: { type: "all_of", rules: [{ type: "course", courseId: "COURSE-CS-101" }, { type: "course_group", count: 2, courseIds: ["COURSE-CS-201", "COURSE-CS-202", "COURSE-CS-203"] }] } },
          { title: "Advising", rule: { type: "manual_review", reason: "Confirm electives with an advisor." } }
        ]
      }
    }))
    expect(receipt).toMatchObject({ ok: true, primaryVisibleId: "PROGRAM-COMPUTER-SCIENCE" })
    const workspace = await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")
    const added = workspace.programs.find((program) => program.id === "PROGRAM-COMPUTER-SCIENCE")!
    expect(added.addedBy).toMatchObject({ type: "agent" })
    expect(added.requirements).toHaveLength(2)
    expect(workspace.contextItems.some((item) => item.sourceEvidenceIds?.includes("EVIDENCE-WHEREVER-CS"))).toBe(true)
    const removal = await executeCommand(repository, envelope({ type: "remove_reference_program", programId: "PROGRAM-COMPUTER-SCIENCE" }, 2, "HIST-002"))
    expect(removal.ok).toBe(true)
    const after = await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")
    expect(after.programs.some((program) => program.id === "PROGRAM-COMPUTER-SCIENCE")).toBe(false)
  })

  it("protects shipped programs and rejects invalid requirement trees", async () => {
    const repository = new MemoryWorkspaceRepository(buildFixture())
    const evidence = { id: "EVIDENCE-BAD", title: "Page", classification: "official", claim: "Claim.", sourceUrl: "https://example.edu/x", sourceTitle: "Catalog", retrievedAt: "2026-08-28T00:00:00Z", confidence: 0.9, status: "current" }
    await expect(executeCommand(repository, envelope({ type: "add_reference_program", evidence, program: { id: "PROGRAM-CS-BS", name: "Computer Science", sourceUrl: "https://example.edu/x", requirements: [{ title: "Core", rule: { type: "course", courseId: "COURSE-CS-101" } }] } }))).rejects.toThrow(/read-only/)
    await expect(executeCommand(repository, envelope({ type: "remove_reference_program", programId: "PROGRAM-CS-BS" }))).rejects.toThrow(/cannot be removed/)
    await expect(executeCommand(repository, envelope({ type: "add_reference_program", evidence, program: { name: "X", sourceUrl: "https://example.edu/x", requirements: [{ title: "Core", rule: { type: "sparkle" } }] } }))).rejects.toThrow(/Unsupported requirement rule/)
    expect(() => validateRequirementRule({ type: "choose_n", count: 2, rules: [] })).toThrow(/child rules/)
    expect(() => validateRequirementRule({ type: "minimum_units", units: 999, courseIds: ["COURSE-A"] })).toThrow(/between 1 and 200/)
    const deep = { type: "all_of", rules: [{ type: "all_of", rules: [{ type: "all_of", rules: [{ type: "all_of", rules: [{ type: "all_of", rules: [{ type: "all_of", rules: [{ type: "course", courseId: "COURSE-A" }] }] }] }] }] }] }
    expect(() => validateRequirementRule(deep as Record<string, unknown>)).toThrow(/nest/)
  })
})


describe("Stanford AP chart presets", () => {
  it("lists unique exams whose grants pass the credit validator", async () => {
    const { apExamPresets } = await import("@/data/institutions/stanford/ap-credit")
    const names = apExamPresets.map((preset) => preset.exam)
    expect(new Set(names).size).toBe(names.length)
    for (const preset of apExamPresets) {
      for (const grant of preset.grants) {
        expect(() => validateApCredit({ id: "AP-TEST", exam: preset.exam, score: grant.score, unitsGranted: grant.units })).not.toThrow()
        expect(grant.score).toBeGreaterThanOrEqual(3)
        expect(grant.score).toBeLessThanOrEqual(5)
      }
    }
  })

  it("grants the published defaults for the calculus and physics sequences", async () => {
    const { apGrantFor } = await import("@/data/institutions/stanford/ap-credit")
    expect(apGrantFor("AP Calculus BC", 5)).toMatchObject({ units: 10, satisfiesCodes: ["MATH 19", "MATH 20", "MATH 21"] })
    expect(apGrantFor("AP Calculus BC", 4)?.satisfiesCodes).toEqual(["MATH 19", "MATH 20"])
    expect(apGrantFor("AP Physics C: Mechanics", 4)).toMatchObject({ units: 4, satisfiesCodes: ["PHYSICS 41"] })
    expect(apGrantFor("AP Spanish Language and Culture", 4)?.units).toBe(10)
  })

  it("records exams Stanford credits nothing for without inventing units", async () => {
    const { apGrantFor, apPresetFor } = await import("@/data/institutions/stanford/ap-credit")
    for (const exam of ["AP Computer Science A", "AP Statistics", "AP Psychology"]) {
      expect(apPresetFor(exam)).toBeDefined()
      expect(apGrantFor(exam, 5)).toBeNull()
    }
    expect(apGrantFor("Not An Exam", 5)).toBeNull()
  })

  it("offers deterministic score and unit choices for the form", async () => {
    const { apScoreChoices, apUnitChoices } = await import("@/data/institutions/stanford/ap-credit")
    expect(apScoreChoices).toEqual([5, 4, 3, 2, 1])
    expect(apUnitChoices).toEqual([...apUnitChoices].sort((a, b) => a - b))
    expect(new Set(apUnitChoices).size).toBe(apUnitChoices.length)
  })
})


describe("credit kinds", () => {
  it("validates AP, IB, and college co-enrollment credit shapes", () => {
    const ap = validateApCredit({ exam: "AP Calculus BC", kind: "ap", score: 5, unitsGranted: 10 })
    expect(ap.kind).toBe("ap")
    expect(() => validateApCredit({ exam: "AP Calculus BC", kind: "ap", score: 7 })).toThrow(/between 1 and 5/)
    const ib = validateApCredit({ exam: "IB Physics HL", kind: "ib", score: 7, unitsGranted: 8 })
    expect(ib).toMatchObject({ kind: "ib", score: 7, unitsGranted: 8 })
    expect(() => validateApCredit({ exam: "IB Physics HL", kind: "ib", score: 8 })).toThrow(/between 1 and 7/)
    const college = validateApCredit({ exam: "MATH 1C Multivariable Calculus", kind: "college", institution: "Foothill College", score: 4, unitsGranted: 5 })
    expect(college).toMatchObject({ kind: "college", institution: "Foothill College", unitsGranted: 5 })
    expect(college.score).toBeUndefined()
    const legacy = validateApCredit({ exam: "AP Chemistry", unitsGranted: 10 })
    expect(legacy.kind).toBe("ap")
  })
})
