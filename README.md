# Acorn

Acorn is an academic planning workspace for Stanford students that a student and their AI agent share. The page registers twenty-two planning tools on `document.modelContext` through [WebMCP](https://openai.com/webmcp-challenge/), so an agent working in the browser reads and edits the same workspace the student sees. Every agent change runs through the same validated command path as a click in the interface, lands in the activity ledger with attribution, and can be undone.

The app ships the complete 2026-2027 Stanford catalog, 15,618 courses across 256 departments imported from Stanford's public ExploreCourses feed, the catalog that Navigator now supersedes, together with official registrar dates, degree timeline math, and a directory of clubs and research programs.

## The workspace

Signing up asks for a name, an email, a password, and two dates: the autumn you entered Stanford and the spring you expect to graduate. Those two dates generate the full quarter map. Everything else is added inside, by the student or by their agent.

- **Calendar** shows official registrar dates for 2026-2027 with clearly flagged projections for later years, class meetings from the plan, standalone events with start and end times in any IANA timezone, and todos with optional due times. A picker re-expresses the whole calendar in a chosen display timezone, and clicking any entry opens its summary in a pinned inspector.
- **Academics** holds the plan for every quarter to graduation, catalog search with real section times, deterministic conflict and prerequisite checks, and academic history, including AP, IB, and transfer credit with the units Stanford granted for each.
- **Activities** covers clubs, research programs, and recurring commitments, each with the weekly times that the calendar and the schedule checks respect.
- **Scratchpad** is the context layer. It holds the degree objective, the current goal with its milestones, and tagged notes that both the student and the agent write. It is the first thing an agent reads and the place where handed-over context lands.
- **Collaborate** shows the live connection status, the full tool table, and a copyable onboarding prompt for an agent's first session.

Persistence lives in Supabase behind the app's own signup and login forms, with row-level security, versioned snapshot commits, and immutable workspace history. Accounts can reset a password by email, change their password or email from the profile page, and reset the workspace back to onboarding.

## How agents connect

In a WebMCP-enabled browser, opening the workspace is the whole integration: the page registers its tools at mount and the Collaborate tab confirms the connection. Every change an agent makes lands in the same workspace state the interface renders, through the same domain command with the same validation, receipt, and undo as a click.

```text
Read   search_workspace, get_planning_context, search_courses, get_plan,
       check_plan, suggest_sections, get_program_progress, export_context

Write  edit_plan, manage_todo, manage_event, manage_activity, set_interest,
       annotate_course, ingest_context, save_research, save_workspace_item,
       update_student_context, extend_reference, configure_view, undo,
       manage_goal
```

Write tools require the workspace version they started from, so an agent holding stale state receives a clean conflict instead of silently overwriting newer work. For bulk context transfer, `export_context` pages the entire workspace out as markdown in pages near five thousand characters, and `ingest_context` files context handed over from another assistant into the scratchpad.

## The terminal bridge

For a browser that does not expose WebMCP yet, the repository includes a bridge that provides the same connection from a terminal:

```bash
node scripts/agent-bridge.mjs --url http://127.0.0.1:3000/app
```

It launches a Chromium with `document.modelContext` installed before the page loads, signs in with the demo credentials from the environment, and serves whatever the page registered over `http://127.0.0.1:4571`:

- `GET /tools` lists the registered tools with their read-only flags.
- `POST /call` with `{"tool": "get_planning_context", "input": {}}` executes a tool and returns its result.
- `POST /goto` with `{"path": "/app/academics"}` moves the visible app between tabs.
- `POST /screenshot` with `{"path": "shot.png"}` captures the current page.

Any terminal, script, or agent that can speak HTTP gets a working session:

```bash
curl -s -X POST http://127.0.0.1:4571/call -H 'content-type: application/json' -d '{"tool":"get_planning_context"}'
```

## Run locally

Requirements are Node.js 20.9 or newer and npm.

```bash
npm install
npm run dev
```

Create `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from a Supabase project, and apply the migrations in `supabase/migrations/` as described in [the setup guide](supabase/README.md). A shared demo account exists for judging, and its credentials travel with the challenge submission rather than the repository. The optional `COURSE_CONTEXT_DEMO_EMAIL` and `COURSE_CONTEXT_DEMO_PASSWORD` variables identify that account for the agent bridge login. `SUPABASE_SERVICE_ROLE_KEY` is read only by `scripts/admin-create-users.mjs`, which creates pre-confirmed accounts, and never by the app.

[ARCHITECTURE.md](ARCHITECTURE.md) describes the routes, the workspace model, the command path, and the tool surface in detail.

## Tests

```bash
npx playwright install chromium
npm run test:all
```

That runs lint, strict TypeScript, unit and contract tests behind enforced coverage gates of 90 percent statements, 85 percent branches, 90 percent functions, and 90 percent lines on the domain, data, WebMCP, and store layers, then the production build, and finally the browser journeys on desktop and mobile Chromium profiles with serious and critical accessibility checks. The browser journeys run against a fixture workspace with `COURSE_CONTEXT_E2E_FIXTURE=true`, so they need no Supabase project.

## Honest limits

Acorn is an independent project and is not affiliated with Stanford University. The catalog is public Stanford data, retrieved on August 30, 2026 from the ExploreCourses feed that Navigator supersedes, so live sections should be verified before enrolling. Acorn never enrolls anyone in anything. Enrollment always happens through the university's own system.

## License

[MIT](LICENSE)
