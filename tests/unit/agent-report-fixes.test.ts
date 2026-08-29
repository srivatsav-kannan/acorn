import { describe, expect, it } from "vitest"
import { buildFixture } from "@/data/fixture"
import { executeCommand } from "@/domain/commands"
import { searchWorkspace } from "@/domain/search"
import type { WorkspaceState } from "@/domain/types"
import { createCourseContextTools } from "@/webmcp/tools"
import { exportBlocks } from "@/webmcp/export"
import { MemoryWorkspaceRepository } from "@/store/memory-repository"

// Regression coverage for the external agent's bug report: mutations that
// acknowledged before the durable commit confirmed, unserialized tool calls,
// ambiguous timeouts, misfiled IB credit, a stale workspace title after a
// rename, and search sufficiency that ignored real gaps.

const session = { userId: "USER-DEMO", workspaceId: "WORKSPACE-DEMO", actor: { type: "agent" as const, id: "AGENT-TEST" } }
const commitError = (code: string) => Object.assign(new Error("The save did not confirm in time."), { code })

const buildTools = (repository: MemoryWorkspaceRepository, options: Parameters<typeof createCourseContextTools>[0] extends infer T ? Partial<T> : never = {}) =>
  createCourseContextTools({ repository, session, now: () => new Date("2026-08-29T12:00:00Z"), ...options })

const findTool = (tools: ReturnType<typeof createCourseContextTools>, name: string) => tools.find((tool) => tool.name === name)!

describe("agent mutation durability", () => {
  it("serializes concurrent tool mutations through the shared gate", async () => {
    const repository = new MemoryWorkspaceRepository(buildFixture())
    let queue: Promise<unknown> = Promise.resolve()
    const runExclusive = <T,>(task: () => Promise<T>): Promise<T> => {
      const run = queue.then(task)
      queue = run.catch(() => undefined)
      return run
    }
    const settle = () => new Promise((resolve) => setTimeout(resolve, 10))
    const tools = buildTools(repository, { runExclusive, onWorkspaceChanged: async () => { await settle() } })
    const manageTodo = findTool(tools, "manage_todo")
    const [first, second] = await Promise.all([
      manageTodo.execute({ expectedVersion: 1, idempotencyKey: "GATE-1", action: "add", todo: { title: "First queued todo" } }),
      manageTodo.execute({ expectedVersion: 2, idempotencyKey: "GATE-2", action: "add", todo: { title: "Second queued todo" } })
    ])
    expect(first).toMatchObject({ ok: true, workspaceVersion: 2 })
    expect(second).toMatchObject({ ok: true, workspaceVersion: 3 })
    const workspace = await repository.getWorkspace(session.workspaceId, session.userId)
    expect(workspace.todos.map((todo) => todo.title)).toEqual(expect.arrayContaining(["First queued todo", "Second queued todo"]))
  })

  it("reports a retryable failure and keeps server truth when the commit does not land", async () => {
    const repository = new MemoryWorkspaceRepository(buildFixture())
    const serverTruth = await repository.getWorkspace(session.workspaceId, session.userId)
    const tools = buildTools(repository, {
      onWorkspaceChanged: async () => {
        repository.replaceWorkspace(serverTruth)
        throw commitError("COMMIT_TIMEOUT")
      }
    })
    const manageTodo = findTool(tools, "manage_todo")
    const result = await manageTodo.execute({ expectedVersion: 1, idempotencyKey: "LOST-1", action: "add", todo: { title: "Should not survive" } })
    expect(result).toMatchObject({ ok: false, code: "COMMIT_TIMEOUT", retryable: true })
    const after = await repository.getWorkspace(session.workspaceId, session.userId)
    expect(after.version).toBe(1)
    expect(after.todos.some((todo) => todo.title === "Should not survive")).toBe(false)
  })

  it("recovers cleanly when the failed commit is retried with the same idempotency key", async () => {
    const repository = new MemoryWorkspaceRepository(buildFixture())
    const serverTruth = await repository.getWorkspace(session.workspaceId, session.userId)
    let failOnce = true
    const tools = buildTools(repository, {
      onWorkspaceChanged: async () => {
        if (failOnce) {
          failOnce = false
          repository.replaceWorkspace(serverTruth)
          throw commitError("COMMIT_TIMEOUT")
        }
      }
    })
    const manageTodo = findTool(tools, "manage_todo")
    const failed = await manageTodo.execute({ expectedVersion: 1, idempotencyKey: "RETRY-1", action: "add", todo: { title: "Retried todo" } })
    expect(failed).toMatchObject({ ok: false, retryable: true })
    const retried = await manageTodo.execute({ expectedVersion: 1, idempotencyKey: "RETRY-1", action: "add", todo: { title: "Retried todo" } })
    expect(retried).toMatchObject({ ok: true, workspaceVersion: 2 })
    const after = await repository.getWorkspace(session.workspaceId, session.userId)
    expect(after.todos.filter((todo) => todo.title === "Retried todo")).toHaveLength(1)
  })

  it("returns the original receipt when a timed-out commit actually landed", async () => {
    const repository = new MemoryWorkspaceRepository(buildFixture())
    const tools = buildTools(repository, {
      onWorkspaceChanged: async (next: WorkspaceState) => {
        repository.replaceWorkspace(next)
        throw commitError("COMMIT_TIMEOUT")
      }
    })
    const manageTodo = findTool(tools, "manage_todo")
    const result = await manageTodo.execute({ expectedVersion: 1, idempotencyKey: "LANDED-1", action: "add", todo: { title: "Landed despite timeout" } })
    expect(result).toMatchObject({ ok: true, workspaceVersion: 2 })
    const after = await repository.getWorkspace(session.workspaceId, session.userId)
    expect(after.todos.some((todo) => todo.title === "Landed despite timeout")).toBe(true)
  })
})

describe("payload growth", () => {
  const envelope = (command: Record<string, unknown>, expectedVersion: number, key: string) =>
    ({ actor: { type: "agent" as const, id: "AGENT-TEST" }, ownerUserId: "USER-DEMO", workspaceId: "WORKSPACE-DEMO", expectedVersion, idempotencyKey: key, command })

  it("keeps undo snapshots flat and bounded so the payload stops compounding", async () => {
    const fixture = buildFixture()
    // A legacy nested snapshot from before the flattening rule.
    const legacy = structuredClone(fixture.workspace)
    legacy.undoSnapshots = { "ACTION-DEEPER": structuredClone(fixture.workspace) }
    fixture.workspace.undoSnapshots["ACTION-LEGACY"] = legacy
    const repository = new MemoryWorkspaceRepository(fixture)
    const receipts: string[] = []
    for (let index = 0; index < 12; index++) {
      const receipt = await executeCommand(repository, envelope({ type: "manage_todo", action: "add", todo: { title: `Growth todo ${index}` } }, index + 1, `GROW-${index}`))
      receipts.push(receipt.receiptId)
    }
    const workspace = await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")
    const stored = Object.values(workspace.undoSnapshots)
    expect(Object.keys(workspace.undoSnapshots)).toHaveLength(10)
    expect(stored.every((snapshot) => Object.keys(snapshot.undoSnapshots).length === 0)).toBe(true)
    expect(workspace.undoSnapshots["ACTION-LEGACY"]).toBeUndefined()
    await expect(executeCommand(repository, envelope({ type: "undo_action", receiptId: receipts[0] }, 13, "UNDO-OLD"))).rejects.toThrow(/no longer be undone/)
    const undone = await executeCommand(repository, envelope({ type: "undo_action", receiptId: receipts[11] }, 13, "UNDO-NEW"))
    expect(undone.ok).toBe(true)
  })

  it("does not persist again when a mutation is an idempotent replay", async () => {
    const repository = new MemoryWorkspaceRepository(buildFixture())
    let persists = 0
    const tools = buildTools(repository, { onWorkspaceChanged: async () => { persists += 1 } })
    const manageTodo = findTool(tools, "manage_todo")
    const first = await manageTodo.execute({ expectedVersion: 1, idempotencyKey: "REPLAY-1", action: "add", todo: { title: "Replay todo" } })
    const replay = await manageTodo.execute({ expectedVersion: 1, idempotencyKey: "REPLAY-1", action: "add", todo: { title: "Replay todo" } })
    expect(first).toMatchObject({ ok: true, workspaceVersion: 2 })
    expect(replay).toMatchObject({ ok: true, workspaceVersion: 2, receiptId: first.receiptId })
    expect(persists).toBe(1)
  })
})

describe("identity and history consistency", () => {
  it("renaming the student also renames the workspace title", async () => {
    const repository = new MemoryWorkspaceRepository(buildFixture())
    await executeCommand(repository, { actor: { type: "human", id: "USER-DEMO" }, ownerUserId: "USER-DEMO", workspaceId: "WORKSPACE-DEMO", expectedVersion: 1, idempotencyKey: "RENAME-1", command: { type: "update_profile", patch: { name: "Srivatsav Kannan" } } })
    const workspace = await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")
    expect(workspace.profile.name).toBe("Srivatsav Kannan")
    expect(workspace.title).toBe("Srivatsav's academic workspace")
  })

  it("labels external credit by kind in the history export", () => {
    const { workspace, catalog } = buildFixture()
    workspace.profile.apCredits = [
      { id: "AP-CS", exam: "AP Computer Science A", score: 5, unitsGranted: 5, satisfiesCourseIds: [] },
      { id: "IB-PHYS", exam: "IB Physics HL", score: 7, unitsGranted: 8, satisfiesCourseIds: [], kind: "ib" },
      { id: "COLLEGE-CALC", exam: "Multivariable Calculus", unitsGranted: 4, satisfiesCourseIds: [], kind: "college", institution: "Foothill College" }
    ]
    const exported = exportBlocks(workspace, catalog, [], "history", new Date("2026-08-29T12:00:00Z")).join("\n")
    expect(exported).toContain("External credit (AP, IB, and college coursework):")
    expect(exported).toContain("- AP: AP Computer Science A, score 5, 5 units granted")
    expect(exported).toContain("- IB: IB Physics HL, score 7, 8 units granted")
    expect(exported).toContain("- Foothill College: Multivariable Calculus, 4 units granted")
  })
})

describe("search sufficiency", () => {
  it("flags a missing program reference instead of claiming sufficiency", () => {
    const { workspace, catalog } = buildFixture()
    const result = searchWorkspace(workspace, catalog, "CS coterm MSCS masters requirements")
    expect(result.sufficient).toBe(false)
    expect(result.gaps.some((gap) => gap.includes("extend_reference"))).toBe(true)
  })

  it("stays sufficient when durable context answers the question", () => {
    const { workspace, catalog } = buildFixture()
    const note = workspace.contextItems.find((item) => !item.archived)!
    const result = searchWorkspace(workspace, catalog, note.title)
    expect(result.sufficient).toBe(true)
    expect(result.gaps).toEqual([])
  })
})
