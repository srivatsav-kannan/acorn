"use client"

import { AppShell } from "@/components/app-shell"
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
  const createView = () => value.onCommand({ type: "configure_view", view: planningView })
  return <AppShell activePage="settings" quarter="Autumn 2026" activity={value.workspace.activity} onUndo={value.undo}><div className="page settings-page">
    <header className="page-heading"><div><p className="eyebrow">Student context</p><h1>Settings</h1><p>Inspect and edit the durable information used for recommendations and checks.</p></div><button className="secondary-button" onClick={value.reset}>Reset demo</button></header>
    <section className="settings-card"><h2>Planning profile</h2><p>{value.workspace.profile.summary}</p><dl><div><dt>Catalog year</dt><dd>{value.workspace.profile.catalogYear}</dd></div><div><dt>Earliest start</dt><dd>{value.workspace.profile.earliestStart}</dd></div><div><dt>Latest end</dt><dd>{value.workspace.profile.latestEnd}</dd></div></dl></section>
    <section className="settings-card saved-views-card"><div className="section-heading"><div><h2>Saved views</h2><span className="count-badge">{value.workspace.savedViews.length}</span></div>{!hasPlanningView && <button className="secondary-button" type="button" onClick={createView}>Create planning view</button>}</div><p>Arrange the same workspace information into focused surfaces. Human and agent changes use the same safe block vocabulary.</p>{value.workspace.savedViews.length === 0 ? <div className="settings-empty"><strong>No custom views yet</strong><span>Create a planning view with plan, requirement, and open-question blocks.</span></div> : <div className="saved-view-list">{value.workspace.savedViews.map((view) => <article key={view.id}><div><span className="type-icon">▦</span><span><strong>{view.title}</strong><small>{view.layout.replace("_", " ")} · {view.blocks.length} blocks</small></span></div><ul>{view.blocks.map((block) => <li key={block.id ?? `${view.id}-${block.type}`}>{block.title ?? block.type.replaceAll("_", " ")}</li>)}</ul></article>)}</div>}</section>
  </div></AppShell>
}
