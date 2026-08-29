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
})
