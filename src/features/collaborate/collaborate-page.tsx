"use client"

import { useEffect, useState } from "react"

const starterPrompt = "You are connected to Acorn, my Stanford planning workspace, through WebMCP. Start with get_planning_context, then pull export_context section \"all\" and follow nextCursor until you have everything. Make changes through the tools only, one mutation per workspace version, and re-read after a conflict. Anything I tell you that belongs in the workspace goes in through ingest_context or the specific tool, so I can see it too."

// The whole pitch, without the pitch: bring any WebMCP-capable agent to this
// page and it can read and edit everything the interface can.

const tools: Array<[string, string]> = [
  ["export_context", "Pages the whole workspace out as markdown"],
  ["ingest_context", "Files your existing context into the scratchpad"],
  ["get_planning_context", "Version, timeline, constraints, and counts"],
  ["search_workspace", "Searches everything saved here"],
  ["search_courses", "Searches the full imported catalog"],
  ["get_plan", "Reads any term's plan"],
  ["check_plan", "Deterministic conflict and prerequisite checks"],
  ["suggest_sections", "Complete section assignments that clear every constraint"],
  ["get_program_progress", "Requirement-by-requirement evaluation"],
  ["edit_plan", "Adds and removes planned courses"],
  ["manage_todo", "Adds and completes todos"],
  ["manage_event", "Places dated, timed, timezone-aware events"],
  ["set_interest", "Marks courses and clubs interesting"],
  ["annotate_course", "Attaches notes to courses"],
  ["manage_activity", "Tracks recurring commitments"],
  ["update_student_context", "Updates identity, hours, and history"],
  ["save_research", "Files findings with sources"],
  ["save_workspace_item", "Adds notes, people, and decisions"],
  ["extend_reference", "Adds or amends courses, clubs, and programs"],
  ["configure_view", "Composes saved views"],
  ["undo", "Reverses any recent mutation by its receipt"],
  ["manage_goal", "Structured goals with linked milestones"]
]

export const CollaboratePage = () => {
  const [detected, setDetected] = useState(false)
  const [copied, setCopied] = useState(false)
  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(starterPrompt)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2200)
    } catch {
      setCopied(false)
    }
  }
  useEffect(() => {
    const update = () => setDetected(Boolean((document as Document & { modelContext?: unknown }).modelContext))
    update()
    const interval = window.setInterval(update, 1500)
    return () => window.clearInterval(interval)
  }, [])

  return <div className="page collaborate-page">
    <header className="page-heading">
      <div><h1>Work with your agent</h1><p>Any WebMCP-capable agent in a supported browser can drive this workspace.</p></div>
      <span className={detected ? "connection-pill connected" : "connection-pill"}><i />{detected ? "Agent connection available" : "No agent bridge detected in this browser"}</span>
    </header>

    <div className="collab-grid">
      <div className="collab-left">
        <section className="panel-card collaborate-intro">
          <p>Everything on this site is reachable through the tools listed here, registered on this page through WebMCP. An agent can pull the entire workspace into its context with <code>export_context</code>, hand over context you gave it elsewhere with <code>ingest_context</code>, and make the same edits you can make by hand: plans, todos, notes, clubs, activities, and history. Every change it makes lands in the activity ledger with attribution and an undo, and stale writes conflict instead of overwriting yours.</p>
        </section>
        <section className="panel-card prompt-card">
          <div className="section-heading"><h2>If your agent needs an introduction</h2><button className="secondary-button small" type="button" onClick={() => void copyPrompt()}>{copied ? "Copied" : "Copy"}</button></div>
          <p className="prompt-text">{starterPrompt}</p>
        </section>
      </div>
      <section className="panel-card">
        <div className="section-heading"><h2>The tools</h2><span className="muted">document.modelContext</span></div>
        <ul className="collab-tool-list">
          {tools.map(([name, note]) => <li key={name}><code>{name}</code><span>{note}</span></li>)}
        </ul>
      </section>
    </div>
  </div>
}
