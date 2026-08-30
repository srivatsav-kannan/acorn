import Link from "next/link"
import { AcornSquirrelMark } from "@/components/icons"
import { Reveal } from "@/components/reveal"
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

const importedOn = new Date(stanfordCatalogMeta.retrievedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })

export const LandingPage = ({ signedIn = false }: { signedIn?: boolean }) => {
  const enterHref = signedIn ? "/app" : "/signup"
  const enterLabel = signedIn ? "Open your workspace" : "Start planning"

  return <main className="public-page">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img className="landing-mark landing-mark-hero" src="/acorn-squirrel-mark.png" alt="" aria-hidden="true" />
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img className="landing-mark landing-mark-low" src="/acorn-squirrel-mark.png" alt="" aria-hidden="true" />
    <header className="public-header">
      <Link className="wordmark" href="/"><AcornSquirrelMark className="wordmark-acorn" />Acorn</Link>
      <nav aria-label="Public">
        <a href="#premise">How it works</a>
        <a href="#agents">For agents</a>
        <Link href="/login">Log in</Link>
        <Link className="primary-button" href={enterHref}><span className="cta-long">{enterLabel}</span><span className="cta-short">{signedIn ? "Open" : "Start"}</span></Link>
      </nav>
    </header>

    <section className="hero">
      <h1>Plan every quarter to graduation in a workspace <em>your agent</em> shares.</h1>
      <p className="hero-lead">Your courses, constraints, clubs, and the reasons behind each choice live in one place, and your agent works on the same plan you see through twenty-two WebMCP tools. Whatever it changes lands on your calendar with a receipt you can undo.</p>
      <div className="hero-actions">
        <Link className="primary-button" href={enterHref}>{enterLabel}</Link>
        <a className="secondary-button" href="#agents">How agents work here</a>
      </div>
    </section>

    <Reveal><section className="use-band" aria-label="What this is for">
      <article>
        <h2>Braindump, get a schedule.</h2>
        <p>Tell your agent everything at once: the hard constraints, the maybes, the club your roommate keeps mentioning. It files each piece where it belongs and hands back a quarter that actually fits.</p>
      </article>
      <article>
        <h2>Tired of re-explaining yourself?</h2>
        <p>A chat forgets the moment it ends. This workspace holds your plan, your history, and the why behind both, so every new conversation starts already caught up.</p>
      </article>
      <article>
        <h2>See everything it does.</h2>
        <p>Agent edits land on the same calendar and plan you use, each one attributed and inspectable, and one click reverses anything you disagree with.</p>
      </article>
    </section></Reveal>

    <section id="premise" className="principles">
      <Reveal><article>
        <span>01</span>
        <h2>Your context stays where you can see it.</h2>
        <p>Preferences, sources, open questions, and decisions live in the workspace itself, so the research behind a choice is still attached a quarter later. A genuine gap becomes a visible open question either of you can resolve.</p>
      </article></Reveal>
      <Reveal><article>
        <span>02</span>
        <h2>You and your agent edit through the same commands.</h2>
        <p>A click in the interface and an agent tool call run the same command with the same validation, the same receipt, and the same undo. The ledger records who changed what, so you can hand over real editing power and still reverse any outcome.</p>
      </article></Reveal>
    </section>

    <Reveal><section id="agents" className="webmcp-band">
      <div>
        <h2>Agents get twenty-two real tools.</h2>
        <p>The page registers its tools directly through WebMCP, so an agent beside you searches your saved context, checks a plan against the engine, and files research with its sources. Its calls run through the same commands as your clicks, which is why every edit arrives attributed and undoable.</p>
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
