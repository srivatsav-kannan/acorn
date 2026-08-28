"use client"

import { useState } from "react"
import { AppShell } from "@/components/app-shell"
import { useWorkspace } from "@/components/workspace-provider"
import { degreeOptions, defaultGraduationTerm, parseTermId, supportsTimeline, termId, termLabel, timelineFor } from "@/domain/timeline"

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
  const [classYear, setClassYear] = useState(profile.classYear ?? "")
  const [earliestStart, setEarliestStart] = useState(profile.earliestStart)
  const [latestEnd, setLatestEnd] = useState(profile.latestEnd)
  const [excludedDays, setExcludedDays] = useState([...profile.excludedDays])
  const [addingCredit, setAddingCredit] = useState(false)
  const [creditExam, setCreditExam] = useState("")
  const [creditScore, setCreditScore] = useState("")
  const [creditUnits, setCreditUnits] = useState("")
  const [creditEquivalentQuery, setCreditEquivalentQuery] = useState("")
  const [creditEquivalentId, setCreditEquivalentId] = useState("")
  const [addingPriority, setAddingPriority] = useState(false)
  const [priorityLabel, setPriorityLabel] = useState("")
  const [priorityStrength, setPriorityStrength] = useState<"hard" | "soft">("soft")
  const [completedQuery, setCompletedQuery] = useState("")
  const hasPlanningView = value.workspace.savedViews.some((view) => view.id === planningView.id)
  const saveProfile = async () => {
    await value.onCommand({ type: "update_profile", patch: { name, summary, classYear, earliestStart, latestEnd, excludedDays } })
    setEditing(false)
  }
  const apCredits = profile.apCredits ?? []
  const saveCredits = (credits: typeof apCredits) => value.onCommand({ type: "update_academic_history", patch: { apCredits: credits } })
  const addCredit = async () => {
    const credit = {
      id: `AP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      exam: creditExam.trim(),
      score: creditScore ? Number(creditScore) : undefined,
      unitsGranted: creditUnits ? Number(creditUnits) : undefined,
      satisfiesCourseIds: creditEquivalentId ? [creditEquivalentId] : undefined
    }
    await saveCredits([...apCredits, credit])
    setCreditExam("")
    setCreditScore("")
    setCreditUnits("")
    setCreditEquivalentQuery("")
    setCreditEquivalentId("")
    setAddingCredit(false)
  }
  const equivalentMatches = creditEquivalentQuery.trim() && !creditEquivalentId ? value.catalog.courses.filter((course) => `${course.code} ${course.title}`.toLowerCase().includes(creditEquivalentQuery.toLowerCase())).slice(0, 5) : []
  const timelineSupported = supportsTimeline(value.workspace)
  const timeline = timelineFor(profile, new Date())
  const entryYear = parseTermId(timeline.entryTermId)?.year ?? 2026
  const gradYear = parseTermId(timeline.expectedGraduationTermId)?.year ?? entryYear + 4
  const saveTimeline = (nextEntryYear: number, nextGradYear: number, nextDegree: string) => {
    const entryTermId = termId(nextEntryYear, "AUTUMN")
    const fallback = defaultGraduationTerm(entryTermId, nextDegree)
    const graduationTermId = nextGradYear > nextEntryYear ? termId(nextGradYear, "SPRING") : fallback
    return value.onCommand({ type: "update_academic_history", patch: { timeline: { entryTermId, expectedGraduationTermId: graduationTermId, degree: nextDegree } } })
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
    <header className="page-heading"><div><h1>Settings</h1></div>{value.isDemoAccount || value.mode === "fixture" ? <button className="secondary-button" onClick={value.reset}>Reset demo to onboarding</button> : <button className="secondary-button" onClick={value.signOut}>Sign out</button>}</header>
    <section className="settings-card profile-settings"><div className="section-heading"><div><h2>{profile.name}</h2></div><button className="text-button" type="button" onClick={() => setEditing((current) => !current)}>{editing ? "Cancel" : "Edit profile"}</button></div>
      {editing ? <form onSubmit={(event) => { event.preventDefault(); void saveProfile() }}><label>Name<input value={name} onChange={(event) => setName(event.target.value)} required /></label><label>Goals and planning context<textarea rows={4} value={summary} onChange={(event) => setSummary(event.target.value)} /></label><label>Class standing<input value={classYear} onChange={(event) => setClassYear(event.target.value)} placeholder="Sophomore, Class of 2029" maxLength={30} /></label><div className="settings-inline"><label>Earliest class<input type="time" value={earliestStart} onChange={(event) => setEarliestStart(event.target.value)} /></label><label>Latest class end<input type="time" value={latestEnd} onChange={(event) => setLatestEnd(event.target.value)} /></label></div><fieldset className="protected-days"><legend>Days to keep free</legend><p>Plan checks treat meetings on these days as conflicts.</p><div>{planningDays.map(([day, label]) => <label key={day}><input type="checkbox" checked={excludedDays.includes(day)} onChange={(event) => setExcludedDays((current) => event.target.checked ? [...current, day] : current.filter((item) => item !== day))} /><span>{label}</span></label>)}</div></fieldset><div className="modal-actions"><button className="primary-button" type="submit">Save profile</button></div></form> : <><p>{profile.summary}</p><dl><div><dt>Class standing</dt><dd>{profile.classYear || "Not set"}</dd></div><div><dt>Catalog year</dt><dd>{profile.catalogYear}</dd></div><div><dt>Earliest start</dt><dd>{profile.earliestStart}</dd></div><div><dt>Latest end</dt><dd>{profile.latestEnd}</dd></div><div><dt>Protected days</dt><dd>{profile.excludedDays.length ? planningDays.filter(([day]) => profile.excludedDays.includes(day)).map(([, label]) => label.slice(0, 3)).join(", ") : "None"}</dd></div></dl></>}
    </section>
    {timelineSupported && <section className="settings-card timeline-settings"><div className="section-heading"><div><h2>Degree timeline</h2></div><span className="muted">{termLabel(timeline.entryTermId)} to {termLabel(timeline.expectedGraduationTermId)}</span></div>
      <p>Entry, graduation, and degree drive the four and five year map, class standing, and unit targets.</p>
      <div className="timeline-fields">
        <label>Degree<select value={timeline.degree} onChange={(event) => void saveTimeline(entryYear, parseTermId(timeline.expectedGraduationTermId)?.year ?? entryYear + (event.target.value.includes("MS") ? 5 : 4), event.target.value)}>{degreeOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}{!degreeOptions.some((option) => option.id === timeline.degree) && <option value={timeline.degree}>{timeline.degree}</option>}</select></label>
        <label>Entered in autumn<select value={entryYear} onChange={(event) => void saveTimeline(Number(event.target.value), gradYear, timeline.degree)}>{Array.from({ length: 9 }, (_, index) => entryYear - 4 + index).map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
        <label>Graduating in spring<select value={gradYear} onChange={(event) => void saveTimeline(entryYear, Number(event.target.value), timeline.degree)}>{Array.from({ length: 8 }, (_, index) => entryYear + 1 + index).map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
      </div>
    </section>}
    <section className="settings-card completed-settings"><div className="section-heading"><div><h2>Completed courses</h2><span className="count-badge">{completedCourses.length}</span></div></div><label className="completed-course-search">Find a course<input value={completedQuery} onChange={(event) => setCompletedQuery(event.target.value)} placeholder="CS 106A or programming" /></label>{courseMatches.length > 0 && <div className="completed-search-results">{courseMatches.map((course) => <button key={course.id} type="button" onClick={() => { void value.onCommand({ type: "set_completed_courses", courseIds: [...profile.completedCourseIds, course.id] }); setCompletedQuery("") }}><b>{course.code}</b><span>{course.title}</span><em>Add</em></button>)}</div>}{completedCourses.length === 0 ? <div className="settings-empty"><strong>No completed courses added</strong><span>Your account starts empty. Add a course when you want it used in planning.</span></div> : <div className="completed-course-list">{completedCourses.map((course) => course && <article key={course.id}><span><strong>{course.code}</strong><small>{course.title}</small></span><button className="text-button" type="button" onClick={() => value.onCommand({ type: "set_completed_courses", courseIds: profile.completedCourseIds.filter((id) => id !== course.id) })}>Remove</button></article>)}</div>}</section>
    <section className="settings-card credit-settings"><div className="section-heading"><div><h2>AP and transfer credit</h2><span className="count-badge">{apCredits.length}</span></div><button className="secondary-button" type="button" onClick={() => setAddingCredit((current) => !current)}>{addingCredit ? "Cancel" : "Add credit"}</button></div>
      <p>Credits count toward prerequisites and requirement checks when you link an equivalent course.</p>
      {addingCredit && <form className="credit-form" onSubmit={(event) => { event.preventDefault(); void addCredit() }}>
        <label>Exam or credit source<input value={creditExam} onChange={(event) => setCreditExam(event.target.value)} placeholder="AP Calculus BC" required maxLength={80} /></label>
        <div className="settings-inline">
          <label>Score<input value={creditScore} onChange={(event) => setCreditScore(event.target.value)} placeholder="5" inputMode="numeric" maxLength={1} /></label>
          <label>Units granted<input value={creditUnits} onChange={(event) => setCreditUnits(event.target.value)} placeholder="10" inputMode="numeric" maxLength={2} /></label>
        </div>
        <label>Counts as<input value={creditEquivalentId ? (value.catalog.courses.find((course) => course.id === creditEquivalentId)?.code ?? creditEquivalentQuery) : creditEquivalentQuery} onChange={(event) => { setCreditEquivalentQuery(event.target.value); setCreditEquivalentId("") }} placeholder="Search a course this credit replaces" /></label>
        {equivalentMatches.length > 0 && <div className="completed-search-results">{equivalentMatches.map((course) => <button key={course.id} type="button" onClick={() => { setCreditEquivalentId(course.id); setCreditEquivalentQuery(course.code) }}><b>{course.code}</b><span>{course.title}</span><em>Select</em></button>)}</div>}
        <div className="modal-actions"><button className="primary-button" type="submit">Save credit</button></div>
      </form>}
      {apCredits.length === 0 ? <div className="settings-empty"><strong>No credits added</strong><span>Add AP, IB, or transfer credit so plans and requirement checks account for it.</span></div> : <div className="completed-course-list">{apCredits.map((credit) => <article key={credit.id}><span><strong>{credit.exam}</strong><small>{[credit.score !== undefined ? `Score ${credit.score}` : null, credit.unitsGranted !== undefined ? `${credit.unitsGranted} units` : null, credit.satisfiesCourseIds?.length ? `Counts as ${credit.satisfiesCourseIds.map((id) => value.catalog.courses.find((course) => course.id === id)?.code ?? id).join(", ")}` : null].filter(Boolean).join(" · ") || "Recorded credit"}</small></span><button className="text-button" type="button" onClick={() => saveCredits(apCredits.filter((item) => item.id !== credit.id))}>Remove</button></article>)}</div>}
    </section>
    <section className="settings-card priority-settings"><div className="section-heading"><div><h2>Planning priorities</h2></div><button className="secondary-button" type="button" onClick={() => setAddingPriority((current) => !current)}>{addingPriority ? "Cancel" : "Add priority"}</button></div>{addingPriority && <form className="priority-form" onSubmit={(event) => { event.preventDefault(); void addPriority() }}><label>Priority<input value={priorityLabel} onChange={(event) => setPriorityLabel(event.target.value)} placeholder="Protect time for research this quarter" required /></label><label>Importance<select value={priorityStrength} onChange={(event) => setPriorityStrength(event.target.value as "hard" | "soft")}><option value="soft">Preference</option><option value="hard">Hard constraint</option></select></label><button className="primary-button" type="submit">Save priority</button></form>}<div className="priority-list">{profile.preferences.map((preference) => <article key={preference.id}><span className={preference.strength}>{preference.strength === "hard" ? "Hard" : "Flexible"}</span><strong>{preference.label}</strong><button className="text-button" type="button" onClick={() => value.onCommand({ type: "delete_student_preference", preferenceId: preference.id })} aria-label={`Remove ${preference.label}`}>Remove</button></article>)}</div></section>
    <section className="settings-card account-card"><div><span className="type-icon">@</span><p><strong>{value.isDemoAccount ? "Demo account" : value.mode === "account" ? "Authenticated account" : "Test fixture"}</strong><small>{value.mode === "account" ? value.userEmail : "Available only during automated verification."}</small></p></div><span className={`status-pill ${value.mode === "account" ? "completed" : "planned"}`}>{value.mode === "account" ? "Saved to server" : "Test only"}</span></section>
    <section className="settings-card saved-views-card"><div className="section-heading"><div><h2>Saved views</h2><span className="count-badge">{value.workspace.savedViews.length}</span></div>{!hasPlanningView && <button className="secondary-button" type="button" onClick={() => value.onCommand({ type: "configure_view", view: planningView })}>Create planning view</button>}</div><p>Arrange the same workspace information into focused surfaces. Human and agent changes use the same safe block vocabulary.</p>{value.workspace.savedViews.length === 0 ? <div className="settings-empty"><strong>No custom views yet</strong><span>Create a planning view with plan, requirement, and open-question blocks.</span></div> : <div className="saved-view-list">{value.workspace.savedViews.map((view) => <article key={view.id}><div><span className="type-icon">▦</span><span><strong>{view.title}</strong><small>{view.layout.replace("_", " ")} · {view.blocks.length} blocks</small></span><button className="text-button" type="button" onClick={() => value.onCommand({ type: "delete_saved_view", viewId: view.id })}>Remove</button></div><ul>{view.blocks.map((block) => <li key={block.id ?? `${view.id}-${block.type}`}>{block.title ?? block.type.replaceAll("_", " ")}</li>)}</ul></article>)}</div>}</section>
  </div></AppShell>
}
