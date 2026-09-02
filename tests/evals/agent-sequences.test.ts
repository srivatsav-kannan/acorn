import { describe, expect, it } from "vitest"
import { evaluateAgentSequence } from "./agent-evals"

describe("context-first agent sequences", () => {
  it("accepts an answer grounded entirely in stored context", () => {
    expect(evaluateAgentSequence([
      { tool: "search_workspace", result: { sufficient: true } },
      { action: "answer" }
    ])).toMatchObject({ pass: true })
  })

  it("accepts research only after a workspace gap and requires persistence", () => {
    expect(evaluateAgentSequence([
      { tool: "search_workspace", result: { sufficient: false, gaps: ["current offering"] } },
      { action: "web_search" },
      { tool: "save_research", result: { ok: true } },
      { tool: "edit_plan", result: { ok: true } },
      { action: "answer" }
    ])).toMatchObject({ pass: true })
  })

  it.each([
    [[{ action: "web_search" }, { action: "answer" }], "WORKSPACE_NOT_SEARCHED"],
    [[{ tool: "search_workspace", result: { sufficient: false } }, { action: "web_search" }, { action: "answer" }], "RESEARCH_NOT_SAVED"],
    [[{ tool: "edit_plan", result: { ok: true } }, { action: "answer" }], "WORKSPACE_NOT_SEARCHED"],
    [[{ tool: "search_workspace", result: { sufficient: true } }, { tool: "save_research", result: { ok: true } }, { action: "answer" }], "UNNECESSARY_RESEARCH"]
  ] as const)("rejects invalid sequence %#", (events, code) => {
    expect(evaluateAgentSequence(events as never)).toMatchObject({ pass: false, code })
  })
})
