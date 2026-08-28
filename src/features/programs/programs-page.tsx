"use client"

import { useMemo, useState } from "react"
import { evaluateRequirement } from "@/domain/requirements"
import type { Catalog, WorkspaceState } from "@/domain/types"

const labels = { completed: "Completed", planned: "Planned", missing: "Open", manual_review: "Read official details" } as const

export const ProgramsPage = ({ workspace, catalog, onCommand }: { workspace: WorkspaceState, catalog: Catalog, onCommand: (command: Record<string, unknown>) => void }) => {
  const [selectedId, setSelectedId] = useState(workspace.profile.declaredProgramId ?? workspace.programs[0]?.id ?? "")
  const [openOnly, setOpenOnly] = useState(false)
  const program = workspace.programs.find((item) => item.id === selectedId) ?? workspace.programs[0]
  const planned = workspace.plans.flatMap((plan) => {
    const scenario = plan.scenarios.find((item) => item.id === plan.activeScenarioId) ?? plan.scenarios[0]
    return scenario?.courses.filter((item) => item.status === "active").map((item) => item.courseId) ?? []
  })
  const units = Object.fromEntries(catalog.courses.map((course) => [course.id, course.maxUnits]))
  const evaluations = useMemo(() => program ? program.requirements.map((requirement) => ({
    requirement,
    evaluation: evaluateRequirement({ rule: requirement.rule, completedCourseIds: workspace.profile.completedCourseIds, plannedCourseIds: planned, courseUnits: units, courseGrades: workspace.profile.courseGrades, residentCourseIds: workspace.profile.residentCourseIds, allowDoubleCount: false })
  })) : [], [planned, program, units, workspace.profile.completedCourseIds, workspace.profile.courseGrades, workspace.profile.residentCourseIds])
  const completed = evaluations.filter((item) => item.evaluation.status === "completed").length
  const shown = openOnly ? evaluations.filter((item) => item.evaluation.status !== "completed") : evaluations
  const tracking = workspace.profile.declaredProgramId === program?.id

  if (!program) return <div className="page programs-page"><div className="library-empty"><h1>Program references are unavailable</h1><p>Refresh the page or try again later.</p></div></div>

  return <div className="page programs-page programs-rebuild">
    <header className="page-heading"><div><p className="eyebrow">Stanford reference</p><h1>Explore programs</h1><p>Compare official program pages, then track one only when you choose it.</p></div><span className="reference-badge">Read-only reference</span></header>

    <div className="program-browser">
      <aside className="program-list" aria-label="Stanford programs">
        <p className="nav-label">Programs in this reference pack</p>
        {workspace.programs.map((item) => <button key={item.id} className={item.id === program.id ? "active" : ""} onClick={() => setSelectedId(item.id)}><span><strong>{item.name}</strong><small>{item.credential} · {item.catalogYear}</small></span>{workspace.profile.declaredProgramId === item.id && <em>Tracking</em>}</button>)}
        <p className="program-coverage-note">This pack covers a focused set of common paths. The official Bulletin remains the complete source.</p>
      </aside>

      <section className="program-detail">
        <div className="program-detail-heading"><div><p className="eyebrow">Official Stanford program</p><h2>{program.name}</h2><p>{program.summary ?? `${program.credential} program for the ${program.catalogYear} catalog year.`}</p></div><div className="program-detail-actions"><a className="secondary-button" href={program.sourceUrl} target="_blank" rel="noreferrer">Open official page ↗</a><button className={tracking ? "secondary-button" : "primary-button"} type="button" onClick={() => onCommand({ type: "update_profile", patch: { declaredProgramId: tracking ? null : program.id } })}>{tracking ? "Stop tracking" : "Track this program"}</button></div></div>

        <div className="program-reference-meta"><span><b>Source</b> Stanford Bulletin</span><span><b>Catalog year</b> {program.catalogYear}</span><span><b>Your status</b> {tracking ? "Selected by you" : "Reference only"}</span></div>

        {tracking && <section className="program-progress-strip"><div><strong>{completed}</strong><span>of {evaluations.length} tracked areas complete</span></div><div className="progress-track"><span style={{ width: evaluations.length ? `${completed / evaluations.length * 100}%` : "0%" }} /></div><p>CourseContext separates completed work from courses that are only planned.</p></section>}

        <section className="requirements-section"><div className="section-heading"><div><h2>Requirement overview</h2><span className="count-badge">{shown.length}</span></div>{tracking && <button className="text-button" aria-pressed={openOnly} onClick={() => setOpenOnly((value) => !value)}>{openOnly ? "Show all" : "Show open only"}</button>}</div>
          <div className="requirement-list">{shown.map(({ requirement, evaluation }) => <article key={requirement.id}><span className={`requirement-state ${evaluation.status}`}>{evaluation.status === "completed" ? "✓" : evaluation.status === "planned" ? "→" : evaluation.status === "manual_review" ? "i" : "○"}</span><div><div className="requirement-title"><h3>{requirement.title}</h3><span className={`status-pill ${evaluation.status}`}>{tracking ? labels[evaluation.status] : "Reference"}</span></div><p>{!tracking ? "Track this program to compare the requirement against your courses and plan." : evaluation.status === "completed" ? "Satisfied by a completed course you added." : evaluation.status === "planned" ? "Covered by a course in your current plan." : evaluation.status === "manual_review" ? evaluation.detail : "No completed or planned course currently covers this area."}</p>{evaluation.contributingCourseIds.length > 0 && <div className="contributing">{evaluation.contributingCourseIds.map((id) => <span key={id}>{catalog.courses.find((course) => course.id === id)?.code ?? id}</span>)}</div>}</div><a href={program.sourceUrl} target="_blank" rel="noreferrer" aria-label={`Official source for ${requirement.title}`}>↗</a></article>)}</div>
        </section>
      </section>
    </div>

    <aside className="program-note"><span>i</span><p><b>Planning aid, not an official degree audit</b><small>CourseContext links to official requirements and leaves policy nuance open for advisor review.</small></p></aside>
    <section className="stanford-resources"><div className="section-heading"><div><p className="eyebrow">Official planning resources</p><h2>Useful starting points</h2></div></div><div>{workspace.evidence.filter((item) => ["EVIDENCE-ACADEMIC-CALENDAR", "EVIDENCE-DECLARING-MAJOR"].includes(item.id)).map((item) => <a key={item.id} href={item.sourceUrl} target="_blank" rel="noreferrer"><span>Official Stanford source</span><strong>{item.sourceTitle}</strong><small>Checked {new Date(item.retrievedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</small></a>)}</div></section>
  </div>
}
