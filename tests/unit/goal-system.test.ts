import { describe, expect, it } from "vitest"
import { buildFixture } from "@/data/fixture"
import { buildStanfordCatalog } from "@/data/institutions/stanford"
import { executeCommand } from "@/domain/commands"
import { goalContentOf, nextMilestone, structuredGoals } from "@/domain/goals"
import { checkPlan } from "@/domain/planner"
import { createCourseContextTools } from "@/webmcp/tools"
import { exportBlocks } from "@/webmcp/export"
import { MemoryWorkspaceRepository } from "@/store/memory-repository"

const session = { userId: "USER-DEMO", workspaceId: "WORKSPACE-DEMO", actor: { type: "agent" as const, id: "AGENT-TEST" } }
const buildTools = (repository: MemoryWorkspaceRepository) =>
  createCourseContextTools({ repository, session, now: () => new Date("2026-08-29T12:00:00Z") })
const findTool = (tools: ReturnType<typeof createCourseContextTools>, name: string) => tools.find((tool) => tool.name === name)!
const envelope = (command: Record<string, unknown>, expectedVersion: number, key: string) =>
  ({ actor: { type: "agent" as const, id: "AGENT-TEST" }, ownerUserId: "USER-DEMO", workspaceId: "WORKSPACE-DEMO", expectedVersion, idempotencyKey: key, command })

describe("structured goals", () => {
  it("creates a goal whose dated milestones become linked todos", async () => {
    const repository = new MemoryWorkspaceRepository(buildFixture())
    const tools = buildTools(repository)
    const created = await findTool(tools, "manage_goal").execute({
      expectedVersion: 1,
      idempotencyKey: "G-1",
      action: "upsert",
      goal: { id: "GOAL-CURIS", title: "Be ready for CURIS", why: "Research early, health AI.", targetDate: "2027-03-01", milestones: [{ title: "Shortlist health-AI labs", due: "2026-12-01" }, { title: "Coffee chat with one professor", due: "2027-01-15" }, { title: "Draft an application story" }], courseIds: ["COURSE-CS-106B"], tags: ["research"] }
    })
    expect(created).toMatchObject({ ok: true, workspaceVersion: 2, primaryVisibleId: "GOAL-CURIS" })
    const workspace = await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")
    const item = workspace.contextItems.find((candidate) => candidate.id === "GOAL-CURIS")!
    const goal = goalContentOf(item)!
    expect(goal.milestones).toHaveLength(3)
    expect(goal.milestones[0].todoId).toBeTruthy()
    expect(goal.milestones[2].todoId).toBeUndefined()
    const linked = workspace.todos.find((todo) => todo.id === goal.milestones[0].todoId)!
    expect(linked).toMatchObject({ title: "Shortlist health-AI labs", due: "2026-12-01", done: false })
    expect(linked.detail).toContain("Be ready for CURIS")
    expect(nextMilestone(goal)?.title).toBe("Shortlist health-AI labs")
  })

  it("completes milestones and todos together, in both directions", async () => {
    const repository = new MemoryWorkspaceRepository(buildFixture())
    const tools = buildTools(repository)
    await findTool(tools, "manage_goal").execute({ expectedVersion: 1, idempotencyKey: "G-2", action: "upsert", goal: { id: "GOAL-SYNC", title: "Sync test", milestones: [{ title: "Step one", due: "2026-10-01" }, { title: "Step two", due: "2026-11-01" }] } })
    let workspace = await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")
    const goal = goalContentOf(workspace.contextItems.find((item) => item.id === "GOAL-SYNC")!)!
    const toggled = await findTool(tools, "manage_goal").execute({ expectedVersion: 2, idempotencyKey: "G-3", action: "toggle_milestone", goalId: "GOAL-SYNC", milestoneId: goal.milestones[0].id, done: true })
    expect(toggled).toMatchObject({ ok: true })
    workspace = await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")
    expect(workspace.todos.find((todo) => todo.id === goal.milestones[0].todoId)?.done).toBe(true)
    await executeCommand(repository, envelope({ type: "manage_todo", action: "toggle", todoId: goal.milestones[1].todoId }, 3, "G-4"))
    workspace = await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")
    const after = goalContentOf(workspace.contextItems.find((item) => item.id === "GOAL-SYNC")!)!
    expect(after.milestones[1].done).toBe(true)
    expect(nextMilestone(after)).toBeUndefined()
  })

  it("re-upserting drops removed milestones together with their todos and validates input", async () => {
    const repository = new MemoryWorkspaceRepository(buildFixture())
    const tools = buildTools(repository)
    await findTool(tools, "manage_goal").execute({ expectedVersion: 1, idempotencyKey: "G-5", action: "upsert", goal: { id: "GOAL-TRIM", title: "Trim test", milestones: [{ id: "MILESTONE-KEEP", title: "Keep", due: "2026-10-01" }, { id: "MILESTONE-DROP", title: "Drop", due: "2026-10-02" }] } })
    let workspace = await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")
    const dropTodoId = goalContentOf(workspace.contextItems.find((item) => item.id === "GOAL-TRIM")!)!.milestones[1].todoId
    await findTool(tools, "manage_goal").execute({ expectedVersion: 2, idempotencyKey: "G-6", action: "upsert", goal: { id: "GOAL-TRIM", title: "Trim test", milestones: [{ id: "MILESTONE-KEEP", title: "Keep", due: "2026-10-01" }] } })
    workspace = await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")
    expect(workspace.todos.some((todo) => todo.id === dropTodoId)).toBe(false)
    expect(goalContentOf(workspace.contextItems.find((item) => item.id === "GOAL-TRIM")!)!.milestones).toHaveLength(1)
    const noTitle = await findTool(tools, "manage_goal").execute({ expectedVersion: 3, idempotencyKey: "G-7", action: "upsert", goal: { milestones: [] } })
    expect(noTitle).toMatchObject({ ok: false, code: "COMMAND_INVALID" })
    const badDue = await findTool(tools, "manage_goal").execute({ expectedVersion: 3, idempotencyKey: "G-8", action: "upsert", goal: { title: "Bad", milestones: [{ title: "X", due: "2026-02-30" }] } })
    expect(badDue).toMatchObject({ ok: false, code: "COMMAND_INVALID" })
    const status = await findTool(tools, "manage_goal").execute({ expectedVersion: 3, idempotencyKey: "G-9", action: "set_status", goalId: "GOAL-TRIM", status: "achieved" })
    expect(status).toMatchObject({ ok: true })
    workspace = await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")
    expect(goalContentOf(workspace.contextItems.find((item) => item.id === "GOAL-TRIM")!)!.status).toBe("achieved")
  })

  it("surfaces active goals in planning context and structured milestones in the export", async () => {
    const repository = new MemoryWorkspaceRepository(buildFixture())
    const tools = buildTools(repository)
    await findTool(tools, "manage_goal").execute({ expectedVersion: 1, idempotencyKey: "G-10", action: "upsert", goal: { id: "GOAL-EXPORT", title: "Export me", milestones: [{ title: "First step", due: "2026-10-01" }], courseIds: ["COURSE-CS-106B"] } })
    const context = await findTool(tools, "get_planning_context").execute({}) as { goals?: Array<{ id: string, title: string, next: string | null }> }
    expect(context.goals?.some((goal) => goal.id === "GOAL-EXPORT" && goal.next === "First step")).toBe(true)
    const workspace = await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")
    const goals = exportBlocks(workspace, buildFixture().catalog, [], "goals", new Date("2026-08-29T12:00:00Z")).join("\n")
    expect(goals).toContain("- [ ] First step (due 2026-10-01)")
    expect(goals).toContain("Linked: CS 106B")
    expect(structuredGoals(workspace)).toHaveLength(1)
  })
})

describe("goal edge cases", () => {
  it("covers refusals, carryover, and status filtering", async () => {
    const repository = new MemoryWorkspaceRepository(buildFixture())
    const tools = buildTools(repository)
    const goalTool = findTool(tools, "manage_goal")
    const longTitle = await goalTool.execute({ expectedVersion: 1, idempotencyKey: "E-1", action: "upsert", goal: { title: "x".repeat(121) } })
    expect(longTitle).toMatchObject({ ok: false, code: "COMMAND_INVALID" })
    const tooMany = await goalTool.execute({ expectedVersion: 1, idempotencyKey: "E-2", action: "upsert", goal: { title: "Many", milestones: Array.from({ length: 13 }, (_, index) => ({ title: `M${index}` })) } })
    expect(String(tooMany.message)).toContain("twelve")
    const badTarget = await goalTool.execute({ expectedVersion: 1, idempotencyKey: "E-3", action: "upsert", goal: { title: "Bad target", targetDate: "2027-02-30" } })
    expect(badTarget).toMatchObject({ ok: false })
    const longMilestone = await goalTool.execute({ expectedVersion: 1, idempotencyKey: "E-3B", action: "upsert", goal: { title: "Long milestone", milestones: [{ title: "y".repeat(101) }] } })
    expect(String(longMilestone.message)).toContain("100 characters")
    const clash = await goalTool.execute({ expectedVersion: 1, idempotencyKey: "E-4", action: "upsert", goal: { id: "NOTE-001", title: "Wrong kind" } })
    expect(String(clash.message)).toMatch(/non-goal/)
    const unknownGoal = await goalTool.execute({ expectedVersion: 1, idempotencyKey: "E-5", action: "toggle_milestone", goalId: "GOAL-NOPE", milestoneId: "M" })
    expect(unknownGoal).toMatchObject({ ok: false })
    const badAction = await goalTool.execute({ expectedVersion: 1, idempotencyKey: "E-6", action: "explode" })
    expect(String(badAction.message)).toContain("upsert")

    await goalTool.execute({ expectedVersion: 1, idempotencyKey: "E-7", action: "upsert", goal: { id: "GOAL-EDGE", title: "Edge", why: "Original rationale.", status: "achieved", milestones: [{ id: "MILESTONE-EDGE-1", title: "Dated", due: "2026-10-01", done: true }] } })
    let workspace = await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")
    let goal = goalContentOf(workspace.contextItems.find((item) => item.id === "GOAL-EDGE")!)!
    expect(goal.status).toBe("achieved")
    expect(nextMilestone(goal)).toBeUndefined()
    const context = await findTool(tools, "get_planning_context").execute({}) as { goals?: Array<{ id: string }> }
    expect(context.goals?.some((entry) => entry.id === "GOAL-EDGE")).toBeFalsy()

    const unknownMilestone = await goalTool.execute({ expectedVersion: 2, idempotencyKey: "E-8", action: "toggle_milestone", goalId: "GOAL-EDGE", milestoneId: "MILESTONE-NOPE" })
    expect(unknownMilestone).toMatchObject({ ok: false })
    const badStatus = await goalTool.execute({ expectedVersion: 2, idempotencyKey: "E-9", action: "set_status", goalId: "GOAL-EDGE", status: "paused" })
    expect(String(badStatus.message)).toContain("active, achieved, or dropped")
    const statusUnknown = await goalTool.execute({ expectedVersion: 2, idempotencyKey: "E-10", action: "set_status", goalId: "GOAL-NOPE", status: "active" })
    expect(statusUnknown).toMatchObject({ ok: false })

    const withTodo = goal.milestones[0].todoId
    await goalTool.execute({ expectedVersion: 2, idempotencyKey: "E-11", action: "upsert", goal: { id: "GOAL-EDGE", title: "Edge", milestones: [{ id: "MILESTONE-EDGE-1", title: "Dated" }] } })
    workspace = await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")
    goal = goalContentOf(workspace.contextItems.find((item) => item.id === "GOAL-EDGE")!)!
    expect(goal.text).toBe("Original rationale.")
    expect(goal.milestones[0].todoId).toBeUndefined()
    expect(workspace.todos.some((todo) => todo.id === withTodo)).toBe(false)
    const uncheck = await goalTool.execute({ expectedVersion: 3, idempotencyKey: "E-12", action: "toggle_milestone", goalId: "GOAL-EDGE", milestoneId: "MILESTONE-EDGE-1", done: false })
    expect(uncheck).toMatchObject({ ok: true })
  })

  it("rejects oversized and malformed protected windows", async () => {
    const repository = new MemoryWorkspaceRepository(buildFixture())
    const tools = buildTools(repository)
    const five = await findTool(tools, "update_student_context").execute({ expectedVersion: 1, idempotencyKey: "PW-1", profile: { protectedWindows: Array.from({ length: 5 }, () => ({ days: ["mon"], start: "10:00", end: "11:00", label: "W" })) } })
    expect(String(five.message)).toContain("four")
    const noDays = await findTool(tools, "update_student_context").execute({ expectedVersion: 1, idempotencyKey: "PW-2", profile: { protectedWindows: [{ days: ["someday"], start: "10:00", end: "11:00", label: "W" }] } })
    expect(String(noDays.message)).toContain("valid day")
    const badClock = await findTool(tools, "update_student_context").execute({ expectedVersion: 1, idempotencyKey: "PW-3", profile: { protectedWindows: [{ days: ["mon"], start: "25:00", end: "26:00", label: "W" }] } })
    expect(badClock).toMatchObject({ ok: false })
    const defaulted = await findTool(tools, "update_student_context").execute({ expectedVersion: 1, idempotencyKey: "PW-4", profile: { protectedWindows: [{ days: ["mon"], start: "10:00", end: "11:00" }] } })
    expect(defaulted).toMatchObject({ ok: true })
    const workspace = await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")
    expect(workspace.profile.protectedWindows?.[0]).toMatchObject({ id: "WINDOW-1", label: "Protected time" })
  })
})

describe("protected time windows", () => {
  it("stores validated windows through the profile and flags overlapping sections", async () => {
    const repository = new MemoryWorkspaceRepository(buildFixture())
    const tools = buildTools(repository)
    const bad = await findTool(tools, "update_student_context").execute({ expectedVersion: 1, idempotencyKey: "W-0", profile: { protectedWindows: [{ days: ["fri"], start: "18:00", end: "13:00", label: "Backwards" }] } })
    expect(bad).toMatchObject({ ok: false, code: "COMMAND_INVALID" })
    const set = await findTool(tools, "update_student_context").execute({ expectedVersion: 1, idempotencyKey: "W-1", profile: { protectedWindows: [{ days: ["fri"], start: "13:00", end: "18:00", label: "Research afternoons" }] } })
    expect(set).toMatchObject({ ok: true })
    const workspace = await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")
    expect(workspace.profile.protectedWindows?.[0]).toMatchObject({ days: ["fri"], start: "13:00", end: "18:00", label: "Research afternoons" })
    const catalog = buildStanfordCatalog()
    const scenario = { id: "S", name: "S", unitLimit: 20, courses: [{ id: "PC-106B", courseId: "COURSE-CS-106B", sectionId: "SECTION-CS-106B-01", units: 5, status: "active" as const }], commitments: [] }
    const checks = checkPlan({ scenario, catalog, profile: workspace.profile, evidence: workspace.evidence, now: new Date("2026-08-29T12:00:00Z") })
    const flagged = checks.find((check) => check.code === "PROTECTED_TIME")
    expect(flagged).toBeDefined()
    expect(flagged?.message).toContain("Research afternoons")
    const profileExport = exportBlocks(workspace, buildFixture().catalog, [], "profile", new Date("2026-08-29T12:00:00Z")).join("\n")
    expect(profileExport).toContain("Protected time: Research afternoons fri 13:00 to 18:00.")
  })
})

describe("intended terms on interests", () => {
  it("stores, exports, validates, and clears the intended term", async () => {
    const repository = new MemoryWorkspaceRepository(buildFixture())
    const tools = buildTools(repository)
    const bad = await findTool(tools, "set_interest").execute({ expectedVersion: 1, idempotencyKey: "I-0", kind: "course", id: "COURSE-PSYCH-1", interested: true, intendedTermId: "next winter" })
    expect(bad).toMatchObject({ ok: false, code: "COMMAND_INVALID" })
    const set = await findTool(tools, "set_interest").execute({ expectedVersion: 1, idempotencyKey: "I-1", kind: "course", id: "COURSE-PSYCH-1", interested: true, intendedTermId: "TERM-2027-WINTER" })
    expect(set).toMatchObject({ ok: true })
    let workspace = await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")
    expect(workspace.courseIntents?.["COURSE-PSYCH-1"]).toBe("TERM-2027-WINTER")
    const tracker = exportBlocks(workspace, buildFixture().catalog, [], "courses", new Date("2026-08-29T12:00:00Z")).join("\n")
    expect(tracker).toContain("(intended Winter 2027)")
    await findTool(tools, "set_interest").execute({ expectedVersion: 2, idempotencyKey: "I-2", kind: "course", id: "COURSE-PSYCH-1", interested: false })
    workspace = await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")
    expect(workspace.courseIntents?.["COURSE-PSYCH-1"]).toBeUndefined()
  })
})

describe("expired evidence warning", () => {
  it("warns when current evidence has passed its expiry", async () => {
    const fixture = buildFixture()
    fixture.workspace.evidence.push({ id: "EVIDENCE-EXPIRED", classification: "official", claim: "Old schedule claim.", sourceUrl: "https://navigator.stanford.edu/classes", sourceTitle: "Stanford Navigator", retrievedAt: "2026-06-01T00:00:00Z", expiresAt: "2026-07-01T00:00:00Z", confidence: 0.9, status: "current", addedBy: "agent", untrustedExternalContent: true })
    const repository = new MemoryWorkspaceRepository(fixture)
    const tools = buildTools(repository)
    const context = await findTool(tools, "get_planning_context").execute({}) as { warnings?: string[] }
    expect(context.warnings?.some((warning) => warning.includes("passed expiry"))).toBe(true)
  })
})
