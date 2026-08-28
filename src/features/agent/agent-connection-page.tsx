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
    <header className="page-heading"><div><p className="eyebrow">Plan together</p><h1>Bring an agent into your workspace.</h1><p>Ask naturally. Your plan, notes, and saved sources provide the context.</p></div><span className={`connection-pill ${detected ? "connected" : ""}`}><i />{detected ? "Agent connection available" : "Open in a compatible browser"}</span></header>

    <section className="agent-conversation-guide">
      <div className="agent-guide-copy"><p className="eyebrow">One minute setup</p><h2>Keep CourseContext open, then start a conversation with your browser agent.</h2><p>You do not need to paste your schedule or explain how the app works. Start with what you want, such as:</p><blockquote>Build me two balanced Autumn plans. I want to explore computer science and design, and I care more about leaving room to adjust than maximizing units.</blockquote><p className="agent-status-copy">{detected ? "This browser can share the open workspace with your agent." : "The workspace still works normally. Agent access becomes available automatically in a compatible browser."}</p></div>
      <div className="agent-permissions"><p className="eyebrow">What your agent can do</p><ul><li><span>✓</span><div><strong>Read what you saved</strong><small>Goals, preferences, plans, notes, and sources.</small></div></li><li><span>✓</span><div><strong>Research and organize</strong><small>New sources are saved visibly with attribution.</small></div></li><li><span>✓</span><div><strong>Edit plans</strong><small>Changes are focused, persisted, and undoable.</small></div></li><li><span>✓</span><div><strong>Fill catalog gaps</strong><small>Missing courses can be added to your reference with sources, and you can remove them.</small></div></li><li className="blocked"><span>×</span><div><strong>No external submissions</strong><small>It cannot enroll, send email, or act in Stanford systems.</small></div></li></ul></div>
    </section>

    <section className="agent-tools-card agent-manifest-card">
      <div className="section-heading"><div><p className="eyebrow">Registered in this page</p><h2>Twelve semantic tools</h2></div><span>{detected ? "Available to a connected agent" : "Registered when a compatible browser connects"}</span></div>
      <div className="tool-groups">
        <div><h3>Read</h3>{["search_workspace", "get_planning_context", "search_courses", "get_plan", "check_plan", "get_program_progress"].map((name) => <code key={name}>{name}</code>)}</div>
        <div><h3>Change, always visibly</h3>{["edit_plan", "save_research", "save_workspace_item", "update_student_context", "extend_reference", "configure_view"].map((name) => <code key={name}>{name}</code>)}</div>
      </div>
      <aside><span>✓</span><p><strong>Same rules as you</strong><small>Every tool runs the same domain command your own clicks use, with version checks, receipts, and undo.</small></p></aside>
    </section>

    <section className="agent-starter-card">
      <div><p className="eyebrow">Optional instruction</p><h2>Give your agent the collaboration rules once.</h2><p>This helps an unfamiliar agent use the workspace carefully. After that, speak normally.</p></div>
      <blockquote>{starterPrompt}</blockquote>
      <button className="primary-button" type="button" onClick={copy}>{copied ? "Copied" : "Copy instruction"}</button>
    </section>

    <section className="agent-visibility-card"><div><span className="visibility-icon">◷</span><p><strong>You can always see what changed.</strong><small>Agent work appears in Activity and in the same plan or Library view you edit yourself.</small></p></div><dl><div><dt>Workspace</dt><dd>{workspace.title}</dd></div><div><dt>Saved changes</dt><dd>{workspace.activity.filter((item) => item.actor.type === "agent").length} by agent</dd></div></dl></section>
  </div>
}
