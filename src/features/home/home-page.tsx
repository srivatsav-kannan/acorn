"use client"

import Link from "next/link"
import { PlanIcon } from "@/components/icons"
import type { Catalog, WorkspaceState } from "@/domain/types"

export const HomePage = ({ workspace, catalog }: { workspace: WorkspaceState, catalog: Catalog }) => {
  const plan = workspace.plans[0]
  const scenario = plan?.scenarios.find((item) => item.id === plan.activeScenarioId) ?? plan?.scenarios[0]
  const active = scenario?.courses.filter((item) => item.status === "active") ?? []
  const units = active.reduce((sum, item) => sum + item.units, 0)
  const firstName = workspace.profile.name.split(/\s+/)[0] || "there"
  const goal = workspace.contextItems.find((item) => item.type === "goal" && !item.archived)
  const personalItems = workspace.contextItems.filter((item) => item.type !== "goal" && !item.archived)
  const program = workspace.programs.find((item) => item.id === workspace.profile.declaredProgramId)

  return <div className="page home-page home-rebuild">
    <header className="home-heading">
      <div><p className="eyebrow">Your workspace</p><h1>Good to see you, {firstName}.</h1><p>Keep the question, the evidence, and the plan in one place.</p></div>
      <Link className="primary-button" href="/app/plan">{active.length ? "Open my plan" : "Start my plan"}</Link>
    </header>

    <section className="goal-strip">
      <div><span>Current goal</span><h2>{goal?.summary || workspace.profile.summary || "Add what you want help figuring out."}</h2></div>
      <Link href="/app/settings">Edit</Link>
    </section>

    <div className="home-workspace-grid">
      <section className="home-next-step">
        <p className="eyebrow">Best next step</p>
        {active.length === 0 ? <>
          <h2>Build a first version of your quarter.</h2>
          <p>Browse Stanford courses and add a few possibilities. You can set a major, unit limit, and time constraints when they become useful.</p>
          <div className="next-actions"><Link className="primary-button" href="/app/explore">Browse Stanford</Link><Link className="secondary-button" href="/app/agent">Plan with an agent</Link></div>
        </> : <>
          <h2>{active.length} course{active.length === 1 ? "" : "s"} in your current plan.</h2>
          <p>{units} units are scheduled. Open the plan to check times, prerequisites, and any missing information.</p>
          <div className="next-actions"><Link className="primary-button" href="/app/plan">Review plan</Link><Link className="secondary-button" href="/app/explore">Add a course</Link></div>
        </>}
      </section>

      <section className="home-plan-summary">
        <div className="section-heading"><div><p className="eyebrow">Autumn 2026</p><h2>Current plan</h2></div><Link href="/app/plan">Open</Link></div>
        <div className="home-plan-numbers"><strong>{units}</strong><span>units</span><strong>{active.length}</strong><span>courses</span></div>
        {active.length === 0 ? <div className="compact-empty"><span><PlanIcon width={19} height={19} /></span><p><strong>Your schedule is empty.</strong><small>Add only the courses you choose.</small></p></div> : <ul className="home-course-list">{active.slice(0, 4).map((item) => { const course = catalog.courses.find((candidate) => candidate.id === item.courseId); return <li key={item.id}><b>{course?.code ?? item.courseId}</b><span>{course?.title ?? "Course"}</span><em>{item.units}</em></li> })}</ul>}
      </section>

      <section className="home-context-summary">
        <div className="section-heading"><div><p className="eyebrow">Remembered here</p><h2>Your context</h2></div><Link href="/app/library" aria-label="Open Library">Library</Link></div>
        <dl>
          <div><dt>Program</dt><dd>{program ? program.name : "Not chosen"}</dd></div>
          <div><dt>Completed courses</dt><dd>{workspace.profile.completedCourseIds.length || "None added"}</dd></div>
          <div><dt>Notes and research</dt><dd>{personalItems.length || "None yet"}</dd></div>
          <div><dt>Planning priorities</dt><dd>{workspace.profile.preferences.length || "None yet"}</dd></div>
        </dl>
        <Link className="text-button" href="/app/settings">Add context when it matters</Link>
      </section>

      <section className="home-collaboration">
        <div className="collaboration-mark">C</div>
        <div><p className="eyebrow">Shared with your agent</p><h2>No copy and paste required.</h2><p>Your agent can read this workspace, add sourced research, and edit your plan. Every change appears here with a clear label and undo.</p></div>
        <Link className="secondary-button" href="/app/agent">How it works</Link>
      </section>
    </div>
  </div>
}
