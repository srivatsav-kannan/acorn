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

## Non-goals for the challenge build

- Replacing Stanford Academic Advising.
- Integrating with authenticated Stanford enrollment or degree-audit systems.
- Supporting every university.
- Producing a complete four-year degree guarantee.
- Scraping private student data.
- Building a general-purpose browser automation framework.

## Open decisions

- Final product name and visual identity.
- Application framework and hosting provider.
- Exact public Stanford datasets and ingestion method.
- Seeded demo persona and academic goal.
- Final read and mutation tool set.
- Evaluation baseline and measurements.
