"use client"

import Link from "next/link"
import { BackButton } from "@/components/back-button"
import { useWorkspace } from "@/components/workspace-provider"

const planningView = {
  id: "VIEW-MY-PLANNING",
  title: "My planning view",
  layout: "two_column" as const,
  blocks: [
    { id: "BLOCK-PLAN", type: "plan_summary" as const, title: "Quarter plan" },
    { id: "BLOCK-REQUIREMENTS", type: "requirement_progress" as const, title: "Degree progress" },
    { id: "BLOCK-QUESTIONS", type: "open_questions" as const, title: "Open questions" }
  ]
}

export default function Page() {
  const value = useWorkspace()
  const hasPlanningView = value.workspace.savedViews.some((view) => view.id === planningView.id)
  return <div className="page settings-page">
    <header className="page-heading"><div><BackButton /><h1>Settings</h1></div>{value.isDemoAccount || value.mode === "fixture" ? <button className="secondary-button" onClick={value.reset}>{value.localAccount ? "Reset workspace" : "Reset demo to onboarding"}</button> : <button className="secondary-button" onClick={value.signOut}>Sign out</button>}</header>
    <section className="settings-card account-card"><div><span className="type-icon">@</span><p><strong>{value.isDemoAccount ? "Demo account" : value.mode === "account" ? "Authenticated account" : "Test fixture"}</strong><small>{value.mode === "account" ? value.userEmail : "Available only during automated verification."}</small></p></div><span className={`status-pill ${value.mode === "account" ? "completed" : "planned"}`}>{value.mode === "account" ? "Saved to server" : "Test only"}</span></section>
    <section className="settings-card"><div className="section-heading"><div><h2>Your academic profile</h2></div><Link className="text-button" href="/app/profile">Open Profile</Link></div><p className="muted">Name, goal, degree timeline, course history, credits, and priorities live in the Profile tab.</p></section>
    <section className="settings-card saved-views-card"><div className="section-heading"><div><h2>Saved views</h2><span className="count-badge">{value.workspace.savedViews.length}</span></div>{!hasPlanningView && <button className="secondary-button" type="button" onClick={() => value.onCommand({ type: "configure_view", view: planningView })}>Create planning view</button>}</div><p>Arrange the same workspace information into focused surfaces. Human and agent changes use the same safe block vocabulary.</p>{value.workspace.savedViews.length === 0 ? <div className="settings-empty"><strong>No custom views yet</strong><span>Create a planning view with plan, requirement, and open-question blocks.</span></div> : <div className="saved-view-list">{value.workspace.savedViews.map((view) => <article key={view.id}><div><span className="type-icon">▦</span><span><strong>{view.title}</strong><small>{view.layout.replace("_", " ")} · {view.blocks.length} blocks</small></span><button className="text-button" type="button" onClick={() => value.onCommand({ type: "delete_saved_view", viewId: view.id })}>Remove</button></div><ul>{view.blocks.map((block) => <li key={block.id ?? `${view.id}-${block.type}`}>{block.title ?? block.type.replaceAll("_", " ")}</li>)}</ul></article>)}</div>}</section>
  </div>
}
