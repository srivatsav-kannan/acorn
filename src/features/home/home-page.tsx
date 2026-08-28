"use client"

import Link from "next/link"
import { useMemo } from "react"
import { PlanIcon } from "@/components/icons"
import { evaluateDegreePlan, planForTerm } from "@/domain/degree-plan"
import { supportsTimeline, termLabel } from "@/domain/timeline"
import type { Catalog, WorkspaceState } from "@/domain/types"

export const HomePage = ({ workspace, catalog }: { workspace: WorkspaceState, catalog: Catalog }) => {
  const now = useMemo(() => new Date(), [])
  const degree = useMemo(() => evaluateDegreePlan(workspace, catalog, now), [workspace, catalog, now])
  const timelineSupported = supportsTimeline(workspace)
  const plan = planForTerm(workspace, workspace.currentTermId) ?? workspace.plans[0]
  const scenario = plan?.scenarios.find((item) => item.id === plan.activeScenarioId) ?? plan?.scenarios[0]
  const active = scenario?.courses.filter((item) => item.status === "active") ?? []
  const units = active.reduce((sum, item) => sum + item.units, 0)
  const firstName = workspace.profile.name.split(/\s+/).filter(Boolean)[0] ?? ""
  const goal = workspace.contextItems.find((item) => item.type === "goal" && !item.archived)
  const personalItems = workspace.contextItems.filter((item) => item.type !== "goal" && !item.archived)
  const program = workspace.programs.find((item) => item.id === workspace.profile.declaredProgramId)

  return <div className="page home-page home-rebuild">
    <header className="home-heading">
      <div><h1>{firstName ? `Good to see you, ${firstName}.` : "Welcome."}</h1></div>
      <Link className="primary-button" href="/app/plan">{active.length ? "Open my plan" : "Start my plan"}</Link>
    </header>

    {(goal?.summary || workspace.profile.summary) ? <section className="goal-strip">
      <div><span>Current goal</span><h2>{goal?.summary || workspace.profile.summary}</h2></div>
      <Link href="/app/settings">Edit</Link>
    </section> : <section className="goal-strip setup">
      <div><span>Make it yours</span><h2>Add your name and what you want help figuring out.</h2></div>
      <Link href="/app/settings">Open Settings</Link>
    </section>}

    <div className="home-workspace-grid">
      <section className="home-next-step">
        {active.length === 0 ? <>
          <h2>Build a first version of your quarter.</h2>
          <p>Browse the {workspace.institution} catalog and add a few possibilities.</p>
          <div className="next-actions"><Link className="primary-button" href="/app/explore">Browse courses</Link><Link className="secondary-button" href="/app/agent">Plan with an agent</Link></div>
        </> : <>
          <h2>{active.length} course{active.length === 1 ? "" : "s"} in your current plan.</h2>
          <p>{units} units are scheduled. Open the plan to check times, prerequisites, and any missing information.</p>
          <div className="next-actions"><Link className="primary-button" href="/app/plan">Review plan</Link><Link className="secondary-button" href="/app/explore">Add a course</Link></div>
        </>}
      </section>

      <section className="home-plan-summary">
        <div className="section-heading"><div><h2>{plan ? plan.title : termLabel(workspace.currentTermId)}</h2></div><Link href="/app/plan">Open</Link></div>
        <div className="home-plan-numbers"><strong>{units}</strong><span>units</span><strong>{active.length}</strong><span>courses</span></div>
        {active.length === 0 ? <div className="compact-empty"><span><PlanIcon width={19} height={19} /></span><p><strong>Nothing scheduled yet.</strong><small>The catalog is one tab over.</small></p></div> : <ul className="home-course-list">{active.slice(0, 4).map((item) => { const course = catalog.courses.find((candidate) => candidate.id === item.courseId); return <li key={item.id}><b>{course?.code ?? item.courseId}</b><span>{course?.title ?? "Course"}</span><em>{item.units}</em></li> })}</ul>}
        {timelineSupported && <p className="home-degree-line">{degree.projectedUnits} of {degree.requiredUnits} units planned or complete toward the {degree.timeline.degree}. <Link href="/app/plan">Degree map</Link></p>}
      </section>

      <section className="home-context-summary">
        <div className="section-heading"><div><h2>Your context</h2></div><Link href="/app/library" aria-label="Open Library">Library</Link></div>
        <dl>
          <div><dt>Program</dt><dd>{program ? program.name : "Not chosen"}</dd></div>
          <div><dt>Completed courses</dt><dd>{workspace.profile.completedCourseIds.length || "None added"}</dd></div>
          <div><dt>AP and transfer credits</dt><dd>{(workspace.profile.apCredits ?? []).length || "None added"}</dd></div>
          <div><dt>Notes and research</dt><dd>{personalItems.length || "None yet"}</dd></div>
          <div><dt>Planning priorities</dt><dd>{workspace.profile.preferences.length || "None yet"}</dd></div>
        </dl>
        <Link className="text-button" href="/app/settings">Settings</Link>
      </section>

    </div>
  </div>
}
