import Link from "next/link"
import { AcornMark } from "@/components/icons"
import { Reveal } from "@/components/reveal"
import { buildStanfordCatalog, stanfordCatalogMeta } from "@/data/institutions/stanford"
import { listInstitutionChoices } from "@/data/institutions/registry"
import { standingForTerm, termSequence } from "@/domain/timeline"

const readTools: Array<[string, string]> = [
  ["search_workspace", "Searches saved context and names real gaps."],
  ["get_planning_context", "Goals, constraints, history, and current versions."],
  ["search_courses", "Full catalog search with section times."],
  ["get_plan", "Scenarios, courses, and commitments for any term."],
  ["check_plan", "Deterministic conflict and prerequisite checks."],
  ["get_program_progress", "Requirement-by-requirement degree evaluation."]
]

const writeTools: Array<[string, string]> = [
  ["export_context", "Pages the whole workspace out as markdown."],
  ["ingest_context", "Files handed-over context into the scratchpad."],
  ["edit_plan", "Atomic schedule changes with receipts."],
  ["manage_todo", "Adds and completes todos."],
  ["manage_event", "Dated, timed, timezone-aware events."],
  ["manage_activity", "Recurring commitments outside the catalog."],
  ["set_interest", "Marks courses and clubs interesting."],
  ["annotate_course", "Attributed notes on any course."],
  ["save_research", "Findings filed with sources and dates."],
  ["save_workspace_item", "Notes, tasks, people, and decisions."],
  ["update_student_context", "Identity, hours, preferences, and history."],
  ["extend_reference", "Adds or amends courses and programs."],
  ["configure_view", "Composes saved views from safe blocks."],
  ["undo", "Reverses any recent mutation by receipt."]
]

// Recognizable courses for the ticker, resolved against the real import so
// every code, title, and unit count on this page is catalog truth.
const tickerCodes = ["CS 106A", "CS 106B", "MATH 51", "CS 107", "PHYSICS 41", "ECON 1", "CS 109", "PSYCH 1", "CS 148", "ENGR 40M", "PHIL 80", "CS 161", "CME 100", "CS 229", "EARTHSYS 10", "MS&E 178"]

const importedOn = new Date(stanfordCatalogMeta.retrievedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })

export const LandingPage = ({ signedIn = false }: { signedIn?: boolean }) => {
  const catalog = buildStanfordCatalog()
  const byCode = new Map(catalog.courses.map((course) => [course.code, course]))
  const tickerCourses = tickerCodes.map((code) => byCode.get(code)).filter((course) => course !== undefined)
  const quarters = termSequence("TERM-2026-AUTUMN", "TERM-2030-SPRING")
  const years = [0, 1, 2, 3].map((offset) => quarters.filter((quarter) => quarter.academicYearStart === 2026 + offset))
  const timeline = { entryTermId: "TERM-2026-AUTUMN", expectedGraduationTermId: "TERM-2030-SPRING", degree: "BS" }
  const institutionChoices = listInstitutionChoices()
  const enterHref = signedIn ? "/app" : "/signup"
  const enterLabel = signedIn ? "Open your workspace" : "Start planning"

  return <main className="public-page">
    <header className="public-header">
      <Link className="wordmark" href="/"><AcornMark className="wordmark-acorn" />Acorn</Link>
      <nav aria-label="Public">
        <a href="#premise">How it works</a>
        <a href="#agents">For agents</a>
        <Link href="/login">Log in</Link>
        <Link className="primary-button" href={enterHref}><span className="cta-long">{enterLabel}</span><span className="cta-short">{signedIn ? "Open" : "Start"}</span></Link>
      </nav>
    </header>

    <section className="hero">
      <h1>Plan every quarter to graduation in a workspace <em>your agent</em> shares.</h1>
      <p className="hero-lead">Acorn keeps the complete {stanfordCatalogMeta.academicYear} Stanford catalog, your requirements, your history, and the reasoning behind each choice in one durable workspace. An agent working with you reads and edits that same workspace through twenty WebMCP tools, and each change it makes arrives attributed, inspectable, and reversible.</p>
      <div className="hero-actions">
        <Link className="primary-button" href={enterHref}>{enterLabel}</Link>
        <a className="secondary-button" href="#agents">How agents work here</a>
      </div>
      <p className="hero-note">Creating an account is free, and your workspace follows your email to any device. Enrollment itself always happens through your university&apos;s own system.</p>
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
        <h2>Your context stays where you can see it.</h2>
        <p>Preferences, sources, open questions, and decisions live in the workspace itself, so the research behind a choice is still attached to it a quarter later. When you or your agent search, saved context answers first, and a genuine gap becomes a visible open question that either of you can resolve.</p>
      </article></Reveal>
      <Reveal><article>
        <span>02</span>
        <h2>You and your agent edit through the same commands.</h2>
        <p>A click in the interface and an agent tool call run the same semantic command, with the same validation, the same receipt, and the same undo. The activity ledger records who changed what, so you can hand your agent real editing power and still review or reverse any outcome.</p>
      </article></Reveal>
      <Reveal><article>
        <span>03</span>
        <h2>The degree math is computed, so both of you can rely on it.</h2>
        <p>Quarter ordering, unit totals, prerequisite checks, schedule conflicts, and class standing all come from a deterministic timeline engine. Your agent reads the same results you see, which keeps its recommendations consistent with your actual requirements.</p>
      </article></Reveal>
    </section>

    <Reveal><section className="timeline-band">
      <h2>Two dates define your whole map.</h2>
      <p>Your entry year and graduation year come from onboarding, and the engine derives everything between them: every quarter, your standing in each one, unit targets for a bachelor&apos;s or a coterm, and sequencing checks that reach across years. This is the map it builds for a student entering in autumn 2026.</p>
      <div className="quarter-rail">
        {years.map((yearQuarters, index) => <div className="quarter-rail-year" key={index}>
          <div className="quarter-rail-head"><b>Year {index + 1}</b><span>{standingForTerm(timeline, yearQuarters[0].id)}</span></div>
          <ul>{yearQuarters.map((quarter) => <li key={quarter.id}>{quarter.season[0]}{quarter.season.slice(1).toLowerCase()} {quarter.year}</li>)}</ul>
        </div>)}
      </div>
    </section></Reveal>

    <Reveal><section id="agents" className="webmcp-band">
      <div>
        <h2>Agents work here through twenty real tools.</h2>
        <p>Acorn registers its planning tools directly in the page through WebMCP, so an agent working beside you can search your saved context, check a plan against the engine, file research with its sources, and extend the institutional reference when something is missing. Because those tools run through the same command path as your own clicks, every agent edit lands in the ledger with attribution and an undo.</p>
        <p>Read tools carry a read-only annotation, and write tools require the workspace version they started from, so an agent holding stale state receives a clean conflict and retries with fresh context.</p>
      </div>
      <div className="tool-manifest">
        <header><b>Registered tools</b><span>document.modelContext</span></header>
        <ul>
          {[...readTools, ...writeTools].map(([name, note]) => <li key={name}><code>{name}</code><span>{note}</span></li>)}
        </ul>
      </div>
    </section></Reveal>

    <Reveal><section className="institution-band">
      <h2>The complete Stanford catalog ships inside.</h2>
      <p>Every course in the {stanfordCatalogMeta.academicYear} catalog is imported and searchable: {stanfordCatalogMeta.courses.toLocaleString()} courses across {stanfordCatalogMeta.departments} departments, with published section times, WAYS designations, requirement maps, and a directory of clubs and research programs. The same reference model is designed to carry other universities, and a student at a school without a shipped pack can have their agent research it and build the reference with sources.</p>
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
      <span>Catalog imported from Stanford Navigator on {importedOn}.</span>
      <span>Independent project, not affiliated with Stanford University.</span>
    </footer>
  </main>
}
