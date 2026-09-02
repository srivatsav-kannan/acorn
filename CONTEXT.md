# Acorn product context

## Goal

A planning workspace where a Stanford student and an AI agent build and maintain the student's course plan together, from the autumn they entered to the spring they expect to graduate.

## Audience

Stanford students who currently move among class search, degree progress, advising guidance, department pages, and personal notes to decide what to take. The shared judging workspace belongs to a fictional first-year, Julia Reyes.

## Product direction

- The interface is optimized for a person. The WebMCP tool surface is optimized for an agent. Both operate on the same workspace state.
- The agent retrieves context on demand through search and paged export instead of receiving an indiscriminate dump.
- Conflicts, prerequisite gaps, unit totals, and the degree timeline are computed by application code, never inferred by a model.
- Everything either participant adds is visible, attributed, editable, and undoable in the interface.

## Requirements the shipped product meets

### REQ-001: WebMCP is essential

The planning workflow is materially faster through the semantic tools than through the interface alone: one prompt fills a workspace that would take an afternoon of clicking.

### REQ-002: Shared state

Interface edits and agent mutations update the same persisted workspace through the same command path, with the same validation, receipt, and undo.

### REQ-003: Evidence with provenance

Research the agent saves carries a source, a retrieval time, a classification, and a confidence, and appears as a source card on the scratchpad.

### REQ-004: Honest uncertainty

Official facts, experiential information, inference, and student-provided context stay distinguishable in storage and on screen.

### REQ-005: Human control

The product never enrolls, submits, purchases, messages, or performs any other consequential external action. Enrollment stays with the university.

### REQ-006: Stanford first

The shipped reference layer is Stanford's. Other universities are represented honestly as agent-built adapters until real data ships.

### REQ-007: Challenge delivery

A public live URL, a public MIT-licensed repository, a working WebMCP implementation, a submission description, and a public demo video under three minutes.

### REQ-008: Agents change what the interface shows

Every agent mutation lands in workspace state the interface renders, and every agent-visible fact is also visible to the student. The one stored-only object is a saved view from `configure_view`, which is validated and kept but not yet rendered.

### REQ-009: Context first

An agent reads the workspace before external research. When the workspace is insufficient, the agent may research public sources and must save the useful result with provenance where the student can see it.

### REQ-010: Information management in the interface

Agent-added information appears as ordinary editable objects: notes, sources, todos, people, decisions, questions, courses, clubs, and program listings. The product never depends on source-code edits or filesystem access.

### REQ-011: Complete quarter planning

A student can create, compare, check, and revise a full quarter, including sections, units, time conflicts, protected hours, commitments, backups, and requirement effects, and plan any later quarter to graduation.

### REQ-012: Durable personal workspace

Ideas, links, research, people, clubs, todos, and decisions persist outside the calendar in a searchable scratchpad.

### REQ-013: Program and requirement tracking

Program requirements evaluate against completed and planned courses with explicit source and uncertainty status.

### REQ-014: Bounded presentation

Agents configure views only from a safe set of product-native blocks. No HTML, JavaScript, CSS, or executable code enters the workspace.

### REQ-015: Deliberate visual design

Restrained, content-led design with clear hierarchy, flat surfaces, hairline structure, one accent, responsive layouts, accessible states, and polished empty, loading, and error states. No decorative gradients, no generic generated-dashboard styling.

### REQ-016: Plain language

User-visible copy is concise, specific, and natural. No em dashes, no semicolons, no startup slogans, no text that reads as machine generated.

### REQ-017: Real accounts

A new user creates an account, receives an empty personal workspace, signs out, signs back in, and finds the same state. Personal workspaces are never cloned from or contaminated by the demo persona.

### REQ-018: End-to-end persistence

Every human and agent mutation persists through the server-enforced repository with optimistic version checks and immutable history. Reloads, route changes, and return visits preserve verified state.

### REQ-019: Functional interaction

Every visible control performs its stated action or is clearly disabled. No decorative buttons, inert filters, or simulated success.

### REQ-020: Two ways in

Signing up collects a name, an email, a password, the autumn entry year, and the spring graduation year, and creates the workspace directly. The onboarding form, reached after a workspace reset, collects the name, the university, and the two years. Everything else is added inside the workspace afterward.

### REQ-021: Product-grade feedback

Mutations show saving, saved, failure, conflict, and recovery states. Motion respects reduced-motion preferences and never delays core actions.

### REQ-022: Research is visibly durable

Saving research atomically stores its provenance and creates or updates a searchable source card on the scratchpad. The tool response returns the visible item's ID and never claims a change the student cannot find.

### REQ-023: Reference and personal context stay separate

Stanford courses, sections, programs, dates, and directory entries live in a versioned reference layer. Student notes and agent research live in the personal workspace. Agent additions and corrections to the reference layer are labeled, shown against the original, and removable.

### REQ-024: Progressive setup

The workspace begins with the student's goal and reveals scheduling, program, workload, and history questions only when they affect the current task.

### REQ-025: Nontechnical collaboration

A student collaborates with an agent through ordinary requests without understanding WebMCP, schemas, IDs, or tool setup. The interface explains what the agent can see and change, shows every change in plain language, and offers direct edit and undo.

### REQ-026: Honest empty states

A new account begins with no major, courses, schedule, commitments, research, or inferred preferences. Empty states explain the next useful action and never fabricate progress.

### REQ-027: Useful Stanford depth

The complete public ExploreCourses catalog for 2026-2027 ships in the repository, refreshed by a committed importer, with real section times for the departments that publish them, official registrar dates, AP and IB credit tables, and a directory of clubs and research programs.

### REQ-028: Honest authentication

The login page offers exactly what works: email and password, a confirmation resend for unconfirmed accounts, and a password reset by email. Accounts change their password or email from the profile page.

### REQ-029: No demo coupling

Personal account code paths fail closed when account data is missing. They never fall back to a fictional profile, a demo owner, or a demo plan.

### REQ-030: The demo workspace is protected

The shared judging account uses the same repository, commands, history, and tools as any account. A database trigger refuses changes to its email and password, and the workspace reset refuses to erase its seeded history, so one judge cannot lock out or blank the workspace for the next.

### REQ-031: Dynamic institutional reference

A student's agent can add a missing course, section, program with a validated requirement tree, or directory entry through `extend_reference`. Additions require a classified source, merge into search, planning, and checks, and appear labeled in the interface.

### REQ-032: Custom institutions are agent-built

A student whose school has no shipped pack names their university at onboarding and receives a neutral workspace marked beta, with a copyable instruction for the agent to construct the school's reference layer.

### REQ-033: Structured academic history

Completed courses, AP, IB, and transfer credit, and class standing are structured state, editable on the Academics tab and writable by an agent through `update_student_context`. Credit counts toward prerequisites and requirements like completed coursework.

### REQ-034: Deterministic timeline

Term identity, ordering, academic years, class standing, the current term, and units-toward-degree math are computed by application code. The degree evaluator carries completed and planned work forward through every quarter.

### REQ-035: Amendable directory

Clubs, research programs, and campus programs ship as a starting directory. Students and agents extend it through the same command, and amendments show the difference against the original.

## Non-goals

- Replacing Stanford Academic Advising.
- Integrating with authenticated Stanford enrollment or degree-audit systems.
- Supporting every university.
- Guaranteeing a complete four-year degree.
- Scraping private student data.
- Building a general-purpose browser automation framework.

## Resolved decisions

- Product name: Acorn.
- Visual identity: editorial academic workspace using paper, ink, cardinal, and restrained elevation, set in Fraunces and Karla.
- Judging persona: Julia Reyes, a shared account whose credentials travel with the submission.
- Data posture: the full public ExploreCourses catalog is imported by `scripts/import-stanford/import-catalog.mjs` and committed as `src/data/institutions/stanford-catalog.json`. Rerunning the importer refreshes it.
- Tool surface: eight read tools and fourteen mutation tools, listed in `README.md` and implemented in `src/webmcp/tools.ts`.
- Verification: unit, integration, contract, and agent-sequence tests with coverage gates, plus browser journeys with accessibility checks. See `ARCHITECTURE.md`.

## Architecture decisions

- Structured application state is the machine-readable context layer. Markdown export is a portable representation, not the live source of truth.
- Every workspace change is a versioned snapshot commit with an immutable history row, attributed to a human or an agent.
- Presentation stays bounded to application-owned components. Agents never inject markup or code.
- The Stanford reference layer is a versioned baseline that agents extend per workspace, with `institution_id` boundaries kept in the core model for later universities.
