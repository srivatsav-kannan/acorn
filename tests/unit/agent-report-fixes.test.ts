import { describe, expect, it } from "vitest"
import { buildFixture } from "@/data/fixture"
import { executeCommand } from "@/domain/commands"
import { creditCategory, validateApCredit } from "@/domain/history"
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

  it("never vouches for an unconfirmed write when even the reload of server truth failed", async () => {
    const repository = new MemoryWorkspaceRepository(buildFixture())
    const tools = buildTools(repository, {
      onWorkspaceChanged: async () => {
        // Neither the commit nor the reload succeeded, so the repository is
        // left holding the locally applied, unconfirmed state.
        throw Object.assign(new Error("The workspace could not be reloaded from the server."), { code: "RELOAD_FAILED" })
      }
    })
    const manageTodo = findTool(tools, "manage_todo")
    const result = await manageTodo.execute({ expectedVersion: 1, idempotencyKey: "DARK-1", action: "add", todo: { title: "Unknown fate" } })
    expect(result).toMatchObject({ ok: false, code: "RELOAD_FAILED", retryable: false })
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

describe("codex round one findings", () => {
  const envelope = (command: Record<string, unknown>, expectedVersion: number, key: string) =>
    ({ actor: { type: "agent" as const, id: "AGENT-TEST" }, ownerUserId: "USER-DEMO", workspaceId: "WORKSPACE-DEMO", expectedVersion, idempotencyKey: key, command })

  it("rejects impossible calendar values instead of committing them", async () => {
    const repository = new MemoryWorkspaceRepository(buildFixture())
    const add = (event: Record<string, unknown>, key: string) =>
      executeCommand(repository, envelope({ type: "manage_event", action: "add", event }, 1, key))
    await expect(add({ title: "Bad day", date: "2026-02-30" }, "IMP-1")).rejects.toThrow(/real calendar date/)
    await expect(add({ title: "Bad day", date: "2027-02-29" }, "IMP-2")).rejects.toThrow(/real calendar date/)
    await expect(add({ title: "Bad clock", date: "2026-10-05", start: "25:61" }, "IMP-3")).rejects.toThrow(/real clock/)
    await expect(add({ title: "Backwards", date: "2026-10-05", start: "17:00", end: "09:00" }, "IMP-4")).rejects.toThrow(/end time comes before its start/)
    await expect(executeCommand(repository, envelope({ type: "manage_todo", action: "add", todo: { title: "Bad due", due: "2026-02-30" } }, 1, "IMP-5"))).rejects.toThrow(/real calendar date/)
    await expect(executeCommand(repository, envelope({ type: "manage_todo", action: "add", todo: { title: "Bad due time", due: "2026-10-05", dueTime: "24:00" } }, 1, "IMP-6"))).rejects.toThrow(/real clock/)
    const leapDay = await add({ title: "Leap day brunch", date: "2028-02-29", start: "10:00", end: "11:30" }, "IMP-7")
    expect(leapDay.ok).toBe(true)
  })

  it("rejects oversized titles instead of silently truncating them", async () => {
    const repository = new MemoryWorkspaceRepository(buildFixture())
    await expect(executeCommand(repository, envelope({ type: "manage_event", action: "add", event: { title: "x".repeat(101), date: "2026-10-05" } }, 1, "LONG-1"))).rejects.toThrow(/100 characters/)
    await expect(executeCommand(repository, envelope({ type: "manage_todo", action: "add", todo: { title: "x".repeat(121) } }, 1, "LONG-2"))).rejects.toThrow(/120 characters/)
  })

  it("labels legacy IB records as IB even when their stored kind defaulted to ap", () => {
    const { workspace, catalog } = buildFixture()
    workspace.profile.apCredits = [
      { id: "AP-IB-PHYSICS-HL", exam: "IB Physics HL", score: 7, unitsGranted: 8, satisfiesCourseIds: [], kind: "ap" },
      { id: "AP-CALC", exam: "AP Calculus BC", score: 5, unitsGranted: 10, satisfiesCourseIds: [], kind: "ap" }
    ]
    const exported = exportBlocks(workspace, catalog, [], "history", new Date("2026-08-29T12:00:00Z")).join("\n")
    expect(exported).toContain("- IB: IB Physics HL")
    expect(exported).toContain("- AP: AP Calculus BC")
  })

  it("infers IB from the exam name and allows IB score bounds when kind is omitted", () => {
    const credit = validateApCredit({ exam: "IB Chemistry HL", score: 7 })
    expect(credit.kind).toBe("ib")
    expect(credit.score).toBe(7)
    expect(creditCategory({ exam: "AP Statistics" })).toBe("ap")
    expect(creditCategory({ exam: "Multivariable Calculus", kind: "college" })).toBe("college")
  })

  it("registers dueTime in the manage_todo schema so schema-following hosts can send it", () => {
    const repository = new MemoryWorkspaceRepository(buildFixture())
    const tools = buildTools(repository)
    const schema = findTool(tools, "manage_todo").inputSchema.properties?.todo as { properties?: Record<string, unknown> }
    expect(schema.properties?.dueTime).toBeDefined()
  })

  it("answers a missing envelope with a clean error instead of crashing", async () => {
    const repository = new MemoryWorkspaceRepository(buildFixture())
    const tools = buildTools(repository)
    const bare = await findTool(tools, "manage_event").execute({})
    expect(bare).toMatchObject({ ok: false, code: "COMMAND_INVALID" })
    expect(String(bare.message)).toMatch(/expectedVersion/)
  })
})

describe("codex round two findings", () => {
  const envelope = (command: Record<string, unknown>, expectedVersion: number, key: string) =>
    ({ actor: { type: "agent" as const, id: "AGENT-TEST" }, ownerUserId: "USER-DEMO", workspaceId: "WORKSPACE-DEMO", expectedVersion, idempotencyKey: key, command })

  it("rejects impossible planning-window values instead of silently skipping them", async () => {
    const repository = new MemoryWorkspaceRepository(buildFixture())
    await expect(executeCommand(repository, envelope({ type: "update_profile", patch: { earliestStart: "25:00" } }, 1, "WIN-1"))).rejects.toThrow(/real clock value/)
    await expect(executeCommand(repository, envelope({ type: "update_profile", patch: { earliestStart: "18:00", latestEnd: "09:00" } }, 1, "WIN-2"))).rejects.toThrow(/must come after/)
    const valid = await executeCommand(repository, envelope({ type: "update_profile", patch: { earliestStart: "09:30" } }, 1, "WIN-3"))
    expect(valid.ok).toBe(true)
    const workspace = await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")
    expect(workspace.profile.earliestStart).toBe("09:30")
  })

  it("evaluates program progress and projected units against the active scenario", async () => {
    const repository = new MemoryWorkspaceRepository(buildFixture())
    const tools = buildTools(repository)
    const before = await findTool(tools, "get_program_progress").execute({}) as { program: { requirements: Array<{ courseIds?: string[] }> } }
    const plannedBefore = new Set(before.program.requirements.flatMap((requirement) => requirement.courseIds ?? []))
    await executeCommand(repository, envelope({
      type: "edit_plan",
      planId: "PLAN-AUT26",
      operations: [{ type: "create_scenario", scenario: { id: "SCENARIO-ALT", name: "Alternate", courses: [{ id: "PLANCOURSE-ALT-CS-106B", courseId: "COURSE-CS-106B", sectionId: "SECTION-CS-106B-01", units: 5, status: "active" }] } }]
    }, 1, "SCEN-1"))
    await executeCommand(repository, envelope({ type: "edit_plan", planId: "PLAN-AUT26", scenarioId: "SCENARIO-ALT", operations: [{ type: "set_active_scenario" }] }, 2, "SCEN-2"))
    const after = await findTool(tools, "get_program_progress").execute({}) as { program: { requirements: Array<{ courseIds?: string[] }> } }
    const plannedAfter = new Set(after.program.requirements.flatMap((requirement) => requirement.courseIds ?? []))
    expect(plannedAfter.has("COURSE-CS-106B")).toBe(true)
    expect(plannedAfter).not.toEqual(plannedBefore)
    const workspace = await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")
    const { evaluateDegreePlan } = await import("@/domain/degree-plan")
    const { buildStanfordCatalog } = await import("@/data/fixture")
    const evaluation = evaluateDegreePlan(workspace, buildStanfordCatalog(), new Date("2026-08-29T12:00:00Z"))
    const scenario = workspace.plans[0].scenarios.find((item) => item.id === "SCENARIO-ALT")!
    expect(workspace.plans[0].activeScenarioId).toBe("SCENARIO-ALT")
    expect(scenario.courses).toHaveLength(1)
    expect(evaluation.plannedUnits).toBe(5)
  })

  it("exports due times, activity bounds, and locations", () => {
    const { workspace, catalog } = buildFixture()
    workspace.todos.push({ id: "TODO-TIMED-EXPORT", title: "Submit form", due: "2026-09-15", dueTime: "18:30", done: false, source: "human", createdAt: "2026-08-29T00:00:00Z" })
    workspace.activities.push({ id: "ACT-BOUNDED", name: "Robotics build", kind: "other", schedule: { days: ["tue", "thu"], start: "17:00", end: "18:00", location: "Gates" }, startDate: "2026-09-22", endDate: "2026-10-09", addedBy: "human" })
    const exported = exportBlocks(workspace, catalog, [], "all", new Date("2026-08-29T12:00:00Z")).join("\n")
    expect(exported).toContain("(due 2026-09-15 18:30)")
    expect(exported).toContain("17:00 to 18:00 at Gates")
    expect(exported).toContain("Runs 2026-09-22 to 2026-10-09.")
  })

  it("explains a same-term prerequisite instead of claiming it is not planned", async () => {
    const { workspace, catalog } = buildFixture()
    const { checkPlan } = await import("@/domain/planner")
    const scenario = structuredClone(workspace.plans[0].scenarios[0])
    scenario.courses.push({ id: "PLANCOURSE-MATH-52", courseId: "COURSE-MATH-52", sectionId: "SECTION-MATH-52-01", units: 5, status: "active" })
    const sameTerm = checkPlan({ scenario, catalog, profile: workspace.profile, evidence: workspace.evidence, now: new Date("2026-08-28T12:00:00Z") })
    const check = sameTerm.find((item) => item.code === "PREREQUISITE_MISSING" && item.affectedIds.includes("PLANCOURSE-MATH-52"))!
    expect(check.message).toContain("planned in this same term")
    scenario.courses = scenario.courses.filter((item) => item.courseId !== "COURSE-MATH-51")
    const notPlanned = checkPlan({ scenario, catalog, profile: workspace.profile, evidence: workspace.evidence, now: new Date("2026-08-28T12:00:00Z") })
    const missing = notPlanned.find((item) => item.code === "PREREQUISITE_MISSING" && item.affectedIds.includes("PLANCOURSE-MATH-52"))!
    expect(missing.message).toContain("not completed before this term")
  })
})

describe("codex round three findings", () => {
  const envelope = (command: Record<string, unknown>, expectedVersion: number, key: string) =>
    ({ actor: { type: "agent" as const, id: "AGENT-TEST" }, ownerUserId: "USER-DEMO", workspaceId: "WORKSPACE-DEMO", expectedVersion, idempotencyKey: key, command })
  const referenceEvidence = { id: "EVIDENCE-R3", title: "Ref source", classification: "official", claim: "Official reference.", sourceUrl: "https://example.edu/ref", sourceTitle: "Catalog", retrievedAt: "2026-08-29T00:00:00Z", confidence: 0.9, status: "current" }

  it("lists the active scenario first in get_plan", async () => {
    const repository = new MemoryWorkspaceRepository(buildFixture())
    const tools = buildTools(repository)
    await executeCommand(repository, envelope({ type: "edit_plan", planId: "PLAN-AUT26", operations: [{ type: "create_scenario", scenario: { id: "SCENARIO-ALT", name: "Alternate", courses: [] } }] }, 1, "GP-1"))
    await executeCommand(repository, envelope({ type: "edit_plan", planId: "PLAN-AUT26", scenarioId: "SCENARIO-ALT", operations: [{ type: "set_active_scenario" }] }, 2, "GP-2"))
    const result = await findTool(tools, "get_plan").execute({ planId: "PLAN-AUT26" }) as { plan: { activeScenarioId: string, scenarios: Array<{ id: string }> } }
    expect(result.plan.activeScenarioId).toBe("SCENARIO-ALT")
    expect(result.plan.scenarios[0].id).toBe("SCENARIO-ALT")
  })

  it("rejects a reused idempotency key with a different payload", async () => {
    const repository = new MemoryWorkspaceRepository(buildFixture())
    const tools = buildTools(repository)
    const manageEvent = findTool(tools, "manage_event")
    const first = await manageEvent.execute({ expectedVersion: 1, idempotencyKey: "SAME-KEY", action: "add", event: { title: "Payload A", date: "2026-10-05" } })
    expect(first).toMatchObject({ ok: true, workspaceVersion: 2 })
    const different = await manageEvent.execute({ expectedVersion: 1, idempotencyKey: "SAME-KEY", action: "add", event: { title: "Payload B", date: "2026-10-06" } })
    expect(different).toMatchObject({ ok: false, code: "IDEMPOTENCY_CONFLICT" })
    const replay = await manageEvent.execute({ expectedVersion: 1, idempotencyKey: "SAME-KEY", action: "add", event: { title: "Payload A", date: "2026-10-05" } })
    expect(replay).toMatchObject({ ok: true, receiptId: first.receiptId })
    const workspace = await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")
    expect(workspace.events.filter((event) => event.title.startsWith("Payload"))).toHaveLength(1)
  })

  it("removes agent-added reference entries through extend_reference and protects shipped ones", async () => {
    const repository = new MemoryWorkspaceRepository(buildFixture())
    const tools = buildTools(repository)
    const extend = findTool(tools, "extend_reference")
    const added = await extend.execute({ expectedVersion: 1, idempotencyKey: "REF-ADD", course: { code: "CS 197X", title: "Applied Planning Studio" }, evidence: referenceEvidence })
    expect(added).toMatchObject({ ok: true })
    const courseId = (added.changed as Array<{ type: string, id: string }>).find((item) => item.type === "reference_course")?.id ?? added.primaryVisibleId
    const removed = await extend.execute({ expectedVersion: 2, idempotencyKey: "REF-REMOVE", remove: { kind: "course", id: courseId } })
    expect(removed).toMatchObject({ ok: true })
    const workspace = await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")
    expect(workspace.referenceOverlay?.courses ?? []).toHaveLength(0)
    const shipped = await extend.execute({ expectedVersion: 3, idempotencyKey: "REF-SHIPPED", remove: { kind: "program", id: workspace.programs[0].id } })
    expect(shipped).toMatchObject({ ok: false, code: "COMMAND_INVALID" })
    const missingEvidence = await extend.execute({ expectedVersion: 3, idempotencyKey: "REF-NOEV", course: { code: "CS 198X", title: "Another" } })
    expect(missingEvidence).toMatchObject({ ok: false, code: "COMMAND_INVALID" })
    expect(String(missingEvidence.message)).toMatch(/evidence/)
  })

  it("flags an exact course code the catalog does not carry", () => {
    const { workspace, catalog } = buildFixture()
    const missing = searchWorkspace(workspace, catalog, "CS 197X Applied Planning Systems Studio")
    expect(missing.sufficient).toBe(false)
    expect(missing.gaps.some((gap) => gap.includes("CS 197X"))).toBe(true)
    const present = searchWorkspace(workspace, catalog, "CS 106A introduction")
    expect(present.gaps.some((gap) => gap.includes("No catalog course matches"))).toBe(false)
  })

  it("warns a fresh agent when durable notes contradict the structured timeline", async () => {
    const fixture = buildFixture()
    fixture.workspace.contextItems.push({ id: "NOTE-STALE-YEAR", type: "note", title: "Roadmap", summary: "Four year roadmap for the Class of 2099.", content: { text: "Class of 2099 plan." }, tags: [], collectionId: "COLLECTION-INBOX", addedBy: { type: "human", id: "USER-DEMO" }, createdAt: "2026-08-29T00:00:00Z", updatedAt: "2026-08-29T00:00:00Z" })
    const repository = new MemoryWorkspaceRepository(fixture)
    const tools = buildTools(repository)
    const context = await findTool(tools, "get_planning_context").execute({}) as { warnings?: string[] }
    expect(context.warnings?.some((warning) => warning.includes("Class of 2099") && warning.includes("authoritative"))).toBe(true)
    const clean = await findTool(buildTools(new MemoryWorkspaceRepository(buildFixture())), "get_planning_context").execute({}) as { warnings?: string[] }
    expect(clean.warnings).toBeUndefined()
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
