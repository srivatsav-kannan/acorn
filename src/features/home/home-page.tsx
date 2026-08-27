"use client"

import type { Catalog, WorkspaceState } from "@/domain/types"

export const HomePage = ({ workspace, catalog }: { workspace: WorkspaceState, catalog: Catalog }) => {
  const scenario = workspace.plans[0].scenarios[0]
  const active = scenario.courses.filter((item) => item.status === "active")
  const units = active.reduce((sum, item) => sum + item.units, 0)
  return <div className="page home-page"><header className="home-heading"><div><p className="eyebrow">Thursday, August 27</p><h1>Good evening, Alex.</h1><p>Your Autumn plan is coherent. There is one research gap worth resolving next.</p></div><button className="primary-button">Ask the workspace</button></header>
    <div className="home-grid"><section className="home-plan-card"><div className="section-heading"><div><p className="eyebrow">Active plan</p><h2>Autumn quarter</h2></div><a href="/app/plan" aria-label="Open active quarter">Open →</a></div><div className="plan-metric"><strong>{units}</strong><span>units across<br/>{active.length} courses</span></div><div className="mini-courses">{active.map((item, index) => { const course = catalog.courses.find((found) => found.id === item.courseId)!; return <div key={item.id}><i className={`course-color ${["red", "blue", "gold", "green"][index]}`} /><span><b>{course.code}</b><small>{course.title}</small></span><em>{item.units}</em></div> })}</div></section>
      <section className="home-focus"><p className="eyebrow">Current focus</p><h2>Build a CS foundation without losing design and research time.</h2><div className="focus-tags"><span>CS-first</span><span>Friday open</span><span>Design practice</span></div><a href="/app/settings">Edit student context →</a></section>
      <section className="home-gap"><div className="gap-icon">?</div><div><p className="eyebrow">Open question</p><h2>{workspace.uncertainties[0].title}</h2><p>{workspace.uncertainties[0].question}</p><button className="secondary-button">Ask agent to research</button></div></section>
      <section className="home-recent"><div className="section-heading"><div><h2>Recent context</h2><span className="count-badge">{workspace.contextItems.length}</span></div><a href="/app/library" aria-label="Open recent context">View all →</a></div>{workspace.contextItems.map((item) => <article key={item.id}><span className="type-icon">{item.type === "person" ? "P" : "✦"}</span><div><b>{item.title}</b><p>{item.summary}</p><small>{item.addedBy?.type === "agent" ? "Added by agent" : "Added by you"}</small></div></article>)}</section>
    </div></div>
}
