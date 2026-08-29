import { describe, expect, it } from "vitest"
import { buildFixture } from "@/data/fixture"
import { createCourseContextTools } from "@/webmcp/tools"
import { MemoryWorkspaceRepository } from "@/store/memory-repository"

// One sequential pass that touches every tool and every action at least once,
// happy path and documented failure alike, so no corner of the surface ships
// untested. Each mutation chains the version the previous one produced.

const session = { userId: "USER-DEMO", workspaceId: "WORKSPACE-DEMO", actor: { type: "agent" as const, id: "AGENT-MATRIX" } }

describe("the exhaustive tool matrix", () => {
  it("walks every tool and action across one workspace", async () => {
    const repository = new MemoryWorkspaceRepository(buildFixture())
    const tools = createCourseContextTools({ repository, session, now: () => new Date("2026-08-29T12:00:00Z") })
    const tool = (name: string) => tools.find((candidate) => candidate.name === name)!
    let version = 1
    let key = 0
    const call = async (name: string, input: Record<string, unknown> = {}, mutation = true) => {
      key += 1
      const result = await tool(name).execute(mutation ? { expectedVersion: version, idempotencyKey: `MX-${key}`, ...input } : input)
      if (mutation && result?.ok) version = result.workspaceVersion
      return result
    }

    // Reads first: every read tool answers on the untouched workspace.
    expect((await call("get_planning_context", {}, false)).version).toBe(1)
    expect((await call("search_workspace", { query: "research" }, false)).groups.length).toBeGreaterThan(0)
    const courseSearch = await call("search_courses", { query: "CS 106B" }, false)
    expect(courseSearch.results[0].sections[0].meets).toContain("12:30")
    const filtered = await call("search_courses", { query: "CS", termId: "TERM-2026-AUTUMN", minUnits: 4, maxUnits: 5, excludedDays: ["sat"], levels: [100], subjects: ["CS"] }, false)
    expect(filtered.results.length).toBeGreaterThan(0)
    const planRead = await call("get_plan", { planId: "PLAN-AUT26" }, false)
    expect(planRead.plan.activeScenarioId).toBe("SCENARIO-PRIMARY")
    expect((await call("get_plan", { termId: "TERM-2026-AUTUMN" }, false)).plan.id).toBe("PLAN-AUT26")
    expect((await call("get_plan", { planId: "PLAN-NOPE" }, false)).plan).toBeNull()
    expect((await call("check_plan", { planId: "PLAN-AUT26" }, false)).checks).toBeDefined()
    expect((await call("check_plan", { planId: "PLAN-AUT26", scenarioId: "SCENARIO-LIGHTER" }, false)).checks).toBeDefined()
    const suggestions = await call("suggest_sections", { planId: "PLAN-AUT26" }, false)
    expect(suggestions.options.length).toBeGreaterThan(0)
    expect(suggestions.options[0].sections.length).toBe(3)
    expect(suggestions.options[0].warningCount).toBe(0)
    expect((await call("suggest_sections", { planId: "PLAN-AUT26", limit: 1 }, false)).options.length).toBe(1)
    const progress = await call("get_program_progress", { programId: "PROGRAM-CS-BS" }, false)
    expect(progress.program.requirements.length).toBeGreaterThan(0)
    expect((await call("get_program_progress", {}, false)).program).toBeTruthy()
    for (const section of ["all", "profile", "goals", "todos", "events", "scratchpad", "plans", "courses", "clubs", "activities", "calendar", "history", "nonsense"]) {
      const page = await call("export_context", { section }, false)
      expect(typeof page.markdown).toBe("string")
    }
    expect((await call("export_context", { section: "all", cursor: -5 }, false)).markdown.length).toBeGreaterThan(0)
    expect((await call("export_context", { section: "all", cursor: 999999 }, false)).markdown.length).toBeGreaterThanOrEqual(0)

    // Todos: add, toggle, remove, and every refusal.
    const todo = await call("manage_todo", { action: "add", todo: { title: "Matrix todo", detail: "d", due: "2026-10-01", dueTime: "09:00" } })
    expect(todo.ok).toBe(true)
    const todoId = todo.primaryVisibleId
    expect((await call("manage_todo", { action: "toggle", todoId })).ok).toBe(true)
    expect((await call("manage_todo", { action: "toggle", todoId })).ok).toBe(true)
    expect((await call("manage_todo", { action: "remove", todoId })).ok).toBe(true)
    expect((await call("manage_todo", { action: "toggle", todoId: "TODO-NOPE" })).ok).toBe(false)
    expect((await call("manage_todo", { action: "explode" })).ok).toBe(false)

    // Events: add, update, remove, plus the calendar-value refusals.
    const event = await call("manage_event", { action: "add", event: { title: "Matrix event", date: "2026-10-05", start: "10:00", end: "11:00", timezone: "America/New_York", description: "d" } })
    expect(event.ok).toBe(true)
    const eventId = event.primaryVisibleId
    expect((await call("manage_event", { action: "update", event: { id: eventId, title: "Matrix event moved", date: "2026-10-06" } })).ok).toBe(true)
    expect((await call("manage_event", { action: "update", event: { id: "EVENT-NOPE", title: "X", date: "2026-10-06" } })).ok).toBe(false)
    expect((await call("manage_event", { action: "remove", eventId })).ok).toBe(true)
    expect((await call("manage_event", { action: "remove", eventId })).ok).toBe(false)

    // Interests: course with intent, club, clearing both, bad ids.
    expect((await call("set_interest", { kind: "course", id: "COURSE-CS-148", interested: true, intendedTermId: "TERM-2027-SPRING" })).ok).toBe(true)
    expect((await call("set_interest", { kind: "club", id: "OPPORTUNITY-TREEHACKS", interested: true })).ok).toBe(true)
    expect((await call("set_interest", { kind: "club", id: "OPPORTUNITY-TREEHACKS", interested: false })).ok).toBe(true)
    expect((await call("set_interest", { kind: "course", id: "", interested: true })).ok).toBe(false)

    // Course notes: add, remove, remove-unknown.
    const note = await call("annotate_course", { courseId: "COURSE-CS-148", text: "Matrix note" })
    expect(note.ok).toBe(true)
    const noteId = note.primaryVisibleId
    expect((await call("annotate_course", { courseId: "COURSE-CS-148", removeNoteId: noteId })).ok).toBe(true)
    expect((await call("annotate_course", { courseId: "COURSE-CS-148", removeNoteId: "NOTE-NOPE" })).ok).toBe(false)

    // Activities: upsert, update in place, remove, remove-unknown.
    const activity = await call("manage_activity", { activity: { id: "ACT-MATRIX", name: "Matrix lab", kind: "research", schedule: { days: ["tue"], start: "15:00", end: "16:00" } } })
    expect(activity.ok).toBe(true)
    expect((await call("manage_activity", { activity: { id: "ACT-MATRIX", name: "Matrix lab renamed", kind: "research" } })).ok).toBe(true)
    expect((await call("manage_activity", { removeActivityId: "ACT-MATRIX" })).ok).toBe(true)
    expect((await call("manage_activity", { removeActivityId: "ACT-MATRIX" })).ok).toBe(false)
    expect((await call("manage_activity", {})).ok).toBe(false)

    // Research: save, update the same record, and its library card.
    const evidence = { id: "EVIDENCE-MATRIX", title: "Matrix source", classification: "official", claim: "A matrix claim.", sourceUrl: "https://navigator.stanford.edu/classes", sourceTitle: "Stanford Navigator", retrievedAt: "2026-08-29T00:00:00Z", confidence: 0.9, status: "current" }
    expect((await call("save_research", { evidence })).ok).toBe(true)
    expect((await call("save_research", { evidence: { ...evidence, status: "superseded" } })).ok).toBe(true)

    // Workspace items: create, update, archive, restore; unknown field refusal.
    expect((await call("save_workspace_item", { item: { id: "NOTE-MATRIX", type: "note", title: "Matrix note", text: "Body" } })).ok).toBe(true)
    expect((await call("save_workspace_item", { item: { id: "NOTE-MATRIX", type: "note", title: "Matrix note edited", text: "Body two" } })).ok).toBe(true)
    expect((await call("save_workspace_item", { item: { id: "NOTE-MATRIX", type: "note", title: "Matrix note edited", archived: true } })).ok).toBe(true)
    expect((await call("save_workspace_item", { item: { id: "NOTE-MATRIX", type: "note", title: "Matrix note edited", archived: false } })).ok).toBe(true)
    expect((await call("save_workspace_item", { item: { id: "NOTE-BAD", type: "note", title: "Bad", body: "nope" } })).ok).toBe(false)

    // Student context: one section per call across all four sections.
    expect((await call("update_student_context", { profile: { goal: "Matrix goal text." } })).ok).toBe(true)
    expect((await call("update_student_context", { preferences: [{ id: "PREF-MATRIX", label: "Matrix priority", strength: "soft", value: true }] })).ok).toBe(true)
    expect((await call("update_student_context", { academicHistory: { completedCourses: [{ courseId: "COURSE-MATH-19" }] } })).ok).toBe(true)
    expect((await call("update_student_context", { profile: { goal: "x" }, preferences: [{ id: "P", label: "L", strength: "soft", value: 1 }] })).ok).toBe(false)
    expect((await call("update_student_context", {})).ok).toBe(false)

    // Plans: every edit_plan operation in one scenario lifecycle.
    expect((await call("edit_plan", { planId: "PLAN-AUT26", operations: [{ type: "create_scenario", scenario: { id: "SCENARIO-MATRIX", name: "Matrix" } }] })).ok).toBe(true)
    expect((await call("edit_plan", { planId: "PLAN-AUT26", scenarioId: "SCENARIO-MATRIX", operations: [
      { type: "add_course", planCourse: { id: "PC-MATRIX-1", courseId: "COURSE-CS-148", sectionId: "SECTION-CS-148-01", units: 4, status: "active" } },
      { type: "add_commitment", commitment: { id: "COMMIT-MATRIX", title: "Matrix block", meetings: [{ days: ["mon"], start: "08:00", end: "09:00", timezone: "America/Los_Angeles", type: "commitment" }] } },
      { type: "set_unit_limit", unitLimit: 12 },
      { type: "rename_scenario", name: "Matrix renamed" },
      { type: "set_rationale", rationale: "A matrix-shaped quarter." }
    ] })).ok).toBe(true)
    expect((await call("edit_plan", { planId: "PLAN-AUT26", scenarioId: "SCENARIO-MATRIX", operations: [
      { type: "set_status", planCourseId: "PC-MATRIX-1", status: "backup" },
      { type: "set_units", planCourseId: "PC-MATRIX-1", units: 3 },
      { type: "select_section", planCourseId: "PC-MATRIX-1", sectionId: "SECTION-CS-148-01" },
      { type: "remove_commitment", commitmentId: "COMMIT-MATRIX" },
      { type: "remove_course", planCourseId: "PC-MATRIX-1" }
    ] })).ok).toBe(true)
    expect((await call("edit_plan", { planId: "PLAN-AUT26", scenarioId: "SCENARIO-MATRIX", operations: [{ type: "set_active_scenario" }] })).ok).toBe(true)
    expect((await call("edit_plan", { planId: "PLAN-AUT26", scenarioId: "SCENARIO-MATRIX", operations: [{ type: "delete_scenario" }] })).ok).toBe(true)
    expect((await call("edit_plan", { termId: "TERM-2027-WINTER", operations: [{ type: "add_course", planCourse: { id: "PC-WIN", courseId: "COURSE-CS-107", sectionId: null, units: 5, status: "active" } }] })).ok).toBe(true)
    expect((await call("edit_plan", { planId: "PLAN-AUT26", scenarioId: "SCENARIO-NOPE", operations: [{ type: "rename_scenario", name: "X" }] })).ok).toBe(false)
    expect((await call("edit_plan", { planId: "PLAN-AUT26", scenarioId: "SCENARIO-PRIMARY", operations: [{ type: "warp_reality" }] })).ok).toBe(false)

    // Reference: add course with section, amend opportunity, program, removals, evidence archive.
    const refEvidence = { ...evidence, id: "EVIDENCE-MATRIX-REF" }
    const refCourse = await call("extend_reference", { course: { code: "CS 990X", title: "Matrix Course" }, section: { units: 3, meetings: [{ days: ["mon"], start: "09:00", end: "10:00" }] }, evidence: refEvidence })
    expect(refCourse.ok).toBe(true)
    expect((await call("extend_reference", { opportunity: { name: "Matrix Society", summary: "A society.", kind: "club" }, evidence: refEvidence })).ok).toBe(true)
    expect((await call("extend_reference", { program: { name: "Matrix Minor", credential: "Minor", sourceUrl: "https://example.edu/matrix", requirements: [{ title: "Core", rule: { type: "course_group", count: 1, courseIds: ["COURSE-CS-106A"] } }] }, evidence: refEvidence })).ok).toBe(true)
    expect((await call("extend_reference", { remove: { kind: "program", id: "PROGRAM-MATRIX-MINOR" } })).ok).toBe(true)
    const workspaceMid = await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")
    const oppId = workspaceMid.referenceOverlay!.opportunities!.find((item) => item.name === "Matrix Society")!.id
    expect((await call("extend_reference", { remove: { kind: "opportunity", id: oppId } })).ok).toBe(true)
    expect((await call("extend_reference", { remove: { kind: "course", id: "COURSE-CS-990X" } })).ok).toBe(true)
    expect((await call("extend_reference", { remove: { kind: "evidence", id: "EVIDENCE-MATRIX-REF" } })).ok).toBe(true)
    expect((await call("extend_reference", { course: { code: "CS 991X", title: "No evidence" } })).ok).toBe(false)

    // Views, goals, ingest, undo: the rest of the writes.
    expect((await call("configure_view", { view: { id: "VIEW-MATRIX", title: "Matrix view", layout: "one_column", blocks: [{ type: "checklist", title: "Checks" }] } })).ok).toBe(true)
    expect((await call("ingest_context", { text: "One thought.\n\nAnother thought.", tag: "matrix" })).ok).toBe(true)
    expect((await call("manage_goal", { action: "upsert", goal: { id: "GOAL-MATRIX", title: "Matrix goal", milestones: [{ title: "Step", due: "2026-10-10" }] } })).ok).toBe(true)
    expect((await call("manage_goal", { action: "toggle_milestone", goalId: "GOAL-MATRIX", milestoneId: "MILESTONE-MATRIX-1", done: true })).ok).toBe(true)
    expect((await call("manage_goal", { action: "set_status", goalId: "GOAL-MATRIX", status: "achieved" })).ok).toBe(true)
    expect((await call("manage_goal", { action: "remove", goalId: "GOAL-MATRIX" })).ok).toBe(true)
    const last = await call("save_workspace_item", { item: { id: "NOTE-UNDO-ME", type: "note", title: "Undo target", text: "gone soon" } })
    expect((await call("undo", { receiptId: last.receiptId })).ok).toBe(true)
    const finalWorkspace = await repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")
    expect(finalWorkspace.contextItems.some((item) => item.id === "NOTE-UNDO-ME")).toBe(false)
    expect(finalWorkspace.version).toBe(version)
    expect(finalWorkspace.receipts.length).toBeLessThanOrEqual(300)
    expect(Object.keys(finalWorkspace.undoSnapshots).length).toBeLessThanOrEqual(6)
  })
})
