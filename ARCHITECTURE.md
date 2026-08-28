# CourseContext system architecture

Status: rebuilding the Stanford vertical slice around real accounts and progressive setup

## Rebuild contract

The authenticated product is no longer allowed to derive a new workspace from the fictional demo fixture. A new account contains only the preferred name and planning goal the student explicitly entered. It begins with an empty quarter scenario, no selected program, no completed courses, no commitments, no research, and no inferred constraints.

CourseContext has two visibly different data layers:

1. **Stanford reference** contains read-only courses, programs, official planning resources, source URLs, retrieval dates, and honest coverage notes. It is shared across accounts and versioned with the application.
2. **My workspace** contains the student's goals, course history, program interests, plans, notes, tasks, decisions, and agent-added research. It is private, persisted in Supabase, editable, attributed, and undoable.

Onboarding asks for a preferred name and one open-ended planning goal. The product asks for a major, completed courses, unit limit, schedule constraints, or commitments only when the student starts a task that needs that information. The ordinary interface never requires a student to understand WebMCP, schemas, tool names, IDs, or context injection.

The fictional Alex Chen workspace remains an isolated judge demo only. Demo objects must never enter an authenticated workspace.

This document is the product and technical source of truth for CourseContext. It describes the complete intended system, then identifies the smaller challenge release that proves the central interaction.

## 1. Product definition

CourseContext is a persistent academic workspace shared by a student and an AI agent. It stores the student's goals, constraints, academic plans, institutional evidence, notes, tasks, decisions, and preferred ways of viewing that information. The student works through a polished web interface. The agent works through semantic WebMCP tools. Both operate on the same objects through the same domain services.

The first product is specific to Stanford and the Autumn 2026 planning workflow. The core model includes an institution boundary so a later release can support another university without rewriting the planning engine.

The central product claim is:

> An agent gives better academic advice when the context it needs is persistent, structured, visible to the student, and editable by both participants.

The schedule is one major view of that context. It is not the whole product.

## 2. Scope

### 2.1 Challenge release

The competition build must support one complete Stanford quarter-planning loop:

1. A student opens a seeded or personal workspace.
2. The workspace contains goals, commitments, course history, prospective programs, and preferences.
3. The agent searches the workspace before answering.
4. The agent searches the course catalog and current quarter offerings.
5. The agent identifies missing, stale, or conflicting evidence.
6. The agent may research a public Stanford source with its normal web capabilities.
7. The agent saves the useful result into the visible workspace with source, date, type, and confidence.
8. The agent creates or revises a complete quarter plan.
9. Deterministic checks evaluate sections, units, conflicts, prerequisites, commitments, backups, and requirement effects.
10. The student edits the plan or context directly.
11. The agent reads the revised state and updates only the affected reasoning.
12. The student can inspect the evidence, decisions, and action history behind the plan.

### 2.2 Included product areas

- Stanford course catalog and term offerings
- Quarter plans and schedule variants
- Personal commitments on the calendar
- Course recommendations and backups
- Prospective and declared program selection
- Requirement progress and plan effects
- Notes, scratch documents, links, people, clubs, ideas, questions, tasks, and decisions
- Evidence provenance and uncertainty
- Global workspace search
- Human and agent action history
- Bounded workspace view customization
- WebMCP tools over the same state as the interface

### 2.3 Explicit exclusions

- Axess, Carta, Navigator, or ExploreCourses authentication
- Official course enrollment
- Official degree certification
- Automatic email sending
- Arbitrary agent-written frontend code
- Arbitrary database access
- Unrestricted filesystem access
- A general web crawler
- A complete four-year optimizer for the challenge release
- Claims that CourseContext is an official Stanford product

## 3. System principles

### 3.1 Shared domain state

The interface and WebMCP layer never maintain parallel representations of the plan. A course added by dragging it onto the calendar and a course added through `edit_plan` invoke the same command and produce the same record, validation result, activity entry, and UI update.

### 3.2 Domain-action parity

Every non-administrative domain action available to an agent has a visible human affordance. Every human domain action has an agent-callable equivalent when it is safe and useful.

Parity covers:

- reading and searching context
- creating and editing notes
- organizing workspace items
- saving sources and research
- changing planning preferences
- creating and revising plans
- checking plans
- recording decisions
- selecting prospective programs
- configuring product-native views

Parity does not cover account recovery, privacy controls, session management, destructive account deletion, external enrollment, or other consequential submissions. These remain human-controlled security boundaries.

### 3.3 Context before external research

The agent first searches the workspace. External research begins only when the existing context is missing, stale, contradictory, or too weak for the requested decision.

### 3.4 Research becomes visible product state

Useful research is not left inside a chat transcript. The agent saves it as a source, claim, note, decision input, course annotation, program annotation, or task. The student can find, edit, move, archive, or delete it through the normal interface.

### 3.5 Structured context, human-readable presentation

The database stores typed objects and relationships. The interface presents those objects as clear schedules, cards, documents, lists, and requirement trees. Markdown and JSON are export formats. A giant Markdown file is not the live machine interface.

### 3.6 Visible uncertainty

The system distinguishes official facts, experiential information, inference, and user-provided statements. A recommendation can use all four, but it must not present them as equally authoritative.

### 3.7 Additive agent behavior with undo

The agent may directly add low-risk items such as notes, links, research, questions, suggestions, and tasks. Every addition is attributed, visible in activity, and undoable. Changes to durable identity facts, completed-course history, or declared program status require an explicit confirmation in the interface.

### 3.8 Bounded customization

The agent can create and arrange product-native views. It chooses from known blocks such as a schedule, checklist, course comparison, evidence list, requirement summary, document, task list, or decision table. It cannot inject HTML, CSS, JavaScript, SQL, or executable code.

## 4. Primary user story

The seeded demo student is planning Autumn 2026. The student wants to make progress toward Computer Science, explore product design, stay under 15 units, avoid Friday classes, and preserve two afternoons for research.

The student asks the agent to produce two plans. The agent reads the workspace, searches relevant courses, checks current offerings, stores one newly researched Stanford source, creates two schedule variants, explains the tradeoffs, and identifies one uncertain prerequisite. The student then removes a course and records a stronger preference for a CS-first path. The agent sees the change, preserves unrelated choices, and repairs the affected plan.

This journey demonstrates the product better than a broad catalog demo because it exercises persistent context, research, scheduling, program progress, human edits, and agent revalidation in one loop.

## 5. Information architecture

The signed-in product has five primary areas.

### 5.1 Home

Home answers, "What needs my attention?"

It contains:

- current quarter and active plan
- units, open conflicts, and unresolved questions
- next tasks and follow-ups
- recent workspace additions
- recent agent and human activity
- selected program progress summary
- a compact quick-capture field

Home is a summary, not a second copy of every feature.

### 5.2 Plan

Plan is the complete quarter scheduler. It contains:

- a weekly calendar
- enrolled or proposed course sections
- personal commitments
- unscheduled courses and backups
- unit totals
- plan checks
- rationale and decisions
- multiple named scenarios
- course detail drawers

The student can drag a section, remove a course, switch a section, activate a backup, add a commitment, or create another scenario. Every action is available through a corresponding domain command.

### 5.3 Explore

Explore is the catalog and recommendation surface. It contains:

- course search
- quarter, subject, unit, day, time, level, and program filters
- course cards with current-offering status
- course detail pages
- source-backed descriptions and prerequisites
- saved courses
- recommendation reasons tied to student goals
- comparison mode

Catalog facts and dynamic workspace annotations are visually distinct.

### 5.4 Library

Library is the persistent context workspace outside the calendar. It contains:

- scratch documents
- notes and ideas
- saved links and guides
- people and professor follow-ups
- clubs and activities
- questions to investigate
- tasks and reminders
- decisions and rejected alternatives
- source and evidence records
- collections created by the student or agent

The Library lets a student capture a thought without first deciding its perfect structure. The item can be organized later by either participant.

### 5.5 Programs

Programs tracks declared and prospective academic paths. It contains:

- selected programs
- side-by-side program comparison
- requirement trees
- completed, planned, missing, and uncertain requirement status
- course-to-requirement mappings
- source and effective-date information
- impact of the active quarter plan

Changing a prospective program does not delete the previous selection or its analysis. It creates a revision and updates visible progress.

### 5.6 Activity

Activity is accessible from every area and has a dedicated full-page view. It shows:

- actor
- action
- timestamp
- affected objects
- reason
- validation result
- source or evidence references
- before and after summary
- undo availability

Agent actions are labeled plainly as "Added by agent" or "Updated by agent." The interface does not use magic-wand language or decorative AI effects.

## 6. Global product shell

### 6.1 Desktop layout

The desktop application uses:

- a 64 pixel sticky header
- a 224 pixel left navigation rail
- a flexible main content region
- an optional 360 pixel inspector on Plan, Explore, Library, and Programs

The header contains:

- product lockup
- active quarter selector
- global search and command entry
- workspace sync status
- recent activity button
- account menu

The left rail contains Home, Plan, Explore, Library, and Programs. Activity and Settings appear below a divider. The rail can collapse to icons on medium screens.

The inspector opens only when an object is selected. It never permanently steals space from an empty page.

### 6.2 Mobile layout

Mobile uses a compact top bar and a bottom navigation bar for Home, Plan, Explore, Library, and Programs. Inspectors become full-height sheets. The weekly calendar defaults to a day view with horizontal day navigation. Every interactive target has a minimum 44 pixel hit area.

### 6.3 Global capture

An "Add" control appears in the header and accepts:

- note
- task
- link
- person
- club
- idea
- question
- decision
- commitment
- scratch document

The first field accepts plain text or a URL. The second step suggests a type, collection, relationships, and optional date. The student can save immediately or adjust the suggestion.

The agent uses the same creation model through `save_workspace_item`.

### 6.4 Global search

Global search returns grouped results from courses, plans, program requirements, documents, notes, tasks, people, clubs, decisions, and sources. Results indicate their type and current status. Search remains usable from the keyboard and supports direct navigation.

### 6.5 Desktop working layouts

Plan uses a dense working layout rather than a grid of disconnected cards:

```text
+----------------------------------------------------------------------------------+
| CourseContext   Autumn 2026   Search workspace                  Activity  Account |
+------------+----------------------+----------------------------------------------+
| Home       | Plan A               | Mon   Tue   Wed   Thu   Fri                  |
| Plan       | 14 units             |                                              |
| Explore    |                      |       weekly calendar                        |
| Library    | Unscheduled          |                                              |
| Programs   | Backups              |                                              |
|            | Commitments          |                                              |
|            +----------------------+------------------------------+---------------+
| Settings   | Plan checks and rationale                            | Inspector     |
+------------+------------------------------------------------------+---------------+
```

Library uses a document and information-management layout:

```text
+----------------------------------------------------------------------------------+
| CourseContext   Autumn 2026   Search workspace                  Activity  Account |
+------------+------------------+-----------------------------------+---------------+
| Home       | Inbox            | Professor follow-ups              | Context       |
| Plan       | Courses          |                                    | Type          |
| Explore    | Programs         | document, notes, links, and tasks | Relations     |
| Library    | People           |                                    | Sources       |
| Programs   | Clubs            |                                    | History       |
|            | Research         |                                    |               |
| Settings   | Decisions        |                                    |               |
+------------+------------------+-----------------------------------+---------------+
```

The visual hierarchy comes from column purpose, typography, rules, and whitespace. It does not depend on placing every object inside a rounded floating container.

## 7. Visual design system

The visual direction takes structural cues from UPRound without copying its brand. It uses strong typography, flat surfaces, hairline borders, restrained elevation, clear states, and content-first layouts.

### 7.1 Design character

The product should feel like a carefully designed academic notebook and planning desk. It should not look like a generic analytics dashboard, chat wrapper, or generated admin template.

### 7.2 Color tokens

Initial light-theme tokens:

| Token | Value | Use |
| --- | --- | --- |
| paper | `#FAF9F6` | application background |
| surface | `#FFFFFF` | primary working surfaces |
| ink | `#191817` | primary text |
| ink-soft | `#68645F` | secondary text |
| line | `#E4E0D8` | borders and dividers |
| accent | `#8B1E2D` | selected state and primary action |
| accent-soft | `#F5E8EA` | active navigation and quiet emphasis |
| success | `#24704A` | passing checks |
| warning | `#9A6615` | uncertainty and stale evidence |
| danger | `#B33A32` | hard conflicts and destructive action |
| info | `#365F87` | neutral guidance |

The accent is a restrained academic red. The product does not use the Stanford seal, Stanford wordmark, or language that implies institutional endorsement.

Decorative gradients are prohibited. A future brand mark may use a deliberately designed tonal treatment, but page backgrounds, buttons, cards, and charts remain flat.

### 7.3 Typography

- Display and major page headings: Noto Serif Variable
- Interface and body text: Noto Sans Variable
- Numbers and schedule times: tabular numerals
- Default body size: 15 to 16 pixels
- Minimum supporting text: 12 pixels
- Comfortable line height for documents: 1.6

Serif type is reserved for meaningful hierarchy. It is not applied to every card title.

### 7.4 Shape and elevation

- Primary surfaces use square or 4 pixel corners
- Pills are reserved for statuses, compact filters, and removable tokens
- Cards use borders before shadows
- Drawers and menus may use one restrained large shadow
- Buttons do not use glow
- Empty space and rules establish hierarchy

### 7.5 Copy rules

- Use plain student language
- Say what changed and what the student can do next
- Avoid internal model, retrieval, vector, schema, and orchestration language
- Avoid vague labels such as "Insights" when a specific label exists
- Do not use em dashes
- Do not use semicolons
- Do not use generic slogans
- Do not use decorative references to AI

### 7.6 States

Every major view must define:

- loading skeleton
- empty state with a useful first action
- partial-data state
- stale-data state
- permission failure
- recoverable network failure
- hard validation failure
- successful mutation receipt
- optimistic update rollback

Spinners are reserved for short, isolated actions. Page loads use skeletons that match the final layout.

## 8. Screen specifications

### 8.1 Public landing page

The landing page contains:

1. A concise statement about planning with persistent context
2. A visual product frame showing the schedule and Library together
3. A three-step explanation: collect context, build plans, preserve decisions
4. A Stanford-specific example
5. A clear WebMCP collaboration explanation
6. A privacy statement
7. Primary actions for "Try the demo" and "Create a workspace"

The page should demonstrate the product within the first viewport. It should not begin with a long marketing essay.

### 8.2 Onboarding

Onboarding is one focused screen with two fields:

1. Preferred name
2. An open-ended description of what the student wants help figuring out

The account starts with an empty Autumn scenario and one visible goal item created from the student's own words. Program selection, completed courses, unit limits, time constraints, commitments, interests, and workload preferences are added later through the relevant working surface. The product explains why each field matters at the moment it asks.

### 8.3 Home

Home uses a two-column desktop layout:

- Left: active plan, open checks, and next tasks
- Right: program progress, recent context, and activity

The active plan summary includes units, free-day pattern, known conflicts, and the next unresolved decision. It does not reproduce the full weekly grid.

### 8.4 Plan

The desktop Plan page uses three working regions:

- Left tray, 280 pixels: plan scenarios, unscheduled courses, backups, and commitments
- Center: weekly calendar and active scenario
- Right inspector, 340 to 380 pixels: selected course, checks, rationale, and evidence

The calendar supports:

- Monday through Friday by default
- optional weekend visibility
- configurable day start and end
- course meetings
- labs and discussions
- personal commitments
- commute or transition buffers
- overlapping-event visualization
- uncertain meeting times
- finals or special meetings in a separate strip

Course placement uses the selected section. Adding a course without a selected section places it in the unscheduled tray and creates an explicit warning.

Plan scenarios are named and independently versioned. The user can duplicate a scenario, compare two scenarios, and promote one as active. A backup course belongs to a scenario but does not count toward active units or conflicts until activated.

### 8.5 Explore

Explore has a persistent filter row and a list-detail layout. Selecting a course opens an inspector with:

- title, code, and units
- current offering status
- sections and meeting times
- description
- prerequisites
- program mappings
- saved evidence
- uncertainty and staleness
- why it may fit the current student
- add to plan, save, compare, and add note actions

The recommendation explanation cites specific student-context references. It must never say only that a course is "a great fit."

### 8.6 Library

Library uses:

- a collection rail
- a main item list or document editor
- an optional context inspector

Default collections include Inbox, Courses, Programs, People, Clubs, Research, Decisions, and Archived. Students and agents can create more collections.

Scratch documents support structured blocks:

- heading
- paragraph
- checklist
- link with source metadata
- course reference
- program reference
- person reference
- date or reminder
- decision
- callout

The challenge release stores block data as JSON and renders it through first-party components. Markdown import and export are supported where representation is lossless.

### 8.7 Programs

Programs presents a compact selector followed by a requirement tree. Each requirement row shows:

- requirement name
- status
- courses that currently satisfy it
- planned courses that may satisfy it
- missing information
- source and effective date

Program comparison shows only meaningful differences by default. The student can expand the complete requirement trees.

### 8.8 Activity and undo

The activity drawer shows the ten most recent actions. The full page supports filters by actor, object type, and date. Reversible actions show Undo. Bulk agent changes are grouped under one receipt and undone atomically.

## 9. Authentication and login flow

### 9.1 Authentication options

The production path uses email magic links as the primary account entry. Google sign-in is compiled into the application only when the deployment explicitly enables `NEXT_PUBLIC_SUPABASE_GOOGLE_AUTH_ENABLED=true` after the provider has been configured and verified. An isolated demo workspace remains available without personal data.

Stanford credentials are never collected. Stanford SSO is outside the challenge scope.

### 9.2 New user flow

1. The user selects "Create a workspace."
2. The user enters an email and receives a one-time sign-in link.
3. Supabase completes authentication when the user opens that link.
4. The server establishes a secure session in an HttpOnly cookie.
5. The user completes the two-field goal-first onboarding flow.
6. The server atomically creates a private workspace, owner membership, first snapshot, and first version record.
7. The user lands on Home.

### 9.3 Returning user flow

1. The session cookie is validated on the server.
2. The last active workspace and quarter are loaded.
3. The root shell renders with cached summary data.
4. The WebMCP provider registers tools after identity and workspace authorization are known.

### 9.4 Demo flow

"Try the demo" sets a short-lived HttpOnly mode cookie and opens a browser-persisted clone of the seeded Stanford workspace. Each browser profile receives its own copy. Demo writes never affect the canonical fixture or an authenticated account. A reset action removes the local copy and restores the fixture.

The judge path must work without waiting for email. The demo is deliberately separated from authenticated account code. Authenticated rendering throws when its real workspace payload is absent and never substitutes the demo fixture.

### 9.5 Session rules

- Secure, HttpOnly, SameSite cookies
- Supabase-managed access session with rotation
- Server-side authorization on every query and command
- Explicit sign-out and session revocation
- Provider-level authentication limits, with application mutation limits required before a broad public launch
- No tokens in local storage
- No secrets or student data in logs

## 10. Human and agent collaboration contract

### 10.1 One operation layer

The system exposes domain queries and commands through an application service. React components and WebMCP tool handlers call this service. They do not write directly to database tables.

```text
Human interface -----\
                     -> domain query or command -> validation -> transaction -> database
WebMCP tool ---------/                                |               |
                                                      v               v
                                                action receipt    live UI update
```

### 10.2 Actor model

Every command includes an authenticated actor:

```json
{
  "actorType": "human",
  "actorId": "USER-DEMO",
  "workspaceId": "WORKSPACE-DEMO",
  "expectedVersion": 42,
  "idempotencyKey": "capture-20260827-001"
}
```

Agent actions use `actorType: "agent"` and retain the signed-in user session as the authority boundary. The browser agent never receives a separate database credential.

### 10.3 Command result

Every mutation returns an action receipt:

```json
{
  "ok": true,
  "receiptId": "ACTION-0184",
  "workspaceVersion": 43,
  "changed": [
    {"type": "plan_course", "id": "PLANCOURSE-CS-147"}
  ],
  "warnings": [],
  "undoAvailable": true,
  "summary": "Added CS 147 to Autumn plan A using section 01."
}
```

The UI displays the same summary. The agent receives only the concise structured result it needs.

### 10.4 Concurrency

Workspace and plan mutations use optimistic concurrency. A command includes the version it read. If the student has edited the same state, the command fails with a conflict receipt containing the current version and affected fields. The agent must reread and retry intentionally.

## 11. The context-first agent loop

The expected agent behavior is:

```text
student question
      |
      v
search_workspace
      |
      v
is the context sufficient and current?
      | yes                         | no
      v                             v
reason from stored context     research public web source
      |                             |
      |                             v
      |                       save_research
      |                             |
      +-------------+---------------+
                    v
             answer or edit plan
                    |
                    v
          record decision if durable
```

### 11.1 What is stored

The agent stores information when it is likely to help later, including:

- a current course-offering fact
- a useful department guide
- a professor contact link
- an important deadline
- a decision and its reason
- a rejected alternative
- a new user preference
- an unresolved question
- a club or opportunity the student wants to revisit

Transient reasoning and hidden chain of thought are never stored.

### 11.2 Placement

Every saved item has a primary type, collection, relationships, and view hint. For example, a professor email idea can appear in People, on the related course page, and in Tasks without duplicating the underlying object.

### 11.3 Agent-created context

Agent-created items include:

- attribution
- creation time
- related request
- evidence references where applicable
- confidence
- status
- undo link

The student can edit an agent-created item exactly as they can edit their own item.

## 12. Context data model

The context system uses typed records and relationships rather than one undifferentiated document.

### 12.1 Context item types

- note
- document
- idea
- question
- task
- link
- source
- claim
- decision
- person
- organization
- club
- commitment
- preference
- goal
- constraint
- uncertainty

### 12.2 Common fields

Every context item has:

- stable ID
- workspace ID
- type
- title
- summary
- structured content
- status
- creator actor
- source classification
- confidence where relevant
- created and updated timestamps
- optional due date
- optional source URL
- optional retrieval time
- version
- archive state

### 12.3 Relationships

Typed relationships connect context items to:

- courses
- sections
- plans
- programs
- requirements
- people
- organizations
- other context items

Examples include `supports`, `contradicts`, `relates_to`, `satisfies`, `recommended_for`, `blocked_by`, `follow_up_with`, and `supersedes`.

### 12.4 Source classifications

- `official`: current institutional source
- `experiential`: student or community experience
- `inferred`: conclusion from incomplete or historical information
- `user_provided`: supplied by the student

The UI always displays the classification when it affects a recommendation.

## 13. Academic data model

### 13.1 Institutions and terms

- `institutions`
- `academic_terms`
- `subjects`

Every academic record contains `institution_id`. The first adapter provides Stanford data.

### 13.2 Catalog

- `courses`: stable catalog identity, title, description, unit range
- `course_versions`: effective-dated catalog text and prerequisite representation
- `course_aliases`: prior codes and cross-listings
- `instructors`
- `sections`: term-specific offering and meeting information
- `meetings`: day, time, location, and meeting type
- `final_exams`: final meeting information when available
- `course_sources`: provenance for catalog and offering fields

Course identity and term offering remain separate. A course can exist in the catalog without being offered in the active quarter.

### 13.3 Student context

- `student_profiles`
- `student_goals`
- `student_preferences`
- `student_constraints`
- `completed_courses`
- `current_commitments`
- `program_selections`

Preferences include strength and provenance. A hard constraint differs from a soft preference.

### 13.4 Plans

- `plans`
- `plan_scenarios`
- `plan_courses`
- `plan_section_choices`
- `plan_backups`
- `plan_commitments`
- `plan_checks`
- `plan_decisions`

A plan represents a term. A scenario represents one alternative within that plan.

### 13.5 Programs and requirements

- `programs`
- `program_versions`
- `requirements`
- `requirement_rules`
- `course_requirement_mappings`
- `requirement_sources`
- `student_requirement_results`

Requirement versions are effective-dated. A student's selected catalog year is preserved.

### 13.6 Workspace organization

- `collections`
- `context_items`
- `context_relationships`
- `document_blocks`
- `saved_views`
- `activity_entries`
- `action_receipts`
- `workspace_snapshots`

## 14. Evidence architecture

### 14.1 Authority by question

Different sources answer different questions:

| Question | Preferred authority |
| --- | --- |
| What is the course generally about? | official catalog or department page |
| Is it offered this quarter? | current official term schedule |
| When and where does it meet? | current official section listing |
| What satisfies a program requirement? | effective-dated official program requirements |
| What is the workload like? | experiential source, clearly labeled |
| Is it a good fit for this student? | recommendation derived from stored student context and evidence |

The system must not use a general catalog description to prove current availability.

### 14.2 Evidence record

```json
{
  "id": "EVIDENCE-CS147-AUT26-OFFERING",
  "classification": "official",
  "claim": "CS 147 has an Autumn 2026 section.",
  "sourceUrl": "https://example.stanford.edu/course/cs147",
  "sourceTitle": "Stanford course schedule",
  "retrievedAt": "2026-08-27T12:00:00Z",
  "effectiveTerm": "2026-autumn",
  "confidence": 1,
  "status": "current",
  "addedBy": "agent",
  "untrustedExternalContent": true
}
```

### 14.3 Research intake

The agent calls `save_research` with a normalized claim and source metadata. The application validates the URL, classification, required dates, and target relationship. It stores external text as untrusted content. External page instructions are never treated as application instructions.

### 14.4 Local overlay

Agent research enters the student's workspace evidence layer. It does not silently modify the shared global catalog. A later administrative curation process may promote well-supported official evidence into a global dataset.

### 14.5 Staleness

Staleness policy depends on the claim:

- term offering and meeting time: expires at the end of the term or on source change
- deadline: expires after the event
- program requirement: valid for its effective catalog year until superseded
- general description: reviewed when a new catalog version appears
- experiential report: does not expire automatically, but displays its date

Stale information remains searchable and visibly stale. It is not used as current proof without confirmation.

## 15. Schedule and plan engine

The plan engine is deterministic. Model judgment may recommend a plan, but code determines structural validity.

### 15.1 Checks

- unit minimum and maximum
- duplicate course
- overlapping meetings
- personal commitment conflict
- required section missing
- section not offered in active term
- prerequisite satisfied, missing, or uncertain
- co-requisite satisfied, missing, or uncertain
- final exam conflict
- day and time constraints
- transition buffer violation
- backup duplication
- requirement mapping effect
- stale evidence used by the plan

### 15.2 Check result

Each result includes:

- stable code
- severity
- affected object IDs
- human explanation
- evidence references
- suggested repair actions
- deterministic or advisory classification

### 15.3 Time representation

- Store timestamps in UTC where they represent absolute time
- Store recurring class meetings as local weekday and local time
- Use `America/Los_Angeles` as the Stanford planning timezone
- Preserve source timezone and conversion metadata
- Keep final exams as dated events

### 15.4 Recommendation score

The challenge release may rank candidates using transparent features:

- goal alignment
- requirement progress
- schedule compatibility
- workload preference
- interest match
- evidence quality
- uncertainty penalty

The score helps order candidates. It does not replace the natural-language rationale or deterministic checks.

## 16. Program requirement engine

Requirements use a small typed rule tree:

- `all_of`
- `any_of`
- `choose_n`
- `course`
- `course_group`
- `minimum_units`
- `minimum_grade`
- `residency`
- `manual_review`

The evaluator returns completed, planned, missing, uncertain, or not-applicable status with contributing courses and source references.

Unsupported policy nuance produces `manual_review`. It never silently passes.

## 17. Dynamic view system

### 17.1 Purpose

Saved views let the workspace adapt to the student's current task without allowing arbitrary code generation.

### 17.2 Allowed blocks

- plan summary
- weekly schedule
- course list
- course comparison
- requirement progress
- checklist
- task list
- source list
- decision table
- document
- collection
- recent activity
- open questions

### 17.3 View schema

```json
{
  "id": "VIEW-HEALTH-AI-AUT26",
  "title": "Health AI options",
  "layout": "two_column",
  "blocks": [
    {
      "type": "course_list",
      "title": "Courses to compare",
      "query": {"collectionId": "COLLECTION-HEALTH-AI"}
    },
    {
      "type": "decision_table",
      "title": "Tradeoffs",
      "query": {"relatedTo": "GOAL-HEALTH-AI"}
    }
  ]
}
```

The server validates block types, queries, object access, and layout limits. The same view editor is available to the student.

## 18. WebMCP tool surface

The initial tool surface is intentionally semantic and compact.

### 18.1 Read tools

#### `search_workspace`

Search courses, programs, plans, notes, documents, tasks, people, clubs, decisions, sources, and evidence. Returns concise grouped matches and context gaps.

#### `get_planning_context`

Return the student goals, constraints, preferences, commitments, selected programs, and relevant durable decisions for a specified planning task.

#### `search_courses`

Search the normalized catalog and active-term offerings using structured filters.

#### `get_plan`

Return one scenario with courses, sections, commitments, backups, units, decisions, and current checks.

#### `check_plan`

Run deterministic checks and return violations, warnings, evidence gaps, and suggested repairs.

#### `get_program_progress`

Return requirement progress for one selected program and optionally show the effect of a plan scenario.

### 18.2 Mutation tools

#### `save_research`

Save a sourced claim or guide into the evidence layer and atomically create or update a student-visible source card in the Research collection. The source card and evidence record share a stable evidence relationship. A successful receipt returns the card ID as `primaryVisibleId`. The same ID must resolve through workspace search and the Library UI before the operation may claim `visibleChange: true`.

Previously stored evidence that has no related context item is materialized into a Research source card when the workspace loads. This repairs older hidden records without changing the evidence ID or deleting provenance.

#### `save_workspace_item`

Create or update a note, document, idea, question, task, link, person, club, commitment, or decision.

#### `update_student_context`

Add or revise goals, preferences, constraints, and program interests. Sensitive durable facts may return `confirmation_required`.

#### `edit_plan`

Apply one atomic set of plan operations such as adding a course, choosing a section, removing a course, adding a backup, adding a commitment, or creating a scenario.

#### `configure_view`

Create or revise a saved view using allowed layout and block schemas.

### 18.3 Tool contract

Every tool:

- has a stable name under 30 characters where practical
- uses a closed JSON Schema
- has narrow inputs
- validates workspace authorization
- returns stable IDs and state versions
- returns under roughly 1,500 characters by default
- supports pagination or follow-up retrieval for larger results
- uses `readOnlyHint` accurately
- uses `untrustedContentHint` for externally sourced text
- describes side effects precisely
- reports whether the visible UI changed
- returns the exact primary visible object ID for a mutating action that claims a visible result
- returns a structured error and recovery suggestion

### 18.4 Registration lifecycle

Tools register from a persistent client provider mounted in the authenticated application shell. Registration begins only after the session and active workspace are known. Route changes do not replace the provider. Sign-out unregisters tools or causes every handler to fail closed.

## 19. Frontend architecture

### 19.1 Proposed stack

- Next.js with React and TypeScript
- Server-rendered application shell where useful
- Client components for calendar, editors, and WebMCP registration
- TanStack Query for server state and invalidation
- CSS variables with Tailwind utilities for the design system
- Zod schemas shared by UI, route handlers, domain services, and WebMCP
- Accessible first-party components before a large component library

Version numbers are locked only during implementation after checking current compatibility.

### 19.2 State ownership

- Server state lives in the database and query cache
- Local UI state covers selection, open drawers, temporary form values, and drag previews
- Durable preferences are saved explicitly
- No plan or context object exists only in browser memory after a successful mutation

### 19.3 Mutation flow

1. UI validates basic input
2. UI calls a domain command endpoint
3. Server authenticates and authorizes
4. Domain service validates current state
5. Database transaction applies the command
6. Activity and receipt records are written in the same transaction
7. Server returns the receipt and updated versions
8. Query cache updates from the receipt or invalidates targeted keys
9. UI shows the result

### 19.4 Calendar rendering

The calendar uses DOM and CSS grid rather than canvas. This preserves accessibility, text selection, responsive behavior, and straightforward testing. Drag operations calculate a proposal locally, then commit a semantic section or commitment change through the server.

### 19.5 Documents

The challenge release uses a small first-party block editor with explicit block types. It does not adopt a large collaborative editor framework unless the vertical slice proves the need.

## 20. Backend architecture

### 20.1 Proposed stack

- Next.js route handlers for the competition release
- PostgreSQL hosted by Supabase
- Supabase Auth for email magic links, with optional provider-gated Google sign-in
- A separate local demo cookie and browser-persisted demo fixture
- Drizzle or an equivalent typed SQL layer selected during the implementation decision
- Zod at all network and command boundaries
- Database migrations committed to the repository

A separate API service can be extracted later if traffic, background ingestion, or additional clients justify it.

### 20.2 Layer boundaries

```text
route handler or WebMCP handler
             |
             v
application query or command
             |
             v
domain validation and policy
             |
             v
repository and transaction layer
             |
             v
PostgreSQL
```

Route handlers do not contain planning rules. Database repositories do not generate user-facing recommendation prose.

### 20.3 Background jobs

The challenge release needs only bounded jobs:

- catalog fixture import
- evidence staleness refresh
- demo workspace cleanup
- optional link metadata fetch

Jobs are idempotent and record run results. No autonomous recurring agent research is required for the challenge.

## 21. Search and retrieval

### 21.1 Initial implementation

Use PostgreSQL full-text search and trigram matching across normalized searchable fields. Rank exact course codes and titles first, then structured relationships, then full text.

The first release does not require embeddings. Structured filters and lexical search are easier to explain, test, and keep current.

### 21.2 Retrieval rules

- Apply workspace authorization before ranking
- Prefer current official evidence for factual academic questions
- Include stale items only with an explicit stale marker
- Return IDs and short excerpts rather than complete documents
- Return context gaps when no strong result exists
- Preserve result provenance

### 21.3 Context packs

`get_planning_context` assembles a task-specific pack. It contains only relevant goals, constraints, preferences, commitments, decisions, program selections, and evidence references. It never returns an unrestricted account dump.

## 22. Data ingestion

### 22.1 Stanford adapter

The Stanford adapter converts allowed public data into the common academic model. Each importer stores:

- source URL
- source title
- retrieval time
- effective term or catalog year
- content hash
- importer version
- license or usage note
- normalization warnings

### 22.2 Seed strategy

The challenge fixture should contain enough real, attributable data for the exact demo journey and nearby alternatives. It should not attempt to mirror every Stanford page during the seven-day build.

The minimum fixture includes:

- 30 to 60 relevant courses
- current-term sections for the demonstrated courses
- a small Computer Science requirement tree
- one adjacent program or concentration comparison
- public source records
- the fictional student profile
- two initial context items and one intentional evidence gap

### 22.3 Dynamic completion

When the fixture lacks a useful nuance, the agent researches it and saves a workspace evidence item. This is a demonstrated feature, not an ingestion failure. The app must clearly show that the new evidence belongs to the student's workspace overlay.

## 23. Versioning and portability

### 23.1 Runtime history

Workspace state uses a database revision journal rather than Git. Each command writes an action receipt. Bulk actions create a pre-change snapshot. Reversible actions store a validated inverse operation.

### 23.2 Git

Git versions:

- application source
- migrations
- catalog fixture source
- normalized seeded data where licensing allows
- evaluation tasks
- challenge documentation
- verified release commits

The challenge release does not create a hidden Git repository for each user.

### 23.3 Export

A workspace export contains:

- `workspace.json`
- `PROFILE.md`
- `PLANS.md`
- `PROGRAMS.md`
- `LIBRARY/` Markdown files
- `SOURCES.json`
- `ACTIVITY.jsonl`

After the challenge, users may connect an export destination such as GitHub. Export is explicit and must warn before including private data.

## 24. Security and privacy

### 24.1 Tenant isolation

- Every user-owned row includes `workspace_id`
- Membership is checked server-side
- Row-level security provides a second boundary
- Global catalog rows are read-only to ordinary users
- Demo workspaces are isolated and expiring

### 24.2 WebMCP security

- Tools act through the signed-in browser session
- Every handler repeats authorization
- Inputs are untrusted and schema validated
- External research content is marked untrusted
- Tool results never contain secrets or unrelated private context
- Read-only and mutation annotations are accurate
- Sensitive changes require confirmation
- Consequential external actions are not implemented

### 24.3 Link handling

- Only `http` and `https` URLs are accepted for external sources
- Rendered links use safe target and rel attributes
- Server-side metadata fetching blocks private network ranges and redirects to them
- Fetched HTML is never executed
- Stored excerpts are sanitized and length limited

### 24.4 Privacy

- The public repository contains only fictional demo data
- The system does not request Stanford passwords or transcript access
- Logs use IDs rather than full context payloads
- Analytics exclude document text, notes, and profile content
- Account deletion is human initiated and has a confirmation flow

## 25. Performance

Initial budgets:

- authenticated shell usable within 2 seconds on a normal broadband connection
- route transition feedback within 100 milliseconds
- search response under 300 milliseconds for the seeded dataset
- plan check under 100 milliseconds for one scenario
- mutation receipt under 500 milliseconds excluding network variability
- WebMCP read result under 1,500 characters by default
- no per-course network fan-out to render lists

The course list uses one compact query. Detail data loads only when selected. Search input is debounced and cancellable.

## 26. Accessibility and responsive behavior

- WCAG 2.2 AA contrast target
- complete keyboard navigation
- visible focus rings
- 44 pixel touch targets
- reduced-motion support
- calendar events have list equivalents and descriptive labels
- conflicts use icon and text in addition to color
- screen-reader announcements for successful and failed mutations
- document blocks preserve heading order
- drag actions have keyboard alternatives
- mobile layouts are designed, not merely compressed desktop layouts

## 27. Observability

The application records:

- request ID
- authenticated workspace ID hash
- operation name
- duration
- status code
- stable error code
- domain command receipt ID
- WebMCP tool name and outcome

It does not record raw notes, document bodies, prompts, or private profile values.

An internal diagnostics page shows fixture version, tool registration status, active workspace version, and recent failed operations for local development.

## 28. Testing architecture

### 28.1 Deterministic tests

- requirement rule evaluation
- course and section normalization
- schedule overlap
- unit totals
- prerequisites
- commitments and buffers
- evidence authority and staleness
- optimistic concurrency
- idempotent commands
- undo behavior
- workspace authorization
- demo isolation

### 28.2 Contract tests

- closed WebMCP schemas
- read-only and untrusted annotations
- shared UI and WebMCP operation parity
- stable IDs and version fields
- concise output budgets
- structured errors
- tool registration lifecycle

### 28.3 Browser tests

- demo login to completed plan
- human edit followed by agent reread
- agent research saved and visible in Library
- plan conflict and repair
- mobile quick capture
- session expiry and recovery

### 28.4 Agent evals

Evaluate whether the model:

- searches the workspace first
- selects the correct tool
- passes correct IDs and versions
- stores useful missing evidence
- preserves unrelated plan choices
- distinguishes official from inferred information
- completes the multi-step journey

Compare the WebMCP journey with a UI-only browser path using the same task and model.

## 29. Repository structure

The first implementation should remain one application rather than a premature monorepo.

```text
src/
  app/                 routes, layouts, and route handlers
  components/          shared interface components
  features/
    auth/
    home/
    planner/
    explore/
    library/
    programs/
    activity/
  domain/              entities, commands, queries, checks, and policies
  db/                  repositories and transaction helpers
  webmcp/              tool definitions, registration, handlers, and receipts
  contracts/           shared Zod schemas
  styles/              tokens and global styles
db/
  migrations/
data/
  fixtures/
  raw/                 ignored unless licensing allows inclusion
scripts/
  import-stanford/
tests/
  unit/
  integration/
  browser/
  evals/
docs/
  product-brief.md
  challenge-plan.md
  implementation-plan.md
ARCHITECTURE.md
CONTEXT.md
AGENTS.md
```

## 30. Deployment architecture

### 30.1 Proposed challenge deployment

- Next.js application on Vercel
- Supabase Postgres and Auth
- Same public application origin for pages and domain route handlers
- `Origin-Agent-Cluster: ?1` response header where required by the WebMCP implementation
- Production environment variables stored only in provider secret storage

### 30.2 Environments

- local
- preview per pull request
- production challenge deployment

Preview environments use separate demo data or a separate schema. Production fixture migrations are deterministic.

### 30.3 Release

The final challenge release is tied to:

- Git commit
- migration version
- fixture version
- tool manifest version
- deployed URL
- browser verification report
- demo script version

The production deployment and submitted repository are frozen after the deadline according to the challenge guidance.

## 31. Failure modes and responses

### Context drift

The agent forgets a durable preference. Prevented by context-first search, structured preferences, and plan decisions tied to object IDs.

### Source confusion

The agent uses a catalog description as evidence of current availability. Prevented by question-specific authority rules and separate course and section models.

### Hidden agent state

Useful information remains in chat. Prevented by saving durable research, decisions, and tasks into visible workspace objects.

### UI and agent divergence

The student and agent see different plans. Prevented by one operation layer, versioned state, and live query invalidation.

### Full plan regeneration

A small correction rewrites unrelated choices. Prevented by stable IDs, atomic plan operations, scenario versions, and affected-object receipts.

### Arbitrary customization

An agent-generated interface becomes unsafe or incoherent. Prevented by validated saved-view schemas and product-native blocks.

### Tool overload

The model chooses among many overlapping tools poorly. Prevented by a compact semantic tool set and end-to-end evals.

### Stale confidence

Old evidence remains persuasive. Prevented by retrieval dates, effective periods, visible stale states, and plan-check warnings.

### Generic interface

The result looks like an interchangeable generated dashboard. Prevented by the design rules, specific screen specifications, real content hierarchy, and visual review on target sizes.

## 32. Challenge definition of done

The product is ready for submission only when:

- a judge can open a public URL and enter an isolated demo workspace
- the workspace visibly contains student context, evidence, a plan, and Library items
- WebMCP tools register in the supported browser
- the agent searches workspace context before editing the plan
- the agent saves one externally researched item into a visible UI location
- the agent creates or revises two plan scenarios
- deterministic checks find and explain at least one issue
- a human edit is visible to the agent without copying and pasting
- every agent mutation appears in Activity with an undo path
- the UI and tool handlers use the same domain commands
- the complete journey passes on desktop and the core human workflow works on mobile
- the repository, license, setup, deployment, and video requirements are complete
- the final verification run passes after the last production change

## 33. Post-challenge expansion

Expansion should follow evidence from the Stanford vertical slice:

1. More complete Stanford catalog and program adapters
2. Four-year scenario planning
3. Calendar and task integrations with explicit authorization
4. Additional institution adapters
5. Shared advising workspaces
6. Optional Git-backed workspace export
7. More saved-view blocks
8. Institution-maintained evidence feeds

The future general platform is an institution-neutral context and planning engine with institution-specific adapters. The current product remains deliberately Stanford-specific until the shared collaboration loop works reliably.
