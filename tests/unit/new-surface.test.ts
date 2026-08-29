import { describe, expect, it } from "vitest"
import { buildFixture } from "@/data/fixture"
import { buildStanfordCatalog } from "@/data/institutions/stanford"
import { buildIcs } from "@/domain/ics"
import { checkPlan } from "@/domain/planner"
import { createCourseContextTools } from "@/webmcp/tools"
import { MemoryWorkspaceRepository } from "@/store/memory-repository"

const session = { userId: "USER-DEMO", workspaceId: "WORKSPACE-DEMO", actor: { type: "agent" as const, id: "AGENT-TEST" } }
const buildTools = (repository: MemoryWorkspaceRepository) =>
  createCourseContextTools({ repository, session, now: () => new Date("2026-08-29T12:00:00Z") })
const findTool = (tools: ReturnType<typeof createCourseContextTools>, name: string) => tools.find((tool) => tool.name === name)!

describe("the undo tool", () => {
  it("reverses an agent mutation by receipt and records the undo in the ledger", async () => {
    const repository = new MemoryWorkspaceRepository(buildFixture())
    const tools = buildTools(repository)
    const added = await findTool(tools, "manage_todo").execute({ expectedVersion: 1, idempotencyKey: "U-1", action: "add", todo: { title: "Undo me" } })
    expect(added).toMatchObject({ ok: true, workspaceVersion: 2 })
    const undone = await findTool(tools, "undo").execute({ expectedVersion: 2, idempotencyKey: "U-2", receiptId: added.receiptId })
    expect(undone).toMatchObject({ ok: true, workspaceVersion: 3, undoAvailable: false })
    const workspace = await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")
    expect(workspace.todos.some((todo) => todo.title === "Undo me")).toBe(false)
    expect(workspace.version).toBe(3)
    const unknown = await findTool(tools, "undo").execute({ expectedVersion: 3, idempotencyKey: "U-3", receiptId: "ACTION-NEVER-EXISTED" })
    expect(unknown).toMatchObject({ ok: false, code: "COMMAND_INVALID" })
  })
})

describe("the transition buffer preference", () => {
  it("is settable through update_student_context and flags the real ten-minute CS gap", async () => {
    const repository = new MemoryWorkspaceRepository(buildFixture())
    const tools = buildTools(repository)
    const rejected = await findTool(tools, "update_student_context").execute({ expectedVersion: 1, idempotencyKey: "B-0", profile: { transitionBufferMinutes: 300 } })
    expect(rejected).toMatchObject({ ok: false, code: "COMMAND_INVALID" })
    const set = await findTool(tools, "update_student_context").execute({ expectedVersion: 1, idempotencyKey: "B-1", profile: { transitionBufferMinutes: 15 } })
    expect(set).toMatchObject({ ok: true })
    const workspace = await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")
    expect(workspace.profile.transitionBufferMinutes).toBe(15)

    const catalog = buildStanfordCatalog()
    const scenario = {
      id: "SCENARIO-TIGHT",
      name: "Tight",
      unitLimit: 20,
      courses: [
        { id: "PC-106B", courseId: "COURSE-CS-106B", sectionId: "SECTION-CS-106B-01", units: 5, status: "active" as const },
        { id: "PC-173A", courseId: "COURSE-CS-173A", sectionId: "SECTION-CS-173A-01", units: 4, status: "active" as const }
      ],
      commitments: []
    }
    const checks = checkPlan({ scenario, catalog, profile: workspace.profile, evidence: workspace.evidence, now: new Date("2026-08-29T12:00:00Z") })
    const tight = checks.find((check) => check.code === "TRANSITION_BUFFER")
    expect(tight).toBeDefined()
    expect(tight?.message).toContain("10 minutes")
  })
})

describe("undo frontier honesty", () => {
  it("names each refusal precisely and walks back only step by step", async () => {
    const repository = new MemoryWorkspaceRepository(buildFixture())
    const tools = buildTools(repository)
    const manageTodo = findTool(tools, "manage_todo")
    const undoTool = findTool(tools, "undo")
    const a = await manageTodo.execute({ expectedVersion: 1, idempotencyKey: "F-A", action: "add", todo: { title: "First" } })
    const b = await manageTodo.execute({ expectedVersion: 2, idempotencyKey: "F-B", action: "add", todo: { title: "Second" } })
    const older = await undoTool.execute({ expectedVersion: 3, idempotencyKey: "F-OLD", receiptId: a.receiptId })
    expect(older).toMatchObject({ ok: false, code: "COMMAND_INVALID" })
    expect(String(older.message)).toMatch(/most recent action/)
    const undoB = await undoTool.execute({ expectedVersion: 3, idempotencyKey: "F-UB", receiptId: b.receiptId })
    expect(undoB).toMatchObject({ ok: true, workspaceVersion: 4 })
    const again = await undoTool.execute({ expectedVersion: 4, idempotencyKey: "F-AGAIN", receiptId: b.receiptId })
    expect(String(again.message)).toMatch(/already undone/)
    const undoTheUndo = await undoTool.execute({ expectedVersion: 4, idempotencyKey: "F-UU", receiptId: undoB.receiptId })
    expect(String(undoTheUndo.message)).toMatch(/cannot itself be undone/)
    const undoA = await undoTool.execute({ expectedVersion: 4, idempotencyKey: "F-UA", receiptId: a.receiptId })
    expect(undoA).toMatchObject({ ok: true, workspaceVersion: 5 })
    const workspace = await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")
    expect(workspace.todos.some((todo) => ["First", "Second"].includes(todo.title))).toBe(false)
    expect(workspace.version).toBe(5)
  })

  it("preserves later work by refusing the destructive path outright", async () => {
    const repository = new MemoryWorkspaceRepository(buildFixture())
    const tools = buildTools(repository)
    const a = await findTool(tools, "manage_todo").execute({ expectedVersion: 1, idempotencyKey: "K-A", action: "add", todo: { title: "Keep A" } })
    await findTool(tools, "manage_event").execute({ expectedVersion: 2, idempotencyKey: "K-B", action: "add", event: { title: "Keep B", date: "2026-10-06" } })
    const blocked = await findTool(tools, "undo").execute({ expectedVersion: 3, idempotencyKey: "K-UNDO", receiptId: a.receiptId })
    expect(blocked.ok).toBe(false)
    const workspace = await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")
    expect(workspace.todos.some((todo) => todo.title === "Keep A")).toBe(true)
    expect(workspace.events.some((event) => event.title === "Keep B")).toBe(true)
    expect(workspace.version).toBe(3)
  })
})

describe("system evidence refresh", () => {
  it("rewrites stored system records to the shipped wording and leaves others alone", async () => {
    const { refreshSystemEvidence } = await import("@/domain/evidence")
    const { workspace } = buildFixture()
    const target = workspace.evidence.find((item) => item.addedBy === "system")!
    target.sourceTitle = "Stanford ExploreCourses"
    target.sourceUrl = "https://explorecourses.stanford.edu/"
    workspace.evidence.push({ ...target, id: "EVIDENCE-STUDENT-OWN", addedBy: "human", sourceTitle: "Stanford ExploreCourses" })
    const { buildStanfordEvidence } = await import("@/data/institutions/stanford")
    refreshSystemEvidence(workspace, buildStanfordEvidence())
    const refreshed = workspace.evidence.find((item) => item.id === target.id)!
    expect(refreshed.sourceTitle).toBe("Stanford Navigator")
    expect(refreshed.sourceUrl).toContain("navigator.stanford.edu")
    expect(workspace.evidence.find((item) => item.id === "EVIDENCE-STUDENT-OWN")!.sourceTitle).toBe("Stanford ExploreCourses")
  })
})

describe("agent-readable schedule detail", () => {
  it("exports class meetings for the current term and search results carry meeting strings", async () => {
    const { workspace } = buildFixture()
    const catalog = buildStanfordCatalog()
    const { exportBlocks } = await import("@/webmcp/export")
    const exported = exportBlocks(workspace, catalog, [], "calendar", new Date("2026-10-01T12:00:00Z")).join("\n")
    expect(exported).toContain("## Class meetings this term")
    expect(exported).toMatch(/CS 106B: mon\/wed\/fri 12:30 to 13:20/)
    const repository = new MemoryWorkspaceRepository({ workspace: buildFixture().workspace, catalog })
    const tools = buildTools(repository)
    const found = await findTool(tools, "search_courses").execute({ query: "CS 106B" }) as { results: Array<{ code: string, sections: Array<{ id: string, meets: string }> }> }
    const cs106b = found.results.find((row) => row.code === "CS 106B")!
    expect(cs106b.sections[0].id).toBe("SECTION-CS-106B-01")
    expect(cs106b.sections[0].meets).toContain("mon/wed/fri 12:30 to 13:20")
  })
})

describe("the ics export", () => {
  it("renders timed and all-day entries with real timezone ids and escaping", () => {
    const ics = buildIcs([
      { id: "EVENT-1", date: "2026-10-05", start: "15:00", end: "15:45", title: "CURIS interview; bring questions", detail: "Zoom link, arrives by email", kind: "event", timezone: "America/New_York" },
      { id: "ACADEMIC-1", date: "2026-09-22", title: "Autumn quarter begins", kind: "academic" }
    ], "Acorn October 2026")
    expect(ics).toContain("BEGIN:VCALENDAR")
    expect(ics).toContain("X-WR-CALNAME:Acorn October 2026")
    expect(ics).toContain("DTSTART;TZID=America/New_York:20261005T150000")
    expect(ics).toContain("DTEND;TZID=America/New_York:20261005T154500")
    expect(ics).toContain("SUMMARY:CURIS interview\\; bring questions")
    expect(ics).toContain("DESCRIPTION:Zoom link\\, arrives by email")
    expect(ics).toContain("DTSTART;VALUE=DATE:20260922")
    expect(ics).toContain("UID:EVENT-1@acorn")
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true)
    for (const line of ics.split("\r\n")) expect(line.length).toBeLessThanOrEqual(75)
  })

  it("folds long lines onto continuation lines per the iCalendar spec", () => {
    const longDetail = "This description is deliberately long enough to require folding across multiple physical lines so that every calendar client reassembles it correctly when importing the file."
    const ics = buildIcs([{ id: "EVENT-LONG", date: "2026-10-05", title: "Long", detail: longDetail, kind: "event" }])
    const lines = ics.split("\r\n")
    expect(lines.some((line) => line.startsWith(" "))).toBe(true)
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(75)
    expect(ics.replace(/\r\n /g, "")).toContain("reassembles it correctly")
  })
})
