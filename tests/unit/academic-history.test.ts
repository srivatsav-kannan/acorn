import { describe, expect, it } from "vitest"
import { buildFixture } from "@/data/fixture"
import { CUSTOM_INSTITUTION_ID, customInstitution, institutionForWorkspace } from "@/data/institutions/registry"
import { buildPersonalWorkspaceWithHistory } from "@/data/personal-workspace"
import { executeCommand } from "@/domain/commands"
import { effectiveCompletedCourseIds, validateApCredit, validateAcademicHistoryPatch } from "@/domain/history"
import { checkPlan } from "@/domain/planner"
import { validateRequirementRule } from "@/domain/reference"
import { MemoryWorkspaceRepository } from "@/store/memory-repository"
import { createOnboardingTools } from "@/webmcp/onboarding-tools"

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
    expect(() => validateAcademicHistoryPatch({})).toThrow(/class year, completed courses, or credits/)
    const patch = validateAcademicHistoryPatch({ classYear: "Class of 2030", completedCourses: [{ courseId: "COURSE-CS-106A", grade: "A" }] })
    expect(patch.completedCourses).toEqual([{ courseId: "COURSE-CS-106A", grade: "A" }])
  })

  it("lets an agent record structured history through the shared command, visibly and undoably", async () => {
    const repository = new MemoryWorkspaceRepository(buildFixture())
    const receipt = await executeCommand(repository, envelope({
      type: "update_academic_history",
      patch: {
        classYear: "Sophomore",
        completedCourses: [{ courseId: "COURSE-CS-106A", grade: "A" }, { courseId: "COURSE-MATH-19" }],
        apCredits: [{ exam: "AP Calculus BC", score: 5, unitsGranted: 10, satisfiesCourseIds: ["COURSE-MATH-21"] }]
      }
    }))
    expect(receipt).toMatchObject({ ok: true, undoAvailable: true })
    const workspace = await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")
    expect(workspace.profile.classYear).toBe("Sophomore")
    expect(workspace.profile.completedCourseIds).toEqual(["COURSE-CS-106A", "COURSE-MATH-19"])
    expect(workspace.profile.courseGrades).toEqual({ "COURSE-CS-106A": "A" })
    expect(workspace.profile.apCredits).toHaveLength(1)
    expect(workspace.activity).toHaveLength(1)
    const undo = await executeCommand(repository, envelope({ type: "undo_action", receiptId: receipt.receiptId }, 2, "HIST-UNDO"))
    expect(undo.ok).toBe(true)
    const restored = await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")
    expect(restored.profile.classYear).toBeUndefined()
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

describe("onboarding WebMCP tools", () => {
  it("describes the form contract and submits through the shared path", async () => {
    const calls: Array<Record<string, unknown>> = []
    const tools = createOnboardingTools({ submit: async (input) => { calls.push(input as unknown as Record<string, unknown>); return { ok: true, workspaceId: "WORKSPACE-NEW" } } })
    expect(tools.map((tool) => tool.name)).toEqual(["get_onboarding_form", "create_workspace"])
    const form = await tools[0].execute({}) as { institutions: Array<{ id: string }>, customPath: string }
    expect(form.institutions.some((item) => item.id === "INSTITUTION-STANFORD")).toBe(true)
    expect(form.institutions.some((item) => item.id === CUSTOM_INSTITUTION_ID)).toBe(true)
    expect(form.customPath).toContain("extend_reference")
    const result = await tools[1].execute({ name: "Dave", goal: "Plan my semester.", institutionId: CUSTOM_INSTITUTION_ID, customInstitution: "University of Wherever", academicHistory: { classYear: "Junior" } }) as { ok: boolean }
    expect(result.ok).toBe(true)
    expect(calls[0]).toMatchObject({ name: "Dave", customInstitution: "University of Wherever" })
    const failing = createOnboardingTools({ submit: async () => { throw new Error("network down") } })
    const failure = await failing[1].execute({ name: "Dave", goal: "Plan." }) as { ok: boolean, message?: string }
    expect(failure).toMatchObject({ ok: false, message: "network down" })
  })
})
