import { describe, expect, it } from "vitest"
import { buildFixture } from "@/data/fixture"
import { executeCommand } from "@/domain/commands"
import { searchWorkspace } from "@/domain/search"
import { MemoryWorkspaceRepository } from "@/store/memory-repository"

const setup = () => new MemoryWorkspaceRepository(buildFixture())
const envelope = (command: Record<string, unknown>, expectedVersion = 1, key = "MATRIX") => ({
  actor: { type: "human" as const, id: "USER-DEMO" },
  workspaceId: "WORKSPACE-DEMO",
  expectedVersion,
  idempotencyKey: `${key}-${expectedVersion}`,
  command
})

describe("complete command matrix", () => {
  it("archives and restores existing context and rejects a missing item", async () => {
    const repository = setup()
    await executeCommand(repository, envelope({ type: "archive_context_item", itemId: "NOTE-001" }))
    expect((await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")).contextItems.find((item) => item.id === "NOTE-001")?.archived).toBe(true)
    await executeCommand(repository, envelope({ type: "restore_context_item", itemId: "NOTE-001" }, 2, "RESTORE"))
    expect((await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")).contextItems.find((item) => item.id === "NOTE-001")?.archived).toBe(false)
    await expect(executeCommand(repository, envelope({ type: "archive_context_item", itemId: "NOTE-MISSING" }, 3))).rejects.toMatchObject({ code: "COMMAND_INVALID" })
  })

  it("updates an existing preference and rejects incomplete preference data", async () => {
    const repository = setup()
    await executeCommand(repository, envelope({ type: "set_student_preference", preference: { id: "PREFERENCE-DESIGN", label: "Prioritize studio work", strength: "hard", value: true } }))
    expect((await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")).profile.preferences.find((item) => item.id === "PREFERENCE-DESIGN")?.strength).toBe("hard")
    await expect(executeCommand(repository, envelope({ type: "set_student_preference", preference: { id: "PREFERENCE-BAD" } }, 2))).rejects.toMatchObject({ code: "COMMAND_INVALID" })
  })

  it("atomically saves every agent-provided priority and lets the student remove one", async () => {
    const repository = setup()
    const receipt = await executeCommand(repository, envelope({
      type: "set_student_preferences",
      preferences: [
        { id: "PREFERENCE-HEALTH", label: "Build healthcare depth", strength: "soft", value: true },
        { id: "PREFERENCE-AI", label: "Explore applied AI", strength: "hard", value: true }
      ]
    }))
    expect(receipt.changed).toEqual([
      { type: "preference", id: "PREFERENCE-HEALTH" },
      { type: "preference", id: "PREFERENCE-AI" }
    ])
    await executeCommand(repository, envelope({ type: "delete_student_preference", preferenceId: "PREFERENCE-HEALTH" }, 2, "REMOVE-HEALTH"))
    const priorities = (await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")).profile.preferences
    expect(priorities.some((item) => item.id === "PREFERENCE-HEALTH")).toBe(false)
    expect(priorities).toContainEqual({ id: "PREFERENCE-AI", label: "Explore applied AI", strength: "hard", value: true })
  })

  it("supports remove, section selection, and backup status operations", async () => {
    const repository = setup()
    const receipt = await executeCommand(repository, envelope({
      type: "edit_plan",
      planId: "PLAN-AUT26",
      scenarioId: "SCENARIO-PRIMARY",
      operations: [
        { type: "select_section", planCourseId: "PLANCOURSE-COMM-1", sectionId: "SECTION-FRIDAY" },
        { type: "set_status", planCourseId: "PLANCOURSE-MATH-51", status: "backup" },
        { type: "remove_course", planCourseId: "PLANCOURSE-DESIGN-60" }
      ]
    }))
    expect(receipt.changed).toHaveLength(3)
  })

  it("creates a distinct scenario atomically and records its stable ID", async () => {
    const repository = setup()
    const scenario = { id: "SCENARIO-THIRD", name: "Third option", unitLimit: 18, courses: [], commitments: [] }
    const receipt = await executeCommand(repository, envelope({ type: "edit_plan", planId: "PLAN-AUT26", scenarioId: "SCENARIO-PRIMARY", operations: [{ type: "create_scenario", scenario }] }))
    expect(receipt.changed).toContainEqual({ type: "plan_scenario", id: scenario.id })
    expect((await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")).plans[0].scenarios).toContainEqual(scenario)
    await expect(executeCommand(repository, envelope({ type: "edit_plan", planId: "PLAN-AUT26", scenarioId: "SCENARIO-PRIMARY", operations: [{ type: "create_scenario", scenario }] }, 2, "DUPLICATE-SCENARIO"))).rejects.toMatchObject({ code: "COMMAND_INVALID" })
  })

  it("renames, activates, and deletes scenarios while preserving one valid scenario", async () => {
    const repository = setup()
    await executeCommand(repository, envelope({ type: "edit_plan", planId: "PLAN-AUT26", scenarioId: "SCENARIO-LIGHTER", operations: [{ type: "rename_scenario", name: "Research first" }, { type: "set_active_scenario" }] }))
    let plan = (await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")).plans[0]
    expect(plan.activeScenarioId).toBe("SCENARIO-LIGHTER")
    expect(plan.scenarios.find((item) => item.id === "SCENARIO-LIGHTER")?.name).toBe("Research first")
    await executeCommand(repository, envelope({ type: "edit_plan", planId: "PLAN-AUT26", scenarioId: "SCENARIO-PRIMARY", operations: [{ type: "delete_scenario" }] }, 2, "DELETE-SCENARIO"))
    plan = (await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")).plans[0]
    expect(plan.scenarios.map((item) => item.id)).toEqual(["SCENARIO-LIGHTER"])
    await expect(executeCommand(repository, envelope({ type: "edit_plan", planId: "PLAN-AUT26", scenarioId: "SCENARIO-LIGHTER", operations: [{ type: "delete_scenario" }] }, 3, "DELETE-LAST"))).rejects.toMatchObject({ code: "COMMAND_INVALID" })
  })

  it("updates course units and rejects invalid values", async () => {
    const repository = setup()
    await executeCommand(repository, envelope({ type: "edit_plan", planId: "PLAN-AUT26", scenarioId: "SCENARIO-PRIMARY", operations: [{ type: "set_units", planCourseId: "PLANCOURSE-MATH-51", units: 3 }] }))
    expect((await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")).plans[0].scenarios[0].courses.find((item) => item.id === "PLANCOURSE-MATH-51")?.units).toBe(3)
    await expect(executeCommand(repository, envelope({ type: "edit_plan", planId: "PLAN-AUT26", scenarioId: "SCENARIO-PRIMARY", operations: [{ type: "set_units", planCourseId: "PLANCOURSE-MATH-51", units: 0 }] }, 2, "BAD-UNITS"))).rejects.toMatchObject({ code: "COMMAND_INVALID" })
  })

  it.each([
    [{ type: "edit_plan", planId: "PLAN-MISSING", scenarioId: "SCENARIO-PRIMARY", operations: [] }, "Plan or scenario"],
    [{ type: "edit_plan", planId: "PLAN-AUT26", scenarioId: "SCENARIO-PRIMARY", operations: [{ type: "add_course", planCourse: { id: "PLANCOURSE-CS-106B" } }] }, "unique"],
    [{ type: "edit_plan", planId: "PLAN-AUT26", scenarioId: "SCENARIO-PRIMARY", operations: [{ type: "remove_course", planCourseId: "PLANCOURSE-MISSING" }] }, "not found"],
    [{ type: "edit_plan", planId: "PLAN-AUT26", scenarioId: "SCENARIO-PRIMARY", operations: [{ type: "select_section", planCourseId: "PLANCOURSE-COMM-1", sectionId: "" }] }, "Section"],
    [{ type: "edit_plan", planId: "PLAN-AUT26", scenarioId: "SCENARIO-PRIMARY", operations: [{ type: "set_status", planCourseId: "PLANCOURSE-MATH-51", status: "invented" }] }, "status"],
    [{ type: "edit_plan", planId: "PLAN-AUT26", scenarioId: "SCENARIO-PRIMARY", operations: [{ type: "invented_operation" }] }, "Unsupported"],
    [{ type: "invented_command" }, "Unsupported"]
  ])("rejects invalid semantic mutations %#", async (command, message) => {
    await expect(executeCommand(setup(), envelope(command))).rejects.toMatchObject({ code: "COMMAND_INVALID", message: expect.stringContaining(message) })
  })

  it("stores research and a safe view through the command journal", async () => {
    const repository = setup()
    const receipt = await executeCommand(repository, envelope({ type: "save_research", evidence: { id: "EVIDENCE-NEW", title: "Freshman health-AI option", classification: "official", claim: "A source-backed health-AI option for freshmen", sourceUrl: "https://example.edu/source", sourceTitle: "Example source", retrievedAt: "2026-08-27T00:00:00Z", confidence: 1, status: "current", addedBy: "agent", untrustedExternalContent: true } }))
    await executeCommand(repository, envelope({ type: "configure_view", view: { id: "VIEW-NEW", title: "My view", layout: "one_column", blocks: [] } }, 2))
    const workspace = await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")
    expect(workspace.evidence.some((item) => item.id === "EVIDENCE-NEW")).toBe(true)
    expect(receipt).toMatchObject({ visibleChange: true, primaryVisibleId: "SOURCE-EVIDENCE-NEW" })
    expect(workspace.contextItems.find((item) => item.id === receipt.primaryVisibleId)).toMatchObject({ type: "source", title: "Freshman health-AI option", collectionId: "COLLECTION-RESEARCH", sourceEvidenceIds: ["EVIDENCE-NEW"], content: { sourceUrl: "https://example.edu/source" } })
    expect(searchWorkspace(workspace, repository.catalog, "freshman healthcare health AI courses").groups.flatMap((group) => group.items).some((item) => item.id === receipt.primaryVisibleId)).toBe(true)
    expect(workspace.savedViews.some((item) => item.id === "VIEW-NEW")).toBe(true)
  })

  it("updates an existing visible research card instead of creating a duplicate", async () => {
    const repository = setup()
    const first = { id: "EVIDENCE-UPSERT", title: "Initial health source", classification: "official", claim: "Initial claim", sourceUrl: "https://example.edu/health", sourceTitle: "Health source", retrievedAt: "2026-08-27T00:00:00Z", confidence: 0.8, status: "current", addedBy: "agent", untrustedExternalContent: true }
    await executeCommand(repository, envelope({ type: "save_research", evidence: first }))
    await executeCommand(repository, envelope({ type: "save_research", evidence: { ...first, title: "Updated health source", claim: "Updated claim" } }, 2, "RESEARCH-UPDATE"))
    const workspace = await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")
    expect(workspace.contextItems.filter((item) => item.sourceEvidenceIds?.includes("EVIDENCE-UPSERT"))).toHaveLength(1)
    expect(workspace.contextItems.find((item) => item.sourceEvidenceIds?.includes("EVIDENCE-UPSERT"))).toMatchObject({ title: "Updated health source", summary: "Updated claim" })
  })

  it("updates human profile and context records and removes saved views", async () => {
    const repository = setup()
    await executeCommand(repository, envelope({ type: "update_profile", patch: { name: "Maya Patel", summary: "Health HCI and research", earliestStart: "09:00", latestEnd: "17:00", excludedDays: ["fri"], declaredProgramId: null } }))
    await executeCommand(repository, envelope({ type: "update_context_item", itemId: "NOTE-001", title: "Revised note", summary: "Revised details", content: { text: "Revised details" }, collectionId: "COLLECTION-RESEARCH" }, 2, "UPDATE-NOTE"))
    await executeCommand(repository, envelope({ type: "configure_view", view: { id: "VIEW-REMOVE-ME", title: "Temporary", layout: "one_column", blocks: [] } }, 3, "CREATE-REMOVABLE"))
    await executeCommand(repository, envelope({ type: "delete_saved_view", viewId: "VIEW-REMOVE-ME" }, 4, "DELETE-VIEW"))
    const workspace = await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")
    expect(workspace.profile).toMatchObject({ name: "Maya Patel", summary: "Health HCI and research", earliestStart: "09:00", declaredProgramId: null })
    expect(workspace.contextItems.find((item) => item.id === "NOTE-001")).toMatchObject({ title: "Revised note", collectionId: "COLLECTION-RESEARCH" })
    expect(workspace.savedViews.some((view) => view.id === "VIEW-REMOVE-ME")).toBe(false)
  })

  it("prevents an agent from changing student identity fields", async () => {
    await expect(executeCommand(setup(), { ...envelope({ type: "update_profile", patch: { name: "Agent name" } }), actor: { type: "agent", id: "AGENT-TEST" }, ownerUserId: "USER-DEMO" })).rejects.toMatchObject({ code: "COMMAND_INVALID" })
  })

  it("rejects research without an evidence ID and undo without a snapshot", async () => {
    await expect(executeCommand(setup(), envelope({ type: "save_research", evidence: { claim: "No ID" } }))).rejects.toMatchObject({ code: "COMMAND_INVALID" })
    await expect(executeCommand(setup(), envelope({ type: "undo_action", receiptId: "ACTION-MISSING" }))).rejects.toMatchObject({ code: "COMMAND_INVALID" })
  })

  it("rejects unsafe research and view payloads at the command boundary", async () => {
    await expect(executeCommand(setup(), envelope({ type: "save_research", evidence: { id: "EVIDENCE-UNSAFE", classification: "official", claim: "Unsafe", sourceUrl: "file:///etc/passwd", sourceTitle: "Unsafe", retrievedAt: "2026-08-27T00:00:00Z", confidence: 1, status: "current", addedBy: "agent", untrustedExternalContent: true } }))).rejects.toMatchObject({ code: "COMMAND_INVALID" })
    await expect(executeCommand(setup(), envelope({ type: "configure_view", view: { id: "VIEW-UNSAFE", title: "Unsafe", layout: "one_column", blocks: [{ type: "javascript" }] } }))).rejects.toMatchObject({ code: "COMMAND_INVALID" })
  })

  it("rejects duplicate context IDs and incomplete context records", async () => {
    await expect(executeCommand(setup(), envelope({ type: "create_context_item", item: { id: "NOTE-001", type: "note", title: "Duplicate", summary: "Duplicate", content: {}, collectionId: "COLLECTION-INBOX" } }))).rejects.toMatchObject({ code: "COMMAND_INVALID" })
    await expect(executeCommand(setup(), envelope({ type: "create_context_item", item: { type: "note" } }))).rejects.toThrow(/ID and title/i)
  })
})
