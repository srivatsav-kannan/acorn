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

### REQ-017: Real end-user accounts

- Priority: hard
- Requirement: A new user can create an account, complete onboarding, receive a genuinely empty personal workspace, sign out, sign back in, and recover the same persisted state. Authenticated workspaces must never be cloned from, patched from, or contaminated by the fictional demo persona.

### REQ-018: End-to-end persistence

- Priority: hard
- Requirement: Authenticated human and WebMCP mutations persist through the server-enforced workspace repository with optimistic version checks. Reloads, route changes, browser restarts, and return visits must preserve verified state.

### REQ-019: Functional interaction

- Priority: hard
- Requirement: Every visible control must perform its stated action, navigate to a working destination, or be clearly disabled with an explanation. The released interface must not contain decorative buttons, inert filters, or simulated success.

### REQ-020: Human and agent onboarding

- Priority: hard
- Requirement: Human onboarding asks only for a preferred name and one open-ended description of what the student wants help with. Additional questions appear progressively when a real task requires them. Agent onboarding is machine-native through tool descriptions and planning context, while the student sees only plain-language guidance.

### REQ-021: Product-grade feedback and motion

- Priority: hard
- Requirement: Mutations expose saving, saved, failure, conflict, and recovery states. Motion reinforces navigation, hierarchy, and state changes, respects reduced-motion preferences, and never delays core actions.

### REQ-022: Research is visibly durable

- Priority: hard
- Requirement: Saving research must atomically store its provenance and create or update a normal, searchable Library source item in the Research collection. A successful tool response must return the visible item ID and must not claim a visible change unless the student can find that item through the UI and workspace search.

### REQ-023: Institutional reference and personal context are separate

- Priority: hard
- Requirement: Stanford courses, programs, policies, and official sources live in a versioned read-only institutional reference layer. Student notes and agent research live in a personal workspace overlay. The interface must always identify the source, retrieval date, and whether information is official, student-provided, agent-added, experiential, or derived.

### REQ-024: Progressive task setup

- Priority: hard
- Requirement: The application begins with the student's goal and reveals scheduling, program, workload, time, and course-history questions only when they affect the current task. No user is forced through a demo-shaped questionnaire.

### REQ-025: Nontechnical collaboration

- Priority: hard
- Requirement: A student can collaborate with an agent using ordinary requests without understanding WebMCP, schemas, IDs, context injection, or tool setup. The interface explains what the agent can see and change, shows every change in normal product language, and provides direct edit and undo controls.

### REQ-026: Honest empty states

- Priority: hard
- Requirement: A new account begins with no selected major, completed courses, schedule, commitments, research, decisions, or inferred preferences. Empty states explain the next useful action and never fabricate progress or prepopulate personal choices.

### REQ-027: Useful Stanford depth

- Priority: hard
- Requirement: The product ships with a broad, source-attributed Stanford reference pack covering courses, programs, and planning resources. Institutional data may be updated by a controlled import process. Agent discoveries remain user-specific overlays until explicitly curated into a future reference release.

### REQ-028: Honest authentication choices

- Priority: hard
- Requirement: The login page shows only authentication paths that work in the deployment. Personal accounts may use email magic links. The public demo uses a fixed Supabase account through a dedicated "Sign in with demo credentials" action and never depends on the shared email sender. The page must have one clear hierarchy and no provider theater.

### REQ-029: No authenticated demo coupling

- Priority: hard
- Requirement: Personal account code paths must fail closed when account data is missing. They must never fall back to a fictional profile, demo owner ID, demo plan IDs, a particular major, a particular subject, or a Friday-only preference model. The demo account is explicitly marked in server data and uses the same authenticated repository, commands, history, and WebMCP path as a personal account.

### REQ-030: General personal constraints

- Priority: hard
- Requirement: Personal planning controls must represent the student's actual choices rather than the demo persona. Protected days, subjects, programs, course history, commitments, and unit limits are generic and editable.

### REQ-031: Verifiable demo reset

- Status: active
- Priority: hard
- Requirement: The public demo is a permanent Supabase identity with a server-stored workspace. Reset must preserve the Auth user, workspace, membership, and immutable history while replacing the active snapshot with an onboarding state, revoking the browser session, and returning to demo login. The next demo sign-in must begin at onboarding. Production must never use browser storage as the demo database.

### REQ-032: Direct login copy

- Priority: hard
- Requirement: Login must focus on authentication. Remove the marketing panel, numbered claims, "workspace that remembers" language, and "resettable demo" language. The demo entry action must state that it signs in with demo credentials.

### REQ-033: Dynamic institutional reference

- Priority: hard
- Requirement: The shipped institutional pack is a versioned baseline, not a ceiling. A student's agent can add a missing course, section, or program fact to a private workspace reference overlay through a dedicated WebMCP tool. Overlay additions require a classified source, merge into search, planning, and checks, appear visibly labeled in the catalog UI, and can be removed by the student. Other universities are represented honestly as planned adapters until real data ships.

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
- Demo account: permanent shared Supabase identity. A reset returns it to onboarding. The scripted challenge journey may enter the fictional Alex Chen scenario during onboarding, but that profile is never hardcoded into the authenticated reset state.
- Data posture: deterministic illustrative fixture for the judged demo. Live Stanford ingestion remains a post-challenge adapter.
- Tool surface: six read tools and six mutation tools listed in `README.md` and implemented in `src/webmcp/tools.ts`. `extend_reference` is the pathway for agent-supplied institutional context.
- Verification baseline: UI-only browser journeys, semantic WebMCP contract tests, deterministic domain tests, accessibility checks, and coverage gates.

## Remaining release work

- Apply the server-backed demo migration and create the permanent demo Auth user.
- Complete the demo credential login, onboarding, persistence, reset, sign-out, and second onboarding journey against the connected hosted Supabase project.
- Configure custom SMTP before claiming personal email signup is production-ready.
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
