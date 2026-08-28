# CourseContext implementation plan

This plan turns the architecture into a verified Stanford vertical slice. The order protects the central product claim. Shared state, visible context, and semantic WebMCP operations must work before visual breadth or institution expansion.

## Rebuild acceptance journey

The current rebuild is accepted only after this exact journey works against hosted Supabase:

1. Create a new account and complete a two-field onboarding form.
2. Land in a workspace with the entered goal and no fictional or inferred personal data.
3. Browse sourced Stanford courses, programs, and planning resources without those records becoming personal choices.
4. Add a course to an empty quarter plan, change its role or section, and reload the page.
5. Add and edit a Library item, then confirm that it persists after sign-out and sign-in.
6. Let an agent search the same workspace, save sourced research, and make one plan edit.
7. Find the agent-added item in the normal interface with attribution, source, and undo.
8. Run the complete plan check and show every unresolved issue in plain language.

Component tests and fixture tests do not satisfy this acceptance journey. The final claim requires a fresh hosted account and browser observation.

## 1. Delivery strategy

Build one vertical journey from authentication through plan revision before adding secondary screens.

The first complete journey is:

1. Enter an isolated demo workspace.
2. Read the seeded student context.
3. Search Stanford courses.
4. Add a course and section to a plan.
5. Run deterministic checks.
6. Save one source-backed research item to Library.
7. Show the new evidence on the course and in Library.
8. Change a preference through the human interface.
9. Reread the preference through WebMCP.
10. Revise only the affected plan objects.
11. Inspect the action receipt and undo the change.

Anything that does not strengthen this journey waits until the journey works.

## 2. Phase 0: freeze the product contract

### Work

- Confirm the CourseContext repository as the source of truth.
- Approve `ARCHITECTURE.md` and this plan.
- Record the exact demo persona.
- Record the exact Autumn 2026 planning prompt.
- Record the final set of course and program fixtures needed for the prompt.
- Record the WebMCP tool names and high-level schemas.
- Freeze the visual rules in `AGENTS.md`.
- Create a challenge compliance checklist.

### Demo persona fixture

Use a fictional first-year Stanford student with:

- prospective Computer Science major
- interest in product design and health AI
- no Friday classes as a hard constraint
- 15 unit ceiling
- research commitment on Tuesday and Thursday afternoons
- preference for a CS-first path
- one completed introductory course
- one uncertain prerequisite
- one saved professor follow-up
- one saved club idea

Do not use Srivatsav's real academic record.

### Exit condition

One written scenario lists every object the demo needs, every expected tool call, every visible UI change, and every deterministic check.

## 3. Phase 1: technology decision and application shell

### Work

- Write a short technology decision record covering Next.js, Supabase, typed SQL, Zod, testing, and deployment.
- Verify current package compatibility before selecting versions.
- Scaffold the application without optional UI libraries.
- Add TypeScript strict mode.
- Add formatting, linting, unit test, and browser test commands.
- Add environment validation and `.env.example`.
- Add global response headers needed for WebMCP testing.
- Build the product shell with header, navigation, responsive breakpoints, and account menu.
- Add design tokens, typography, focus treatment, skeleton primitives, error primitives, and toast or receipt primitives.

### Initial routes

```text
/
/login
/demo
/app
/app/plan
/app/explore
/app/library
/app/programs
/app/activity
/app/settings
```

### Tests

- application boots without environment secrets in fixture mode
- unsupported environment configuration fails clearly
- root shell renders at desktop and mobile breakpoints
- keyboard focus is visible
- navigation works without a full document reload
- WebMCP provider remains mounted across application routes

### Exit condition

The deployed preview shows the complete empty shell and passes accessibility smoke tests at desktop and mobile sizes.

## 4. Phase 2: database, identity, and demo isolation

### Work

- Create the first database migration.
- Implement users, workspaces, memberships, terms acceptance, sessions, and workspace versions.
- Configure Google sign-in and email magic links.
- Implement secure server session handling.
- Implement anonymous demo sessions.
- Build the four-step onboarding flow.
- Add row-level security policies.
- Add a deterministic demo reset command.
- Add a cleanup job for expired demo workspaces.

### Required tables

```text
users
workspaces
workspace_memberships
terms_acceptances
workspace_versions
demo_sessions
```

### Demo isolation test

1. Start demo session A.
2. Start demo session B.
3. Modify a note in A.
4. Confirm B and the canonical fixture remain unchanged.
5. Reset A.
6. Confirm A returns to the fixture state.

### Security tests

- a user cannot read another workspace
- a user cannot mutate another workspace by changing an ID
- expired demo sessions fail closed
- sign-out invalidates the active session
- no authentication token appears in local storage
- mutation endpoints reject missing session and invalid origin

### Exit condition

A judge can enter an isolated demo workspace in one click. A normal user can create a private workspace through Google or email.

## 5. Phase 3: domain kernel and action receipts

### Work

- Implement actor, workspace, version, command, query, receipt, and domain error contracts.
- Implement the central command executor.
- Implement optimistic concurrency.
- Implement idempotency keys.
- Implement activity entries in the same transaction as every mutation.
- Implement inverse operations for the first reversible commands.
- Implement one query cache invalidation map shared by UI and WebMCP handlers.

### First commands

```text
create_context_item
update_context_item
archive_context_item
set_student_preference
create_plan_scenario
add_plan_course
select_plan_section
remove_plan_course
add_plan_commitment
undo_action
```

### Receipt requirements

- receipt ID
- actor
- operation name
- workspace and object versions
- affected stable IDs
- concise summary
- warnings
- validation diagnostics
- undo availability
- timestamp

### Tests

- duplicate idempotency key returns the first receipt
- stale expected version produces a conflict
- failed validation writes no partial domain state
- successful mutation writes activity and state atomically
- undo restores the prior state and creates its own receipt
- UI and WebMCP adapters call the same command functions

### Exit condition

A command issued from a test UI control and the corresponding test tool call produce equivalent state and receipts.

## 6. Phase 4: Stanford fixture and evidence model

### Work

- Identify the allowed public Stanford sources used by the demo.
- Record terms, attribution, retrieval date, and content hash.
- Implement institution, term, course, course version, section, meeting, instructor, program, requirement, and evidence tables.
- Build a deterministic fixture importer.
- Separate catalog identity from term offering.
- Implement source classification and staleness policy.
- Seed the fictional student and initial Library items.
- Include one deliberate evidence gap for the live agent research moment.

### Required fixture coverage

- enough Computer Science courses for two valid alternatives
- at least one product-design course
- at least one course relevant to health AI
- at least one course not offered in Autumn 2026
- at least one missing or uncertain prerequisite
- at least two section options for one course
- one pair of overlapping meetings
- one final or special-time conflict if source data supports it
- a small Computer Science requirement tree
- one adjacent program or concentration comparison

### Source rules

- course description source does not establish current offering
- term schedule source establishes sections and times
- program source establishes requirement rules for its effective year
- experiential workload information remains labeled experiential
- inferred historical pattern never becomes an official offering fact

### Tests

- importer produces stable IDs and output hashes
- repeated import is idempotent
- course and section identities do not collapse
- cross-listed aliases resolve correctly for fixture cases
- stale evidence is returned with a stale marker
- unsupported program nuance returns manual review

### Exit condition

The database can answer every factual question needed by the demo except the one intentional evidence gap.

## 7. Phase 5: Library and persistent context

### Work

- Implement context item types and relationships.
- Build Library collections and Inbox.
- Build global quick capture.
- Build note, link, task, person, club, question, decision, and document views.
- Build the small structured document editor.
- Implement item relationships to courses, plans, programs, and people.
- Build context detail inspector with source, status, attribution, and history.
- Implement search across Library items.
- Implement move, archive, restore, and undo.

### Human context-injection flow

1. Select Add.
2. Enter text or paste a URL.
3. Review suggested type and collection.
4. Add optional relationship or due date.
5. Save.
6. See the item in Library, global search, and related-object views.

### Agent context-injection flow

1. Call `save_workspace_item` or `save_research`.
2. Validate classification, placement, relationships, and source.
3. Write item and activity receipt atomically.
4. Update visible Library and related-object queries.
5. Return the stable ID and summary.

### Tests

- human and agent creation produce the same item shape
- source-backed item requires retrieval time and classification
- relationship targets must belong to the workspace or global catalog
- archive removes item from default search but preserves history
- document Markdown export preserves supported blocks
- external URL rendering is safe

### Exit condition

The student and agent can both capture, organize, find, edit, and undo the same information through their respective interfaces.

## 8. Phase 6: Explore and catalog search

### Work

- Implement course search query.
- Add exact course-code ranking.
- Add structured quarter, units, day, time, level, subject, and program filters.
- Build course result cards.
- Build course detail inspector.
- Display current offering separately from catalog identity.
- Display source and staleness.
- Display related Library items.
- Add save, compare, and add-to-plan actions.
- Add a recommendation reason component tied to explicit context references.

### Performance rule

Course result lists use one compact query. Do not issue one request per course card.

### Tests

- exact code ranks before description matches
- active-term filter excludes catalog-only courses
- Friday filter uses meeting records
- missing section information remains visible
- recommendation reason references real context IDs
- mobile list and inspector remain usable

### Exit condition

A student can discover a course, understand its current status and evidence, and add it to a plan without leaving the product.

## 9. Phase 7: Planner and deterministic checks

### Work

- Build plans and named scenarios.
- Build the weekly calendar.
- Build course tray, unscheduled list, backups, and commitments.
- Build course and check inspectors.
- Implement drag and keyboard placement affordances.
- Implement section selection.
- Implement scenario duplication and comparison.
- Implement active-plan selection.
- Implement all challenge checks.
- Build conflict and repair explanations.

### Challenge checks

```text
UNIT_LIMIT
DUPLICATE_COURSE
MEETING_CONFLICT
COMMITMENT_CONFLICT
MISSING_SECTION
NOT_OFFERED
PREREQUISITE_MISSING
PREREQUISITE_UNCERTAIN
FINAL_CONFLICT
DAY_CONSTRAINT
TIME_CONSTRAINT
TRANSITION_BUFFER
STALE_EVIDENCE
```

### Calendar quality checklist

- exact time labels
- visible overlapping events
- readable dense schedule
- selected event state
- day-off visibility
- personal commitment distinction
- unscheduled warning
- list alternative for accessibility
- mobile day mode
- printable summary

### Tests

- exact boundary times do not falsely overlap
- multiple meetings for one section all appear
- backup courses do not count toward active units
- commitment conflicts use the same interval logic as course conflicts
- stale source warning survives otherwise valid plans
- removing one course does not mutate unrelated plan entries
- scenario copy creates new stable child IDs and preserves provenance

### Exit condition

Both demo scenarios can be created, compared, checked, edited, and repaired through human UI and domain commands.

## 10. Phase 8: Programs and requirement progress

### Work

- Implement the requirement rule tree.
- Build program selection and comparison.
- Build the requirement progress view.
- Evaluate completed and planned courses separately.
- Show manual-review status for unsupported nuance.
- Show effective year and source.
- Show the active plan's effect on progress.
- Record program selection revisions instead of overwriting history.

### Tests

- `all_of`, `any_of`, `choose_n`, course group, and unit rules
- planned course does not appear completed
- one course cannot double count when the rule forbids it
- program version follows selected catalog year
- removing a plan course updates projected progress
- uncertain mapping remains uncertain

### Exit condition

The student can change a prospective program and immediately see how each current plan affects sourced requirements.

## 11. Phase 9: WebMCP tools

### Work

- Implement the final tool schemas.
- Register tools only in an authenticated or isolated demo workspace.
- Add accurate read-only and untrusted-content annotations.
- Route each tool to the existing query or command.
- Add output-length controls and pagination.
- Add structured domain errors.
- Add registration status to local diagnostics.
- Add automatic query invalidation after mutations.
- Add exact tool-to-UI operation parity tests.

### Tools

```text
search_workspace
get_planning_context
search_courses
get_plan
check_plan
get_program_progress
save_research
save_workspace_item
update_student_context
edit_plan
configure_view
```

### Tool result quality

Every result should tell the agent:

- whether the operation succeeded
- what IDs were read or changed
- which state version now applies
- what the visible interface changed
- what evidence supports the result
- what warning or conflict needs attention
- what tool or parameter can repair a failure

### Tests

- browser discovers the complete expected tool set
- sign-out makes tools unavailable or fail closed
- navigation does not lose registration
- malformed arguments fail with stable errors
- stale version does not overwrite human changes
- repeated idempotency key does not duplicate a mutation
- output respects the character budget
- saved external evidence is marked untrusted

### Exit condition

The complete demo can be executed through semantic tools without low-level clicking, while every change remains visible and editable in the application.

## 12. Phase 10: context-first agent behavior and saved views

### Work

- Write tool descriptions that direct workspace search before external research.
- Add context-gap results to `search_workspace` and `get_planning_context`.
- Implement `save_research` placement into Library and related views.
- Implement the saved-view schema and validator.
- Build the human view editor.
- Implement `configure_view` over the same schema.
- Add agent eval cases for search, research, save, plan, revise, and preserve.

### Saved-view challenge blocks

- weekly schedule
- course list
- course comparison
- requirement progress
- checklist
- task list
- source list
- decision table
- open questions

### Eval prompts

- direct request with all context already stored
- request with one missing current-offering fact
- ambiguous request that should read student preferences
- correction that affects one course only
- attempt to save unsupported arbitrary HTML
- stale-plan edit after a human mutation
- source containing prompt-injection text

### Exit condition

The agent reliably searches stored context first, saves useful missing evidence, configures only allowed views, and preserves unrelated state after a human correction.

## 13. Phase 11: polish, accessibility, and responsive verification

### Work

- Complete all loading, empty, partial, stale, error, and success states.
- Review every page at 1440, 1024, 768, 430, and 375 pixel widths.
- Test keyboard-only operation.
- Test screen-reader labels and announcements.
- Test reduced motion.
- Tune dense calendar readability.
- Remove generic copy and internal technical language.
- Audit for prohibited gradients, excessive pills, and inconsistent radii.
- Audit all user-visible copy for em dashes and semicolons.
- Verify every action has a visible result and recovery path.

### Visual review questions

- Is the most important action obvious without a tutorial?
- Does every page have one dominant working surface?
- Are borders doing useful structural work?
- Is the accent reserved for meaning?
- Can the user distinguish official facts from personal notes immediately?
- Can the user distinguish course identity from current offering immediately?
- Is agent attribution visible without becoming visual clutter?
- Does the mobile version feel intentionally designed?

### Exit condition

The product passes the visual, responsive, keyboard, and copy audits with no critical issues.

## 14. Phase 12: deployment and challenge finalization

### Work

- Create production Supabase project and migrations.
- Configure production auth redirect URLs.
- Deploy the application.
- Confirm WebMCP origin and response-header requirements.
- Seed the canonical demo fixture.
- Run a clean judge session in ChatGPT's browser.
- Run a clean judge session in Chrome with WebMCP enabled.
- Record tool discovery and every expected call.
- Verify the public repository, license, setup, and architecture docs.
- Write the Devpost description from verified behavior.
- Record the under-three-minute demo.
- Upload the public YouTube video.
- Freeze the release commit, deployment, fixture, and submission.

### Final demo sequence

1. Open the seeded workspace.
2. Show the student's current context and active constraints.
3. Ask the agent for two Autumn plans.
4. Show `search_workspace` and catalog reads.
5. Show one external research gap.
6. Save the source through `save_research`.
7. Show it appear in Library and on the related course.
8. Create the plans and run checks.
9. Change one preference directly in the UI.
10. Ask the agent to revise.
11. Show preservation of unrelated plan entries.
12. Show Activity and the final evidence-backed plan.

### Final verification

- unit tests pass
- integration tests pass
- browser tests pass
- WebMCP contract tests pass
- agent eval threshold passes
- production smoke test passes
- demo reset works
- no private data is present
- no secret is tracked
- no unsupported claim appears in README or submission
- all public links work
- video is public, under three minutes, and contains audio
- release commit and deployed version match

### Exit condition

Every item in the challenge definition of done is backed by a test result, browser observation, or public artifact.

## 15. Seven-day execution map

### Day 1

- Phase 0
- Phase 1
- begin Phase 2

Target: deployed shell, approved contracts, and working demo-session foundation.

### Day 2

- finish Phase 2
- Phase 3
- Phase 4

Target: isolated demo state, domain commands, action receipts, and imported Stanford fixture.

### Day 3

- Phase 5
- Phase 6

Target: persistent Library, quick capture, global search, and course exploration.

### Day 4

- Phase 7
- Phase 8

Target: complete scheduler, deterministic checks, scenarios, and requirement progress.

### Day 5

- Phase 9
- Phase 10

Target: complete WebMCP journey and context-first agent behavior.

### Day 6

- Phase 11
- production deployment
- initial video rehearsal

Target: polished product and stable public judge path.

### Day 7

- Phase 12 only

Target: final verification, recording, submission, and release freeze. No new product features.

## 16. Scope cuts if time slips

Cut in this order:

1. Custom collection icons and visual personalization
2. Full document block variety
3. Program side-by-side comparison polish
4. Drag interactions, while preserving click and keyboard alternatives
5. User-created saved views, while retaining the one demonstrated agent-created view
6. Google sign-in, while preserving demo and email access

Do not cut:

- shared domain operations
- Library and visible saved research
- context-first search
- action receipts and activity
- quarter scenarios
- deterministic checks
- source classification
- WebMCP mutation visibility
- demo isolation
- final verification

## 17. Post-challenge backlog

- full Stanford catalog adapter
- additional program requirement trees
- richer document collaboration
- calendar export
- user-approved email drafting and handoff
- optional GitHub workspace export
- institution adapter toolkit
- advisor collaboration roles
- four-year scenario planning
- additional saved-view blocks
- richer workload and experiential evidence

The backlog begins only after the challenge release is frozen and submitted.
