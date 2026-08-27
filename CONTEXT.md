# CourseContext product context

## Goal

Create a WebMCP-powered academic planning workspace where a student and an AI agent build a source-backed next-quarter course plan together.

## Initial audience

Stanford students who currently move among class search, degree progress, advising guidance, department pages, course information, and personal notes to decide what to take.

## Product direction

- The planning canvas is optimized for humans.
- The WebMCP tool surface is optimized for agents.
- Both surfaces operate on the same student context, evidence, schedules, and decision ledger.
- The agent retrieves context on demand instead of receiving an indiscriminate data dump.
- Recommendations expose sources, uncertainty, tradeoffs, and alternatives.

## Active requirements

### REQ-001: WebMCP is essential

- Priority: hard
- Requirement: The demonstrated workflow must be materially faster or more reliable through semantic WebMCP tools than through UI-only interaction.

### REQ-002: Shared state

- Priority: hard
- Requirement: Human UI edits and agent tool mutations must update the same persisted plan state.

### REQ-003: Evidence-backed recommendations

- Priority: hard
- Requirement: Every consequential recommendation must link to evidence with provenance and confidence.

### REQ-004: Honest uncertainty

- Priority: hard
- Requirement: Official facts, experiential information, inference, and user-provided context must remain distinguishable.

### REQ-005: Human control

- Priority: hard
- Requirement: The challenge release must not perform official enrollment or another consequential external submission.

### REQ-006: Narrow vertical slice

- Priority: hard
- Requirement: The initial product must deliver one polished Stanford next-quarter planning workflow before expanding to other institutions or four-year planning.

### REQ-007: Challenge-ready delivery

- Priority: hard
- Requirement: The project must provide a public live URL, public licensed repository, verified WebMCP implementation, submission description, and public demo video under three minutes.

### REQ-008: Domain-action parity

- Priority: hard
- Requirement: Every planning, context, organization, and presentation action exposed to an agent must also have a clear human UI, and both paths must call the same domain operation against the same persisted state.

### REQ-009: Context-first agent behavior

- Priority: hard
- Requirement: An agent must search the student's workspace before relying on external research. When workspace context is insufficient or stale, the agent may research externally and store the useful result with provenance in the appropriate visible workspace location.

### REQ-010: UI-level information management

- Priority: hard
- Requirement: Agent-added information must appear as normal, editable product objects such as notes, sources, tasks, people, clubs, decisions, course references, or requirement evidence. The challenge product must not depend on arbitrary source-code edits or unrestricted filesystem access.

### REQ-011: Complete quarter planning

- Priority: hard
- Requirement: A student must be able to create, compare, check, and revise a complete Stanford quarter plan, including sections, units, time conflicts, commitments, backups, uncertainties, and requirement effects.

### REQ-012: Durable personal workspace

- Priority: hard
- Requirement: The product must preserve ideas, links, research, professor follow-ups, clubs, tasks, decisions, and other planning context outside the calendar in an organized, searchable workspace.

### REQ-013: Program and requirement tracking

- Priority: hard
- Requirement: A student can select or compare prospective and declared programs, change them without losing history, and see requirement progress with explicit source and uncertainty status.

### REQ-014: Bounded interface customization

- Priority: hard
- Requirement: Humans and agents can configure workspace views from a safe set of product-native blocks and layouts. The agent cannot inject arbitrary HTML, JavaScript, CSS, or executable code.

### REQ-015: Deliberate visual design

- Priority: hard
- Requirement: The interface must use restrained, content-led visual design with clear hierarchy, flat surfaces, hairline structure, one controlled accent, responsive layouts, accessible interaction states, and polished empty, loading, and error states. Decorative gradients, purple gradients, excessive pills, and generic generated-dashboard styling are prohibited.

### REQ-016: Plain human language

- Priority: hard
- Requirement: User-visible copy must be concise, specific, and natural. It must avoid unnecessary technical language, em dashes, semicolons, generic startup slogans, and text that reads as machine generated.

## Non-goals for the challenge build

- Replacing Stanford Academic Advising.
- Integrating with authenticated Stanford enrollment or degree-audit systems.
- Supporting every university.
- Producing a complete four-year degree guarantee.
- Scraping private student data.
- Building a general-purpose browser automation framework.

## Resolved challenge decisions

- Product name: CourseContext.
- Visual identity: editorial academic workspace using paper, ink, Stanford red, navy, and restrained elevation.
- Demo persona: fictional student Alex Chen with a CS-first plan, design interest, protected Friday, and research goals.
- Data posture: deterministic illustrative fixture for the judged demo. Live Stanford ingestion remains a post-challenge adapter.
- Tool surface: six read tools and five mutation tools listed in `README.md` and implemented in `src/webmcp/tools.ts`.
- Verification baseline: UI-only browser journeys, semantic WebMCP contract tests, deterministic domain tests, accessibility checks, and coverage gates.

## Remaining release work

- Deploy the verified build to a public HTTPS URL.
- Record the under-three-minute public demo video with real WebMCP use.
- Replace illustrative schedule data with a verified public Stanford snapshot if challenge time permits.
- Complete and submit the Devpost listing using only verified claims.

## Architecture decisions

- Use the existing CourseContext repository as the competition source of truth. Keep the prior ArtScript project separate.
- Build a Stanford-specific vertical slice while retaining `institution_id` boundaries in the core data model.
- Use structured application state as the machine-readable context layer. Markdown and JSON exports are portable representations, not the live source of truth.
- Use a visible revision journal for workspace changes. Git versions application source and verified fixtures. Optional user workspace export to Git is a later capability.
- Keep dynamic presentation bounded to application-owned view schemas and components.
