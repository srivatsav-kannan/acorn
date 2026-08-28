"use client"

import { useEffect, useState } from "react"
import type { WorkspaceState } from "@/domain/types"

const starterPrompt = "Help me plan my Stanford quarter using this CourseContext workspace. Read what I have already saved before researching anything new. If you find useful information elsewhere, save the source in my Library. Explain tradeoffs, make the smallest useful changes, preserve details that still apply, and run the complete plan check before finishing. Do not enroll, submit, email, or message anyone for me."

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

  return <div className="page agent-page agent-rebuild">
    <header className="page-heading"><div><h1>Plan together</h1><p className="heading-sub">Your agent reads and edits this workspace directly. No pasting schedules into a chat.</p></div><span className={`connection-pill ${detected ? "connected" : ""}`}><i />{detected ? "Agent connection available" : "Open in a compatible browser"}</span></header>

    <section className="agent-conversation-guide">
      <div className="agent-guide-copy"><h2>Keep CourseContext open, then start a conversation with your browser agent.</h2><p>Start with what you want, such as:</p><blockquote>Build me two balanced Autumn plans. I want to explore computer science and design, and I care more about leaving room to adjust than maximizing units.</blockquote><p className="agent-status-copy">{detected ? "This browser can share the open workspace with your agent." : "The workspace still works normally. Agent access becomes available automatically in a compatible browser."}</p></div>
      <div className="agent-permissions"><h3 className="agent-permissions-title">What it can do here</h3><ul><li><span>✓</span><div><strong>Read what you saved</strong><small>Goals, preferences, plans, notes, and sources.</small></div></li><li><span>✓</span><div><strong>Research and organize</strong><small>New sources are saved visibly with attribution.</small></div></li><li><span>✓</span><div><strong>Edit plans</strong><small>Changes are focused, persisted, and undoable.</small></div></li><li><span>✓</span><div><strong>Fill catalog gaps</strong><small>Missing courses can be added to your reference with sources, and you can remove them.</small></div></li><li className="blocked"><span>×</span><div><strong>No external submissions</strong><small>It cannot enroll, send email, or act in Stanford systems.</small></div></li></ul></div>
    </section>

    <section className="agent-tools-card agent-manifest-card">
      <div className="section-heading"><div><h2>Twelve tools, registered by this page</h2></div><span>{detected ? "Available to a connected agent" : "Registered when a compatible browser connects"}</span></div>
      <div className="tool-groups">
        <div><h3>Read</h3>{["search_workspace", "get_planning_context", "search_courses", "get_plan", "check_plan", "get_program_progress"].map((name) => <code key={name}>{name}</code>)}</div>
        <div><h3>Change, always visibly</h3>{["edit_plan", "save_research", "save_workspace_item", "update_student_context", "extend_reference", "configure_view"].map((name) => <code key={name}>{name}</code>)}</div>
      </div>
      <aside><span>✓</span><p><strong>Same rules as you</strong><small>Every tool runs the same domain command your own clicks use, with version checks, receipts, and undo.</small></p></aside>
    </section>

    <section className="agent-starter-card">
      <div><h2>Give your agent the collaboration rules once.</h2><p>Useful for an agent that has never seen this workspace. After that, speak normally.</p></div>
      <blockquote>{starterPrompt}</blockquote>
      <button className="primary-button" type="button" onClick={copy}>{copied ? "Copied" : "Copy instruction"}</button>
    </section>

    <section className="agent-visibility-card"><div><span className="visibility-icon">◷</span><p><strong>You can always see what changed.</strong><small>Every agent edit lands in Activity with an undo.</small></p></div><dl><div><dt>Workspace</dt><dd>{workspace.title}</dd></div><div><dt>Saved changes</dt><dd>{workspace.activity.filter((item) => item.actor.type === "agent").length} by agent</dd></div></dl></section>
  </div>
}
