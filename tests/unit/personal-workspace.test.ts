import { describe, expect, it } from "vitest"
import { buildPersonalWorkspace } from "@/data/personal-workspace"
import { buildStanfordCatalog } from "@/data/fixture"
import { executeCommand } from "@/domain/commands"
import { MemoryWorkspaceRepository } from "@/store/memory-repository"

const buildNewAccount = () => buildPersonalWorkspace({
  userId: "USER-MAYA",
  email: "maya@example.com",
  name: "Maya",
  goal: "Explore computer science without overloading my first quarter.",
  id: () => "11111111-2222-4333-8444-555555555555",
  now: () => new Date("2026-08-28T12:00:00Z")
})

describe("fresh account workspace", () => {
  it("contains only personal information the student explicitly supplied", () => {
    const workspace = buildNewAccount()
    expect(workspace.profile).toMatchObject({
      name: "Maya",
      email: "maya@example.com",
      isFictional: false,
      summary: "Explore computer science without overloading my first quarter.",
      declaredProgramId: null,
      completedCourseIds: [],
      residentCourseIds: [],
      preferences: [],
      excludedDays: []
    })
    expect(workspace.contextItems).toHaveLength(0)
    expect(workspace.plans[0].scenarios[0].courses).toEqual([])
    expect(workspace.plans[0].scenarios[0].commitments).toEqual([])
    expect(workspace.uncertainties).toEqual([])
    expect(workspace.activity).toEqual([])
  })

  it("never carries fictional demo identity or choices into an account", () => {
    const serialized = JSON.stringify(buildNewAccount())
    for (const forbidden of ["Alex Chen", "alex@example.edu", "USER-DEMO", "PROFILE-DEMO", "NOTE-001", "COMMITMENT-RESEARCH", "PREFERENCE-NO-FRIDAY"]) {
      expect(serialized).not.toContain(forbidden)
    }
  })

  it("keeps shared Stanford references read-only and out of the personal Library", () => {
    const workspace = buildNewAccount()
    expect(workspace.programs.length).toBeGreaterThanOrEqual(9)
    expect(workspace.programs.every((program) => program.sourceUrl.startsWith("https://bulletin.stanford.edu/") || program.sourceUrl.startsWith("https://advising.stanford.edu/"))).toBe(true)
    expect(workspace.evidence.every((evidence) => evidence.addedBy === "system")).toBe(true)
    expect(workspace.contextItems.some((item) => item.type === "source")).toBe(false)
  })

  it("supports a real first edit from the empty plan without fixture assumptions", async () => {
    const workspace = buildNewAccount()
    const repository = new MemoryWorkspaceRepository({ workspace, catalog: buildStanfordCatalog() })
    const scenario = workspace.plans[0].scenarios[0]
    const receipt = await executeCommand(repository, {
      actor: { type: "human", id: "USER-MAYA" },
      ownerUserId: "USER-MAYA",
      workspaceId: workspace.id,
      expectedVersion: 1,
      idempotencyKey: "MAYA-FIRST-COURSE",
      command: { type: "edit_plan", planId: workspace.plans[0].id, scenarioId: scenario.id, operations: [{ type: "add_course", planCourse: { id: "PLANCOURSE-MAYA-CS106A", courseId: "COURSE-CS-106A", sectionId: "SECTION-CS-106A-01-02", units: 5, status: "active" } }] }
    })
    const saved = await repository.getWorkspace(workspace.id, "USER-MAYA")
    expect(receipt.ok).toBe(true)
    expect(saved.version).toBe(2)
    expect(saved.plans[0].scenarios[0].courses).toEqual([expect.objectContaining({ courseId: "COURSE-CS-106A" })])
    expect(saved.activity).toHaveLength(1)
  })

  it("updates the visible goal and profile summary together", async () => {
    const workspace = buildNewAccount()
    const repository = new MemoryWorkspaceRepository({ workspace, catalog: buildStanfordCatalog() })
    await executeCommand(repository, {
      actor: { type: "human", id: "USER-MAYA" },
      ownerUserId: "USER-MAYA",
      workspaceId: workspace.id,
      expectedVersion: 1,
      idempotencyKey: "MAYA-GOAL-EDIT",
      command: { type: "update_profile", patch: { summary: "Build a light quarter with time for research." } }
    })
    const saved = await repository.getWorkspace(workspace.id, "USER-MAYA")
    expect(saved.profile.summary).toBe("Build a light quarter with time for research.")
    expect(saved.contextItems.filter((item) => item.type === "goal")).toHaveLength(0)
  })
})
