import Link from "next/link"
import { AcornMark, AcornSquirrelMark } from "@/components/icons"
import { Reveal } from "@/components/reveal"
import { UseCaseCarousel } from "@/features/landing/use-case-carousel"
import { stanfordCatalogMeta } from "@/data/institutions/stanford"

const readTools: Array<[string, string]> = [
  ["search_workspace", "Searches saved context and names real gaps."],
  ["get_planning_context", "Goals, constraints, history, and current versions."],
  ["search_courses", "Full catalog search with section times."],
  ["get_plan", "Scenarios, courses, and commitments for any term."],
  ["check_plan", "Deterministic conflict and prerequisite checks."],
  ["suggest_sections", "Ranked section assignments that clear every constraint."],
  ["get_program_progress", "Requirement-by-requirement degree evaluation."]
]

const writeTools: Array<[string, string]> = [
  ["export_context", "Pages the whole workspace out as markdown."],
  ["ingest_context", "Files handed-over context into the scratchpad."],
  ["edit_plan", "Atomic schedule changes with receipts."],
  ["manage_todo", "Adds and completes todos."],
  ["manage_event", "Dated, timed, timezone-aware events."],
  ["manage_activity", "Clubs and recurring commitments, straight to the calendar."],
  ["set_interest", "Marks courses and clubs interesting."],
  ["annotate_course", "Attributed notes on any course."],
  ["save_research", "Findings filed with sources and dates."],
  ["save_workspace_item", "Notes, tasks, people, and decisions."],
  ["update_student_context", "Identity, hours, preferences, and history."],
  ["extend_reference", "Adds or amends courses and programs."],
  ["configure_view", "Composes saved views from safe blocks."],
  ["undo", "Reverses any recent mutation by receipt."],
  ["manage_goal", "Goals with milestones linked to todos."]
]

// A dozen little acorns drifting down behind the page, deterministic so the
// server and client render the same rain.
const acornRain: Array<{ left: number, size: number, delay: number, duration: number, tilt: number }> = [
  { left: 4, size: 20, delay: 0, duration: 46, tilt: -14 },
  { left: 12, size: 15, delay: 11, duration: 58, tilt: 22 },
  { left: 21, size: 24, delay: 24, duration: 41, tilt: 8 },
  { left: 30, size: 14, delay: 5, duration: 63, tilt: -28 },
  { left: 38, size: 18, delay: 31, duration: 49, tilt: 15 },
  { left: 47, size: 13, delay: 17, duration: 66, tilt: -8 },
  { left: 55, size: 22, delay: 38, duration: 44, tilt: 30 },
  { left: 63, size: 16, delay: 8, duration: 57, tilt: -20 },
  { left: 71, size: 20, delay: 27, duration: 52, tilt: 12 },
  { left: 79, size: 14, delay: 44, duration: 61, tilt: -16 },
  { left: 87, size: 23, delay: 14, duration: 47, tilt: 25 },
  { left: 94, size: 16, delay: 34, duration: 55, tilt: -10 },
  { left: 8, size: 17, delay: 40, duration: 53, tilt: 18 },
  { left: 17, size: 21, delay: 2, duration: 60, tilt: -24 },
  { left: 26, size: 15, delay: 48, duration: 45, tilt: 10 },
  { left: 34, size: 22, delay: 20, duration: 56, tilt: -6 },
  { left: 43, size: 16, delay: 52, duration: 48, tilt: 26 },
  { left: 51, size: 20, delay: 9, duration: 64, tilt: -18 },
  { left: 59, size: 14, delay: 29, duration: 51, tilt: 6 },
  { left: 67, size: 24, delay: 45, duration: 58, tilt: -30 },
  { left: 75, size: 15, delay: 6, duration: 43, tilt: 20 },
  { left: 83, size: 19, delay: 36, duration: 62, tilt: -12 },
  { left: 91, size: 14, delay: 22, duration: 50, tilt: 14 },
  { left: 98, size: 18, delay: 50, duration: 54, tilt: -22 }
]

const importedOn = new Date(stanfordCatalogMeta.retrievedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })

export const LandingPage = ({ signedIn = false }: { signedIn?: boolean }) => {
  const enterHref = signedIn ? "/app" : "/signup"
  const enterLabel = signedIn ? "Open your workspace" : "Start planning"

  return <main className="public-page">
    <div className="acorn-rain" aria-hidden="true">
      {acornRain.map((drop, index) => <span key={index} style={{ left: `${drop.left}%`, width: drop.size, animationDelay: `${drop.delay * -1}s`, animationDuration: `${drop.duration}s`, ["--tilt" as string]: `${drop.tilt}deg` }}><AcornMark width={drop.size} height={drop.size} /></span>)}
    </div>
    <header className="public-header">
      <Link className="wordmark" href="/"><AcornSquirrelMark className="wordmark-acorn" />Acorn</Link>
      <nav aria-label="Public">
        <a href="#premise">How it works</a>
        <a href="#agents">For agents</a>
        <Link href="/login">Log in</Link>
        <Link className="primary-button" href={enterHref}><span className="cta-long">{enterLabel}</span><span className="cta-short">{signedIn ? "Open" : "Start"}</span></Link>
      </nav>
    </header>

    <section id="premise" className="hero">
      <h1>Plan every quarter to graduation in a workspace <em>your agent</em> shares.</h1>
      <p className="hero-lead">Acorn is one workspace where you and your agent plan your Stanford degree together, on top of all {stanfordCatalogMeta.courses.toLocaleString()} courses in the {stanfordCatalogMeta.academicYear} catalog. Your constraints and your reasoning stay put between chats, and anything the agent changes, you can see and undo.</p>
      <div className="hero-actions">
        <Link className="primary-button" href={enterHref}>{enterLabel}</Link>
        <a className="secondary-button" href="#agents">How agents work here</a>
      </div>
    </section>

    <Reveal><UseCaseCarousel /></Reveal>

    <Reveal><section id="agents" className="webmcp-band">
      <div>
        <h2>Agents get twenty-two real tools.</h2>
        <p>The page registers them straight into the browser through WebMCP. An agent working next to you searches your saved context, runs the same schedule checks you see, and files its research with sources attached. Its calls go through the same commands as your clicks, which is why everything it does shows up with a receipt you can reverse.</p>
      </div>
      <div className="tool-manifest">
        <header><b>Registered tools</b><span>document.modelContext</span></header>
        <ul>
          {[...readTools, ...writeTools].map(([name, note]) => <li key={name}><code>{name}</code><span>{note}</span></li>)}
        </ul>
      </div>
    </section></Reveal>

    <footer className="public-footer">
      <span>Built for the WebMCP Challenge.</span>
      <span>Catalog imported from Stanford Navigator on {importedOn}.</span>
      <span>Independent project, not affiliated with Stanford University.</span>
    </footer>
  </main>
}
