import Link from "next/link"
import { listInstitutionChoices } from "@/data/institutions/registry"

const readTools: Array<[string, string]> = [
  ["search_workspace", "read saved context first"],
  ["get_planning_context", "goals, constraints, versions"],
  ["search_courses", "catalog and current sections"],
  ["get_plan", "scenarios and commitments"],
  ["check_plan", "deterministic conflict checks"],
  ["get_program_progress", "requirement evaluation"]
]

const writeTools: Array<[string, string]> = [
  ["edit_plan", "atomic schedule changes"],
  ["save_research", "sourced findings, visibly filed"],
  ["save_workspace_item", "notes, tasks, people, decisions"],
  ["update_student_context", "preferences and constraints"],
  ["extend_reference", "add missing courses and programs"],
  ["configure_view", "safe block-based views"]
]

export const LandingPage = () => {
  const allChoices = listInstitutionChoices()
  const institutionChoices = [...allChoices.filter((choice) => choice.status === "full").slice(0, 1), ...allChoices.filter((choice) => choice.status === "planned").slice(0, 3), ...allChoices.filter((choice) => choice.status === "custom")]
  return <main className="public-page">
    <header className="public-header">
      <Link className="wordmark" href="/"><span className="wordmark-mark">C</span><span>CourseContext</span></Link>
      <nav aria-label="Public"><a href="#how">How it works</a><a href="#agents">For agents</a><a href="/login">Sign in</a></nav>
    </header>

    <section className="hero">
      <div className="hero-copy">
        <p className="eyebrow">Course planning, with context that lasts</p>
        <h1>An academic workspace you and your agent <em>actually share</em>.</h1>
        <p className="hero-lead">Plan every quarter to graduation, track degree progress, and keep the research behind each decision. Your agent reads the same workspace you see and makes changes you can inspect and undo.</p>
        <div className="hero-actions"><a className="primary-button" href="/demo">Demo login</a><a className="secondary-button" href="/login">Create a workspace</a></div>
        <p className="trust-note">No university login required. Nothing is submitted anywhere on your behalf.</p>
      </div>
      <div className="hero-product" aria-label="CourseContext product preview">
        <div className="preview-bar"><span className="wordmark-mark">C</span><b>Autumn plan</b><span>15 units</span></div>
        <div className="preview-body">
          <div className="preview-list">
            <p>Primary scenario</p>
            <div><i className="course-color red" /><span><b>CS 106B</b><small>Programming Abstractions</small></span><em>5</em></div>
            <div><i className="course-color blue" /><span><b>MATH 51</b><small>Linear Algebra and Applications</small></span><em>5</em></div>
            <div><i className="course-color gold" /><span><b>DESIGN 60</b><small>Design Foundations</small></span><em>2</em></div>
          </div>
          <div className="preview-calendar"><span>MON</span><span>TUE</span><span>WED</span><span>THU</span><div className="preview-event event-one">CS 106B</div><div className="preview-event event-two">MATH 51</div><div className="preview-event event-three">DESIGN 60</div></div>
        </div>
        <div className="preview-agent"><span>✓</span><p><b>Plan check complete</b><small>No hard conflicts. Friday remains open.</small></p></div>
      </div>
    </section>

    <section id="how" className="principles">
      <article><span>01</span><h2>Context that lasts</h2><p>Preferences, sources, ideas, and decisions live in one inspectable workspace instead of disappearing inside a chat transcript.</p></article>
      <article><span>02</span><h2>One action model</h2><p>Every human click and agent edit uses the same semantic command, validation, receipt, and undo path. You always see who changed what.</p></article>
      <article><span>03</span><h2>Research with provenance</h2><p>The agent searches what you already know first, labels information gaps, and saves useful findings with sources and retrieval dates.</p></article>
    </section>

    <section id="agents" className="webmcp-band">
      <div>
        <p className="eyebrow">Built on WebMCP</p>
        <h2>The page itself is the tool surface.</h2>
        <p>CourseContext registers twelve planning tools in the browser through WebMCP. An agent working with you reads your context, checks plans against deterministic rules, and files research where you can find it. No pixel scraping, no filter clicking.</p>
      </div>
      <div className="tool-manifest">
        <header><b>Registered tools</b><span>document.modelContext</span></header>
        <ul>
          {[...readTools, ...writeTools].map(([name, note]) => <li key={name}><code>{name}</code><span>{note}</span></li>)}
        </ul>
      </div>
    </section>

    <section className="institution-band">
      <p className="eyebrow">Institutional context</p>
      <h2>Stanford today. Built to travel.</h2>
      <p>Every course in the 2026-27 Stanford catalog is imported and searchable, with requirement maps, WAYS tracking, and a club and research directory. Other universities plug into the same model, and your agent fills what is missing.</p>
      <div className="institution-grid">
        {institutionChoices.slice(0, 5).map((choice) => <article key={choice.id}>
          <span className={choice.status === "full" ? "institution-status live" : choice.status === "custom" ? "institution-status beta" : "institution-status"}>{choice.status === "full" ? "Available" : choice.status === "custom" ? "Beta" : "Planned"}</span>
          <h3>{choice.status === "custom" ? "Your school" : choice.shortName}</h3>
          <p>{choice.status === "full" ? "Full 2026-27 catalog import, requirement maps, WAYS, clubs, and research." : choice.status === "custom" ? "Name your university and your agent researches and builds its reference." : "Public catalog maps onto the same reference model."}</p>
        </article>)}
      </div>
    </section>

    <footer className="public-footer"><span>Built for the WebMCP Challenge</span><span>Not an official Stanford University product.</span></footer>
  </main>
}
