import { describe, expect, it, vi } from "vitest"
import { buildFixture } from "@/data/fixture"
import { createCourseContextTools } from "@/webmcp/tools"
import { registerWebMcpTools } from "@/webmcp/register"
import { MemoryWorkspaceRepository } from "@/store/memory-repository"

const expectedNames = [
  "search_workspace",
  "get_planning_context",
  "search_courses",
  "get_plan",
  "check_plan",
  "suggest_sections",
  "get_program_progress",
  "save_research",
  "save_workspace_item",
  "update_student_context",
  "edit_plan",
  "extend_reference",
  "configure_view",
  "export_context",
  "ingest_context",
  "manage_todo",
  "set_interest",
  "annotate_course",
  "manage_event",
  "manage_activity",
  "undo",
  "manage_goal"
]

const setup = () => {
  const repository = new MemoryWorkspaceRepository(buildFixture())
  const tools = createCourseContextTools({
    repository,
    session: { userId: "USER-DEMO", workspaceId: "WORKSPACE-DEMO", actor: { type: "agent", id: "AGENT-TEST" } },
    now: () => new Date("2026-08-27T12:00:00Z")
  })
  return { repository, tools }
}

describe("WebMCP manifest", () => {
  it("exposes exactly the approved semantic tools", () => {
    const { tools } = setup()
    expect(tools.map((tool) => tool.name)).toEqual(expectedNames)
    expect(tools.every((tool) => !tool.name.includes("click") && !tool.name.includes("element"))).toBe(true)
  })

  it("uses stable short names, concise descriptions, and closed schemas", () => {
    const { tools } = setup()
    for (const tool of tools) {
      expect(tool.name.length).toBeLessThanOrEqual(30)
      expect(tool.description.length).toBeLessThanOrEqual(500)
      expect(tool.inputSchema).toMatchObject({ type: "object", additionalProperties: false })
      for (const property of Object.values(tool.inputSchema.properties ?? {})) {
        if (property && typeof property === "object" && "description" in property) {
          expect(String(property.description).length).toBeLessThanOrEqual(150)
        }
      }
    }
  })

  it("annotates reads, writes, and untrusted research accurately", () => {
    const { tools } = setup()
    const readNames = [...expectedNames.slice(0, 7), "export_context"]
    expect(tools.filter((tool) => tool.annotations.readOnlyHint).map((tool) => tool.name)).toEqual(readNames)
    expect(tools.find((tool) => tool.name === "save_research")?.annotations.untrustedContentHint).toBe(true)
    expect(tools.find((tool) => tool.name === "ingest_context")?.annotations.untrustedContentHint).toBe(true)
    expect(tools.find((tool) => tool.name === "edit_plan")?.annotations.readOnlyHint).toBe(false)
  })

  it("keeps default tool results inside the output budget", async () => {
    const { tools } = setup()
    for (const tool of tools.slice(0, 6)) {
      const result = await tool.execute(tool.examples[0] ?? {})
      expect(JSON.stringify(result).length).toBeLessThanOrEqual(1500)
    }
  })

  it("pages the full-context export near its budget until the workspace is exhausted", async () => {
    const { tools } = setup()
    const tool = tools.find((candidate) => candidate.name === "export_context")!
    let cursor: number | undefined = 0
    let pages = 0
    const seen: string[] = []
    while (cursor !== undefined && pages < 30) {
      const result = await tool.execute({ section: "all", cursor }) as { markdown: string, nextCursor?: number }
      expect(result.markdown.length).toBeLessThanOrEqual(5200)
      seen.push(result.markdown)
      cursor = result.nextCursor
      pages += 1
    }
    expect(cursor).toBeUndefined()
    const full = seen.join("\n\n")
    expect(full).toContain("## Todos")
    expect(full).toContain("## Plans")
    expect(full).toContain("## Clubs and programs")
    expect(full).toContain("`PLAN-")
  })

  it("ingests freeform markdown into visible scratchpad notes", async () => {
    const { repository, tools } = setup()
    const tool = tools.find((candidate) => candidate.name === "ingest_context")!
    const result = await tool.execute({ expectedVersion: 1, idempotencyKey: "INGEST-1", tag: "imported", text: "# Transfer thoughts\nI took multivariable calc at a community college.\n\nHeard CS 106B midterms are brutal in winter.\n\nPossible lab: Prof. Rivera's health AI group." })
    expect(result).toMatchObject({ ok: true, visibleChange: true })
    const workspace = await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")
    const imported = workspace.contextItems.filter((item) => item.tags?.includes("imported"))
    expect(imported).toHaveLength(3)
    expect(imported[0].title).toBe("Transfer thoughts")
  })

  it("runs the tracker loop: todo, interest, note, activity, all visible and undoable", async () => {
    const { repository, tools } = setup()
    const call = (name: string) => tools.find((candidate) => candidate.name === name)!
    let version = 1
    const todo = await call("manage_todo").execute({ expectedVersion: version, idempotencyKey: "TODO-1", action: "add", todo: { title: "Ask about CURIS", due: "2027-02-01" } })
    expect(todo).toMatchObject({ ok: true })
    version += 1
    const interest = await call("set_interest").execute({ expectedVersion: version, idempotencyKey: "INT-1", kind: "course", id: "COURSE-CS-106B", interested: true })
    expect(interest).toMatchObject({ ok: true, primaryVisibleId: "COURSE-CS-106B" })
    version += 1
    const note = await call("annotate_course").execute({ expectedVersion: version, idempotencyKey: "NOTE-1", courseId: "COURSE-CS-106B", text: "Rumored heavy workload in winter." })
    expect(note).toMatchObject({ ok: true })
    version += 1
    const activity = await call("manage_activity").execute({ expectedVersion: version, idempotencyKey: "ACT-1", activity: { name: "Rivera lab", kind: "research", schedule: { days: ["tue", "thu"], start: "15:00", end: "17:00" }, dates: [{ date: "2026-10-01", label: "First lab meeting" }] } })
    expect(activity).toMatchObject({ ok: true })
    const workspace = await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")
    expect(workspace.todos.some((item) => item.title === "Ask about CURIS" && item.source === "agent")).toBe(true)
    expect(workspace.interestedCourseIds).toContain("COURSE-CS-106B")
    expect(workspace.courseNotes["COURSE-CS-106B"][0]).toMatchObject({ author: "agent" })
    expect(workspace.activities[0]).toMatchObject({ name: "Rivera lab", addedBy: "agent" })
  })

  it("returns the current plan and scenario IDs before an agent edits", async () => {
    const { tools } = setup()
    const result = await tools.find((tool) => tool.name === "get_planning_context")!.execute({})
    expect(result).toMatchObject({ currentPlanId: "PLAN-AUT26", activeScenarioId: "SCENARIO-PRIMARY" })
    expect(result.workflow).toContain("Discover plan and scenario IDs before editing")
  })

  it("returns stable IDs, versions, evidence, and visible-change receipts", async () => {
    const { tools } = setup()
    const result = await tools.find((tool) => tool.name === "save_workspace_item")!.execute({
      expectedVersion: 1,
      idempotencyKey: "TOOL-001",
      item: {
        id: "NOTE-FROM-TOOL",
        type: "note",
        title: "A tool note",
        summary: "Saved through the same domain command",
        text: "Visible in Library",
        collectionId: "COLLECTION-INBOX"
      }
    })
    expect(result).toMatchObject({
      ok: true,
      workspaceVersion: 2,
      visibleChange: true,
      changed: [{ id: "NOTE-FROM-TOOL" }]
    })
  })

  it("returns structured recovery for a stale mutation", async () => {
    const { tools } = setup()
    const tool = tools.find((candidate) => candidate.name === "update_student_context")!
    await tool.execute({
      expectedVersion: 1,
      idempotencyKey: "CONTEXT-1",
      preferences: [{ id: "PREFERENCE-ONE", label: "First", strength: "soft", value: true }]
    })
    const stale = await tool.execute({
      expectedVersion: 1,
      idempotencyKey: "CONTEXT-2",
      preferences: [{ id: "PREFERENCE-TWO", label: "Second", strength: "soft", value: true }]
    })
    expect(stale).toMatchObject({ ok: false, code: "VERSION_CONFLICT", retryable: true })
  })

  it("routes research, plan edits, and view configuration through shared commands", async () => {
    const { tools } = setup()
    const research = await tools.find((tool) => tool.name === "save_research")!.execute({
      expectedVersion: 1,
      idempotencyKey: "RESEARCH-MATRIX",
      evidence: { id: "EVIDENCE-TOOL-MATRIX", title: "Tool research source", classification: "official", claim: "Tool research", sourceUrl: "https://example.edu/source", sourceTitle: "Example source", retrievedAt: "2026-08-27T00:00:00Z", confidence: 1, status: "current", addedBy: "agent", untrustedExternalContent: true }
    })
    expect(research).toMatchObject({ ok: true, visibleChange: true, primaryVisibleId: "SOURCE-EVIDENCE-TOOL-MATRIX", changed: expect.arrayContaining([{ type: "context_item", id: "SOURCE-EVIDENCE-TOOL-MATRIX" }]) })
    const edit = await tools.find((tool) => tool.name === "edit_plan")!.execute({
      expectedVersion: 2,
      idempotencyKey: "EDIT-MATRIX",
      planId: "PLAN-AUT26",
      scenarioId: "SCENARIO-PRIMARY",
      operations: [{ type: "set_status", planCourseId: "PLANCOURSE-MATH-51", status: "backup" }]
    })
    expect(edit.ok).toBe(true)
    const view = await tools.find((tool) => tool.name === "configure_view")!.execute({
      expectedVersion: 3,
      idempotencyKey: "VIEW-MATRIX",
      view: { id: "VIEW-TOOL-MATRIX", title: "Tool view", layout: "one_column", blocks: [] }
    })
    expect(view.ok).toBe(true)
  })
})

describe("structured context and reference tools", () => {
  const referenceEvidence = { id: "EVIDENCE-CONTRACT-REF", title: "Reference source", classification: "official", claim: "Official reference.", sourceUrl: "https://example.edu/ref", sourceTitle: "Catalog", retrievedAt: "2026-08-28T00:00:00Z", confidence: 0.9, status: "current" }

  it("accepts academic history through update_student_context, one section per call", async () => {
    const { tools } = setup()
    const tool = tools.find((candidate) => candidate.name === "update_student_context")!
    const guarded = await tool.execute({ expectedVersion: 1, idempotencyKey: "HISTORY-0", academicHistory: { classYear: "Class of 2030" } })
    expect(guarded).toMatchObject({ ok: false, code: "COMMAND_INVALID" })
    expect(String((guarded as { message?: string }).message)).toMatch(/derived from the entry and graduation dates/)
    const history = await tool.execute({ expectedVersion: 1, idempotencyKey: "HISTORY-1", academicHistory: { apCredits: [{ exam: "AP Calculus BC", score: 5, satisfiesCourseIds: ["COURSE-MATH-21"] }] } })
    expect(history).toMatchObject({ ok: true })
    const both = await tool.execute({ expectedVersion: 2, idempotencyKey: "HISTORY-2", academicHistory: { classYear: "Junior" }, preferences: [{ id: "PREFERENCE-X", label: "X", strength: "soft", value: true }] })
    expect(both).toMatchObject({ ok: false, code: "ONE_SECTION_PER_CALL" })
    const neither = await tool.execute({ expectedVersion: 2, idempotencyKey: "HISTORY-3" })
    expect(neither).toMatchObject({ ok: false, code: "ONE_SECTION_PER_CALL" })
    const named = await tool.execute({ expectedVersion: 2, idempotencyKey: "HISTORY-4", profile: { preferredName: "Alex C.", goal: "Explore health and AI." } })
    expect(named).toMatchObject({ ok: true })
  })

  it("derives standing from the timeline and still takes the planning window through the profile section", async () => {
    const { repository, tools } = setup()
    const tool = tools.find((candidate) => candidate.name === "update_student_context")!
    const standing = await tool.execute({ expectedVersion: 1, idempotencyKey: "WINDOW-0", profile: { classStanding: "Coterm" } })
    expect(standing).toMatchObject({ ok: false, code: "COMMAND_INVALID" })
    const result = await tool.execute({ expectedVersion: 1, idempotencyKey: "WINDOW-1", profile: { earliestStart: "10:00", latestEnd: "17:30", excludedDays: ["fri", "sun"] } })
    expect(result).toMatchObject({ ok: true })
    const workspace = await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")
    expect(workspace.profile).toMatchObject({ earliestStart: "10:00", latestEnd: "17:30", excludedDays: ["fri", "sun"] })
  })

  it("adds a program through extend_reference and rejects ambiguous payloads", async () => {
    const { tools } = setup()
    const tool = tools.find((candidate) => candidate.name === "extend_reference")!
    const program = { name: "Data Science Minor", credential: "Minor", sourceUrl: "https://example.edu/ds-minor", requirements: [{ title: "Core", rule: { type: "course_group", count: 2, courseIds: ["COURSE-STATS-60", "COURSE-DATASCI-112", "COURSE-CS-109"] } }] }
    const added = await tool.execute({ expectedVersion: 1, idempotencyKey: "REF-PROGRAM-1", program, evidence: referenceEvidence })
    expect(added).toMatchObject({ ok: true, primaryVisibleId: "PROGRAM-DATA-SCIENCE-MINOR", visibleChange: true })
    const ambiguous = await tool.execute({ expectedVersion: 2, idempotencyKey: "REF-PROGRAM-2", program, course: { code: "CS 1", title: "X" }, evidence: referenceEvidence })
    expect(ambiguous).toMatchObject({ ok: false, code: "COMMAND_INVALID" })
    const empty = await tool.execute({ expectedVersion: 2, idempotencyKey: "REF-PROGRAM-3", evidence: referenceEvidence })
    expect(empty).toMatchObject({ ok: false, code: "COMMAND_INVALID" })
  })

  it("adds and amends opportunity listings through extend_reference", async () => {
    const { tools } = setup()
    const tool = tools.find((candidate) => candidate.name === "extend_reference")!
    const added = await tool.execute({ expectedVersion: 1, idempotencyKey: "OPP-TOOL-1", opportunity: { kind: "research", name: "Systems Reading Group", summary: "Weekly systems papers with graduate mentors." }, evidence: { ...referenceEvidence, id: "EVIDENCE-OPP-TOOL" } })
    expect(added).toMatchObject({ ok: true, primaryVisibleId: "OPPORTUNITY-SYSTEMS-READING-GROUP", visibleChange: true })
    const search = await tools.find((candidate) => candidate.name === "search_workspace")!.execute({ query: "systems reading group" }) as { groups: Array<{ type: string, items: Array<{ id: string }> }> }
    expect(search.groups.find((group) => group.type === "opportunities")?.items.some((item) => item.id === "OPPORTUNITY-SYSTEMS-READING-GROUP")).toBe(true)
  })

  it("plans future terms and records the degree timeline through the same tools", async () => {
    const { tools } = setup()
    const editPlan = tools.find((candidate) => candidate.name === "edit_plan")!
    const created = await editPlan.execute({ expectedVersion: 1, idempotencyKey: "TERM-TOOL-1", termId: "TERM-2027-WINTER", operations: [{ type: "add_course", planCourse: { id: "PLANCOURSE-TOOL-W", courseId: "COURSE-CS-107", sectionId: null, units: 5, status: "active" } }] })
    expect(created.ok).toBe(true)
    const getPlan = tools.find((candidate) => candidate.name === "get_plan")!
    const byTerm = await getPlan.execute({ termId: "TERM-2027-WINTER" }) as { plan: { id: string } | null }
    expect(byTerm.plan?.id).toBe("PLAN-2027-WINTER")
    const missing = await getPlan.execute({ termId: "TERM-2028-SPRING" }) as { plan: unknown }
    expect(missing.plan).toBeNull()
    const checks = await tools.find((candidate) => candidate.name === "check_plan")!.execute({ planId: "PLAN-2027-WINTER" }) as { timelineIssues: unknown[], unitsToward: { projected: number } }
    expect(checks.unitsToward.projected).toBeGreaterThan(0)
    const timeline = await tools.find((candidate) => candidate.name === "update_student_context")!.execute({ expectedVersion: 2, idempotencyKey: "TL-TOOL-1", academicHistory: { timeline: { entryTermId: "TERM-2026-AUTUMN", degree: "BS-MS" } } })
    expect(timeline.ok).toBe(true)
    const context = await tools.find((candidate) => candidate.name === "get_planning_context")!.execute({}) as { timeline: { graduation: string, degree: string } }
    expect(context.timeline).toMatchObject({ degree: "BS-MS", graduation: "TERM-2031-SPRING" })
  })

  it("reports institution status, history, and the custom-school path in planning context", async () => {
    const { tools } = setup()
    const context = await tools.find((candidate) => candidate.name === "get_planning_context")!.execute({}) as { institution: string, referenceNote: string, history: { completedCourses: number } }
    expect(context.institution).toBe("Stanford University")
    expect(context.referenceNote).toContain("extend_reference")
    expect(context.history.completedCourses).toBe(1)
  })
})

describe("WebMCP registration", () => {
  it("registers every tool when the imperative API exists", () => {
    const { tools } = setup()
    const registerTool = vi.fn()
    const unregister = registerWebMcpTools({ modelContext: { registerTool } }, tools)
    expect(registerTool).toHaveBeenCalledTimes(expectedNames.length)
    unregister()
  })

  it("does nothing safely when WebMCP is unavailable", () => {
    const { tools } = setup()
    expect(() => registerWebMcpTools({}, tools)()).not.toThrow()
  })

  it("unregisters tools returned by the browser", () => {
    const { tools } = setup()
    const remove = vi.fn()
    const registerTool = vi.fn(() => ({ unregister: remove }))
    const unregister = registerWebMcpTools({ modelContext: { registerTool } }, tools)
    unregister()
    expect(remove).toHaveBeenCalledTimes(expectedNames.length)
  })

  it("uses an abort signal for current WebMCP lifecycle cleanup", () => {
    const { tools } = setup()
    const signals: AbortSignal[] = []
    const registerTool = vi.fn((_tool: unknown, options?: { signal?: AbortSignal }) => {
      if (options?.signal) signals.push(options.signal)
    })
    const unregister = registerWebMcpTools({ modelContext: { registerTool } }, tools)
    expect(signals).toHaveLength(expectedNames.length)
    expect(signals.every((signal) => !signal.aborted)).toBe(true)
    unregister()
    expect(signals.every((signal) => signal.aborted)).toBe(true)
  })

  it("cleans up asynchronous registrations returned by compatible implementations", async () => {
    const { tools } = setup()
    const remove = vi.fn()
    const registerTool = vi.fn(async () => ({ unregister: remove }))
    const unregister = registerWebMcpTools({ modelContext: { registerTool } }, tools)
    await Promise.resolve()
    unregister()
    expect(remove).toHaveBeenCalledTimes(expectedNames.length)
  })

  it("reports asynchronous registration failures without an unhandled rejection", async () => {
    const { tools } = setup()
    const report = vi.spyOn(console, "error").mockImplementation(() => undefined)
    const registerTool = vi.fn(() => Promise.reject(new Error("Unsupported registration")))
    registerWebMcpTools({ modelContext: { registerTool } }, tools)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(report).toHaveBeenCalledTimes(expectedNames.length)
    report.mockRestore()
  })
})

describe("tracker tool edges", () => {
  it("guards ingest, activity, interest, and export edge inputs", async () => {
    const { tools } = setup()
    const call = (name: string) => tools.find((candidate) => candidate.name === name)!
    expect(await call("ingest_context").execute({ expectedVersion: 1, idempotencyKey: "IN-0", text: "   " })).toMatchObject({ ok: false, code: "COMMAND_INVALID" })
    const many = Array.from({ length: 22 }, (_, index) => `Note ${index + 1}`).join("\n\n")
    const overflow = await call("ingest_context").execute({ expectedVersion: 1, idempotencyKey: "IN-1", text: many }) as { ok: boolean, note?: string }
    expect(overflow.ok).toBe(true)
    expect(overflow.note).toContain("Filed 20 of 22")
    expect(await call("manage_activity").execute({ expectedVersion: 2, idempotencyKey: "MA-0" })).toMatchObject({ ok: false, code: "COMMAND_INVALID" })
    const madeActivity = await call("manage_activity").execute({ expectedVersion: 2, idempotencyKey: "MA-1", activity: { name: "Shift", kind: "job" } }) as { ok: boolean, primaryVisibleId?: string }
    expect(madeActivity.ok).toBe(true)
    expect(await call("manage_activity").execute({ expectedVersion: 3, idempotencyKey: "MA-2", removeActivityId: madeActivity.primaryVisibleId })).toMatchObject({ ok: true })
    expect(await call("set_interest").execute({ expectedVersion: 4, idempotencyKey: "SI-1", kind: "club", id: "OPPORTUNITY-TREEHACKS", interested: true })).toMatchObject({ ok: true, primaryVisibleId: "OPPORTUNITY-TREEHACKS" })
    const note = await call("annotate_course").execute({ expectedVersion: 5, idempotencyKey: "AN-1", courseId: "COURSE-CS-106B", text: "Check pacing." }) as { ok: boolean, primaryVisibleId?: string }
    expect(note.ok).toBe(true)
    expect(await call("annotate_course").execute({ expectedVersion: 6, idempotencyKey: "AN-2", courseId: "COURSE-CS-106B", removeNoteId: note.primaryVisibleId })).toMatchObject({ ok: true })
    const tail = await call("export_context").execute({ section: "todos", cursor: 9999 }) as { markdown: string, nextCursor?: number }
    expect(tail.nextCursor).toBeUndefined()
    const clubWithBadDates = await call("extend_reference").execute({ expectedVersion: 7, idempotencyKey: "OP-1", opportunity: { name: "Bad Dates Club", kind: "club", summary: "Testing.", dates: [{ date: "soon", label: "Apply" }] }, evidence: { id: "EVIDENCE-BAD-DATES", title: "T", claim: "C", sourceUrl: "https://example.edu", sourceTitle: "S", retrievedAt: "2026-08-28T00:00:00Z", classification: "student", confidence: 0.5, status: "current" } })
    expect(clubWithBadDates).toMatchObject({ ok: false, code: "COMMAND_INVALID" })
  })
})
