type AgentEvent = { tool?: string, action?: string, result?: Record<string, unknown> }

export const evaluateAgentSequence = (events: AgentEvent[]) => {
  const searchIndex = events.findIndex((event) => event.tool === "search_workspace")
  const webIndex = events.findIndex((event) => event.action === "web_search")
  const editIndex = events.findIndex((event) => event.tool === "edit_plan")
  const saveIndex = events.findIndex((event) => event.tool === "save_research")
  if (searchIndex < 0 && (webIndex >= 0 || editIndex >= 0)) return { pass: false, code: "WORKSPACE_NOT_SEARCHED" }
  if (webIndex >= 0 && searchIndex > webIndex) return { pass: false, code: "WORKSPACE_NOT_SEARCHED" }
  const sufficient = searchIndex >= 0 && events[searchIndex].result?.sufficient === true
  if (sufficient && saveIndex >= 0) return { pass: false, code: "UNNECESSARY_RESEARCH" }
  if (webIndex >= 0 && saveIndex < webIndex) return { pass: false, code: "RESEARCH_NOT_SAVED" }
  return { pass: true }
}
