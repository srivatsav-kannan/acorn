"use client"

import { useState } from "react"
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
  const profile = value.workspace.profile
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(profile.name)
  const [summary, setSummary] = useState(profile.summary)
  const [earliestStart, setEarliestStart] = useState(profile.earliestStart)
  const [latestEnd, setLatestEnd] = useState(profile.latestEnd)
  const [fridayOpen, setFridayOpen] = useState(profile.excludedDays.includes("fri"))
  const [addingPriority, setAddingPriority] = useState(false)
  const [priorityLabel, setPriorityLabel] = useState("")
  const [priorityStrength, setPriorityStrength] = useState<"hard" | "soft">("soft")
  const hasPlanningView = value.workspace.savedViews.some((view) => view.id === planningView.id)
  const saveProfile = async () => {
    await value.onCommand({ type: "update_profile", patch: { name, summary, earliestStart, latestEnd, excludedDays: fridayOpen ? ["fri"] : [] } })
    setEditing(false)
  }
  const addPriority = async () => {
    await value.onCommand({ type: "set_student_preference", preference: { id: `PREFERENCE-${crypto.randomUUID().toUpperCase()}`, label: priorityLabel.trim(), strength: priorityStrength, value: true } })
    setPriorityLabel("")
    setPriorityStrength("soft")
    setAddingPriority(false)
  }
  return <AppShell activePage="settings" quarter="Autumn 2026" activity={value.workspace.activity} onUndo={value.undo}><div className="page settings-page">
    <header className="page-heading"><div><p className="eyebrow">Account and context</p><h1>Settings</h1><p>Manage the durable information used for recommendations, checks, and agent work.</p></div>{value.mode === "demo" ? <button className="secondary-button" onClick={value.reset}>Reset demo</button> : <button className="secondary-button" onClick={value.signOut}>Sign out</button>}</header>
    <section className="settings-card profile-settings"><div className="section-heading"><div><p className="eyebrow">Planning profile</p><h2>{profile.name}</h2></div><button className="text-button" type="button" onClick={() => setEditing((current) => !current)}>{editing ? "Cancel" : "Edit profile"}</button></div>
      {editing ? <form onSubmit={(event) => { event.preventDefault(); void saveProfile() }}><label>Name<input value={name} onChange={(event) => setName(event.target.value)} required /></label><label>Goals and planning context<textarea rows={4} value={summary} onChange={(event) => setSummary(event.target.value)} /></label><div className="settings-inline"><label>Earliest class<input type="time" value={earliestStart} onChange={(event) => setEarliestStart(event.target.value)} /></label><label>Latest class end<input type="time" value={latestEnd} onChange={(event) => setLatestEnd(event.target.value)} /></label></div><label className="check-row"><input type="checkbox" checked={fridayOpen} onChange={(event) => setFridayOpen(event.target.checked)} /><span><strong>Keep Fridays open</strong><small>Plan checks treat Friday meetings as a conflict.</small></span></label><div className="modal-actions"><button className="primary-button" type="submit">Save profile</button></div></form> : <><p>{profile.summary}</p><dl><div><dt>Catalog year</dt><dd>{profile.catalogYear}</dd></div><div><dt>Earliest start</dt><dd>{profile.earliestStart}</dd></div><div><dt>Latest end</dt><dd>{profile.latestEnd}</dd></div><div><dt>Friday meetings</dt><dd>{profile.excludedDays.includes("fri") ? "Avoid" : "Allowed"}</dd></div></dl></>}
    </section>
    <section className="settings-card priority-settings"><div className="section-heading"><div><p className="eyebrow">Planning priorities</p><h2>What this quarter should protect</h2></div><button className="secondary-button" type="button" onClick={() => setAddingPriority((current) => !current)}>{addingPriority ? "Cancel" : "Add priority"}</button></div><p>These priorities are visible to you and your agent and are included in planning context.</p>{addingPriority && <form className="priority-form" onSubmit={(event) => { event.preventDefault(); void addPriority() }}><label>Priority<input value={priorityLabel} onChange={(event) => setPriorityLabel(event.target.value)} placeholder="Build healthcare and health-AI depth" required /></label><label>Importance<select value={priorityStrength} onChange={(event) => setPriorityStrength(event.target.value as "hard" | "soft")}><option value="soft">Preference</option><option value="hard">Hard constraint</option></select></label><button className="primary-button" type="submit">Save priority</button></form>}<div className="priority-list">{profile.preferences.map((preference) => <article key={preference.id}><span className={preference.strength}>{preference.strength === "hard" ? "Hard" : "Flexible"}</span><strong>{preference.label}</strong><button className="text-button" type="button" onClick={() => value.onCommand({ type: "delete_student_preference", preferenceId: preference.id })} aria-label={`Remove ${preference.label}`}>Remove</button></article>)}</div></section>
    <section className="settings-card account-card"><div><span className="type-icon">@</span><p><strong>{value.mode === "account" ? "Authenticated account" : "Resettable demo"}</strong><small>{value.mode === "account" ? value.userEmail : "This workspace is stored only in this browser."}</small></p></div><span className={`status-pill ${value.mode === "account" ? "completed" : "planned"}`}>{value.mode === "account" ? "Cloud persisted" : "Local only"}</span></section>
    <section className="settings-card agent-settings"><div><p className="eyebrow">Agent access</p><h2>Connect without copying your context</h2><p>See connection status, semantic tools, safety boundaries, and a reusable starter prompt.</p></div><a className="secondary-button" href="/app/agent">Open agent setup</a></section>
    <section className="settings-card saved-views-card"><div className="section-heading"><div><h2>Saved views</h2><span className="count-badge">{value.workspace.savedViews.length}</span></div>{!hasPlanningView && <button className="secondary-button" type="button" onClick={() => value.onCommand({ type: "configure_view", view: planningView })}>Create planning view</button>}</div><p>Arrange the same workspace information into focused surfaces. Human and agent changes use the same safe block vocabulary.</p>{value.workspace.savedViews.length === 0 ? <div className="settings-empty"><strong>No custom views yet</strong><span>Create a planning view with plan, requirement, and open-question blocks.</span></div> : <div className="saved-view-list">{value.workspace.savedViews.map((view) => <article key={view.id}><div><span className="type-icon">▦</span><span><strong>{view.title}</strong><small>{view.layout.replace("_", " ")} · {view.blocks.length} blocks</small></span><button className="text-button" type="button" onClick={() => value.onCommand({ type: "delete_saved_view", viewId: view.id })}>Remove</button></div><ul>{view.blocks.map((block) => <li key={block.id ?? `${view.id}-${block.type}`}>{block.title ?? block.type.replaceAll("_", " ")}</li>)}</ul></article>)}</div>}</section>
  </div></AppShell>
}
