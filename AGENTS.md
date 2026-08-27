# AGENTS.md

## Mission

Build and evaluate CourseContext, an agent-native academic planning workspace in which a student and an AI agent create evidence-backed course plans together. The first release is a Stanford next-quarter planner for the 2026 WebMCP Challenge. The architecture may generalize later, but the challenge implementation must stay narrow and complete.

## Required reading

Before changing architecture, product scope, or the WebMCP tool surface, read:

- `README.md`
- `CONTEXT.md`
- `ARCHITECTURE.md`
- `docs/product-brief.md`
- `docs/challenge-plan.md`
- `docs/implementation-plan.md`

Update these documents when a decision materially changes the product or submission story.

## Product rules

- WebMCP must be central to the experience, not a decorative wrapper around ordinary UI automation.
- Build one polished next-quarter planning workflow before considering four-year plans or additional universities.
- The human-facing UI and WebMCP tools must call the same domain operations and observe the same state.
- Every safe planning, context, organization, and presentation action available to the agent must also have a visible human affordance. Account security and consequential external submissions remain human-controlled.
- Agents work through semantic application operations. Do not give them arbitrary source-code, SQL, filesystem, HTML, CSS, or JavaScript access as part of the product experience.
- The agent must search persistent workspace context before external research. Useful new research must be saved into a visible, editable workspace object with provenance.
- Treat information management at the UI layer as the central feature. Notes, sources, people, clubs, tasks, ideas, decisions, and scratch documents are first-class domain objects rather than chat residue.
- Preserve human control. Agents may propose and edit plans, but the challenge release must not enroll, submit, purchase, message, or perform another consequential external action.
- Do not present CourseContext as an official Stanford service or a replacement for academic advising.
- Show uncertainty, conflicts, and missing information explicitly.
- Recommendations must remain inspectable: include rationale, alternatives, affected constraints, and supporting evidence.

## Evidence and data rules

- Classify claims as `official`, `experiential`, `inferred`, or `user-provided`.
- Store source, retrieval time, and confidence for evidence used in a recommendation.
- Prefer current official university sources for requirements, policies, schedules, and deadlines.
- Never convert a historical offering pattern or model inference into an official fact.
- Do not scrape or automate authenticated Stanford systems for the challenge build.
- Do not collect Stanford credentials, student records, transcripts, or other private educational data.
- Use seeded or explicitly user-provided demo profiles. Never commit private student data.
- Respect source licenses, robots policies, rate limits, and attribution requirements.

## WebMCP engineering rules

- Expose semantic application operations such as `check_plan`, not generic controls such as `click_element`.
- Keep tool names stable, descriptions precise, inputs narrow, and JSON Schemas closed with `additionalProperties: false` where practical.
- Separate read-only tools from mutations and annotate them accurately.
- Return concise structured results with stable IDs, current state version, diagnostics, and enough evidence to verify success.
- Make mutations idempotent when practical and return an action receipt describing exactly what changed.
- Validate permissions and inputs inside the application. Never trust the invoking agent.
- Avoid returning the entire catalog or student context when a filtered result answers the request.
- Treat tool definitions, inputs, and external research content as untrusted.
- Provide deterministic checks for time conflicts, unit limits, duplicate courses, prerequisite edges, and source staleness.

## Interface and writing rules

- When working on Srivatsav's local machine, read `~/SRIVATSAV_MODEL_CONTEXT.md` if it is available before making material product, copy, or interface decisions. Never copy private profile content into this repository.
- When the local UPRound `startup-prediction/web` codebase is available, use it as a quality reference for deliberate hierarchy, flat surfaces, hairline structure, typography, responsive navigation, loading states, failure states, and plain-language copy. Do not copy the UPRound brand.
- The interface must feel intentionally designed for academic planning. It must not resemble a generic generated dashboard, chat wrapper, analytics template, or component-library demo.
- Reject any interface that reads as vibecoded. Every layout, label, state, and interaction must have a clear product reason.
- Use one restrained accent, neutral paper and ink surfaces, purposeful borders, limited elevation, and strong typographic hierarchy.
- Do not use purple gradients, decorative page gradients, glowing buttons, glassmorphism, excessive pills, arbitrary rounded cards, or decorative AI sparkles.
- Reserve pills for statuses, compact filters, and removable tokens. Use borders and whitespace for primary structure.
- Design desktop and mobile layouts intentionally. Do not treat mobile as a compressed desktop page.
- Provide polished loading, empty, partial-data, stale-data, permission, error, rollback, and success states for every major workflow.
- User-visible copy and product documentation must use concise, specific, natural language. Do not use em dashes or semicolons. Avoid generic startup slogans, canned AI language, and unnecessary technical terminology.
- Do not expose retrieval, embeddings, schemas, orchestration, model internals, or implementation jargon in ordinary student-facing copy.
- Agent attribution should be visible and plain, such as "Added by agent." Do not dramatize agent actions with magical language or effects.

## Engineering expectations

- Record a technology decision before introducing the application framework or material dependencies.
- Prefer a thin, typed vertical slice with seeded data over a broad ingestion platform.
- Give courses, requirements, evidence records, plans, and actions stable human-readable IDs.
- Test domain operations independently from the UI and WebMCP registration layer.
- Add tests for tool schemas, tool discovery, read operations, mutations, validation failures, action receipts, and rollback behavior.
- Add one browser-level happy path and one recovery path for the exact demo story.
- Keep secrets out of source control. Provide `.env.example` only if configuration becomes necessary.
- Put generated output, recordings, and temporary research under ignored directories unless intentionally committed as fixtures.
- Use focused commits without AI authorship trailers.

## Challenge definition of done

The project is not ready to submit until all of the following are true:

- the live URL is publicly accessible in ChatGPT's in-app browser.
- the WebMCP tools are discoverable and work against visible application state.
- the core demo completes without manual repair.
- the public repository contains source, setup instructions, and a visible open-source license.
- the README explains WebMCP leverage, user experience, joint human-agent capability, and implementation.
- the public demo video is under three minutes, includes audio, and demonstrates actual tool use.
- the submission text matches the verified product rather than planned capabilities.
- a final end-to-end verification has been run after the last production change.
