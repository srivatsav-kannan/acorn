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
  "get_program_progress",
  "save_research",
  "save_workspace_item",
  "update_student_context",
  "edit_plan",
  "extend_reference",
  "configure_view"
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
    const readNames = expectedNames.slice(0, 6)
    expect(tools.filter((tool) => tool.annotations.readOnlyHint).map((tool) => tool.name)).toEqual(readNames)
    expect(tools.find((tool) => tool.name === "save_research")?.annotations.untrustedContentHint).toBe(true)
    expect(tools.find((tool) => tool.name === "edit_plan")?.annotations.readOnlyHint).toBe(false)
  })

  it("keeps default tool results inside the output budget", async () => {
    const { tools } = setup()
    for (const tool of tools.slice(0, 6)) {
      const result = await tool.execute(tool.examples[0] ?? {})
      expect(JSON.stringify(result).length).toBeLessThanOrEqual(1500)
    }
  })

  it("returns the current plan and scenario IDs before an agent edits", async () => {
    const { tools } = setup()
    const result = await tools.find((tool) => tool.name === "get_planning_context")!.execute({})
    expect(result).toMatchObject({ currentPlanId: "PLAN-AUT26", activeScenarioId: "SCENARIO-PRIMARY" })
    expect(result.workflow).toContain("Discover current plan and scenario IDs before editing")
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
    const history = await tool.execute({ expectedVersion: 1, idempotencyKey: "HISTORY-1", academicHistory: { classYear: "Sophomore", apCredits: [{ exam: "AP Calculus BC", score: 5, satisfiesCourseIds: ["COURSE-MATH-21"] }] } })
    expect(history).toMatchObject({ ok: true })
    const both = await tool.execute({ expectedVersion: 2, idempotencyKey: "HISTORY-2", academicHistory: { classYear: "Junior" }, preferences: [{ id: "PREFERENCE-X", label: "X", strength: "soft", value: true }] })
    expect(both).toMatchObject({ ok: false, code: "ONE_SECTION_PER_CALL" })
    const neither = await tool.execute({ expectedVersion: 2, idempotencyKey: "HISTORY-3" })
    expect(neither).toMatchObject({ ok: false, code: "COMMAND_INVALID" })
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
