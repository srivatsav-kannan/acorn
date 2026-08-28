import { beforeEach, describe, expect, it } from "vitest"
import { buildFixture } from "@/data/fixture"
import { executeCommand } from "@/domain/commands"
import { MemoryWorkspaceRepository } from "@/store/memory-repository"

describe("command engine", () => {
  let repository: MemoryWorkspaceRepository

  beforeEach(() => {
    repository = new MemoryWorkspaceRepository(buildFixture())
  })

  const envelope = (command: Record<string, unknown>, overrides: Record<string, unknown> = {}) => ({
    actor: { type: "human" as const, id: "USER-DEMO" },
    workspaceId: "WORKSPACE-DEMO",
    expectedVersion: 1,
    idempotencyKey: "TEST-001",
    command,
    ...overrides
  })

  it("creates a context item with a complete receipt and activity entry", async () => {
    const receipt = await executeCommand(repository, envelope({
      type: "create_context_item",
      item: {
        id: "NOTE-NEW-IDEA",
        type: "idea",
        title: "Look into a health AI reading group",
        summary: "A possible autumn activity",
        content: { text: "Ask the CS and medicine communities." },
        collectionId: "COLLECTION-INBOX"
      }
    }))
    expect(receipt).toMatchObject({
      ok: true,
      receiptId: expect.stringMatching(/^ACTION-/),
      workspaceVersion: 2,
      changed: [{ type: "context_item", id: "NOTE-NEW-IDEA" }],
      undoAvailable: true,
      actor: { type: "human", id: "USER-DEMO" }
    })
    const workspace = await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")
    expect(workspace.contextItems.some((item) => item.id === "NOTE-NEW-IDEA")).toBe(true)
    expect(workspace.activity.at(-1)?.receiptId).toBe(receipt.receiptId)
  })

  it("attributes an agent mutation without creating a different state shape", async () => {
    const human = await executeCommand(repository, envelope({
      type: "create_context_item",
      item: {
        id: "NOTE-HUMAN",
        type: "note",
        title: "Human note",
        summary: "Human note",
        content: { text: "Same domain shape" },
        collectionId: "COLLECTION-INBOX"
      }
    }))
    const agent = await executeCommand(repository, envelope({
      type: "create_context_item",
      item: {
        id: "NOTE-AGENT",
        type: "note",
        title: "Agent note",
        summary: "Agent note",
        content: { text: "Same domain shape" },
        collectionId: "COLLECTION-INBOX"
      }
    }, {
      actor: { type: "agent", id: "AGENT-CHATGPT" },
      ownerUserId: "USER-DEMO",
      expectedVersion: 2,
      idempotencyKey: "TEST-002"
    }))
    expect(human.changed[0].type).toBe(agent.changed[0].type)
    expect(agent.actor.type).toBe("agent")
  })

  it("returns the original receipt for a repeated idempotency key", async () => {
    const input = envelope({
      type: "create_context_item",
      item: {
        id: "NOTE-IDEMPOTENT",
        type: "note",
        title: "Only once",
        summary: "Only once",
        content: { text: "Only once" },
        collectionId: "COLLECTION-INBOX"
      }
    })
    const first = await executeCommand(repository, input)
    const second = await executeCommand(repository, input)
    expect(second.receiptId).toBe(first.receiptId)
    const workspace = await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")
    expect(workspace.contextItems.filter((item) => item.id === "NOTE-IDEMPOTENT")).toHaveLength(1)
  })

  it("rejects a stale version without changing state", async () => {
    await executeCommand(repository, envelope({
      type: "set_student_preference",
      preference: { id: "PREFERENCE-NEW", label: "Prefer later mornings", strength: "soft", value: true }
    }))
    await expect(executeCommand(repository, envelope({
      type: "set_student_preference",
      preference: { id: "PREFERENCE-STALE", label: "Stale write", strength: "soft", value: true }
    }, { idempotencyKey: "TEST-STALE" }))).rejects.toMatchObject({ code: "VERSION_CONFLICT" })
    const workspace = await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")
    expect(workspace.profile.preferences.some((preference) => preference.id === "PREFERENCE-STALE")).toBe(false)
  })

  it("rolls back a bulk plan edit when one operation is invalid", async () => {
    const before = structuredClone(await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO"))
    await expect(executeCommand(repository, envelope({
      type: "edit_plan",
      planId: "PLAN-AUT26",
      scenarioId: "SCENARIO-PRIMARY",
      operations: [
        { type: "add_course", planCourse: { id: "PLANCOURSE-VALID", courseId: "COURSE-CS-147", sectionId: "SECTION-CS-147-01", units: 4, status: "active" } },
        { type: "select_section", planCourseId: "PLANCOURSE-MISSING", sectionId: "SECTION-NOT-REAL" }
      ]
    }))).rejects.toMatchObject({ code: "COMMAND_INVALID" })
    const after = await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")
    expect(after.plans).toEqual(before.plans)
    expect(after.version).toBe(before.version)
  })

  it("undoes an additive action atomically", async () => {
    const created = await executeCommand(repository, envelope({
      type: "create_context_item",
      item: {
        id: "NOTE-UNDO",
        type: "note",
        title: "Undo me",
        summary: "Undo me",
        content: { text: "Temporary" },
        collectionId: "COLLECTION-INBOX"
      }
    }))
    const undo = await executeCommand(repository, envelope({
      type: "undo_action",
      receiptId: created.receiptId
    }, { expectedVersion: 2, idempotencyKey: "TEST-UNDO" }))
    expect(undo.ok).toBe(true)
    const workspace = await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")
    expect(workspace.contextItems.some((item) => item.id === "NOTE-UNDO")).toBe(false)
  })

  it("requires confirmation for a durable identity fact", async () => {
    const receipt = await executeCommand(repository, envelope({
      type: "update_profile_fact",
      field: "declaredProgramId",
      value: "PROGRAM-CS-BS"
    }))
    expect(receipt).toMatchObject({ ok: false, code: "CONFIRMATION_REQUIRED" })
  })

  it("rejects unauthorized and cross-workspace access", async () => {
    await expect(repository.getWorkspace("WORKSPACE-DEMO", "USER-OTHER")).rejects.toMatchObject({ code: "FORBIDDEN" })
    await expect(executeCommand(repository, envelope({ type: "archive_context_item", itemId: "NOTE-001" }, {
      actor: { type: "human", id: "USER-OTHER" }
    }))).rejects.toMatchObject({ code: "FORBIDDEN" })
  })
})
