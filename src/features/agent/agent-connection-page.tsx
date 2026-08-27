"use client"

import { useEffect, useState } from "react"
import type { WorkspaceState } from "@/domain/types"

const tools = ["search_workspace", "get_planning_context", "search_courses", "get_plan", "check_plan", "get_program_progress", "save_research", "save_workspace_item", "update_student_context", "edit_plan", "configure_view"]
const starterPrompt = "Help me plan in CourseContext. First inspect my planning context and search my workspace. Use external research only when stored context is missing or stale. Save useful sources visibly. Explain tradeoffs, make only the smallest useful atomic changes, and run the complete plan check before you finish. Never enroll, submit, or message anyone on my behalf."

export const AgentConnectionPage = ({ workspace }: { workspace: WorkspaceState }) => {
  const [detected, setDetected] = useState(false)
  const [copied, setCopied] = useState(false)
  useEffect(() => {
    const update = () => setDetected(Boolean((document as Document & { modelContext?: unknown }).modelContext))
    update()
    const timer = window.setTimeout(update, 500)
    return () => window.clearTimeout(timer)
  }, [])
  const copy = async () => {
    await navigator.clipboard.writeText(starterPrompt)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }
  return <div className="page agent-page">
    <header className="page-heading"><div><p className="eyebrow">Agent connection</p><h1>Work with the context you already built.</h1><p>CourseContext gives a compatible browser agent structured access to this workspace. You stay in control of every visible change.</p></div><span className={`connection-pill ${detected ? "connected" : ""}`}><i />{detected ? "WebMCP detected" : "Browser agent not detected"}</span></header>
    <div className="agent-layout">
      <section className="agent-start-card"><span className="step-number">01</span><p className="eyebrow">Start a conversation</p><h2>Use this once. The tools handle the rest.</h2><p>Open your browser agent while this workspace is active, then give it your actual planning request. The starter prompt establishes the safety and context rules.</p><blockquote>{starterPrompt}</blockquote><button className="primary-button" type="button" onClick={copy}>{copied ? "Copied" : "Copy starter prompt"}</button></section>
      <section className="agent-status-card"><span className="step-number">02</span><p className="eyebrow">Connection status</p><h2>{detected ? "Your agent can discover this workspace" : "Open this page in a WebMCP-capable browser"}</h2><p>{detected ? `The current workspace is exposing ${tools.length} semantic tools. Tool descriptions tell the agent what to call and the planning context tells it what to preserve.` : "The application still works normally. Agent tools become available automatically when the browser exposes WebMCP."}</p><dl><div><dt>Workspace</dt><dd>{workspace.title}</dd></div><div><dt>Version</dt><dd>{workspace.version}</dd></div><div><dt>Mutation policy</dt><dd>Atomic + undoable</dd></div><div><dt>External actions</dt><dd>Not allowed</dd></div></dl></section>
      <section className="agent-tools-card"><div className="section-heading"><div><p className="eyebrow">Available capabilities</p><h2>{tools.length} semantic tools</h2></div><span>Automatically discovered</span></div><div className="tool-groups"><div><h3>Read first</h3>{tools.slice(0, 6).map((tool) => <code key={tool}>{tool}</code>)}</div><div><h3>Change with receipts</h3>{tools.slice(6).map((tool) => <code key={tool}>{tool}</code>)}</div></div><aside><span>i</span><p><strong>No giant context dump required</strong><small>The agent retrieves only what the current task needs. Durable facts and research stay visible in your Library.</small></p></aside></section>
    </div>
  </div>
}
