"use client"

import { useMemo, useState } from "react"
import { institutionForWorkspace } from "@/data/institutions/registry"
import { effectiveCompletedCourseIds } from "@/domain/history"
import { evaluateRequirement } from "@/domain/requirements"
import type { Catalog, RequirementRule, WorkspaceState } from "@/domain/types"

const labels = { completed: "Completed", planned: "Planned", missing: "Open", manual_review: "Read official details" } as const

const ruleCaption = (rule: RequirementRule): string | null => {
  if (rule.type === "course_group") return rule.count === 1 ? "choose one" : `choose ${rule.count}`
  if (rule.type === "choose_n") return `choose ${rule.count}`
  if (rule.type === "minimum_units") return `${rule.units} units from`
  if (rule.type === "any_of") return "one of"
  if (rule.type === "residency") return `${rule.count} taken here`
  return null
}

const ruleCourseIds = (rule: RequirementRule): string[] => {
  if (rule.type === "course") return [rule.courseId]
  if (rule.type === "course_group" || rule.type === "minimum_units" || rule.type === "residency") return rule.courseIds
  if (rule.type === "minimum_grade") return [rule.courseId]
  if (rule.type === "any_of" || rule.type === "all_of" || rule.type === "choose_n") return rule.rules.flatMap(ruleCourseIds)
  return []
}

export const ProgramsPage = ({ workspace, catalog, onCommand }: { workspace: WorkspaceState, catalog: Catalog, onCommand: (command: Record<string, unknown>) => void }) => {
  const [selectedId, setSelectedId] = useState(workspace.profile.declaredProgramId ?? workspace.programs[0]?.id ?? "")
  const [openOnly, setOpenOnly] = useState(false)
  const institution = institutionForWorkspace(workspace)
  const completedWithCredit = effectiveCompletedCourseIds(workspace.profile)
  const program = workspace.programs.find((item) => item.id === selectedId) ?? workspace.programs[0]
  const planned = workspace.plans.flatMap((plan) => {
    const scenario = plan.scenarios.find((item) => item.id === plan.activeScenarioId) ?? plan.scenarios[0]
    return scenario?.courses.filter((item) => item.status === "active").map((item) => item.courseId) ?? []
  })
  const units = Object.fromEntries(catalog.courses.map((course) => [course.id, course.maxUnits]))
  const evaluations = useMemo(() => program ? program.requirements.map((requirement) => ({
    requirement,
    evaluation: evaluateRequirement({ rule: requirement.rule, completedCourseIds: completedWithCredit, plannedCourseIds: planned, courseUnits: units, courseGrades: workspace.profile.courseGrades, residentCourseIds: workspace.profile.residentCourseIds, allowDoubleCount: false })
  })) : [], [completedWithCredit, planned, program, units, workspace.profile.courseGrades, workspace.profile.residentCourseIds])
  const completed = evaluations.filter((item) => item.evaluation.status === "completed").length
  const shown = openOnly ? evaluations.filter((item) => item.evaluation.status !== "completed") : evaluations
  const tracking = workspace.profile.declaredProgramId === program?.id
  const courseCode = (id: string) => catalog.courses.find((course) => course.id === id)?.code ?? id.replace(/^COURSE-/, "").replaceAll("-", " ")
  const courseState = (id: string) => completedWithCredit.includes(id) ? "done" : planned.includes(id) ? "planned" : ""

  const buildPrompt = `My school is ${workspace.institution}. Research its official degree pages. In this open CourseContext workspace, use the extend_reference tool to add my program with its requirement tree, and the courses that satisfy it, each with an official source. Mark anything uncertain for manual review instead of guessing.`

  if (!program) return <div className="page programs-page programs-rebuild">
    <header className="page-heading"><div><h1>Programs</h1><p className="heading-sub">{workspace.institution} · Beta</p></div></header>
    <section className="agent-build-card">
      <div><h2>No programs here yet.</h2><p>Hand your agent the instruction below and it can build your program reference, with sources. Everything it adds is labeled and removable.</p></div>
      <blockquote>{buildPrompt}</blockquote>
    </section>
  </div>

  return <div className="page programs-page programs-rebuild">
    <header className="page-heading"><div><h1>Programs</h1></div><span className="reference-badge">{institution.shortName} reference</span></header>

    <div className="program-browser">
      <aside className="program-list" aria-label={`${institution.shortName} programs`}>
        <p className="nav-label">Programs in this reference pack</p>
        {workspace.programs.map((item) => <button key={item.id} className={item.id === program.id ? "active" : ""} onClick={() => setSelectedId(item.id)}><span><strong>{item.name}</strong><small>{item.credential} · {item.catalogYear}{item.addedBy ? " · Added by your agent" : ""}</small></span>{workspace.profile.declaredProgramId === item.id && <em>Tracking</em>}</button>)}
        <p className="program-coverage-note">This pack covers a focused set of common paths. The official catalog remains the complete source. Your agent can add missing reference material with sources.</p>
      </aside>

      <section className="program-detail">
        <div className="program-detail-heading"><div>{program.addedBy && <p className="eyebrow">Added by your agent</p>}<h2>{program.name}</h2><p>{program.summary ?? `${program.credential} program for the ${program.catalogYear} catalog year.`}</p></div><div className="program-detail-actions"><a className="secondary-button" href={program.sourceUrl} target="_blank" rel="noreferrer">Open official page ↗</a><button className={tracking ? "secondary-button" : "primary-button"} type="button" onClick={() => onCommand({ type: "update_profile", patch: { declaredProgramId: tracking ? null : program.id } })}>{tracking ? "Stop tracking" : "Track this program"}</button>{program.addedBy && <button className="text-button" type="button" onClick={() => { onCommand({ type: "remove_reference_program", programId: program.id }); setSelectedId(workspace.programs.find((item) => item.id !== program.id)?.id ?? "") }}>Remove from my reference</button>}</div></div>

        <div className="program-reference-meta"><span><b>Source</b> {program.addedBy ? "Added by your agent with a cited source" : `${institution.shortName} official pages`}</span><span><b>Catalog year</b> {program.catalogYear}</span><span><b>Your status</b> {tracking ? "Selected by you" : "Reference only"}</span></div>

        {tracking && <section className="program-progress-strip"><div><strong>{completed}</strong><span>of {evaluations.length} tracked areas complete</span></div><div className="progress-track"><span style={{ width: evaluations.length ? `${completed / evaluations.length * 100}%` : "0%" }} /></div><p>CourseContext separates completed work from courses that are only planned.</p></section>}

        <section className="requirements-section"><div className="section-heading"><div><h2>Requirement overview</h2><span className="count-badge">{shown.length}</span></div>{tracking && <button className="text-button" aria-pressed={openOnly} onClick={() => setOpenOnly((value) => !value)}>{openOnly ? "Show all" : "Show open only"}</button>}</div>
          <div className="requirement-list">{shown.map(({ requirement, evaluation }) => {
            const allIds = ruleCourseIds(requirement.rule)
            const caption = ruleCaption(requirement.rule)
            return <article key={requirement.id}><span className={`requirement-state ${evaluation.status}`}>{evaluation.status === "completed" ? "✓" : evaluation.status === "planned" ? "→" : evaluation.status === "manual_review" ? "i" : "○"}</span><div><div className="requirement-title"><h3>{requirement.title}</h3><span className={`status-pill ${evaluation.status}`}>{tracking ? labels[evaluation.status] : "Reference"}</span></div>
              <p>{!tracking ? "Track this program to compare the requirement against your courses and plan." : evaluation.status === "completed" ? "Satisfied by a completed course you added." : evaluation.status === "planned" ? "Covered by a course in your current plan." : evaluation.status === "manual_review" ? evaluation.detail : evaluation.detail ?? (evaluation.contributingCourseIds.length ? "Partly covered. More courses are needed to finish this area." : "No completed or planned course currently covers this area.")}</p>
              {allIds.length > 0 && <div className="rule-course-chips">{caption && <span className="rule-caption">{caption}</span>}{allIds.slice(0, 10).map((id) => <span key={id} className={`rule-chip ${tracking ? courseState(id) : ""}`}>{courseCode(id)}</span>)}{allIds.length > 10 && <span className="rule-caption">and {allIds.length - 10} more</span>}</div>}
            </div><a href={program.sourceUrl} target="_blank" rel="noreferrer" aria-label={`Official source for ${requirement.title}`}>↗</a></article>
          })}</div>
        </section>
      </section>
    </div>

    <aside className="program-note"><span>i</span><p><b>Planning aid, not an official degree audit</b><small>CourseContext links to official requirements and leaves policy nuance open for advisor review.</small></p></aside>
    {institution.resources.length > 0 && <section className="stanford-resources"><div className="section-heading"><div><h2>Planning resources</h2></div></div><div>{institution.resources.map((resource) => <a key={resource.id} href={resource.url} target="_blank" rel="noreferrer"><span>{resource.kind === "official" ? `Official ${institution.shortName} source` : "Community tool"}</span><strong>{resource.title}</strong><small>{resource.note}</small></a>)}</div></section>}
  </div>
}
