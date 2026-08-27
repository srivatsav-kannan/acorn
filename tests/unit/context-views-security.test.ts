import { describe, expect, it } from "vitest"
import { buildFixture } from "@/data/fixture"
import { exportWorkspace, validateContextItem } from "@/domain/context"
import { assertSafeExternalUrl, sanitizeExternalText } from "@/domain/security"
import { validateSavedView } from "@/domain/views"

describe("context items", () => {
  const allowed = ["note", "document", "idea", "question", "task", "link", "source", "claim", "decision", "person", "organization", "club", "commitment", "preference", "goal", "constraint", "uncertainty"] as const

  it.each(allowed)("accepts %s", (type) => {
    expect(validateContextItem({
      id: `ITEM-${type.toUpperCase()}`,
      type,
      title: `A ${type}`,
      summary: `A ${type}`,
      content: { text: "Useful context" },
      collectionId: "COLLECTION-INBOX",
      status: "active",
      createdBy: { type: "human", id: "USER-DEMO" },
      relationships: [],
      version: 1,
      createdAt: "2026-08-27T00:00:00Z",
      updatedAt: "2026-08-27T00:00:00Z"
    }).type).toBe(type)
  })

  it("rejects hidden reasoning as a context type", () => {
    expect(() => validateContextItem({ type: "chain_of_thought" })).toThrow()
  })

  it("exports portable JSON, Markdown, sources, and activity", () => {
    const exported = exportWorkspace(buildFixture().workspace)
    expect(Object.keys(exported).sort()).toEqual([
      "ACTIVITY.jsonl",
      "LIBRARY/Inbox.md",
      "PLANS.md",
      "PROFILE.md",
      "PROGRAMS.md",
      "SOURCES.json",
      "workspace.json"
    ].sort())
    expect(exported["PROFILE.md"]).toContain("CS-first")
  })
})

describe("saved views", () => {
  const allowedBlocks = ["plan_summary", "weekly_schedule", "course_list", "course_comparison", "requirement_progress", "checklist", "task_list", "source_list", "decision_table", "document", "collection", "recent_activity", "open_questions"]

  it.each(allowedBlocks)("accepts the %s block", (type) => {
    const result = validateSavedView({
      id: `VIEW-${type.toUpperCase().replaceAll("_", "-")}`,
      title: "A saved view",
      layout: "two_column",
      blocks: [{ type, title: "Block", query: {} }]
    }, "WORKSPACE-DEMO")
    expect(result.blocks[0].type).toBe(type)
  })

  it.each(["html", "javascript", "css", "sql", "iframe"])("rejects arbitrary %s", (type) => {
    expect(() => validateSavedView({
      id: "VIEW-UNSAFE",
      title: "Unsafe",
      layout: "one_column",
      blocks: [{ type, title: "Unsafe", query: {}, content: "<script>alert(1)</script>" }]
    }, "WORKSPACE-DEMO")).toThrow(/block/i)
  })

  it("rejects unsupported layouts and cross-workspace queries", () => {
    expect(() => validateSavedView({ id: "VIEW-X", title: "X", layout: "freeform", blocks: [] }, "WORKSPACE-DEMO")).toThrow(/layout/i)
    expect(() => validateSavedView({
      id: "VIEW-Y",
      title: "Y",
      layout: "one_column",
      blocks: [{ type: "collection", title: "Other", query: { workspaceId: "WORKSPACE-OTHER" } }]
    }, "WORKSPACE-DEMO")).toThrow(/workspace/i)
  })

  it("requires stable identity and applies a bounded block budget", () => {
    expect(() => validateSavedView({ title: "No ID", layout: "one_column", blocks: [] }, "WORKSPACE-DEMO")).toThrow(/ID/i)
    expect(() => validateSavedView({ id: "VIEW-TOO-LARGE", title: "Too large", layout: "one_column", blocks: Array.from({ length: 13 }, () => ({ type: "document" })) }, "WORKSPACE-DEMO")).toThrow(/12 blocks/i)
  })
})

describe("external content security", () => {
  it.each(["https://stanford.edu", "http://example.edu/path"])("accepts %s", (url) => {
    expect(assertSafeExternalUrl(url)).toBe(url)
  })

  it.each(["javascript:alert(1)", "file:///etc/passwd", "data:text/html,hello", "http://127.0.0.1/private", "http://169.254.169.254/latest"])("rejects %s", (url) => {
    expect(() => assertSafeExternalUrl(url)).toThrow()
  })

  it("removes executable markup without rewriting ordinary text", () => {
    const result = sanitizeExternalText("<script>alert(1)</script><b>Course guide</b>")
    expect(result).not.toContain("script")
    expect(result).toContain("Course guide")
  })
})
