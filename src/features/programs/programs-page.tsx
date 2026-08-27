"use client"

import { evaluateRequirement } from "@/domain/requirements"
import type { Catalog, WorkspaceState } from "@/domain/types"

const labels = { completed: "Completed", planned: "Planned", missing: "Missing", manual_review: "Needs review" } as const

export const ProgramsPage = ({ workspace, catalog }: { workspace: WorkspaceState, catalog: Catalog, onCommand: (command: Record<string, unknown>) => void }) => {
  const program = workspace.programs[0]
  const planned = workspace.plans.flatMap((plan) => plan.scenarios[0].courses.filter((item) => item.status === "active").map((item) => item.courseId))
  const units = Object.fromEntries(catalog.courses.map((course) => [course.id, course.maxUnits]))
  const evaluations = program.requirements.map((requirement) => ({ requirement, evaluation: evaluateRequirement({ rule: requirement.rule, completedCourseIds: workspace.profile.completedCourseIds, plannedCourseIds: planned, courseUnits: units, courseGrades: workspace.profile.courseGrades, residentCourseIds: workspace.profile.residentCourseIds, allowDoubleCount: false }) }))
  const completed = evaluations.filter((item) => item.evaluation.status === "completed").length
  return <div className="page programs-page">
    <header className="page-heading"><div><p className="eyebrow">Degree progress</p><h1>{program.name}</h1><p>{program.credential} · {program.catalogYear}</p></div><a className="secondary-button" href={program.sourceUrl} target="_blank" rel="noreferrer" aria-label="Official source">View official ↗</a></header>
    <section className="program-summary"><div><span className="progress-number">{completed}</span><p><b>requirements satisfied</b><small>of {evaluations.length} tracked in this demo</small></p></div><div className="progress-track"><span style={{ width: `${completed / evaluations.length * 100}%` }} /></div><dl><div><dt>Catalog year</dt><dd>{program.catalogYear}</dd></div><div><dt>Program</dt><dd>{program.credential}</dd></div><div><dt>Source</dt><dd>Stanford Bulletin</dd></div></dl></section>
    <section className="requirements-section"><div className="section-heading"><div><h2>Requirement map</h2><span className="count-badge">{evaluations.length}</span></div><button className="text-button">Show only open requirements</button></div><div className="requirement-list">{evaluations.map(({ requirement, evaluation }) => <article key={requirement.id}><span className={`requirement-state ${evaluation.status}`}>{evaluation.status === "completed" ? "✓" : evaluation.status === "planned" ? "→" : evaluation.status === "manual_review" ? "?" : "○"}</span><div><div className="requirement-title"><h3>{requirement.title}</h3><span className={`status-pill ${evaluation.status}`}>{labels[evaluation.status]}</span></div><p>{evaluation.status === "completed" ? "Satisfied by prior coursework." : evaluation.status === "planned" ? "Covered by the active Autumn plan." : evaluation.status === "manual_review" ? evaluation.detail : "No course currently satisfies this requirement."}</p>{evaluation.contributingCourseIds.length > 0 && <div className="contributing">{evaluation.contributingCourseIds.map((id) => { const found = catalog.courses.find((course) => course.id === id); return <span key={id}>{found?.code ?? id}</span> })}</div>}</div><a href={program.sourceUrl} target="_blank" rel="noreferrer" aria-label={`Source for ${requirement.title}`}>↗</a></article>)}</div></section>
    <aside className="program-note"><span>i</span><p><b>Planning aid, not an official degree audit</b><small>Requirements are grounded in cited references, but ambiguous rules remain marked for advisor review.</small></p></aside>
  </div>
}
