import { describe, expect, it } from "vitest"
import { buildFixture } from "@/data/fixture"
import { executeCommand } from "@/domain/commands"
import { calendarEventsForRange } from "@/domain/calendar"
import { exportBlocks } from "@/webmcp/export"
import { MemoryWorkspaceRepository } from "@/store/memory-repository"

const setup = () => new MemoryWorkspaceRepository(buildFixture())
const run = (repository: MemoryWorkspaceRepository, command: Record<string, unknown>, expectedVersion: number, key: string, actor: "human" | "agent" = "human") =>
  executeCommand(repository, { actor: { type: actor, id: `${actor.toUpperCase()}-TEST` }, ownerUserId: "USER-DEMO", workspaceId: "WORKSPACE-DEMO", expectedVersion, idempotencyKey: key, command })
const state = (repository: MemoryWorkspaceRepository) => repository.getWorkspace("WORKSPACE-DEMO", "USER-DEMO")

describe("todo commands", () => {
  it("adds, toggles, and removes with validation on every edge", async () => {
    const repository = setup()
    await expect(run(repository, { type: "manage_todo", action: "add", todo: { title: "" } }, 1, "T1")).rejects.toThrow(/needs a title/)
    await expect(run(repository, { type: "manage_todo", action: "add", todo: { title: "X", due: "next week" } }, 1, "T2")).rejects.toThrow(/YYYY-MM-DD/)
    await expect(run(repository, { type: "manage_todo", action: "someday" }, 1, "T3")).rejects.toThrow(/add, toggle, or remove/)
    await run(repository, { type: "manage_todo", action: "add", todo: { title: "Visit office hours", due: "2026-10-02", detail: "CS 106B" } }, 1, "T4", "agent")
    let workspace = await state(repository)
    const added = workspace.todos.find((todo) => todo.title === "Visit office hours")!
    expect(added).toMatchObject({ done: false, source: "agent", due: "2026-10-02" })
    await expect(run(repository, { type: "manage_todo", action: "add", todo: { id: added.id, title: "Duplicate" } }, 2, "T5")).rejects.toThrow(/already exists/)
    await run(repository, { type: "manage_todo", action: "toggle", todoId: added.id }, 2, "T6")
    workspace = await state(repository)
    expect(workspace.todos.find((todo) => todo.id === added.id)?.done).toBe(true)
    await expect(run(repository, { type: "manage_todo", action: "toggle", todoId: "TODO-NOPE" }, 3, "T7")).rejects.toThrow(/not found/)
    await run(repository, { type: "manage_todo", action: "remove", todoId: added.id }, 3, "T8")
    workspace = await state(repository)
    expect(workspace.todos.some((todo) => todo.id === added.id)).toBe(false)
  })
})

describe("interest and note commands", () => {
  it("toggles course and club interest idempotently", async () => {
    const repository = setup()
    await expect(run(repository, { type: "set_course_interest", courseId: " ", interested: true }, 1, "I0")).rejects.toThrow(/course ID/)
    await run(repository, { type: "set_course_interest", courseId: "COURSE-CS-106B", interested: true }, 1, "I1")
    await run(repository, { type: "set_course_interest", courseId: "COURSE-CS-106B", interested: true }, 2, "I2")
    let workspace = await state(repository)
    expect(workspace.interestedCourseIds).toEqual(["COURSE-CS-106B"])
    await run(repository, { type: "set_course_interest", courseId: "COURSE-CS-106B", interested: false }, 3, "I3")
    await expect(run(repository, { type: "set_opportunity_interest", opportunityId: "", interested: true }, 4, "I4")).rejects.toThrow(/opportunity ID/)
    await run(repository, { type: "set_opportunity_interest", opportunityId: "OPPORTUNITY-TREEHACKS", interested: true }, 4, "I5")
    await run(repository, { type: "set_opportunity_interest", opportunityId: "OPPORTUNITY-TREEHACKS", interested: false }, 5, "I6")
    workspace = await state(repository)
    expect(workspace.interestedCourseIds).toEqual([])
    expect(workspace.interestedOpportunityIds).toEqual([])
  })

  it("attaches and removes attributed course notes", async () => {
    const repository = setup()
    await expect(run(repository, { type: "annotate_course", courseId: "", note: { text: "x" } }, 1, "N0")).rejects.toThrow(/course ID/)
    await expect(run(repository, { type: "annotate_course", courseId: "COURSE-CS-106B", note: { text: "  " } }, 1, "N1")).rejects.toThrow(/needs text/)
    await run(repository, { type: "annotate_course", courseId: "COURSE-CS-106B", note: { text: "Rumored heavy in winter." } }, 1, "N2", "agent")
    const workspace = await state(repository)
    const note = workspace.courseNotes["COURSE-CS-106B"][0]
    expect(note).toMatchObject({ author: "agent" })
    await expect(run(repository, { type: "annotate_course", courseId: "COURSE-CS-106B", removeNoteId: "NOPE" }, 2, "N3")).rejects.toThrow(/not found/)
    await run(repository, { type: "annotate_course", courseId: "COURSE-CS-106B", removeNoteId: note.id }, 2, "N4")
    expect((await state(repository)).courseNotes["COURSE-CS-106B"]).toHaveLength(0)
  })
})

describe("activity commands", () => {
  it("validates schedules, dates, and sources before saving", async () => {
    const repository = setup()
    await expect(run(repository, { type: "upsert_activity", activity: { name: "" } }, 1, "A0")).rejects.toThrow(/needs a name/)
    await expect(run(repository, { type: "upsert_activity", activity: { name: "Lab", schedule: { days: [], start: "15:00", end: "17:00" } } }, 1, "A1")).rejects.toThrow(/days and HH:MM/)
    await expect(run(repository, { type: "upsert_activity", activity: { name: "Lab", startDate: "October" } }, 1, "A2")).rejects.toThrow(/YYYY-MM-DD/)
    await expect(run(repository, { type: "upsert_activity", activity: { name: "Lab", dates: [{ date: "2026-10-01", label: " " }] } }, 1, "A3")).rejects.toThrow(/date and a label/)
    await expect(run(repository, { type: "upsert_activity", activity: { name: "Lab", sourceUrl: "javascript:alert(1)" } }, 1, "A4")).rejects.toThrow()
    await run(repository, { type: "upsert_activity", activity: { name: "Rivera lab", kind: "research", organizer: "Prof. Rivera", schedule: { days: ["tue", "thu"], start: "15:00", end: "17:00", location: "Gates" }, startDate: "2026-10-01", endDate: "2026-12-01", dates: [{ date: "2026-09-30", label: "Kickoff" }] } }, 1, "A5", "agent")
    let workspace = await state(repository)
    const activity = workspace.activities[0]
    expect(activity).toMatchObject({ name: "Rivera lab", addedBy: "agent" })
    await run(repository, { type: "upsert_activity", activity: { id: activity.id, name: "Rivera health AI lab", kind: "research" } }, 2, "A6")
    workspace = await state(repository)
    expect(workspace.activities).toHaveLength(1)
    expect(workspace.activities[0].name).toBe("Rivera health AI lab")
    await expect(run(repository, { type: "remove_activity", activityId: "NOPE" }, 3, "A7")).rejects.toThrow(/not found/)
    await run(repository, { type: "remove_activity", activityId: activity.id }, 3, "A8")
    expect((await state(repository)).activities).toHaveLength(0)
  })
})

describe("goals and bulk ingest", () => {
  it("sets the degree objective and goal note with the goal card in sync", async () => {
    const repository = setup()
    await expect(run(repository, { type: "set_goals" }, 1, "G0")).rejects.toThrow(/degree objective, a goal/)
    await expect(run(repository, { type: "set_goals", degree: "  " }, 1, "G1")).rejects.toThrow(/cannot be empty/)
    await run(repository, { type: "set_goals", degree: "BS-MS", goal: "Coterm in AI with a healthcare focus." }, 1, "G2", "agent")
    const workspace = await state(repository)
    expect(workspace.profile.timeline?.degree).toBe("BS-MS")
    expect(workspace.profile.summary).toBe("Coterm in AI with a healthcare focus.")
    const goalItem = workspace.contextItems.find((item) => item.type === "goal" && !item.archived)
    if (goalItem) expect(goalItem.summary).toBe("Coterm in AI with a healthcare focus.")
  })

  it("ingests bounded batches of notes and rejects nonsense", async () => {
    const repository = setup()
    await expect(run(repository, { type: "ingest_context_items", items: [] }, 1, "B0")).rejects.toThrow(/at least one/)
    await expect(run(repository, { type: "ingest_context_items", items: Array.from({ length: 21 }, (_, index) => ({ title: `N${index}` })) }, 1, "B1")).rejects.toThrow(/twenty/)
    await expect(run(repository, { type: "ingest_context_items", items: [{ title: " " }] }, 1, "B2")).rejects.toThrow(/needs a title/)
    await run(repository, { type: "ingest_context_items", items: [{ title: "Language background", summary: "Four years of French.", tags: ["Language", "language"] }, { title: "Possible lab" }] }, 1, "B3", "agent")
    const workspace = await state(repository)
    const imported = workspace.contextItems.filter((item) => item.tags?.includes("language"))
    expect(imported).toHaveLength(1)
    expect(imported[0].tags).toEqual(["language"])
    await expect(run(repository, { type: "ingest_context_items", items: [{ title: "Again" }] }, 2, "B3")).resolves.toMatchObject({ ok: true })
  })
})

describe("export sections", () => {
  it("covers every section including trackers, custom additions, and history", async () => {
    const repository = setup()
    await run(repository, { type: "manage_todo", action: "add", todo: { title: "Done thing" } }, 1, "E1")
    const withTodo = await state(repository)
    const doneId = withTodo.todos.find((todo) => todo.title === "Done thing")!.id
    await run(repository, { type: "manage_todo", action: "toggle", todoId: doneId }, 2, "E2")
    await run(repository, { type: "set_course_interest", courseId: "COURSE-CS-106B", interested: true }, 3, "E3")
    await run(repository, { type: "annotate_course", courseId: "COURSE-CS-106B", note: { text: "Winter workload rumor." } }, 4, "E4", "agent")
    await run(repository, { type: "upsert_activity", activity: { name: "Rivera lab", kind: "research", schedule: { days: ["tue"], start: "15:00", end: "16:00" }, dates: [{ date: "2026-10-01", label: "Kickoff" }] } }, 5, "E5")
    const workspace = await state(repository)
    workspace.referenceOverlay = { courses: [{ id: "COURSE-CUSTOM-1", code: "CS 999", title: "Invented Seminar", description: "", subject: "CS", level: 999, minUnits: 3, maxUnits: 3, tags: [] }], sections: [] }
    const opportunities = [{ id: "OPPORTUNITY-TREEHACKS", kind: "club" as const, name: "TreeHacks", summary: "Hackathon.", tags: [], commitment: "One weekend", dates: [{ date: "2027-02-12", label: "Hacking begins" }] }]
    workspace.interestedOpportunityIds.push("OPPORTUNITY-TREEHACKS")
    const full = exportBlocks(workspace, buildFixture().catalog, opportunities, "all", new Date("2026-09-01T12:00:00Z")).join("\n\n")
    expect(full).toContain("## Goals")
    expect(full).toContain("Done: Done thing")
    expect(full).toContain("### Notes on CS 106B")
    expect(full).toContain("Unverified catalog additions")
    expect(full).toContain("TreeHacks")
    expect(full).toContain("(interested)")
    expect(full).toContain("### Rivera lab")
    expect(full).toContain("## Academic history")
    const single = exportBlocks(workspace, buildFixture().catalog, opportunities, "calendar", new Date("2026-09-01T12:00:00Z")).join("\n\n")
    expect(single).toContain("## Next sixty days")
    const fallback = exportBlocks(workspace, buildFixture().catalog, opportunities, "nonsense", new Date("2026-09-01T12:00:00Z"))
    expect(fallback.join("")).toContain("## Goals")
  })
})

describe("calendar edge branches", () => {
  it("marks sectionless planned courses on the first class day and places activity dates", () => {
    const { workspace, catalog } = buildFixture()
    const scenario = workspace.plans[0].scenarios.find((item) => item.id === workspace.plans[0].activeScenarioId)!
    scenario.courses.push({ id: "PLANCOURSE-NO-SECTION", courseId: "COURSE-CS-521", sectionId: null, units: 3, status: "active" })
    workspace.activities.push({ id: "ACT-1", name: "Clinic volunteering", kind: "volunteering", dates: [{ date: "2026-10-03", label: "Orientation" }], addedBy: "human" })
    const events = calendarEventsForRange(workspace, catalog, [], "2026-09-01", "2026-10-31")
    expect(events.some((event) => event.title.endsWith("begins") && event.date === "2026-09-22")).toBe(true)
    expect(events.some((event) => event.title === "Clinic volunteering: Orientation")).toBe(true)
  })
})

describe("export empty and custom branches", () => {
  it("says plainly when a fresh workspace has nothing recorded yet", async () => {
    const { buildPersonalWorkspace } = await import("@/data/personal-workspace")
    const { CUSTOM_INSTITUTION_ID } = await import("@/data/institutions/registry")
    const fresh = buildPersonalWorkspace({ userId: "USER-NEW", email: "new@example.com", name: "Maya", entryYear: 2026, gradYear: 2030 })
    fresh.todos = []
    const blocks = exportBlocks(fresh, { courses: [], sections: [] }, [], "all", new Date("2026-09-01T12:00:00Z")).join("\n\n")
    expect(blocks).toContain("Nothing marked interested yet.")
    expect(blocks).toContain("No priorities recorded.")
    expect(blocks).toContain("No completed courses recorded.")
    expect(blocks).toContain("No AP credit recorded.")
    const custom = buildPersonalWorkspace({ userId: "USER-C", email: "c@example.com", name: "Dana", institutionId: CUSTOM_INSTITUTION_ID, customInstitutionName: "Wherever University" })
    const customBlocks = exportBlocks(custom, { courses: [], sections: [] }, [], "profile", new Date("2026-09-01T12:00:00Z")).join("\n\n")
    expect(customBlocks).toContain("custom institution")
  })

  it("keeps recurring activities inside their default window and skips dateless clubs", () => {
    const { workspace, catalog } = buildFixture()
    workspace.activities.push({ id: "ACT-OPEN", name: "Open-ended shift", kind: "job", schedule: { days: ["mon"], start: "09:00", end: "11:00" }, addedBy: "human" })
    workspace.interestedOpportunityIds.push("OPPORTUNITY-DATELESS")
    const events = calendarEventsForRange(workspace, catalog, [{ id: "OPPORTUNITY-DATELESS", kind: "club", name: "Dateless Club", summary: "", tags: [] }], "2026-10-05", "2026-10-18")
    expect(events.filter((event) => event.title === "Open-ended shift")).toHaveLength(2)
    expect(events.some((event) => event.kind === "club")).toBe(false)
  })
})

describe("remaining branch coverage", () => {
  it("covers timeline-less goals, timing-rich club export, and activity detail arms", async () => {
    const repository = setup()
    const bare = await state(repository)
    delete bare.profile.timeline
    await run(repository, { type: "set_goals", degree: "BA" }, 1, "R1")
    const workspace = await state(repository)
    expect(workspace.profile.timeline?.degree).toBe("BA")

    workspace.activities.push({ id: "ACT-D", name: "Tutoring", kind: "volunteering", detail: "Weekly session", organizer: "Haas Center", addedBy: "human" })
    const opportunities = [{ id: "OPPORTUNITY-T", kind: "club" as const, name: "Timing Club", summary: "Has timing.", tags: [], timing: "Autumn recruiting" }]
    workspace.interestedOpportunityIds.push("OPPORTUNITY-T")
    const clubs = exportBlocks(workspace, buildFixture().catalog, opportunities, "clubs", new Date("2026-09-01T12:00:00Z")).join("\n\n")
    expect(clubs).toContain("Autumn recruiting")
    const activities = exportBlocks(workspace, buildFixture().catalog, opportunities, "activities", new Date("2026-09-01T12:00:00Z")).join("\n\n")
    expect(activities).toContain("with Haas Center")
    expect(activities).toContain("Weekly session")
    const history = exportBlocks(workspace, buildFixture().catalog, [], "history", new Date("2026-09-01T12:00:00Z")).join("\n\n")
    expect(history).toContain("## Academic history")
    const scratch = exportBlocks(workspace, buildFixture().catalog, [], "scratchpad", new Date("2026-09-01T12:00:00Z")).join("\n\n")
    expect(scratch).toContain("## Scratchpad")
  })

  it("covers tag updates on context items and todo add through the human path", async () => {
    const repository = setup()
    await run(repository, { type: "create_context_item", item: { id: "NOTE-TAGME", type: "note", title: "Tag me", summary: "", content: {}, collectionId: "COLLECTION-INBOX" } }, 1, "C1")
    await run(repository, { type: "update_context_item", itemId: "NOTE-TAGME", tags: ["One", "one", "  ", "two"] }, 2, "C2")
    let workspace = await state(repository)
    expect(workspace.contextItems.find((item) => item.id === "NOTE-TAGME")?.tags).toEqual(["one", "two"])
    await run(repository, { type: "manage_todo", action: "add", todo: { title: "Human todo" } }, 3, "C3")
    workspace = await state(repository)
    expect(workspace.todos.find((todo) => todo.title === "Human todo")?.source).toBe("human")
  })
})
