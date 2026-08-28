import Link from "next/link"
import { Reveal } from "@/components/reveal"
import { buildStanfordCatalog, stanfordCatalogMeta } from "@/data/institutions/stanford"
import { listInstitutionChoices } from "@/data/institutions/registry"
import { standingForTerm, termSequence } from "@/domain/timeline"

const readTools: Array<[string, string]> = [
  ["search_workspace", "Search saved context before searching the world."],
  ["get_planning_context", "Goals, constraints, history, and current versions."],
  ["search_courses", "The full catalog with live section data."],
  ["get_plan", "Scenarios, courses, and commitments for any term."],
  ["check_plan", "Deterministic conflict and prerequisite checks."],
  ["get_program_progress", "Requirement-by-requirement degree evaluation."]
]

const writeTools: Array<[string, string]> = [
  ["edit_plan", "Atomic schedule changes with receipts."],
  ["save_research", "Findings filed with sources and retrieval dates."],
  ["save_workspace_item", "Notes, tasks, people, and decisions."],
  ["update_student_context", "Preferences, history, and constraints."],
  ["extend_reference", "Add or amend courses, sections, and programs."],
  ["configure_view", "Compose saved views from safe blocks."]
]

// Recognizable courses for the ticker, resolved against the real import so
// every code, title, and unit count on this page is catalog truth.
const tickerCodes = ["CS 106A", "CS 106B", "MATH 51", "CS 107", "PHYSICS 41", "ECON 1", "CS 109", "PSYCH 1", "CS 148", "ENGR 40M", "PHIL 80", "CS 161", "CME 100", "CS 229", "EARTHSYS 10", "MS&E 178"]

const importedOn = new Date(stanfordCatalogMeta.retrievedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })

export const LandingPage = ({ hasWorkspace = false }: { hasWorkspace?: boolean }) => {
  const catalog = buildStanfordCatalog()
  const byCode = new Map(catalog.courses.map((course) => [course.code, course]))
  const tickerCourses = tickerCodes.map((code) => byCode.get(code)).filter((course) => course !== undefined)
  const quarters = termSequence("TERM-2026-AUTUMN", "TERM-2030-SPRING")
  const years = [0, 1, 2, 3].map((offset) => quarters.filter((quarter) => quarter.academicYearStart === 2026 + offset))
  const timeline = { entryTermId: "TERM-2026-AUTUMN", expectedGraduationTermId: "TERM-2030-SPRING", degree: "BS" }
  const institutionChoices = listInstitutionChoices()
  const enterHref = hasWorkspace ? "/app" : "/start"
  const enterLabel = hasWorkspace ? "Open your workspace" : "Start planning"

  return <main className="public-page">
    <header className="public-header">
      <Link className="wordmark" href="/">CourseContext<i aria-hidden="true">.</i></Link>
      <nav aria-label="Public">
        <a href="#premise">How it works</a>
        <a href="#agents">For agents</a>
        <Link href="/login">Sign in</Link>
        <Link className="primary-button" href={enterHref}><span className="cta-long">{enterLabel}</span><span className="cta-short">{hasWorkspace ? "Open" : "Start"}</span></Link>
      </nav>
    </header>

    <section className="hero">
      <h1>Four years is twelve quarters.<br />Plan <em>all</em> of them.</h1>
      <p className="hero-lead">CourseContext is an academic workspace with the memory for it: the complete {stanfordCatalogMeta.academicYear} Stanford catalog, your requirements, your history, and the reasons behind every choice. Your agent works in the same workspace through twelve WebMCP tools, and everything it changes is attributed, inspectable, and undoable.</p>
      <div className="hero-actions">
        <Link className="primary-button" href={enterHref}>{enterLabel}</Link>
        <a className="secondary-button" href="#agents">How agents work here</a>
      </div>
      <p className="hero-note">Free, and it cannot enroll you in anything. It plans; you register.</p>
    </section>

    <div className="ticker-band" aria-hidden="true">
      <div className="ticker-track">
        {[0, 1].map((copy) => <div className="ticker-run" key={copy}>
          {tickerCourses.map((course) => <span className="ticker-item" key={`${copy}-${course.id}`}><b>{course.code}</b>{course.title}<em>{course.minUnits === course.maxUnits ? `${course.maxUnits} units` : `${course.minUnits} to ${course.maxUnits} units`}</em></span>)}
        </div>)}
      </div>
    </div>

    <section id="premise" className="principles">
      <Reveal><article>
        <span>01</span>
        <h2>Chat forgets. The workspace does not.</h2>
        <p>Preferences, sources, open questions, and decisions live in an inspectable workspace instead of scrolling away inside a transcript. When you or your agent search, saved context answers first, and real gaps are named instead of papered over.</p>
      </article></Reveal>
      <Reveal><article>
        <span>02</span>
        <h2>One command path, two hands on it.</h2>
        <p>A human click and an agent tool call run the same semantic command, with the same validation, the same receipt, and the same undo. The activity ledger records who changed what, and nothing edits the page by pretending to be you.</p>
      </article></Reveal>
      <Reveal><article>
        <span>03</span>
        <h2>Deterministic where it matters.</h2>
        <p>Quarter arithmetic, unit totals, prerequisite and conflict checks, and class standing are computed by the timeline engine, never guessed by a model. Your agent reads exactly the numbers you see.</p>
      </article></Reveal>
    </section>

    <Reveal><section className="timeline-band">
      <h2>Autumn 2026 to Spring 2030, laid out.</h2>
      <p>Entry year and graduation year define the whole map. The engine derives every quarter in between, your standing in each, unit targets, and cross-term sequencing checks, for four-year degrees and five-year coterms alike.</p>
      <div className="quarter-rail">
        {years.map((yearQuarters, index) => <div className="quarter-rail-year" key={index}>
          <div className="quarter-rail-head"><b>Year {index + 1}</b><span>{standingForTerm(timeline, yearQuarters[0].id)}</span></div>
          <ul>{yearQuarters.map((quarter) => <li key={quarter.id}>{quarter.season[0]}{quarter.season.slice(1).toLowerCase()} {quarter.year}</li>)}</ul>
        </div>)}
      </div>
    </section></Reveal>

    <Reveal><section id="agents" className="webmcp-band">
      <div>
        <h2>The page itself is the tool surface.</h2>
        <p>CourseContext registers twelve planning tools in the browser through WebMCP&apos;s <code>document.modelContext</code>. An agent sitting next to you reads your saved context, checks plans against deterministic rules, and files research where you can find it. No pixel scraping, no pretending to click.</p>
        <p>Reads are annotated read-only. Writes require the workspace version they were based on, so a stale agent conflicts instead of clobbering, exactly like a second human editor would.</p>
      </div>
      <div className="tool-manifest">
        <header><b>Registered tools</b><span>document.modelContext</span></header>
        <ul>
          {[...readTools, ...writeTools].map(([name, note]) => <li key={name}><code>{name}</code><span>{note}</span></li>)}
        </ul>
      </div>
    </section></Reveal>

    <Reveal><section className="institution-band">
      <h2>Stanford today, in full.</h2>
      <p>Every course in the {stanfordCatalogMeta.academicYear} catalog is imported and searchable: {stanfordCatalogMeta.courses.toLocaleString()} courses across {stanfordCatalogMeta.departments} departments, with published section times, WAYS designations, requirement maps, and a directory of clubs and research programs. Other universities plug into the same reference model, and at a school without a shipped pack your agent builds the reference itself, visibly and with sources.</p>
      <ul className="institution-table">
        {institutionChoices.map((choice) => <li key={choice.id}>
          <b>{choice.status === "custom" ? "Another university" : choice.shortName}</b>
          <span>{choice.status === "full" ? "Full catalog import, sections, WAYS, programs, clubs, and research." : choice.status === "custom" ? "Named at onboarding; the reference is agent-built." : "Maps onto the same reference model."}</span>
          <em className={choice.status === "full" ? "live" : choice.status === "custom" ? "beta" : ""}>{choice.status === "full" ? "Available" : choice.status === "custom" ? "Beta" : "Planned"}</em>
        </li>)}
      </ul>
    </section></Reveal>

    <footer className="public-footer">
      <span>Built for the WebMCP Challenge.</span>
      <span>Catalog imported from ExploreCourses on {importedOn}.</span>
      <span>Independent project, not affiliated with Stanford University.</span>
    </footer>
  </main>
}
