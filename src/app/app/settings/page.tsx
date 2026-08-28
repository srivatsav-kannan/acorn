"use client"

import { useState } from "react"
import { AppShell } from "@/components/app-shell"
import { useWorkspace } from "@/components/workspace-provider"

const planningDays = [
  ["mon", "Monday"],
  ["tue", "Tuesday"],
  ["wed", "Wednesday"],
  ["thu", "Thursday"],
  ["fri", "Friday"],
  ["sat", "Saturday"],
  ["sun", "Sunday"]
] as const

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
  const [excludedDays, setExcludedDays] = useState([...profile.excludedDays])
  const [addingPriority, setAddingPriority] = useState(false)
  const [priorityLabel, setPriorityLabel] = useState("")
  const [priorityStrength, setPriorityStrength] = useState<"hard" | "soft">("soft")
  const [completedQuery, setCompletedQuery] = useState("")
  const hasPlanningView = value.workspace.savedViews.some((view) => view.id === planningView.id)
  const saveProfile = async () => {
    await value.onCommand({ type: "update_profile", patch: { name, summary, earliestStart, latestEnd, excludedDays } })
    setEditing(false)
  }
  const addPriority = async () => {
    await value.onCommand({ type: "set_student_preference", preference: { id: `PREFERENCE-${crypto.randomUUID().toUpperCase()}`, label: priorityLabel.trim(), strength: priorityStrength, value: true } })
    setPriorityLabel("")
    setPriorityStrength("soft")
    setAddingPriority(false)
  }
  const completedCourses = profile.completedCourseIds.map((id) => value.catalog.courses.find((course) => course.id === id)).filter(Boolean)
  const courseMatches = completedQuery.trim() ? value.catalog.courses.filter((course) => `${course.code} ${course.title}`.toLowerCase().includes(completedQuery.toLowerCase()) && !profile.completedCourseIds.includes(course.id)).slice(0, 6) : []
  return <AppShell activePage="settings" quarter="Autumn 2026" activity={value.workspace.activity} onUndo={value.undo}><div className="page settings-page">
    <header className="page-heading"><div><p className="eyebrow">Your information</p><h1>Settings</h1><p>Change your profile and planning preferences.</p></div>{value.isDemoAccount || value.mode === "fixture" ? <button className="secondary-button" onClick={value.reset}>Reset demo to onboarding</button> : <button className="secondary-button" onClick={value.signOut}>Sign out</button>}</header>
    <section className="settings-card profile-settings"><div className="section-heading"><div><p className="eyebrow">Planning profile</p><h2>{profile.name}</h2></div><button className="text-button" type="button" onClick={() => setEditing((current) => !current)}>{editing ? "Cancel" : "Edit profile"}</button></div>
      {editing ? <form onSubmit={(event) => { event.preventDefault(); void saveProfile() }}><label>Name<input value={name} onChange={(event) => setName(event.target.value)} required /></label><label>Goals and planning context<textarea rows={4} value={summary} onChange={(event) => setSummary(event.target.value)} /></label><div className="settings-inline"><label>Earliest class<input type="time" value={earliestStart} onChange={(event) => setEarliestStart(event.target.value)} /></label><label>Latest class end<input type="time" value={latestEnd} onChange={(event) => setLatestEnd(event.target.value)} /></label></div><fieldset className="protected-days"><legend>Days to keep free</legend><p>Plan checks treat meetings on these days as conflicts.</p><div>{planningDays.map(([day, label]) => <label key={day}><input type="checkbox" checked={excludedDays.includes(day)} onChange={(event) => setExcludedDays((current) => event.target.checked ? [...current, day] : current.filter((item) => item !== day))} /><span>{label}</span></label>)}</div></fieldset><div className="modal-actions"><button className="primary-button" type="submit">Save profile</button></div></form> : <><p>{profile.summary}</p><dl><div><dt>Catalog year</dt><dd>{profile.catalogYear}</dd></div><div><dt>Earliest start</dt><dd>{profile.earliestStart}</dd></div><div><dt>Latest end</dt><dd>{profile.latestEnd}</dd></div><div><dt>Protected days</dt><dd>{profile.excludedDays.length ? planningDays.filter(([day]) => profile.excludedDays.includes(day)).map(([, label]) => label.slice(0, 3)).join(", ") : "None"}</dd></div></dl></>}
    </section>
    <section className="settings-card completed-settings"><div className="section-heading"><div><p className="eyebrow">Course history</p><h2>Completed courses</h2><span className="count-badge">{completedCourses.length}</span></div></div><p>Add only courses you have completed. This prevents repeated recommendations and improves requirement checks.</p><label className="completed-course-search">Find a course<input value={completedQuery} onChange={(event) => setCompletedQuery(event.target.value)} placeholder="CS 106A or programming" /></label>{courseMatches.length > 0 && <div className="completed-search-results">{courseMatches.map((course) => <button key={course.id} type="button" onClick={() => { void value.onCommand({ type: "set_completed_courses", courseIds: [...profile.completedCourseIds, course.id] }); setCompletedQuery("") }}><b>{course.code}</b><span>{course.title}</span><em>Add</em></button>)}</div>}{completedCourses.length === 0 ? <div className="settings-empty"><strong>No completed courses added</strong><span>Your account starts empty. Add a course when you want it used in planning.</span></div> : <div className="completed-course-list">{completedCourses.map((course) => course && <article key={course.id}><span><strong>{course.code}</strong><small>{course.title}</small></span><button className="text-button" type="button" onClick={() => value.onCommand({ type: "set_completed_courses", courseIds: profile.completedCourseIds.filter((id) => id !== course.id) })}>Remove</button></article>)}</div>}</section>
    <section className="settings-card priority-settings"><div className="section-heading"><div><p className="eyebrow">Planning priorities</p><h2>What this quarter should protect</h2></div><button className="secondary-button" type="button" onClick={() => setAddingPriority((current) => !current)}>{addingPriority ? "Cancel" : "Add priority"}</button></div><p>These priorities are visible to you and your agent and are included in planning context.</p>{addingPriority && <form className="priority-form" onSubmit={(event) => { event.preventDefault(); void addPriority() }}><label>Priority<input value={priorityLabel} onChange={(event) => setPriorityLabel(event.target.value)} placeholder="Protect time for research this quarter" required /></label><label>Importance<select value={priorityStrength} onChange={(event) => setPriorityStrength(event.target.value as "hard" | "soft")}><option value="soft">Preference</option><option value="hard">Hard constraint</option></select></label><button className="primary-button" type="submit">Save priority</button></form>}<div className="priority-list">{profile.preferences.map((preference) => <article key={preference.id}><span className={preference.strength}>{preference.strength === "hard" ? "Hard" : "Flexible"}</span><strong>{preference.label}</strong><button className="text-button" type="button" onClick={() => value.onCommand({ type: "delete_student_preference", preferenceId: preference.id })} aria-label={`Remove ${preference.label}`}>Remove</button></article>)}</div></section>
    <section className="settings-card account-card"><div><span className="type-icon">@</span><p><strong>{value.isDemoAccount ? "Demo account" : value.mode === "account" ? "Authenticated account" : "Test fixture"}</strong><small>{value.mode === "account" ? value.userEmail : "Available only during automated verification."}</small></p></div><span className={`status-pill ${value.mode === "account" ? "completed" : "planned"}`}>{value.mode === "account" ? "Saved to server" : "Test only"}</span></section>
    <section className="settings-card agent-settings"><div><p className="eyebrow">Agent access</p><h2>Connect without copying your context</h2><p>See connection status, semantic tools, safety boundaries, and a reusable starter prompt.</p></div><a className="secondary-button" href="/app/agent">Open agent setup</a></section>
    <section className="settings-card saved-views-card"><div className="section-heading"><div><h2>Saved views</h2><span className="count-badge">{value.workspace.savedViews.length}</span></div>{!hasPlanningView && <button className="secondary-button" type="button" onClick={() => value.onCommand({ type: "configure_view", view: planningView })}>Create planning view</button>}</div><p>Arrange the same workspace information into focused surfaces. Human and agent changes use the same safe block vocabulary.</p>{value.workspace.savedViews.length === 0 ? <div className="settings-empty"><strong>No custom views yet</strong><span>Create a planning view with plan, requirement, and open-question blocks.</span></div> : <div className="saved-view-list">{value.workspace.savedViews.map((view) => <article key={view.id}><div><span className="type-icon">▦</span><span><strong>{view.title}</strong><small>{view.layout.replace("_", " ")} · {view.blocks.length} blocks</small></span><button className="text-button" type="button" onClick={() => value.onCommand({ type: "delete_saved_view", viewId: view.id })}>Remove</button></div><ul>{view.blocks.map((block) => <li key={block.id ?? `${view.id}-${block.type}`}>{block.title ?? block.type.replaceAll("_", " ")}</li>)}</ul></article>)}</div>}</section>
  </div></AppShell>
}
