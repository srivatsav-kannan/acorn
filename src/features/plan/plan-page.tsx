"use client"

import { useMemo, useState } from "react"
import { evaluateDegreePlan, planForTerm } from "@/domain/degree-plan"
import { checkPlan } from "@/domain/planner"
import { parseTermId, standingForTerm, supportsTimeline, termLabel, termSequence, termStatus, timelineFor } from "@/domain/timeline"
import type { Catalog, WorkspaceState } from "@/domain/types"

const days = ["mon", "tue", "wed", "thu", "fri"] as const
const colors = ["red", "blue", "gold", "green", "slate"]

const shortTermLabel = (termId: string) => {
  const ref = parseTermId(termId)
  if (!ref) return termLabel(termId)
  return `${ref.season[0]}${ref.season.slice(1, 3).toLowerCase()} ${ref.year}`
}

export const PlanPage = ({ workspace, catalog, onCommand }: { workspace: WorkspaceState, catalog: Catalog, onCommand: (command: Record<string, unknown>) => void | Promise<void> }) => {
  const now = useMemo(() => new Date(), [])
  const timelineSupported = supportsTimeline(workspace)
  const timeline = timelineFor(workspace.profile, now)
  const degree = useMemo(() => evaluateDegreePlan(workspace, catalog, now), [workspace, catalog, now])
  const [view, setView] = useState<"term" | "map">("term")
  const [selectedTermId, setSelectedTermId] = useState(workspace.currentTermId)
  const [selectedScenarioId, setSelectedScenarioId] = useState<string | null>(null)
  const plan = planForTerm(workspace, selectedTermId) ?? (timelineSupported ? undefined : workspace.plans[0])
  const termRefs = timelineSupported ? termSequence(timeline.entryTermId, timeline.expectedGraduationTermId) : []
  const termHasSchedule = catalog.sections.some((section) => section.termId === selectedTermId)
  const termSummary = degree.terms.find((term) => term.termId === selectedTermId)

  const [comparisonOpen, setComparisonOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [calendarMode, setCalendarMode] = useState<"week" | "list">("week")
  const [editCourseId, setEditCourseId] = useState<string | null>(null)
  const [editSectionId, setEditSectionId] = useState("")
  const [editStatus, setEditStatus] = useState<"active" | "backup">("active")
  const [editUnits, setEditUnits] = useState(3)
  const [scenarioSettingsOpen, setScenarioSettingsOpen] = useState(false)
  const [scenarioName, setScenarioName] = useState("")
  const [scenarioUnitLimit, setScenarioUnitLimit] = useState(20)
  const [commitmentOpen, setCommitmentOpen] = useState(false)
  const [commitmentTitle, setCommitmentTitle] = useState("")
  const [commitmentDay, setCommitmentDay] = useState<(typeof days)[number]>("mon")
  const [commitmentStart, setCommitmentStart] = useState("13:00")
  const [commitmentEnd, setCommitmentEnd] = useState("14:00")

  const scenario = plan ? (plan.scenarios.find((item) => item.id === selectedScenarioId) ?? plan.scenarios.find((item) => item.id === plan.activeScenarioId) ?? plan.scenarios[0]) : undefined
  const active = scenario?.courses.filter((item) => item.status === "active") ?? []
  const backups = scenario?.courses.filter((item) => item.status === "backup") ?? []
  const units = active.reduce((sum, item) => sum + item.units, 0)
  const checks = plan && scenario ? checkPlan({ scenario, catalog, profile: workspace.profile, evidence: workspace.evidence, now, termId: plan.termId }) : []
  const sequenceIssues = termSummary?.issues ?? []
  const course = (id: string) => catalog.courses.find((item) => item.id === id)
  const section = (id: string | null) => catalog.sections.find((item) => item.id === id)
  const protectedDayText = workspace.profile.excludedDays.length ? workspace.profile.excludedDays.map((day) => day[0].toUpperCase() + day.slice(1)).join(", ") : "None"

  const selectTerm = (termId: string) => { setSelectedTermId(termId); setSelectedScenarioId(null); setView("term") }
  const startTermPlan = (termId: string) => onCommand({ type: "edit_plan", termId, operations: [] })
  const remove = (id: string) => plan && scenario && onCommand({ type: "edit_plan", planId: plan.id, scenarioId: scenario.id, operations: [{ type: "remove_course", planCourseId: id }] })
  const addScenario = async () => {
    if (!plan || !scenario) return
    const id = `SCENARIO-OPTION-${plan.scenarios.length + 1}`
    await onCommand({ type: "edit_plan", planId: plan.id, scenarioId: scenario.id, operations: [{ type: "create_scenario", scenario: { id, name: `Option ${plan.scenarios.length + 1}`, unitLimit: scenario.unitLimit, courses: scenario.courses.map((item) => ({ ...item, id: `${item.id}-${plan.scenarios.length + 1}` })), commitments: scenario.commitments.map((item) => ({ ...item, id: `${item.id}-${plan.scenarios.length + 1}` })) } }] })
    setSelectedScenarioId(id)
  }
  const beginCourseEdit = (id: string) => { const item = scenario?.courses.find((candidate) => candidate.id === id); if (!item) return; setEditCourseId(id); setEditSectionId(item.sectionId ?? ""); setEditStatus(item.status); setEditUnits(item.units) }
  const saveCourseEdit = async () => {
    if (!editCourseId || !plan || !scenario) return
    const operations: Record<string, unknown>[] = []
    if (editSectionId) operations.push({ type: "select_section", planCourseId: editCourseId, sectionId: editSectionId })
    operations.push({ type: "set_status", planCourseId: editCourseId, status: editStatus }, { type: "set_units", planCourseId: editCourseId, units: editUnits })
    await onCommand({ type: "edit_plan", planId: plan.id, scenarioId: scenario.id, operations })
    setEditCourseId(null)
  }
  const openScenarioSettings = () => { if (!scenario) return; setScenarioName(scenario.name); setScenarioUnitLimit(scenario.unitLimit); setScenarioSettingsOpen(true) }
  const addCommitment = async () => {
    if (!plan || !scenario) return
    await onCommand({ type: "edit_plan", planId: plan.id, scenarioId: scenario.id, operations: [{ type: "add_commitment", commitment: { id: `COMMITMENT-${crypto.randomUUID().toUpperCase()}`, title: commitmentTitle.trim(), meetings: [{ days: [commitmentDay], start: commitmentStart, end: commitmentEnd, timezone: "America/Los_Angeles", type: "commitment" }] } }] })
    setCommitmentTitle("")
    setCommitmentOpen(false)
  }

  const yearRows = useMemo(() => {
    const rows = new Map<number, typeof degree.terms>()
    for (const term of degree.terms) {
      const ref = parseTermId(term.termId)
      if (!ref) continue
      const list = rows.get(ref.academicYearStart) ?? []
      list.push(term)
      rows.set(ref.academicYearStart, list)
    }
    return [...rows.entries()].sort((a, b) => a[0] - b[0])
  }, [degree])

  return <div className="page plan-page">
    <header className="page-heading"><div><h1>{plan?.title ?? termLabel(selectedTermId)}</h1>{timelineSupported && <p className="heading-sub">{standingForTerm(timeline, selectedTermId)} year · {degree.projectedUnits} of {degree.requiredUnits} units planned toward the {timeline.degree}</p>}</div><div className="heading-actions">{plan && <button className="secondary-button" type="button" onClick={() => setComparisonOpen(true)}>Compare scenarios</button>}{timelineSupported && <div className="view-toggle" role="tablist" aria-label="Plan view"><button role="tab" aria-selected={view === "term"} className={view === "term" ? "active" : ""} onClick={() => setView("term")}>This term</button><button role="tab" aria-selected={view === "map"} className={view === "map" ? "active" : ""} onClick={() => setView("map")}>Degree map</button></div>}</div></header>

    {timelineSupported && view === "term" && <div className="term-strip" role="tablist" aria-label="Terms">
      {termRefs.map((ref) => {
        const summary = degree.terms.find((term) => term.termId === ref.id)
        const status = termStatus(ref.id, now)
        return <button key={ref.id} role="tab" aria-selected={selectedTermId === ref.id} className={`term-chip-button ${selectedTermId === ref.id ? "selected" : ""} ${status}`} onClick={() => selectTerm(ref.id)}>
          <b>{shortTermLabel(ref.id)}</b>
          <span>{summary && summary.units > 0 ? `${summary.units} units` : status === "past" ? "Past" : "Open"}</span>
        </button>
      })}
    </div>}

    {view === "map" ? <section className="degree-map" aria-label="Degree map">
      <div className="degree-map-grid">
        {yearRows.map(([yearStart, terms]) => <div className="degree-map-year" key={yearStart}>
          <div className="degree-map-year-head"><b>{standingForTerm(timeline, terms[0].termId)}</b><span>{yearStart}-{String((yearStart + 1) % 100).padStart(2, "0")}</span><em>{terms.reduce((sum, term) => sum + term.units, 0)} units</em></div>
          <div className="degree-map-cells">
            {terms.map((term) => <button key={term.termId} className={`degree-map-cell ${term.status} ${term.issues.some((issue) => issue.severity === "error") ? "has-error" : ""}`} onClick={() => selectTerm(term.termId)}>
              <div className="degree-map-cell-head"><b>{termLabel(term.termId).split(" ")[0]}</b><span>{term.units > 0 ? `${term.units}u` : ""}</span></div>
              {term.courses.length === 0 ? <span className="degree-map-empty">{term.status === "past" ? "—" : "Not planned"}</span> : <ul>{term.courses.slice(0, 6).map((item) => <li key={item.planCourseId}>{item.code}</li>)}{term.courses.length > 6 && <li>+{term.courses.length - 6} more</li>}</ul>}
            </button>)}
          </div>
        </div>)}
      </div>
      <aside className="degree-map-side">
        <div className="degree-progress">
          <div className="degree-progress-numbers"><strong>{degree.projectedUnits}</strong><span>of {degree.requiredUnits} units planned or complete</span></div>
          <div className="progress-track"><span style={{ width: `${Math.min(degree.projectedUnits / degree.requiredUnits * 100, 100)}%` }} /></div>
          <dl><div><dt>Completed</dt><dd>{degree.completedUnits}</dd></div><div><dt>Planned</dt><dd>{degree.plannedUnits}</dd></div><div><dt>Remaining to {degree.requiredUnits}</dt><dd>{Math.max(degree.requiredUnits - degree.projectedUnits, 0)}</dd></div></dl>
        </div>
        <div className="degree-issues">
          <h2>Timeline checks</h2>
          {degree.issues.length === 0 ? <p className="degree-issues-clear">Sequencing, duplicates, and quarter loads all check out.</p> : <ul>{degree.issues.map((issue, index) => <li key={`${issue.code}-${index}`} className={issue.severity}><b>{termLabel(issue.termId)}</b><span>{issue.message}</span></li>)}</ul>}
        </div>
      </aside>
    </section> : !plan ? <section className="term-start">
      <h2>{termLabel(selectedTermId)} is open.</h2>
      <p>Set up this quarter and start placing courses. Prerequisites and unit totals carry across the whole degree map.</p>
      <button className="primary-button" type="button" onClick={() => startTermPlan(selectedTermId)}>Plan {termLabel(selectedTermId)}</button>
    </section> : <>
    <div className="scenario-tabs" role="tablist" aria-label="Plan scenarios">{plan.scenarios.map((item) => <button key={item.id} role="tab" aria-selected={scenario?.id === item.id} onClick={() => setSelectedScenarioId(item.id)}>{item.name} <span>{item.id === plan.activeScenarioId ? "Current" : "Alternative"}</span></button>)}<button className="add-tab" aria-label="Add scenario" onClick={addScenario}>+</button></div>
    <div className={`plan-layout ${termHasSchedule ? "" : "no-schedule"}`}>
      <section className="plan-course-panel" aria-label="Selected courses"><div className="section-heading"><div><h2>Courses</h2><span className="count-badge">{active.length}</span></div><strong>{units} units</strong></div>
        <div className="course-stack">{active.length === 0 ? <div className="plan-empty"><strong>No courses yet</strong><p>Add courses from the catalog whenever this quarter takes shape.</p></div> : active.map((item, index) => { const found = course(item.courseId); const selected = section(item.sectionId); if (!found) return null; return <article className="plan-course-card" key={item.id}><i className={`course-color ${colors[index % colors.length]}`} /><button className="course-main course-edit-trigger" type="button" onClick={() => beginCourseEdit(item.id)} aria-label={`Edit ${found.title}`}><div className="course-title"><span><b>{found.code}</b><small>{found.title}</small></span><span className="unit-pill">{item.units} units</span></div><p>{selected ? `${selected.meetings.map((meeting) => meeting.days.map((day) => day[0].toUpperCase()).join("")).join(" · ")} · ${selected.meetings[0]?.start}–${selected.meetings[0]?.end}` : termHasSchedule ? "Section still to choose" : "Times arrive when the schedule is published"}</p><p className="muted">{selected?.instructor ?? ""}</p></button><button className="more-button" type="button" onClick={() => remove(item.id)} aria-label={`Remove ${found.title}`}>×</button></article> })}</div>
        <a className="add-course-button" href="/app/explore">+ Add course</a>
        <div className="subsection"><div className="section-heading"><div><h2>Backups</h2><span className="count-badge">{backups.length}</span></div></div>{backups.map((item) => { const found = course(item.courseId); return found && <div className="compact-row" key={item.id}><i className="course-color slate"/><span><b>{found.code}</b><small>{found.title}</small></span><em>{item.units} units</em><button className="text-button" type="button" onClick={() => beginCourseEdit(item.id)}>Edit</button></div> })}</div>
        <div className="subsection"><div className="section-heading"><div><h2>Commitments</h2><span className="count-badge">{scenario?.commitments.length ?? 0}</span></div><button className="text-button" type="button" onClick={() => setCommitmentOpen(true)}>Add</button></div>{scenario?.commitments.length === 0 && <p className="subsection-empty">Work, research, practice, and anything else the schedule should protect.</p>}{scenario?.commitments.map((item) => <div className="compact-row commitment" key={item.id}><span className="commitment-icon">◇</span><span><b>{item.title}</b><small>{item.meetings[0].days.join(", ")} · {item.meetings[0].start}–{item.meetings[0].end}</small></span><button className="more-button" type="button" onClick={() => onCommand({ type: "edit_plan", planId: plan.id, scenarioId: scenario.id, operations: [{ type: "remove_commitment", commitmentId: item.id }] })} aria-label={`Remove ${item.title}`}>×</button></div>)}</div>
      </section>
      {termHasSchedule ? <section className={`calendar-panel ${calendarMode === "list" ? "list-mode" : ""}`}><div className="section-heading"><div><h2>Weekly calendar</h2><span className="week-note">Pacific time</span></div><div className="calendar-toggle"><button className={calendarMode === "week" ? "active" : ""} aria-pressed={calendarMode === "week"} onClick={() => setCalendarMode("week")}>Week</button><button className={calendarMode === "list" ? "active" : ""} aria-pressed={calendarMode === "list"} onClick={() => setCalendarMode("list")}>List</button></div></div>
        <div className="weekly-calendar" aria-label="Weekly calendar"><div className="time-column"><span />{[8, 10, 12, 14, 16, 18].map((hour) => <time key={hour}>{hour > 12 ? hour - 12 : hour} {hour >= 12 ? "PM" : "AM"}</time>)}</div>{days.map((day) => <div className="calendar-day" key={day}><b>{day.toUpperCase()}</b><div className="day-grid">{active.flatMap((item, index) => { const foundSection = section(item.sectionId); const foundCourse = course(item.courseId); return foundSection?.meetings.filter((meeting) => meeting.days.includes(day)).map((meeting) => { const start = Number(meeting.start.split(":")[0]) + Number(meeting.start.split(":")[1]) / 60; const end = Number(meeting.end.split(":")[0]) + Number(meeting.end.split(":")[1]) / 60; return <div key={`${item.id}-${day}`} className={`calendar-event ${colors[index % colors.length]}`} style={{ top: `${(start - 8) * 48}px`, height: `${Math.max((end - start) * 48, 32)}px` }}><b>{foundCourse?.code}</b><span>{meeting.start}</span></div> }) ?? []})}{scenario?.commitments.flatMap((commitment) => commitment.meetings.filter((meeting) => meeting.days.includes(day)).map((meeting) => { const start = Number(meeting.start.split(":")[0]) + Number(meeting.start.split(":")[1]) / 60; const end = Number(meeting.end.split(":")[0]) + Number(meeting.end.split(":")[1]) / 60; return <div key={`${commitment.id}-${day}-${meeting.start}`} className="calendar-event commitment-event" style={{ top: `${(start - 8) * 48}px`, height: `${Math.max((end - start) * 48, 32)}px` }}><b>{commitment.title}</b><span>{meeting.start}</span></div> }))}</div></div>)}</div>
        <ul className="schedule-list" aria-label="Schedule list">{active.flatMap((item) => { const found = course(item.courseId); return section(item.sectionId)?.meetings.map((meeting) => <li key={`${item.id}-${meeting.start}`}><b>{found?.code}</b><span>{meeting.days.join(", ")} · {meeting.start}–{meeting.end}</span></li>) ?? [] })}{scenario?.commitments.flatMap((commitment) => commitment.meetings.map((meeting) => <li key={`${commitment.id}-${meeting.start}`}><b>{commitment.title}</b><span>{meeting.days.join(", ")} · {meeting.start}–{meeting.end}</span></li>))}</ul>
      </section> : <section className="future-term-panel">
        <div className="section-heading"><div><h2>{termLabel(selectedTermId)}</h2><span className="week-note">{standingForTerm(timeline, selectedTermId)} year</span></div></div>
        <p className="future-term-note">No section schedule exists for this quarter yet. Courses placed here count toward sequencing and units, and times get chosen once the schedule is published.</p>
        <ul className="future-term-list">{active.map((item) => { const found = course(item.courseId); return found && <li key={item.id}><b>{found.code}</b><span>{found.title}</span><em>{item.units} units</em></li> })}</ul>
      </section>}
      <aside className="checks-panel"><div className="section-heading"><div><h2>Plan checks</h2><span className={checks.some((item) => item.severity === "error") || sequenceIssues.some((item) => item.severity === "error") ? "check-state warning" : "check-state clear"}>{checks.length + sequenceIssues.length || "All clear"}</span></div></div>
        {checks.length === 0 && sequenceIssues.length === 0 ? <div className="all-clear"><span>{active.length ? "✓" : "i"}</span><strong>{active.length ? "No hard conflicts" : "Ready when you are"}</strong><p>{active.length ? "Times, units, commitments, and sequencing all check out." : "Checks appear as the quarter fills in."}</p></div> : <ul className="checks-list">{sequenceIssues.map((issue, index) => <li key={`seq-${index}`}><span>!</span><div><b>{issue.message}</b><p>{issue.code === "SEQUENCE_PREREQUISITE" ? "Move the prerequisite earlier or this course later." : issue.code === "TERM_OVERLOAD" ? "Move a course to a lighter quarter." : issue.code === "DUPLICATE_ACROSS_TERMS" ? "Keep the course in one quarter." : "Confirm times once the schedule is out."}</p></div></li>)}{checks.map((item) => <li key={item.id}><span>!</span><div><b>{item.message}</b><p>{item.suggestedRepairs[0]}</p></div></li>)}</ul>}
        <div className="inspector-card"><div className="inspector-title"><h3>{scenario?.name}</h3><button className="icon-button" type="button" onClick={openScenarioSettings} aria-label="Scenario settings">•••</button></div><dl><div><dt>Unit load</dt><dd>{units} / {scenario?.unitLimit}</dd></div><div><dt>Active courses</dt><dd>{active.length}</dd></div><div><dt>Commitments</dt><dd>{scenario?.commitments.length}</dd></div><div><dt>Protected days</dt><dd>{protectedDayText}</dd></div></dl><button className="text-button" type="button" onClick={() => setReportOpen(true)}>View complete check report</button></div>
      </aside>
    </div>
    </>}

    {comparisonOpen && plan && <div className="modal-backdrop" role="presentation" onMouseDown={() => setComparisonOpen(false)}><section className="scenario-comparison" role="dialog" aria-modal="true" aria-labelledby="comparison-title" onMouseDown={(event) => event.stopPropagation()}><div className="drawer-heading"><div><h2 id="comparison-title">Compare scenarios</h2></div><button className="icon-button" type="button" onClick={() => setComparisonOpen(false)} aria-label="Close comparison">×</button></div><div className="comparison-grid">{plan.scenarios.map((item) => { const selectedCourses = item.courses.filter((entry) => entry.status === "active"); const selectedUnits = selectedCourses.reduce((sum, entry) => sum + entry.units, 0); return <article key={item.id}><span>{item.id === plan.activeScenarioId ? "Current" : "Alternative"}</span><h3>{item.name}</h3><strong>{selectedUnits} units</strong><ul>{selectedCourses.map((planned) => <li key={planned.id}>{course(planned.courseId)?.code}<span>{planned.units}</span></li>)}</ul><button className="secondary-button" type="button" onClick={() => { setSelectedScenarioId(item.id); setComparisonOpen(false) }}>Open scenario</button></article> })}</div></section></div>}
    {reportOpen && <div className="modal-backdrop" role="presentation" onMouseDown={() => setReportOpen(false)}><section className="check-report" role="dialog" aria-modal="true" aria-labelledby="check-report-title" onMouseDown={(event) => event.stopPropagation()}><div className="drawer-heading"><div><p className="eyebrow">Deterministic validation</p><h2 id="check-report-title">Complete check report</h2></div><button className="icon-button" type="button" onClick={() => setReportOpen(false)} aria-label="Close check report">×</button></div><dl><div><dt>Units</dt><dd>{units} of {scenario?.unitLimit}</dd></div><div><dt>Hard schedule conflicts</dt><dd>{checks.filter((item) => item.severity === "error").length}</dd></div><div><dt>Warnings and evidence gaps</dt><dd>{checks.filter((item) => item.severity !== "error").length}</dd></div><div><dt>Timeline findings</dt><dd>{sequenceIssues.length}</dd></div></dl>{checks.length === 0 && sequenceIssues.length === 0 ? <p className="report-clear">✓ All deterministic checks passed for this scenario.</p> : <ul>{[...sequenceIssues.map((issue) => ({ id: issue.code + issue.message, message: issue.message, repair: "" })), ...checks.map((item) => ({ id: item.id, message: item.message, repair: item.suggestedRepairs[0] }))].map((item) => <li key={item.id}><strong>{item.message}</strong><span>{item.repair}</span></li>)}</ul>}</section></div>}
    {editCourseId && plan && scenario && <div className="modal-backdrop" role="presentation" onMouseDown={() => setEditCourseId(null)}><form className="course-editor" onMouseDown={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); void saveCourseEdit() }}><div className="drawer-heading"><div><h2>Edit {course(scenario.courses.find((item) => item.id === editCourseId)?.courseId ?? "")?.code}</h2></div><button className="icon-button" type="button" onClick={() => setEditCourseId(null)} aria-label="Close course editor">×</button></div><label>Planning section<select value={editSectionId} onChange={(event) => setEditSectionId(event.target.value)}><option value="">{termHasSchedule ? "Section still to choose" : "Schedule not published yet"}</option>{catalog.sections.filter((item) => item.courseId === scenario.courses.find((planned) => planned.id === editCourseId)?.courseId && item.termId === plan.termId).map((item) => <option value={item.id} key={item.id}>{item.sectionNumber} · {item.meetings.map((meeting) => `${meeting.days.join("/")} ${meeting.start}`).join(", ")}</option>)}</select></label><div className="settings-inline"><label>Units<input type="number" min="1" max="20" value={editUnits} onChange={(event) => setEditUnits(Number(event.target.value))} /></label><label>Plan role<select value={editStatus} onChange={(event) => setEditStatus(event.target.value as "active" | "backup")}><option value="active">Active course</option><option value="backup">Backup</option></select></label></div><div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setEditCourseId(null)}>Cancel</button><button className="primary-button" type="submit">Save course</button></div></form></div>}
    {scenarioSettingsOpen && plan && scenario && <div className="modal-backdrop" role="presentation" onMouseDown={() => setScenarioSettingsOpen(false)}><section className="course-editor" role="dialog" aria-modal="true" aria-labelledby="scenario-settings-title" onMouseDown={(event) => event.stopPropagation()}><div className="drawer-heading"><div><h2 id="scenario-settings-title">Scenario settings</h2></div><button className="icon-button" type="button" onClick={() => setScenarioSettingsOpen(false)} aria-label="Close scenario settings">×</button></div><label>Scenario name<input value={scenarioName} onChange={(event) => setScenarioName(event.target.value)} /></label><label>Maximum units<input type="number" min="1" max="30" value={scenarioUnitLimit} onChange={(event) => setScenarioUnitLimit(Number(event.target.value))} /></label><div className="scenario-setting-actions"><button className="secondary-button" type="button" onClick={async () => { await onCommand({ type: "edit_plan", planId: plan.id, scenarioId: scenario.id, operations: [{ type: "rename_scenario", name: scenarioName }, { type: "set_unit_limit", unitLimit: scenarioUnitLimit }] }); setScenarioSettingsOpen(false) }}>Save settings</button>{scenario.id !== plan.activeScenarioId && <button className="secondary-button" type="button" onClick={async () => { await onCommand({ type: "edit_plan", planId: plan.id, scenarioId: scenario.id, operations: [{ type: "set_active_scenario" }] }); setScenarioSettingsOpen(false) }}>Make current</button>}{plan.scenarios.length > 1 && <button className="danger-text-button" type="button" onClick={async () => { const next = plan.scenarios.find((item) => item.id !== scenario.id); await onCommand({ type: "edit_plan", planId: plan.id, scenarioId: scenario.id, operations: [{ type: "delete_scenario" }] }); setSelectedScenarioId(next?.id ?? null); setScenarioSettingsOpen(false) }}>Delete scenario</button>}</div></section></div>}
    {commitmentOpen && <div className="modal-backdrop" role="presentation" onMouseDown={() => setCommitmentOpen(false)}><form className="course-editor" onMouseDown={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); void addCommitment() }}><div className="drawer-heading"><div><h2>Add a commitment</h2></div><button className="icon-button" type="button" onClick={() => setCommitmentOpen(false)} aria-label="Close commitment form">×</button></div><label>What is it?<input value={commitmentTitle} onChange={(event) => setCommitmentTitle(event.target.value)} placeholder="Research meeting" required /></label><label>Day<select value={commitmentDay} onChange={(event) => setCommitmentDay(event.target.value as (typeof days)[number])}>{days.map((day) => <option value={day} key={day}>{day[0].toUpperCase() + day.slice(1)}</option>)}</select></label><div className="settings-inline"><label>Starts<input type="time" value={commitmentStart} onChange={(event) => setCommitmentStart(event.target.value)} /></label><label>Ends<input type="time" value={commitmentEnd} onChange={(event) => setCommitmentEnd(event.target.value)} /></label></div><div className="modal-actions"><button className="secondary-button" type="button" onClick={() => setCommitmentOpen(false)}>Cancel</button><button className="primary-button" type="submit">Add commitment</button></div></form></div>}
  </div>
}
