import { describe, expect, it } from "vitest"
import { buildFixture } from "@/data/fixture"
import { executeCommand } from "@/domain/commands"
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
  it("archives existing context and rejects a missing item", async () => {
    const repository = setup()
    await executeCommand(repository, envelope({ type: "archive_context_item", itemId: "NOTE-001" }))
    expect((await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")).contextItems.find((item) => item.id === "NOTE-001")?.archived).toBe(true)
    await expect(executeCommand(repository, envelope({ type: "archive_context_item", itemId: "NOTE-MISSING" }, 2))).rejects.toMatchObject({ code: "COMMAND_INVALID" })
  })

  it("updates an existing preference and rejects incomplete preference data", async () => {
    const repository = setup()
    await executeCommand(repository, envelope({ type: "set_student_preference", preference: { id: "PREFERENCE-DESIGN", label: "Prioritize studio work", strength: "hard", value: true } }))
    expect((await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")).profile.preferences.find((item) => item.id === "PREFERENCE-DESIGN")?.strength).toBe("hard")
    await expect(executeCommand(repository, envelope({ type: "set_student_preference", preference: { id: "PREFERENCE-BAD" } }, 2))).rejects.toMatchObject({ code: "COMMAND_INVALID" })
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
    await executeCommand(repository, envelope({ type: "save_research", evidence: { id: "EVIDENCE-NEW", classification: "official", claim: "New evidence", sourceUrl: "https://example.edu/source", sourceTitle: "Example source", retrievedAt: "2026-08-27T00:00:00Z", confidence: 1, status: "current", addedBy: "agent", untrustedExternalContent: true } }))
    await executeCommand(repository, envelope({ type: "configure_view", view: { id: "VIEW-NEW", title: "My view", layout: "one_column", blocks: [] } }, 2))
    const workspace = await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")
    expect(workspace.evidence.some((item) => item.id === "EVIDENCE-NEW")).toBe(true)
    expect(workspace.savedViews.some((item) => item.id === "VIEW-NEW")).toBe(true)
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
