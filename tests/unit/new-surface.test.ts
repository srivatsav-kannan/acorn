import { describe, expect, it } from "vitest"
import { buildFixture } from "@/data/fixture"
import { buildStanfordCatalog } from "@/data/institutions/stanford"
import { buildIcs } from "@/domain/ics"
import { checkPlan } from "@/domain/planner"
import { searchWorkspace } from "@/domain/search"
import { exportBlocks } from "@/webmcp/export"
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

describe("save_workspace_item as a real intake surface", () => {
  it("rejects unknown fields loudly instead of burying their content", async () => {
    const repository = new MemoryWorkspaceRepository(buildFixture())
    const tools = buildTools(repository)
    const result = await findTool(tools, "save_workspace_item").execute({ expectedVersion: 1, idempotencyKey: "SW-1", item: { id: "GOAL-X", type: "goal", title: "Goal", body: "Long body that would vanish" } })
    expect(result).toMatchObject({ ok: false, code: "COMMAND_INVALID" })
    expect(String(result.message)).toContain("body")
    expect(String(result.message)).toContain("text")
  })

  it("derives a summary from text and updates in place on ID reuse", async () => {
    const repository = new MemoryWorkspaceRepository(buildFixture())
    const tools = buildTools(repository)
    const save = findTool(tools, "save_workspace_item")
    const created = await save.execute({ expectedVersion: 1, idempotencyKey: "SW-2", item: { id: "GOAL-CURIS", type: "goal", title: "Be ready for CURIS", text: "Steps: shortlist health-AI labs, talk to one professor, verify the timeline." } })
    expect(created).toMatchObject({ ok: true, workspaceVersion: 2 })
    let workspace = await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")
    const stored = workspace.contextItems.find((item) => item.id === "GOAL-CURIS")!
    expect(stored.summary).toContain("shortlist health-AI labs")
    expect((stored.content as { text?: string }).text).toContain("verify the timeline")
    const updated = await save.execute({ expectedVersion: 2, idempotencyKey: "SW-3", item: { id: "GOAL-CURIS", type: "goal", title: "Be ready for CURIS by winter", text: "Steps: shortlist labs by December, coffee chat in January." } })
    expect(updated).toMatchObject({ ok: true, workspaceVersion: 3 })
    workspace = await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")
    expect(workspace.contextItems.filter((item) => item.id === "GOAL-CURIS")).toHaveLength(1)
    expect(workspace.contextItems.find((item) => item.id === "GOAL-CURIS")!.title).toBe("Be ready for CURIS by winter")
    const explicit = await save.execute({ expectedVersion: 3, idempotencyKey: "SW-2B", item: { id: "NOTE-EXPLICIT", type: "note", title: "Explicit content", summary: "Set directly", content: { text: "raw", sourceUrl: "https://navigator.stanford.edu/classes" }, tags: ["Health", "health"], collectionId: "COLLECTION-INBOX" } })
    expect(explicit).toMatchObject({ ok: true })
    workspace = await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")
    const explicitStored = workspace.contextItems.find((item) => item.id === "NOTE-EXPLICIT")!
    expect((explicitStored.content as { sourceUrl?: string }).sourceUrl).toContain("navigator")
    expect(explicitStored.tags).toEqual(["health"])
    const archived = await save.execute({ expectedVersion: 4, idempotencyKey: "SW-5", item: { id: "NOTE-EXPLICIT", type: "note", title: "Explicit content", archived: true } })
    expect(archived).toMatchObject({ ok: true })
    workspace = await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")
    expect(workspace.contextItems.find((item) => item.id === "NOTE-EXPLICIT")!.archived).toBe(true)
    const restored = await save.execute({ expectedVersion: 5, idempotencyKey: "SW-6", item: { id: "NOTE-EXPLICIT", type: "note", title: "Explicit content", archived: false } })
    expect(restored).toMatchObject({ ok: true })
    workspace = await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")
    expect(workspace.contextItems.find((item) => item.id === "NOTE-EXPLICIT")!.archived).toBe(false)
  })

  it("keeps standing goals visible in the goals export and findable in search", async () => {
    const repository = new MemoryWorkspaceRepository(buildFixture())
    const tools = buildTools(repository)
    await findTool(tools, "save_workspace_item").execute({ expectedVersion: 1, idempotencyKey: "SW-4", item: { id: "GOAL-CURIS", type: "goal", title: "Be ready for CURIS", text: "Shortlist health-AI labs and talk to one professor before winter." } })
    const workspace = await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")
    const goals = exportBlocks(workspace, buildFixture().catalog, [], "goals", new Date("2026-08-29T12:00:00Z")).join("\n")
    expect(goals).toContain("Standing goals:")
    expect(goals).toContain("Be ready for CURIS")
    const found = searchWorkspace(workspace, buildFixture().catalog, "CURIS health-AI labs professor")
    expect(found.groups.some((group) => group.type === "library" && group.items.some((item) => item.id === "GOAL-CURIS"))).toBe(true)
  })
})

describe("organization search gaps and source urls", () => {
  it("names the gap when a club query has no directory listing", () => {
    const { workspace, catalog } = buildFixture()
    const missing = searchWorkspace(workspace, catalog, "Tamil students association first meeting")
    expect(missing.sufficient).toBe(false)
    expect(missing.gaps.some((gap) => gap.includes("club or program listing"))).toBe(true)
  })

  it("keeps the gap through generic campus words and skips it for covered clubs", async () => {
    const { workspace, catalog } = buildFixture()
    const { institutionForWorkspace } = await import("@/data/institutions/registry")
    const opportunities = institutionForWorkspace(workspace).buildOpportunities()
    const padded = searchWorkspace(workspace, catalog, "Stanford Tamil students association first meeting", opportunities)
    expect(padded.gaps.some((gap) => gap.includes("club or program listing"))).toBe(true)
    const covered = searchWorkspace(workspace, catalog, "TreeHacks hackathon", opportunities)
    expect(covered.gaps.some((gap) => gap.includes("club or program listing"))).toBe(false)
  })

  it("ranks the exact-title match into the visible library results", () => {
    const { workspace, catalog } = buildFixture()
    for (let index = 0; index < 8; index++) {
      workspace.contextItems.push({ id: `NOTE-FILLER-${index}`, type: "note", title: `Research filler ${index}`, summary: "General research note about health and AI readiness.", content: { text: "research health readiness" }, tags: [], collectionId: "COLLECTION-INBOX", addedBy: { type: "human", id: "USER-DEMO" }, createdAt: "2026-08-29T00:00:00Z", updatedAt: "2026-08-29T00:00:00Z" })
    }
    workspace.contextItems.push({ id: "GOAL-CURIS-RANK", type: "goal", title: "Be ready for early health-AI research and CURIS", summary: undefined as unknown as string, content: { text: "steps" }, tags: [], collectionId: "COLLECTION-INBOX", addedBy: { type: "agent", id: "AGENT" }, createdAt: "2026-08-29T00:00:00Z", updatedAt: "2026-08-29T00:00:00Z" })
    const found = searchWorkspace(workspace, catalog, "Be ready for early health-AI research and CURIS")
    const library = found.groups.find((group) => group.type === "library")!
    expect(library.items[0].id).toBe("GOAL-CURIS-RANK")
    const bodyOnly = searchWorkspace(workspace, catalog, "general research note about health")
    const bodyLibrary = bodyOnly.groups.find((group) => group.type === "library")!
    expect(bodyLibrary.items.length).toBeGreaterThan(0)
  })

  it("exposes source urls through search results", () => {
    const { workspace, catalog } = buildFixture()
    const evidence = workspace.evidence.find((item) => item.sourceUrl)!
    const found = searchWorkspace(workspace, catalog, evidence.claim.split(" ").slice(0, 4).join(" "))
    const withUrl = found.groups.flatMap((group) => group.items as Array<{ url?: string }>).some((item) => typeof item.url === "string" && item.url.startsWith("http"))
    expect(withUrl).toBe(true)
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

describe("agent-facing counters and unit labels", () => {
  it("counts club interest in the tracker and reports plan units beside the degree projection", async () => {
    const repository = new MemoryWorkspaceRepository(buildFixture())
    const tools = buildTools(repository)
    const before = await findTool(tools, "get_planning_context").execute({})
    const marked = await findTool(tools, "set_interest").execute({ expectedVersion: 1, idempotencyKey: "CLUB-COUNT-1", kind: "club", id: "OPPORTUNITY-TREEHACKS", interested: true })
    expect(marked).toMatchObject({ ok: true })
    const after = await findTool(tools, "get_planning_context").execute({})
    expect(after.tracker.interested).toBe(before.tracker.interested + 1)

    const checked = await findTool(tools, "check_plan").execute({ planId: "PLAN-AUT26" })
    expect(checked.unitsToward).not.toBeNull()
    expect(checked.unitsToward.planUnits).toBeGreaterThan(0)
    expect(checked.unitsToward.projected).toBeGreaterThan(checked.unitsToward.planUnits)
    expect(checked.unitsToward.note).toContain("planUnits is this scenario alone")
  })
})

describe("save_workspace_item idempotent replay", () => {
  it("replays identically through create, update, archive, and restore without conflicts or duplicates", async () => {
    const repository = new MemoryWorkspaceRepository(buildFixture())
    const tools = buildTools(repository)
    const save = findTool(tools, "save_workspace_item")
    const input = { expectedVersion: 1, idempotencyKey: "SAVE-REPLAY-1", item: { id: "NOTE-REPLAY-CHECK", type: "note", title: "Replay check", text: "Same payload twice." } }
    const first = await save.execute(structuredClone(input))
    expect(first).toMatchObject({ ok: true, workspaceVersion: 2 })
    const replay = await save.execute(structuredClone(input))
    expect(replay).toMatchObject({ ok: true, receiptId: first.receiptId, workspaceVersion: 2 })
    const conflict = await save.execute({ ...structuredClone(input), item: { ...input.item, title: "Different title" } })
    expect(conflict).toMatchObject({ ok: false, code: "IDEMPOTENCY_CONFLICT" })
    const update = await save.execute({ expectedVersion: 2, idempotencyKey: "SAVE-REPLAY-2", item: { id: "NOTE-REPLAY-CHECK", type: "note", title: "Replay check updated", text: "Edited." } })
    expect(update).toMatchObject({ ok: true, workspaceVersion: 3 })
    const workspace = await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")
    expect(workspace.contextItems.filter((item) => item.id === "NOTE-REPLAY-CHECK")).toHaveLength(1)
    expect(workspace.contextItems.find((item) => item.id === "NOTE-REPLAY-CHECK")?.title).toBe("Replay check updated")
    const archive = await save.execute({ expectedVersion: 3, idempotencyKey: "SAVE-REPLAY-3", item: { id: "NOTE-REPLAY-CHECK", type: "note", title: "Replay check updated", archived: true } })
    expect(archive).toMatchObject({ ok: true, workspaceVersion: 4 })
    const restoreInput = { expectedVersion: 4, idempotencyKey: "SAVE-REPLAY-4", item: { id: "NOTE-REPLAY-CHECK", type: "note", title: "Replay check updated", archived: false } }
    const restored = await save.execute(structuredClone(restoreInput))
    expect(restored).toMatchObject({ ok: true, workspaceVersion: 5 })
    const restoredReplay = await save.execute(structuredClone(restoreInput))
    expect(restoredReplay).toMatchObject({ ok: true, receiptId: restored.receiptId, workspaceVersion: 5 })
  })
})

describe("discussion components on read surfaces", () => {
  it("labels non-lecture meetings in search_courses meets strings", async () => {
    const repository = new MemoryWorkspaceRepository(buildFixture())
    const tools = buildTools(repository)
    const found = await findTool(tools, "search_courses").execute({ query: "COMM 1" })
    const comm = found.results.find((row: { id: string }) => row.id === "COURSE-COMM-1")
    const withDiscussion = comm?.sections.find((section: { id: string }) => section.id === "SECTION-COMM-1-02")
    expect(withDiscussion?.meets).toContain("discussion fri 10:45 to 11:35")
    expect(withDiscussion?.meets).toContain("tue/thu 13:30 to 14:50")
  })
})
