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
