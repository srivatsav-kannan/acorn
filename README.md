# CourseContext

CourseContext is an agent-native academic planning workspace. It helps a student and an AI agent build a course plan together from personal goals, institutional requirements, live course information, and source-backed research.

The first vertical is Stanford next-quarter planning for the [WebMCP Challenge](https://openai.com/webmcp-challenge/). The product is designed to generalize to other colleges after the Stanford workflow is proven.

## Product thesis

Course planning is not primarily a calendar problem. It is a context problem.

The facts needed for one decision are scattered across course catalogs, degree-audit systems, department pages, advising guidance, syllabi, enrollment tools, and student experience. Existing planners help students search or arrange classes, but students still have to assemble the reasoning themselves.

CourseContext gives that reasoning a shared home:

- a student profile with goals, constraints, completed work, and preferences.
- an evidence library with sources, retrieval dates, confidence, and provenance.
- visual schedule scenarios that humans can directly manipulate.
- a decision ledger explaining inclusions, risks, alternatives, and open questions.
- a persistent Library for notes, links, tasks, people, clubs, ideas, questions, and scratch documents.
- program and requirement views that show the effect of each plan.
- WebMCP tools through which an agent can retrieve only the context it needs and update the same workspace the student sees.

The product follows one parity rule: every safe planning and information-management action available to the agent must also be available through the human interface. Both paths call the same domain operation and produce the same visible state, validation, history, and undo behavior.

## Why WebMCP

Without WebMCP, an agent must repeatedly inspect pages, operate filters, click cards, and reconstruct application state. CourseContext instead exposes meaningful academic-planning operations from the web app itself.

Implemented read tools:

```text
search_workspace
get_planning_context
search_courses
get_plan
check_plan
get_program_progress
```

Implemented mutation tools:

```text
save_research
save_workspace_item
update_student_context
edit_plan
configure_view
```

The visible interface and WebMCP tools must use the same domain logic and persistent state. Tool results must be structured, concise, provenance-aware, and sufficient to verify what changed.

## Challenge demo

A student asks:

> Build an Autumn schedule under 15 units that advances me toward CS, lets me explore product design, avoids Friday classes, and leaves time for research.

The agent should be able to:

1. Inspect the student's current context.
2. Identify missing information.
3. Query relevant courses and requirements.
4. Build two evidence-backed schedule scenarios.
5. Check time, units, prerequisites, finals, workload balance, and uncertainty.
6. Explain every recommendation and provide backups.
7. React to a human moving or removing a course without rebuilding unrelated work.

The student remains in control. The challenge version does not enroll in courses or represent itself as an official academic advisor.

## Evidence model

Every consequential claim is classified as one of:

- `official`: supported by a current institutional source.
- `experiential`: based on student-reported or community information.
- `derived`: produced from stored facts or deterministic evaluation.
- `student`: supplied directly by the student.

Evidence records include the source URL or document, retrieval time, quoted or normalized claim, and confidence. Uncertainty is shown rather than silently converted into fact.

## Seven-day scope

The competition build focuses on one excellent next-quarter planning loop:

- a seeded Stanford demo profile.
- public, attributable Stanford information.
- course search and evidence inspection.
- a visual weekly schedule.
- two comparable plan scenarios.
- a searchable Library with visible agent-added research.
- selected program and requirement progress.
- automated structural checks.
- human edits followed by agent revalidation.
- a non-trivial WebMCP tool surface.
- a public deployment and an under-three-minute demo video.

It does not attempt multi-university ingestion, official enrollment, a complete four-year optimizer, or authenticated Stanford data integration.

## Working product

The repository now contains a complete local challenge demo:

- a polished landing page, login surface, desktop workspace, and mobile navigation.
- Home, Plan, Explore, Library, Programs, Activity, and Settings routes.
- an isolated fictional judge demo plus a separate Stanford reference pack with 50+ catalog courses, nine programs, official planning resources, sourced requirements, and clearly labeled sample meeting data.
- atomic domain commands with version checks, idempotency keys, visible receipts, activity attribution, rollback, and undo.
- deterministic checks for units, duplicates, meetings, commitments, offerings, sections, prerequisites, finals, day and time constraints, transition buffers, and stale evidence.
- recursive requirement evaluation for completed, planned, missing, and manual-review states.
- all 11 approved semantic WebMCP tools registered in the actual page.
- portable JSON, Markdown, source, and activity exports.
- resettable browser-persisted demo workspaces plus Supabase authentication, row-level security, optimistic snapshot commits, and immutable workspace history.
- goal-first account onboarding that asks only for a preferred name and planning question, protected workspace routes, sign-out, reload-safe persistence, version-conflict recovery, visible save state, loading and failure surfaces.
- clean personal workspaces that never clone the fictional demo profile or prefill a major, course history, schedule, commitment, research item, or inferred preference.
- working profile, Library, course, scenario, program-tracking, saved-view, search, filter, archive, restore, reset, and undo controls.
- a visible agent connection guide and official abort-signal WebMCP registration lifecycle.

Course and program references link to official Stanford sources. Meeting and section values in the challenge fixture are illustrative planning samples. CourseContext is not a live enrollment source or official degree audit.

## Run locally

Requirements:

- Node.js 20.9 or newer
- npm

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and choose **Try the demo**.

The demo needs no external service and persists within the current browser profile. Real accounts require a Supabase project and the two migrations described in [the setup guide](supabase/README.md).

To run the complete verification pipeline:

```bash
npx playwright install chromium
npm run test:all
```

`test:all` runs lint, strict TypeScript, coverage-gated unit and integration tests, the optimized production build, and browser journeys using desktop and mobile Chromium profiles.

## Verified quality

The current finalization run passes:

- unit, property, integration, contract, security, infrastructure, and agent-sequence tests, including fresh-account contamination regressions.
- coverage above the enforced 90% statement, 85% branch, 90% function, and 90% line gates.
- 26 executed browser journeys across desktop and mobile, with two intentional profile-specific skips.
- serious and critical accessibility checks on both browser profiles.
- the production Next.js build for every public and workspace route.

See [the test plan](docs/test-plan.md) for architecture traceability and [the verification record](docs/verification.md) for the exact release command.

## Repository documents

- [AGENTS.md](AGENTS.md): repository operating rules
- [CONTEXT.md](CONTEXT.md): current product intent and durable requirements
- [Architecture](ARCHITECTURE.md): full product, interface, data, WebMCP, security, and deployment design
- [Product brief](docs/product-brief.md): audience, problem, workflow, and success criteria
- [Challenge plan](docs/challenge-plan.md): submission requirements and seven-day schedule
- [Implementation plan](docs/implementation-plan.md): phased engineering sequence and exit conditions
- [Test plan](docs/test-plan.md): requirement-to-test traceability and coverage gates
- [Verification record](docs/verification.md): latest full finalization result
- [Supabase setup](supabase/README.md): hosted authentication and persistence configuration

## License

[MIT](LICENSE)
